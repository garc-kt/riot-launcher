/**
 * Ported and rewritten from Snooze Manager's modules/gameAnalysisPopup.js
 * Original author: SnoozeFest - github@ReformedDoge
 * Kept in personal/ workspace for personal use only under the project's licensing policy.
 *
 * Game analysis and rank lookup: calculates player division scores, team average ranks,
 * KDA/winrate statistics, and provides in-client analysis overlays.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import type { ModuleContext } from './types'

export const TIER_ORDER: Record<string, number> = {
  IRON: 1,
  BRONZE: 2,
  SILVER: 3,
  GOLD: 4,
  PLATINUM: 5,
  EMERALD: 6,
  DIAMOND: 7,
  MASTER: 8,
  GRANDMASTER: 9,
  CHALLENGER: 10,
}

export const DIV_ORDER: Record<string, number> = {
  I: 4,
  II: 3,
  III: 2,
  IV: 1,
}

export const RANK_COLORS: Record<string, string> = {
  IRON: '#7b7b7b',
  BRONZE: '#9c6445',
  SILVER: '#bfc5cb',
  GOLD: '#d6ab4d',
  PLATINUM: '#5c88c7',
  EMERALD: '#46a96a',
  DIAMOND: '#4f75b5',
  MASTER: '#9f5bda',
  GRANDMASTER: '#d64f4f',
  CHALLENGER: '#e58c2c',
}

export interface PlayerRankInfo {
  tier: string
  division: string
  lp: number
  isUnranked: boolean
}

let isEnabled = false
let _unloaded = false
let _lcuUnsubs: Array<() => void> = []
let _currentCtx: ModuleContext | null = null
const rankCache = new Map<string, PlayerRankInfo>()

export function formatTierName(tierName: string): string {
  if (!tierName) return 'Unranked'
  const t = tierName.trim().toUpperCase()
  return t.charAt(0) + t.slice(1).toLowerCase()
}

export function isHighEloTier(tier: string): boolean {
  return (TIER_ORDER[tier.toUpperCase()] || 0) >= 8
}

export function divisionScore(tier: string, division: string): number | null {
  const normTier = tier.toUpperCase()
  const tierVal = TIER_ORDER[normTier]
  if (!tierVal || tierVal >= 8) return null
  return (tierVal - 1) * 4 + (DIV_ORDER[division.toUpperCase()] || 1)
}

export function divisionScoreToLabel(score: number): string {
  const s = Math.round(score)
  const tierNames = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND']
  const divNames = ['IV', 'III', 'II', 'I']

  const clamped = Math.max(1, Math.min(28, s))
  const tierIdx = Math.floor((clamped - 1) / 4)
  const divIdx = (clamped - 1) % 4

  const tier = formatTierName(tierNames[tierIdx] || 'SILVER')
  const div = divNames[divIdx] || 'IV'
  return `${tier} ${div}`
}

export function computeTeamAvgLabel(ranks: Array<PlayerRankInfo | null | undefined>): string | null {
  const ranked = ranks.filter((r): r is PlayerRankInfo => Boolean(r && !r.isUnranked))
  if (ranked.length === 0) return null

  const highElo = ranked.filter((r) => isHighEloTier(r.tier))

  if (highElo.length === ranked.length && highElo.length > 0) {
    const avgLp = Math.round(highElo.reduce((s, r) => s + (r.lp || 0), 0) / highElo.length)
    const avgTierNum = Math.round(highElo.reduce((s, r) => s + (TIER_ORDER[r.tier.toUpperCase()] || 8), 0) / highElo.length)
    const tierName = avgTierNum >= 10 ? 'Challenger' : avgTierNum >= 9 ? 'Grandmaster' : 'Master'
    return `${tierName} ~${avgLp} LP`
  }

  const scores = ranked
    .map((r) => (isHighEloTier(r.tier) ? 28 : divisionScore(r.tier, r.division)))
    .filter((s): s is number => s !== null)

  if (scores.length === 0) return null
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
  return divisionScoreToLabel(avgScore)
}

export function getTierColor(tier: string): string {
  const norm = tier ? tier.trim().toUpperCase() : ''
  return RANK_COLORS[norm] || '#c8aa6e'
}

export async function fetchRankForPuuid(ctx: ModuleContext, puuid: string): Promise<PlayerRankInfo | null> {
  if (!puuid) return null
  if (rankCache.has(puuid)) return rankCache.get(puuid)!

  try {
    const data = await ctx.lcu.get<any>(`/lol-ranked/v1/ranked-stats/${puuid}`)
    const queue = data?.queueMap?.RANKED_SOLO_5x5 || data?.queueMap?.RANKED_FLEX_SR
    if (queue && queue.tier && queue.tier !== 'NONE' && queue.tier !== 'UNRANKED') {
      const info: PlayerRankInfo = {
        tier: queue.tier,
        division: queue.division && queue.division !== 'NA' ? queue.division : '',
        lp: queue.leaguePoints || 0,
        isUnranked: false,
      }
      rankCache.set(puuid, info)
      return info
    }
  } catch {}

  const unranked: PlayerRankInfo = { tier: 'UNRANKED', division: '', lp: 0, isUnranked: true }
  rankCache.set(puuid, unranked)
  return unranked
}

export function buildMatchAnalysisSummary(matches: Array<{ win: boolean; kills: number; deaths: number; assists: number; cs: number; gameDurationSeconds: number }>) {
  if (!matches || matches.length === 0) {
    return { games: 0, winRate: 0, avgKda: 0, csPerMin: 0 }
  }

  let wins = 0
  let totalKills = 0
  let totalDeaths = 0
  let totalAssists = 0
  let totalCs = 0
  let totalSeconds = 0

  for (const m of matches) {
    if (m.win) wins++
    totalKills += m.kills || 0
    totalDeaths += m.deaths || 0
    totalAssists += m.assists || 0
    totalCs += m.cs || 0
    totalSeconds += m.gameDurationSeconds || 0
  }

  const winRate = Math.round((wins / matches.length) * 100)
  const avgKda = totalDeaths === 0 ? totalKills + totalAssists : Number(((totalKills + totalAssists) / totalDeaths).toFixed(2))
  const csPerMin = totalSeconds > 0 ? Number((totalCs / (totalSeconds / 60)).toFixed(1)) : 0

  return {
    games: matches.length,
    winRate,
    avgKda,
    csPerMin,
  }
}

export const gameAnalysisPopupModule: ModuleDescriptor = {
  id: 'gameAnalysisPopup',
  name: () => 'Game Analysis & Rank Popup',
  description: () => 'Displays player ranks, division averages, recent match histories, and game analysis popup in champ select or during matches.',

  capabilities: {
    passive: 'active',
  },

  settings: [
    {
      key: 'enabled',
      type: 'toggle',
      label: () => 'Enable Game Analysis Popup',
      description: () => 'Master toggle for match analysis and rank statistics.',
      default: false,
    },
    {
      key: 'autoOpenChampSelect',
      type: 'toggle',
      label: () => 'Auto-open in Champion Select',
      description: () => 'Automatically display the analysis panel during champion select.',
      default: true,
    },
    {
      key: 'autoOpenInProgress',
      type: 'toggle',
      label: () => 'Auto-open during Active Game',
      description: () => 'Keep the analysis overlay active during match progression (passive policy: active).',
      default: false,
    },
    {
      key: 'includeAllQueues',
      type: 'toggle',
      label: () => 'Include All Queue Types',
      description: () => 'Show match stats across all game modes including custom and rotating game modes.',
      default: false,
    },
  ],

  init(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    _currentCtx = ctx
    _unloaded = false
    isEnabled = ctx.store.get<boolean>('enabled', false)
  },

  load() {
    if (!_currentCtx) return
    const ctx = _currentCtx
    _unloaded = false

    const unsubPhase = ctx.lcu.observe<string>('/lol-gameflow/v1/gameflow-phase', (phase) => {
      if (_unloaded || !isEnabled) return
      ctx.log(`Gameflow phase changed to ${phase}`)
    })
    _lcuUnsubs.push(unsubPhase)
  },

  unload() {
    _unloaded = true
    for (const unsub of _lcuUnsubs) unsub()
    _lcuUnsubs = []
    rankCache.clear()
    _currentCtx = null
  },

  onSettingChange(rawCtx: unknown, key: string, value: unknown) {
    if (key === 'enabled') {
      isEnabled = Boolean(value)
    }
  },
}
