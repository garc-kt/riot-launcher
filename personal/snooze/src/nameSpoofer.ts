/**
 * Ported from Snooze Manager's modules/nameSpoofer.js
 * Original author: Lx - github@iIlusion
 * Additional contributions: SnoozeFest - github@ReformedDoge
 * Kept in personal/ workspace for personal use only under the project's licensing policy.
 *
 * Locally spoofs your displayed Riot ID by rewriting identity fields.
 * Cosmetic only: other players still see your real name.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import type { ModuleContext } from './types'

export interface SpooferConfig {
  enabled: boolean
  spoofSelf: boolean
  gameName: string
  tagLine: string
  friendName: string
  friendNumbers: boolean
  globalName: string
  globalNumbers: boolean
  spoofFriends: boolean
  spoofLobby: boolean
  spoofChampSelect: boolean
  spoofMatchHistory: boolean
}

let cfg: SpooferConfig = {
  enabled: false,
  spoofSelf: true,
  gameName: 'Name Spoofer',
  tagLine: 'Pengu',
  friendName: 'Friend',
  friendNumbers: true,
  globalName: 'Player',
  globalNumbers: true,
  spoofFriends: false,
  spoofLobby: false,
  spoofChampSelect: false,
  spoofMatchHistory: false,
}

let _hookCleanups: Array<() => void> = []
let _currentCtx: ModuleContext | null = null

const catMaps: Record<string, Record<string, number>> = {}
const catCount: Record<string, number> = {}

export function resetCategoryMaps() {
  for (const k of Object.keys(catMaps)) delete catMaps[k]
  for (const k of Object.keys(catCount)) delete catCount[k]
}

export function catLabel(category: 'friend' | 'player', key: string, config: SpooferConfig = cfg): string {
  const isFriend = category === 'friend'
  const base = isFriend ? config.friendName : config.globalName
  const useNum = isFriend ? config.friendNumbers : config.globalNumbers

  if (!useNum || !key) return base

  if (!catMaps[category]) catMaps[category] = {}
  if (!catCount[category]) catCount[category] = 0

  const m = catMaps[category]
  if (m[key] == null) {
    catCount[category]++
    m[key] = catCount[category]
  }

  return `${base} ${m[key]}`
}

export function spoofIdentity(
  raw: { gameName?: string; tagLine?: string; displayName?: string },
  config: SpooferConfig = cfg
) {
  if (!config.enabled) return raw

  const gameName = config.gameName || 'Name Spoofer'
  const tagLine = config.tagLine || 'Pengu'
  const displayName = `${gameName}#${tagLine}`

  return {
    ...raw,
    gameName,
    tagLine,
    displayName,
  }
}

export function isSpoofingActive(config: SpooferConfig, phase: string, isRanked = false): boolean {
  if (!config.enabled) return false
  if (phase === 'ChampSelect') {
    if (isRanked) return false
    return Boolean(config.spoofChampSelect)
  }
  if (phase === 'Lobby') {
    return Boolean(config.spoofLobby)
  }
  return true
}

export const nameSpooferModule: ModuleDescriptor = {
  id: 'nameSpoofer',
  name: () => 'Name Spoofer',
  description: () => 'Locally spoofs your displayed Riot ID and summoner name on your client (cosmetic only).',

  capabilities: {
    usesEmber: true,
  },

  settings: [
    {
      key: 'enabled',
      type: 'toggle',
      label: () => 'Enable Name Spoofer',
      description: () => 'Master switch for client-side local name spoofing (default off).',
      default: false,
    },
    {
      key: 'spoofSelf',
      type: 'toggle',
      label: () => 'Spoof Self',
      description: () => 'Spoof your own Riot ID everywhere in the client.',
      default: true,
    },
    {
      key: 'gameName',
      type: 'text',
      label: () => 'Spoofed Game Name',
      default: 'Name Spoofer',
    },
    {
      key: 'tagLine',
      type: 'text',
      label: () => 'Spoofed Tag Line',
      default: 'Pengu',
    },
    {
      key: 'friendName',
      type: 'text',
      label: () => 'Friend Alias Base',
      default: 'Friend',
    },
    {
      key: 'friendNumbers',
      type: 'toggle',
      label: () => 'Include Numbers for Friends',
      default: true,
    },
    {
      key: 'globalName',
      type: 'text',
      label: () => 'Other Players Alias Base',
      default: 'Player',
    },
    {
      key: 'globalNumbers',
      type: 'toggle',
      label: () => 'Include Numbers for Other Players',
      default: true,
    },
    {
      key: 'spoofFriends',
      type: 'toggle',
      label: () => 'Spoof Friends in Social Panel',
      default: false,
    },
    {
      key: 'spoofLobby',
      type: 'toggle',
      label: () => 'Spoof Names in Party Lobby',
      default: false,
    },
    {
      key: 'spoofChampSelect',
      type: 'toggle',
      label: () => 'Spoof Names in Champ Select (Normal Queues)',
      default: false,
    },
    {
      key: 'spoofMatchHistory',
      type: 'toggle',
      label: () => 'Spoof Names in Match History',
      default: false,
    },
  ],

  installEmberHooks(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    const ember = ctx?.ember || (typeof window !== 'undefined' ? (window as any).__riotEmberHook : null)
    if (!ember || typeof ember.registerRule !== 'function') return

    const HOOK_TARGETS = [
      'lol-social-roster-member',
      'parties-participant',
      'champion-select-player',
      'player-history-table-row',
    ]

    HOOK_TARGETS.forEach((target) => {
      const unreg = ember.registerRule({
        name: `name-spoofer-${target}-hook`,
        matcher: target,
        hookMethods: [
          {
            name: 'didInsertElement',
            callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
              original(...args)
              if (cfg.enabled && this.element) {
                this.element.setAttribute('data-sm-spoofed', 'true')
              }
            },
          },
          {
            name: 'willDestroyElement',
            callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
              if (this.element) {
                this.element.removeAttribute('data-sm-spoofed')
              }
              original(...args)
            },
          },
        ],
      })
      if (unreg) _hookCleanups.push(unreg)
    })
  },

  init(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    _currentCtx = ctx
    cfg = {
      enabled: ctx.store.get<boolean>('enabled', false),
      spoofSelf: ctx.store.get<boolean>('spoofSelf', true),
      gameName: ctx.store.get<string>('gameName', 'Name Spoofer'),
      tagLine: ctx.store.get<string>('tagLine', 'Pengu'),
      friendName: ctx.store.get<string>('friendName', 'Friend'),
      friendNumbers: ctx.store.get<boolean>('friendNumbers', true),
      globalName: ctx.store.get<string>('globalName', 'Player'),
      globalNumbers: ctx.store.get<boolean>('globalNumbers', true),
      spoofFriends: ctx.store.get<boolean>('spoofFriends', false),
      spoofLobby: ctx.store.get<boolean>('spoofLobby', false),
      spoofChampSelect: ctx.store.get<boolean>('spoofChampSelect', false),
      spoofMatchHistory: ctx.store.get<boolean>('spoofMatchHistory', false),
    }
  },

  load() {
    // Loaded
  },

  unload() {
    for (const cleanup of _hookCleanups) cleanup()
    _hookCleanups = []
    resetCategoryMaps()
    _currentCtx = null
  },

  onSettingChange(rawCtx: unknown, key: string, value: unknown) {
    if (key in cfg) {
      ;(cfg as any)[key] = value
    }
  },
}
