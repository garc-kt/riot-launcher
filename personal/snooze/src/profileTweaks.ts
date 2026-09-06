/**
 * Ported from Snooze Manager's modules/profileTweaks.js
 * Original author: SnoozeFest - github@ReformedDoge
 * Kept in personal/ workspace for personal use only under the project's licensing policy.
 *
 * Profile customization utilities: remove banner/border, manage tokens, and unlock profile background.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import type { ModuleContext } from './types'

let isUnlockBackgroundEnabled = false
let _hookCleanups: Array<() => void> = []
let _inventoryHookInstalled = false
let _currentCtx: ModuleContext | null = null

const PURCHASE_DATE_WINDOW_YEARS = 10
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

function getRandomPastPurchaseDateMs(): number {
  const maxOffsetMs = Math.floor(PURCHASE_DATE_WINDOW_YEARS * MS_PER_YEAR)
  return Date.now() - Math.floor(Math.random() * maxOffsetMs)
}

export async function fetchProfileSummary(ctx: ModuleContext): Promise<any> {
  try {
    return await ctx.lcu.get<any>('/lol-challenges/v1/summary-player-data/local-player')
  } catch {
    return null
  }
}

export function getCurrentPreferences(summary: any) {
  const data = summary || {}
  let title = String(data.title?.itemId ?? (typeof data.title === 'string' ? data.title : (data.title?.itemId ?? '10100006')))
  if (title === '-1') title = ''
  const bannerAccent = data.bannerAccent ?? data.bannerId ?? '24'
  const crestBorder = data.crestBorder ?? data.crestId ?? '1'
  const prestigeCrestBorderLevel = data.prestigeCrestBorderLevel ?? 350
  let challengeIds: number[] = []

  if (Array.isArray(data.challengeIds) && data.challengeIds.length > 0) {
    challengeIds = data.challengeIds.slice(0, 3).map((id: any) => Number(id))
  } else if (Array.isArray(data.selectedChallengeIds) && data.selectedChallengeIds.length > 0) {
    challengeIds = data.selectedChallengeIds.slice(0, 3).map((id: any) => Number(id))
  } else if (data.selectedChallengesString) {
    challengeIds = data.selectedChallengesString
      .split(',')
      .filter(Boolean)
      .map((s: string) => Number(s.trim()))
      .slice(0, 3)
  }

  return {
    title,
    bannerAccent,
    crestBorder,
    prestigeCrestBorderLevel,
    challengeIds,
    raw: data,
  }
}

export async function removeBanner(ctx: ModuleContext): Promise<boolean> {
  try {
    const summary = await fetchProfileSummary(ctx)
    const prefs = getCurrentPreferences(summary)
    await ctx.lcu.post('/lol-challenges/v1/update-player-preferences', {
      title: prefs.title,
      bannerAccent: '2',
      crestBorder: prefs.crestBorder,
      prestigeCrestBorderLevel: prefs.prestigeCrestBorderLevel,
      challengeIds: prefs.challengeIds,
    })
    ctx.toast.success('Profile banner removed.')
    return true
  } catch (err: any) {
    ctx.toast.error(`Failed to remove banner: ${err?.message || 'LCU error'}`)
    return false
  }
}

export async function removeBorder(ctx: ModuleContext): Promise<boolean> {
  try {
    await ctx.lcu.put('/lol-regalia/v2/current-summoner/regalia', {
      preferredCrestType: 'prestige',
      preferredBannerType: 'blank',
      selectedPrestigeCrest: 22,
    })
    ctx.toast.success('Profile border removed.')
    return true
  } catch (err: any) {
    ctx.toast.error(`Failed to remove border: ${err?.message || 'LCU error'}`)
    return false
  }
}

export async function updatePlayerTokens(ctx: ModuleContext, tokenIds: Array<string | number>): Promise<boolean> {
  try {
    const chosenIds = tokenIds
      .map((t) => Number(String(t).trim()))
      .filter((n) => Number.isFinite(n) && n > 0)

    const summary = await fetchProfileSummary(ctx)
    const prefs = getCurrentPreferences(summary)
    await ctx.lcu.post('/lol-challenges/v1/update-player-preferences', {
      title: String(prefs.title),
      bannerAccent: prefs.bannerAccent,
      crestBorder: prefs.crestBorder,
      prestigeCrestBorderLevel: prefs.prestigeCrestBorderLevel,
      challengeIds: chosenIds,
    })
    ctx.toast.success('Profile tokens updated.')
    return true
  } catch (err: any) {
    ctx.toast.error(`Failed to update tokens: ${err?.message || 'LCU error'}`)
    return false
  }
}

async function installChampionInventoryHook(ctx: ModuleContext) {
  if (_inventoryHookInstalled) return
  const net = ctx.net || (typeof window !== 'undefined' ? (window as any).__riotNetHook : null)
  if (!net || typeof net.hookXhrRes !== 'function') return

  try {
    const summonerSummary = await ctx.lcu.get<any>('/lol-summoner/v1/current-summoner').catch(() => null)
    if (!summonerSummary) return
    const summonerId = summonerSummary.summonerId || summonerSummary.summonerIdStr || summonerSummary.id
    if (!summonerId) return

    const inventoryEndpointPattern = new RegExp(`/lol-champions/v1/inventories/${summonerId}/champions`)
    const unreg = net.hookXhrRes(inventoryEndpointPattern, (_method: string, _url: string, xhr: any, responseText: string) => {
      if (!ctx.store.get<boolean>('unlockProfileBackground', false)) return responseText
      try {
        let inventoryItems = JSON.parse(responseText)
        const fakePurchaseDateMs = getRandomPastPurchaseDateMs()
        if (Array.isArray(inventoryItems)) {
          inventoryItems.forEach((championEntry: any) => {
            try {
              if (championEntry.ownership && championEntry.ownership.rental) {
                championEntry.ownership.owned = true
                championEntry.ownership.rental.purchaseDate = fakePurchaseDateMs
                championEntry.purchased = fakePurchaseDateMs
              }
              if (Array.isArray(championEntry.skins)) {
                championEntry.skins.forEach((skinEntry: any) => {
                  try {
                    if (!skinEntry.ownership) skinEntry.ownership = {}
                    skinEntry.ownership.owned = true
                    if (skinEntry.questSkinInfo && Array.isArray(skinEntry.questSkinInfo.tiers)) {
                      skinEntry.questSkinInfo.tiers.forEach((tierEntry: any) => {
                        try {
                          if (tierEntry && tierEntry.ownership) tierEntry.ownership.owned = true
                        } catch {}
                      })
                    }
                  } catch {}
                })
              }
            } catch {}
          })
          const patchedJson = JSON.stringify(inventoryItems)
          if (xhr) {
            try {
              Object.defineProperty(xhr, 'responseText', { writable: true, value: patchedJson })
              if (xhr.responseType === '' || xhr.responseType === 'text') {
                Object.defineProperty(xhr, 'response', { writable: true, value: patchedJson })
              }
            } catch {}
          }
          return patchedJson
        }
        return responseText
      } catch {
        return responseText
      }
    })

    if (unreg) {
      _hookCleanups.push(unreg)
      _inventoryHookInstalled = true
    }
  } catch (err) {
    ctx.log('[ProfileTweaks] Failed to install inventory hook:', err)
  }
}

export const profileTweaksModule: ModuleDescriptor = {
  id: 'profileTweaks',
  name: () => 'Profile Tweaks',
  description: () => 'Remove profile banner/border, customize token preferences, and unlock profile background.',

  settings: [
    {
      key: 'unlockProfileBackground',
      type: 'toggle',
      label: () => 'Unlock Profile Background',
      default: false,
    },
    {
      key: 'tokenSlot1',
      type: 'text',
      label: () => 'Token Slot 1 (ID)',
      default: '',
    },
    {
      key: 'tokenSlot2',
      type: 'text',
      label: () => 'Token Slot 2 (ID)',
      default: '',
    },
    {
      key: 'tokenSlot3',
      type: 'text',
      label: () => 'Token Slot 3 (ID)',
      default: '',
    },
  ],

  capabilities: {},

  init(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    _currentCtx = ctx
    isUnlockBackgroundEnabled = ctx.store.get<boolean>('unlockProfileBackground', false)
    if (isUnlockBackgroundEnabled) {
      installChampionInventoryHook(ctx).catch(() => {})
    }
  },

  async load() {
    if (_currentCtx && isUnlockBackgroundEnabled) {
      await installChampionInventoryHook(_currentCtx)
    }
  },

  unload() {
    for (const cleanup of _hookCleanups) cleanup()
    _hookCleanups = []
    _inventoryHookInstalled = false
    _currentCtx = null
  },

  async onSettingChange(rawCtx: unknown, key: string, value: unknown) {
    const ctx = (rawCtx as ModuleContext) || _currentCtx
    if (key === 'unlockProfileBackground') {
      isUnlockBackgroundEnabled = Boolean(value)
      if (isUnlockBackgroundEnabled && ctx) {
        await installChampionInventoryHook(ctx)
      }
    } else if ((key === 'tokenSlot1' || key === 'tokenSlot2' || key === 'tokenSlot3') && ctx) {
      const s1 = ctx.store.get<string>('tokenSlot1', '')
      const s2 = ctx.store.get<string>('tokenSlot2', '')
      const s3 = ctx.store.get<string>('tokenSlot3', '')
      const tokens = [s1, s2, s3].filter(Boolean)
      if (tokens.length > 0) {
        await updatePlayerTokens(ctx, tokens)
      }
    }
  },
}
