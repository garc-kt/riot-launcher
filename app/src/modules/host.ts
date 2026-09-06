import { LcuClient } from '@riot/lcu'
import {
  validateModuleDescriptor,
  validateAutoActsRegisterPanic,
  migrateSnoozeStore,
  serializeModuleSchema,
  type ModuleDescriptor,
  type DataStoreReader,
} from '@riot/contracts'
import type { ScopedStore, GameflowPhase } from '@/types'
import type { ModuleContext, ModuleToast } from './types'

const STORE_KEY_PREFIX = 'modules:'
const MIGRATION_FLAG_KEY = 'modules:__migrated_v2'
const CRASH_LIMIT = 3

function moduleStoreKey(moduleId: string, key: string) {
  return `${STORE_KEY_PREFIX}${moduleId}:${key}`
}

/** Scopes a real ScopedStore to one module's keys, so module code never
 *  needs to know its own id. */
function createModuleStore(real: ScopedStore, moduleId: string): ScopedStore {
  return {
    get: (key, fallback) => real.get(moduleStoreKey(moduleId, key), fallback),
    set: (key, value) => real.set(moduleStoreKey(moduleId, key), value),
    delete: (key) => real.delete(moduleStoreKey(moduleId, key)),
    has: (key) => real.has(moduleStoreKey(moduleId, key)),
    clear: () => {
      const prefix = moduleStoreKey(moduleId, '')
      for (const [key] of real.entries()) {
        if (key.startsWith(prefix)) real.delete(key)
      }
    },
    entries: () => {
      const prefix = moduleStoreKey(moduleId, '')
      return real.entries()
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => [key.slice(prefix.length), value])
    },
  }
}

/** Wraps window.DataStore (or an equivalent) as the reader migrateSnoozeStore
 *  expects — kept here, not in @riot/contracts, since it touches `window`. */
function createLegacyDataStoreReader(): DataStoreReader | null {
  const legacy = typeof window !== 'undefined' ? (window as any).DataStore : null
  if (!legacy) return null
  return { has: (k) => legacy.has(k), get: (k, fb) => legacy.get(k, fb) }
}

/** One-time: pull a Snooze Manager user's settings out of the legacy
 *  global DataStore into this module host's own scoped-store keys, if
 *  they haven't been migrated yet. Never deletes the legacy keys. */
function runLegacyMigrationIfNeeded(store: ScopedStore, log: (...a: unknown[]) => void) {
  if (store.get(MIGRATION_FLAG_KEY)) return

  const reader = createLegacyDataStoreReader()
  if (!reader) return

  const result = migrateSnoozeStore(reader)
  if (result.migratedFieldCount > 0) {
    for (const [moduleId, fields] of Object.entries(result.store.modules)) {
      for (const [key, value] of Object.entries(fields)) {
        store.set(moduleStoreKey(moduleId, key), value)
      }
    }
    log(`[ModuleHost] Migrated ${result.migratedFieldCount} legacy setting(s) (${result.legacyKeyCount} from sm:* keys).`)
  }
  for (const w of result.warnings) log('[ModuleHost] migration warning:', w)
  store.set(MIGRATION_FLAG_KEY, true)
}

interface ModuleRuntimeState {
  initialized: boolean
  loaded: boolean
  crashCount: number
  disabled: boolean
}

export interface ModuleHostDeps {
  lcu: LcuClient
  store: ScopedStore
  toast: ModuleToast
  ember?: any
  net?: any
  fs?: { write: (path: string, content: string) => Promise<boolean> | boolean }
  log?: (...args: unknown[]) => void
}

/**
 * Runs a static registry of EffectModules. Improvements over Snooze's own
 * runner (index.js:1771): crash-disable after repeated throws, a single
 * shared phase getter instead of nine independent gameflow subscriptions,
 * and enforced reverse-order teardown.
 */
