/**
 * Ported from Snooze Manager's modules/whaleHelper.js
 * Original author: SnoozeFest - github@ReformedDoge
 * Kept in personal/ workspace for personal use only under the project's licensing policy.
 *
 * Whale Helper: Rerollable loot pool tracker, drop chance calculations, skin tier badges
 * in champion select, unowned skin filtering, and skin randomizer.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import type { ModuleContext } from './types'

export const SKIN_TIER_COLORS: Record<string, string> = {
  kUltimate: '#e58c2c',
  kMythic: '#9f5bda',
  kLegendary: '#d64f4f',
  kEpic: '#46a96a',
  kRare: '#5c88c7',
  kStandard: '#bfc5cb',
}

export const CLASSIC_RARITIES = new Set(['kNoRarity', 'kDefault', 'kRare', 'kLegacy', ''])

let isLootEnabled = true
let isSkinTierEnabled = true
let isDropOddsEnabled = true
let isHideUnownedEnabled = false
let isSkinRandomizerEnabled = false

let _hookCleanups: Array<() => void> = []
let _currentCtx: ModuleContext | null = null

export function getSkinRarityColor(rarity: string): string {
  return SKIN_TIER_COLORS[rarity] || '#a09b8c'
}

export function getSkinRarityBadge(rarity: string): { label: string; color: string; isClassic: boolean } {
  const isClassic = CLASSIC_RARITIES.has(rarity)
  const clean = rarity.replace(/^k/, '')
  return {
    label: clean || 'Standard',
    color: getSkinRarityColor(rarity),
    isClassic,
  }
}

export function pickRandomSkin(ownedSkinIds: number[], blacklist: Set<number> = new Set()): number | null {
  const candidates = ownedSkinIds.filter((id) => !blacklist.has(id))
  if (candidates.length === 0) return null
  const idx = Math.floor(Math.random() * candidates.length)
  return candidates[idx]
}

export function filterUnownedSkins<T extends { id: number; owned: boolean }>(skins: T[], hideUnowned: boolean): T[] {
  if (!hideUnowned) return skins
  return skins.filter((s) => s.owned)
}

export function calculateLootPoolStats(items: Array<{ id: number; owned: boolean; rarity?: string }>) {
  const total = items.length
  const owned = items.filter((i) => i.owned).length
  const unowned = total - owned
  const percentOwned = total > 0 ? Number(((owned / total) * 100).toFixed(1)) : 100.0

  return {
    total,
    owned,
    unowned,
    percentOwned,
  }
}

export const whaleHelperModule: ModuleDescriptor = {
  id: 'whaleHelper',
  name: () => 'Whale Helper & Loot Tools',
  description: () => 'Rerollable pool viewer on loot page, skin tier badges, unowned skin filter, and skin randomizer in champ select.',

  capabilities: {
    usesEmber: true,
  },

  settings: [
    {
      key: 'lootHelperEnabled',
      type: 'toggle',
      label: () => 'Enable Loot Pool Tracker',
      description: () => 'Show rerollable pool statistics and unowned item viewer in the Loot tab.',
      default: true,
    },
    {
      key: 'skinTierEnabled',
      type: 'toggle',
      label: () => 'Show Skin Tier Badges',
      description: () => 'Display rarity tier badges (Ultimate, Mythic, Legendary, Epic) in champion select.',
      default: true,
    },
    {
      key: 'dropOddsEnabled',
      type: 'toggle',
      label: () => 'Show Chest Drop Odds',
      description: () => 'Display drop rate probability breakdown for Hextech and Masterwork chests.',
      default: true,
    },
    {
      key: 'hideUnownedSkins',
      type: 'toggle',
      label: () => 'Hide Unowned Skins in Champ Select',
      description: () => 'Declutter the skin carousel to only show skins and chromas you currently own.',
      default: false,
    },
    {
      key: 'skinRandomizer',
      type: 'toggle',
      label: () => 'Enable Skin Randomizer',
      description: () => 'Add a button in champion select to pick a random owned skin.',
      default: false,
    },
  ],

  installEmberHooks(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    const ember = ctx?.ember || (typeof window !== 'undefined' ? (window as any).__riotEmberHook : null)
    if (!ember || typeof ember.registerRule !== 'function') return

    const unreg = ember.registerRule({
      name: 'sm-whale-helper-skin-picker',
      matcher: 'champion-select',
      hookMethods: [
        {
          name: 'didInsertElement',
          callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
            original(...args)
            if (isSkinTierEnabled && this.element) {
              this.element.setAttribute('data-sm-whale-helper', 'active')
            }
          },
        },
        {
          name: 'willDestroyElement',
          callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
            if (this.element) {
              this.element.removeAttribute('data-sm-whale-helper')
            }
            original(...args)
          },
        },
      ],
    })

    if (unreg) _hookCleanups.push(unreg)
  },

  init(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    _currentCtx = ctx
    isLootEnabled = ctx.store.get<boolean>('lootHelperEnabled', true)
    isSkinTierEnabled = ctx.store.get<boolean>('skinTierEnabled', true)
    isDropOddsEnabled = ctx.store.get<boolean>('dropOddsEnabled', true)
    isHideUnownedEnabled = ctx.store.get<boolean>('hideUnownedSkins', false)
    isSkinRandomizerEnabled = ctx.store.get<boolean>('skinRandomizer', false)
  },

  load() {
    // Loaded state
  },

  unload() {
    for (const cleanup of _hookCleanups) cleanup()
    _hookCleanups = []
    _currentCtx = null
  },

  onSettingChange(rawCtx: unknown, key: string, value: unknown) {
    const b = Boolean(value)
    if (key === 'lootHelperEnabled') isLootEnabled = b
    if (key === 'skinTierEnabled') isSkinTierEnabled = b
    if (key === 'dropOddsEnabled') isDropOddsEnabled = b
    if (key === 'hideUnownedSkins') isHideUnownedEnabled = b
    if (key === 'skinRandomizer') isSkinRandomizerEnabled = b
  },
}
