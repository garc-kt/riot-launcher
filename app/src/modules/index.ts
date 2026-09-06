import { lcuClient } from '@/services/lcu/client'
import type { PluginContext, ScopedStore } from '@/types'
import { ModuleHost } from './host'
import { MODULE_REGISTRY } from './registry'
import type { ModuleToast } from './types'

/** Falls back gracefully if window.Toast doesn't yet have info/warning —
 *  those land on window.Toast in the same phase that ships ctx.ext.ember. */
function createToast(): ModuleToast {
  const native = () => (window as any).Toast
  return {
    success: (msg) => native()?.success?.(msg),
    error: (msg) => native()?.error?.(msg) ?? console.error('[Companion]', msg),
    info: (msg) => native()?.info?.(msg) ?? native()?.success?.(msg),
    warning: (msg) => native()?.warning?.(msg) ?? native()?.error?.(msg) ?? console.warn('[Companion]', msg),
  }
}

let host: ModuleHost | null = null

export function getModuleHost(): ModuleHost | null {
  return host
}

/** Wires the module kernel to a real plugin context. Runs independently
 *  of whether the Vue UI ever mounts — a module like useClientDuringGame
 *  must keep working even if the user never opens the companion panel. */
export async function bootstrapModules(context: PluginContext) {
  if (!context.ext?.store) {
    console.warn('[ModuleHost] context.ext.store unavailable — modules will not persist settings.')
  }

  host = new ModuleHost({
    lcu: lcuClient.raw,
    store: context.ext?.store ?? createMemoryStoreFallback(),
    toast: createToast(),
    ember: context.ext?.ember ?? (typeof window !== 'undefined' ? (window as any).__riotEmberHook : undefined),
    net: context.ext?.net ?? (typeof window !== 'undefined' ? (window as any).__riotNetHook : undefined),
    fs: context.ext?.fs ? {
      write: (p: string, c: string) => context.ext!.fs.writeText(p, c).then(() => true).catch(() => false),
    } : undefined,
    log: (...args) => console.log(...args),
  })

  host.register(MODULE_REGISTRY)
  await host.initAll()

  // The module host's own phase feed — independent of useUiStore, and free
  // (no extra WAMP subscription) because LcuClient.observe() fans one real
  // subscription per URI out to every caller, this one included.
  lcuClient.raw.observe<string>('/lol-gameflow/v1/gameflow-phase', (phase) => {
    host?.onPhaseChange(phase as any)
  })

  return host
}

export async function loadModules() {
  await host?.loadAll()
}

function createMemoryStoreFallback(): ScopedStore {
  const map = new Map<string, unknown>()
  return {
    get: <T = any>(k: string, fb?: T) => (map.has(k) ? (map.get(k) as T) : fb),
    set: (k: string, v: unknown) => { map.set(k, v); return true },
    delete: (k: string) => map.delete(k),
    has: (k: string) => map.has(k),
    clear: () => map.clear(),
    entries: () => [...map.entries()] as [string, any][],
  }
}
