/**
 * Cross-plugin module registration.
 *
 * The companion and a module-providing plugin (personal/snooze) load as two
 * independent Pengu plugins in the same page, each constructing its own
 * ModuleHost. Nothing connected them: snooze's modules ran headless and its
 * settings were unreachable, because the companion's Modules tab reads only
 * its own host — and the companion's built-in registry is empty by design
 * (see app/src/modules/registry.ts on the licensing split).
 *
 * The registry lives on globalThis and is created by whichever side touches it
 * first, so neither plugin has to load before the other — Pengu gives no
 * ordering guarantee between plugins.
 *
 * Hosts are held behind `getHost()` rather than by value because a source
 * usually registers during its own init(), before its host finishes wiring up.
 */

const REGISTRY_KEY = '__riotModuleSources'

/** Minimal shape the companion needs; avoids depending on ModuleHost itself. */
export interface ModuleHostLike {
  registry: unknown[]
  getModuleSetting?(moduleId: string, key: string, fallback?: unknown): unknown
  setModuleSetting?(moduleId: string, key: string, value: unknown): unknown
}

export interface ModuleSource {
  /** Stable id, used to de-duplicate re-registration across reloads. */
  id: string
  /** Shown as the group heading in the UI. */
  label: string
  /** Resolved lazily; may return null until the source finishes booting. */
  getHost: () => ModuleHostLike | null
}

interface GlobalWithRegistry {
  [REGISTRY_KEY]?: ModuleSource[]
}

function registry(): ModuleSource[] {
  const g = globalThis as GlobalWithRegistry
  if (!Array.isArray(g[REGISTRY_KEY])) {
    g[REGISTRY_KEY] = []
  }
  return g[REGISTRY_KEY]!
}

/**
 * Publish a module host so the companion can render its settings.
 * Re-registering the same id replaces the previous entry, so a plugin
 * reloaded in place doesn't show up twice.
 */
export function registerModuleSource(source: ModuleSource): void {
  const list = registry()
  const existing = list.findIndex(s => s.id === source.id)
  if (existing >= 0) {
    list[existing] = source
  } else {
    list.push(source)
  }
}

export function unregisterModuleSource(id: string): void {
  const list = registry()
  const index = list.findIndex(s => s.id === id)
  if (index >= 0) list.splice(index, 1)
}

/** Every registered source, in registration order. */
export function getModuleSources(): ModuleSource[] {
  return [...registry()]
}

/** Test seam — drops all registrations. */
export function clearModuleSources(): void {
  registry().length = 0
}