export class ModuleHost {
  private modules: ModuleDescriptor[] = []
  private states = new Map<string, ModuleRuntimeState>()
  private panicRegistrations = new Set<string>()
  private panicCancels = new Map<string, Set<() => void>>()
  private currentPhase: GameflowPhase = 'None'
  private deps: ModuleHostDeps

  constructor(deps: ModuleHostDeps) {
    this.deps = deps
  }

  /** Validates the whole registry statically before anything runs — a
   *  broken descriptor is a build-time/startup problem, not a runtime one. */
  register(modules: ModuleDescriptor[]) {
    const errors: string[] = []
    for (const mod of modules) errors.push(...validateModuleDescriptor(mod))
    if (errors.length > 0) {
      throw new Error(`ModuleHost: invalid module registry:\n${errors.join('\n')}`)
    }
    this.modules = modules
    for (const mod of modules) {
      this.states.set(mod.id, { initialized: false, loaded: false, crashCount: 0, disabled: false })
    }
  }

  private log(...args: unknown[]) {
    (this.deps.log || console.log)(...args)
  }

  private buildContext(moduleId: string): ModuleContext {
    return {
      lcu: this.deps.lcu,
      store: createModuleStore(this.deps.store, moduleId),
      toast: this.deps.toast,
      panic: {
        register: (cancel: () => void) => {
          this.panicRegistrations.add(moduleId)
          if (!this.panicCancels.has(moduleId)) this.panicCancels.set(moduleId, new Set())
          this.panicCancels.get(moduleId)!.add(cancel)
          return () => this.panicCancels.get(moduleId)?.delete(cancel)
        },
      },
      ember: this.deps.ember ?? (typeof window !== 'undefined' ? (window as any).__riotEmberHook : undefined),
      net: this.deps.net ?? (typeof window !== 'undefined' ? (window as any).__riotNetHook : undefined),
      log: (...args: unknown[]) => this.log(`[${moduleId}]`, ...args),
      phase: () => this.currentPhase,
    }
  }

  private async guard(moduleId: string, fn: () => void | Promise<void>) {
    const state = this.states.get(moduleId)
    if (!state || state.disabled) return
    try {
      await fn()
    } catch (err) {
      state.crashCount++
      this.log(`[ModuleHost] ${moduleId} threw (${state.crashCount}/${CRASH_LIMIT}):`, err)
      if (state.crashCount >= CRASH_LIMIT) {
        state.disabled = true
        this.deps.toast.warning(`A module (${moduleId}) crashed repeatedly and was disabled.`)
        await this.unloadOne(moduleId).catch(() => {})
      }
    }
  }

  async initAll() {
    runLegacyMigrationIfNeeded(this.deps.store, (...a) => this.log(...a))

    // 1. Synchronously install Ember hooks across all modules before any init()
    for (const mod of this.modules) {
      if (mod.installEmberHooks) {
        const ctx = this.buildContext(mod.id)
        try {
          mod.installEmberHooks(ctx)
        } catch (err) {
          this.log(`[ModuleHost] ${mod.id} installEmberHooks() threw:`, err)
        }
      }
    }

    // 2. Initialize all modules
    for (const mod of this.modules) {
      const state = this.states.get(mod.id)
      if (!state || state.disabled) continue
      const ctx = this.buildContext(mod.id)
      await this.guard(mod.id, async () => {
        await mod.init(ctx)
        state.initialized = true
      })
    }

    // 3. Verify autoActs => panic.register invariant after init
    const panicErrors = validateAutoActsRegisterPanic(this.modules, this.panicRegistrations)
    if (panicErrors.length > 0) {
      throw new Error(`ModuleHost: panic registration invariant failed:\n${panicErrors.join('\n')}`)
    }

    // 4. Publish module settings schemas for external renderers (Phase 13)
    await this.publishSchemas().catch((err) => {
      this.log('[ModuleHost] publishSchemas threw:', err)
    })
  }

