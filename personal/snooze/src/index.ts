/**
 * Snooze Personal — Tier 1 Ported Modules
 *
 * Attribution: Ported from Snooze Manager (github.com/ReformedDoge/Snooze-Manager)
 * Original author: SnoozeFest - github@ReformedDoge
 * Kept in personal/ workspace for personal use only under the project's licensing policy.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import { LcuClient } from '../../../packages/lcu/src/index.ts'
import { ModuleHost } from '../../../app/src/modules/host.ts'

const lcuClient = new LcuClient()
import type { PluginContext, ScopedStore } from '../../../app/src/types/index.ts'
import type { ModuleToast } from './types.ts'
import { useClientDuringGameModule } from './useClientDuringGame.ts'
import { champSelectQuitButtonModule } from './champSelectQuitButton.ts'
import { aramNocdModule } from './aramNocd.ts'
import { penaltyUISuppressModule } from './penaltyUISuppress.ts'
import { autoAcceptModule } from './autoAccept.ts'
import { arenaGodModule } from './arenaGod.ts'
import { customOnlineStatusModule } from './customOnlineStatus.ts'
import { autoHonorModule } from './autoHonor.ts'
import { snoozeBalanceTooltipModule } from './snoozeBalanceTooltip.ts'
import { modeSelectorTweaksModule } from './modeSelectorTweaks.ts'
import { profileTweaksModule } from './profileTweaks.ts'
import { socialPanelTweaksModule } from './socialPanelTweaks.ts'
import { autoQueueModule } from './autoQueue.ts'
import { clientWindowTweaksModule } from './clientWindowTweaks.ts'
import { autoLockChampionModule } from './autoLockChampion.ts'
import { gameAnalysisPopupModule } from './gameAnalysisPopup.ts'
import { whaleHelperModule } from './whaleHelper.ts'
import { nameSpooferModule } from './nameSpoofer.ts'

export {
  useClientDuringGameModule,
  champSelectQuitButtonModule,
  aramNocdModule,
  penaltyUISuppressModule,
  autoAcceptModule,
  arenaGodModule,
  customOnlineStatusModule,
  autoHonorModule,
  snoozeBalanceTooltipModule,
  modeSelectorTweaksModule,
  profileTweaksModule,
  socialPanelTweaksModule,
  autoQueueModule,
  clientWindowTweaksModule,
  autoLockChampionModule,
  gameAnalysisPopupModule,
  whaleHelperModule,
  nameSpooferModule,
}

export const TIER_1_MODULES: ModuleDescriptor[] = [
  useClientDuringGameModule,
  champSelectQuitButtonModule,
  aramNocdModule,
  penaltyUISuppressModule,
]

export const TIER_2_MODULES: ModuleDescriptor[] = [
  autoAcceptModule,
  arenaGodModule,
  customOnlineStatusModule,
  autoHonorModule,
]

export const TIER_3_MODULES: ModuleDescriptor[] = [
  snoozeBalanceTooltipModule,
  modeSelectorTweaksModule,
  profileTweaksModule,
  socialPanelTweaksModule,
]

export const TIER_4_MODULES: ModuleDescriptor[] = [
  autoQueueModule,
  clientWindowTweaksModule,
  autoLockChampionModule,
]

export const TIER_5_MODULES: ModuleDescriptor[] = [
  gameAnalysisPopupModule,
  whaleHelperModule,
  nameSpooferModule,
]

/**
 * Static registry of all 18 ported Snooze modules (Tiers 1, 2, 3, 4, & 5).
 */
export const MODULE_REGISTRY: ModuleDescriptor[] = [
  ...TIER_1_MODULES,
  ...TIER_2_MODULES,
  ...TIER_3_MODULES,
  ...TIER_4_MODULES,
  ...TIER_5_MODULES,
]

function createToast(): ModuleToast {
  const native = () => (typeof window !== 'undefined' ? (window as any).Toast : null)
  return {
    success: (msg) => native()?.success?.(msg),
    error: (msg) => native()?.error?.(msg) ?? console.error('[SnoozePersonal]', msg),
    info: (msg) => native()?.info?.(msg) ?? native()?.success?.(msg),
    warning: (msg) => native()?.warning?.(msg) ?? native()?.error?.(msg) ?? console.warn('[SnoozePersonal]', msg),
  }
}

function createMemoryStoreFallback(): ScopedStore {
  const map = new Map<string, unknown>()
  return {
    get: <T = any>(k: string, fb?: T) => (map.has(k) ? (map.get(k) as T) : fb),
    set: (k: string, v: unknown) => {
      map.set(k, v)
      return true
    },
    delete: (k: string) => map.delete(k),
    has: (k: string) => map.has(k),
    clear: () => map.clear(),
    entries: () => [...map.entries()] as [string, any][],
  }
}

let host: ModuleHost | null = null

export function getModuleHost(): ModuleHost | null {
  return host
}

/**
 * Plugin entry initialization for personal snooze plugin.
 */
export async function init(context: PluginContext) {
  lcuClient.bind(context)

  host = new ModuleHost({
    lcu: lcuClient.raw,
    store: context.ext?.store ?? createMemoryStoreFallback(),
    toast: createToast(),
    ember: context.ext?.ember ?? (typeof window !== 'undefined' ? (window as any).__riotEmberHook : undefined),
    net: context.ext?.net ?? (typeof window !== 'undefined' ? (window as any).__riotNetHook : undefined),
    fs: context.ext?.fs ? {
      write: (p: string, c: string) => context.ext!.fs.writeText(p, c).then(() => true).catch(() => false),
    } : undefined,
    log: (...args) => console.log('[SnoozePersonal]', ...args),
  })

  host.register(MODULE_REGISTRY)
  await host.initAll()

  lcuClient.raw.observe<string>('/lol-gameflow/v1/gameflow-phase', (phase) => {
    host?.onPhaseChange(phase as any)
  })

  return host
}

export async function load() {
  await host?.loadAll()
}

export async function unload() {
  await host?.unloadAll()
  host = null
}

export default {
  init,
  load,
  unload,
}