  /**
   * Publishes declarative module schemas to plugins_data/<id>.schema.json
   * for consumption by the desktop loader (Phase 13).
   */
  async publishSchemas(writer?: { write: (path: string, content: string) => Promise<boolean> | boolean }) {
    const fs = writer || this.deps.fs
    if (!fs || typeof fs.write !== 'function') return

    for (const mod of this.modules) {
      if (mod.settings && mod.settings.length > 0) {
        const serialized = serializeModuleSchema(mod)
        await fs.write(`${mod.id}.schema.json`, JSON.stringify(serialized, null, 2))
      }
    }
  }

  async loadAll() {
    for (const mod of this.modules) {
      const state = this.states.get(mod.id)
      if (!state || state.disabled || !state.initialized) continue
      await this.guard(mod.id, async () => {
        if (mod.load) await mod.load()
        state.loaded = true
      })
    }
  }

  private async unloadOne(moduleId: string) {
    const mod = this.modules.find(m => m.id === moduleId)
    const state = this.states.get(moduleId)
    if (!mod || !state || (!state.loaded && !state.initialized)) return
    await mod.unload()
    state.loaded = false
    state.initialized = false
    for (const cancel of this.panicCancels.get(moduleId) || []) cancel()
    this.panicCancels.delete(moduleId)
  }

  /** Reverse registration order, matching Snooze's own teardown order. */
  async unloadAll() {
    for (const mod of [...this.modules].reverse()) {
      await this.guard(mod.id, () => this.unloadOne(mod.id))
    }
  }

  /** Cancel every pending auto-action across every module (the panic
   *  hotkey), without tearing modules down. */
  panicAll() {
    for (const cancels of this.panicCancels.values()) {
      for (const cancel of cancels) cancel()
    }
  }

  /**
   * Feed phase changes from the app's single shared gameflow subscription
   * (useUiStore, via useLcuEvent in App.vue) — the host does not open a
   * second one. 'strict' modules are unloaded on InProgress and reloaded
   * on leaving it; 'passive-dom'/'active' modules keep running and are
   * expected to manage their own phase-awareness via ctx.lcu.observe.
   */
  async onPhaseChange(phase: GameflowPhase) {
    const wasInProgress = this.currentPhase === 'InProgress'
    const isInProgress = phase === 'InProgress'
    this.currentPhase = phase

    if (wasInProgress === isInProgress) return

    for (const mod of this.modules) {
      const state = this.states.get(mod.id)
      if (!state || state.disabled) continue
      const policy = mod.capabilities?.passive ?? 'strict'
      if (policy !== 'strict') continue

      if (isInProgress) {
        await this.guard(mod.id, () => this.unloadOne(mod.id))
      } else if (!state.loaded || !state.initialized) {
        const ctx = this.buildContext(mod.id)
        await this.guard(mod.id, async () => {
          if (mod.installEmberHooks) {
            try {
              mod.installEmberHooks(ctx)
            } catch (err) {
              this.log(`[ModuleHost] ${mod.id} installEmberHooks() threw:`, err)
            }
          }
          await mod.init(ctx)
          state.initialized = true
          if (mod.load) await mod.load()
          state.loaded = true
        })
      }
    }
  }

  getState(moduleId: string): Readonly<ModuleRuntimeState> | undefined {
    return this.states.get(moduleId)
  }

  /** What the settings UI calls when the user changes a field: persists
   *  through the module's own scoped store, then gives the module a chance
   *  to react immediately (see ModuleDescriptor.onSettingChange). */
  async setModuleSetting(moduleId: string, key: string, value: unknown) {
    const mod = this.modules.find(m => m.id === moduleId)
    const state = this.states.get(moduleId)
    if (!mod || !state || state.disabled) return

    const ctx = this.buildContext(moduleId)
    ctx.store.set(key, value)

    if (mod.onSettingChange) {
      await this.guard(moduleId, () => mod.onSettingChange!(ctx, key, value))
    }
  }

  getModuleSetting<T = unknown>(moduleId: string, key: string, fallback?: T): T | undefined {
    return this.buildContext(moduleId).store.get<T>(key, fallback)
  }

  get registry(): readonly ModuleDescriptor[] {
    return this.modules
  }
}
