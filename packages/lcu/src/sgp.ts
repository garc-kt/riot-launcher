import type { LcuClient } from './client.ts'
import { SgpSummarySchema } from './schemas.ts'

/**
 * SGP region routing table, ported from Snooze Manager's generalUtils.js
 * getSgpContext(). Two bases per region because match-history and
 * "common" (profile/ranked) data are served from different edge hosts —
 * collapsing them to one host (as the previous app-side table did, and
 * with the wrong `-blue-1` hostnames besides) breaks the request outright.
 */
const SGP_SERVERS: Record<string, { matchHistory: string; common: string }> = {
  TW2: { matchHistory: 'https://apse1-red.pp.sgp.pvp.net', common: 'https://tw2-red.lol.sgp.pvp.net' },
  SG2: { matchHistory: 'https://apse1-red.pp.sgp.pvp.net', common: 'https://sg2-red.lol.sgp.pvp.net' },
  PH2: { matchHistory: 'https://apse1-red.pp.sgp.pvp.net', common: 'https://ph2-red.lol.sgp.pvp.net' },
  VN2: { matchHistory: 'https://apse1-red.pp.sgp.pvp.net', common: 'https://vn2-red.lol.sgp.pvp.net' },
  TH2: { matchHistory: 'https://apse1-red.pp.sgp.pvp.net', common: 'https://th2-red.lol.sgp.pvp.net' },
  JP1: { matchHistory: 'https://apne1-red.pp.sgp.pvp.net', common: 'https://jp-red.lol.sgp.pvp.net' },
  KR: { matchHistory: 'https://apne1-red.pp.sgp.pvp.net', common: 'https://kr-red.lol.sgp.pvp.net' },
  NA1: { matchHistory: 'https://usw2-red.pp.sgp.pvp.net', common: 'https://na-red.lol.sgp.pvp.net' },
  BR1: { matchHistory: 'https://usw2-red.pp.sgp.pvp.net', common: 'https://br-red.lol.sgp.pvp.net' },
  LA1: { matchHistory: 'https://usw2-red.pp.sgp.pvp.net', common: 'https://lan-red.lol.sgp.pvp.net' },
  LA2: { matchHistory: 'https://usw2-red.pp.sgp.pvp.net', common: 'https://las-red.lol.sgp.pvp.net' },
  PBE: { matchHistory: 'https://usw2-red.pp.sgp.pvp.net', common: 'https://pbe-red.lol.sgp.pvp.net' },
  OC1: { matchHistory: 'https://apse1-red.pp.sgp.pvp.net', common: 'https://oce-red.lol.sgp.pvp.net' },
  EUW: { matchHistory: 'https://euc1-red.pp.sgp.pvp.net', common: 'https://euw-red.lol.sgp.pvp.net' },
  EUN1: { matchHistory: 'https://euc1-red.pp.sgp.pvp.net', common: 'https://eune-red.lol.sgp.pvp.net' },
  TR1: { matchHistory: 'https://euc1-red.pp.sgp.pvp.net', common: 'https://tr-red.lol.sgp.pvp.net' },
  RU: { matchHistory: 'https://euc1-red.pp.sgp.pvp.net', common: 'https://ru-red.lol.sgp.pvp.net' },
}

/** Region ids exposed for a UI picker — derived, not hand-maintained. */
export const SGP_REGIONS = Object.keys(SGP_SERVERS)

const REGION_ALIASES: Record<string, string> = {
  EUW1: 'EUW',
  NA: 'NA1',
  EUNE: 'EUN1',
  TR: 'TR1',
  JP: 'JP1',
  BR: 'BR1',
  OCE: 'OC1',
  LAN: 'LA1',
  LAS: 'LA2',
}

export interface SgpContext {
  accessToken?: string
  /** Alias for matchHistoryBase, kept for parity with older call sites. */
  sgpBase: string
  matchHistoryBase: string
  commonBase: string
  expiresAt: number
}

const contextCache = new Map<string, SgpContext>()
const contextInFlight = new Map<string, Promise<SgpContext>>()
const CONTEXT_TTL_MS = 5 * 60 * 1000

/**
 * Resolve the SGP endpoint pair for the current (or an overridden) region,
 * with the entitlements token needed to call them. Caches per region for
 * 5 minutes and dedupes concurrent callers onto one in-flight request —
 * ported from Snooze's getSgpContext, including the Tencent/.qq.com issuer
 * path (server-side SGP routing for the Chinese client is not in the
 * regular region table at all).
 */
export async function getSgpContext(lcu: LcuClient, overrideRegion?: string): Promise<SgpContext> {
  const cacheKey = overrideRegion || 'LOCAL'
  const now = Date.now()

  const cached = contextCache.get(cacheKey)
  if (cached && now < cached.expiresAt) return cached

  const inFlight = contextInFlight.get(cacheKey)
  if (inFlight) return inFlight

  const promise = (async (): Promise<SgpContext> => {
    const entToken = await lcu.get<{ accessToken?: string; issuer?: string }>('/entitlements/v1/token').catch(() => null)
    let serverCode = 'EUW'

    if (overrideRegion) {
      serverCode = overrideRegion.toUpperCase()
    } else {
      const regionLocale = await lcu.get<{ region?: string }>('/riotclient/region-locale').catch(() => null)
      if (regionLocale?.region) {
        serverCode = regionLocale.region.toUpperCase()
      } else if (entToken?.issuer) {
        const externalMatch = entToken.issuer.match(/https?:\/\/([a-z0-9]+)-[a-z0-9]+\.(?:lol\.)?sgp\.pvp\.net/)
        if (externalMatch) serverCode = externalMatch[1].toUpperCase()
      }
      serverCode = REGION_ALIASES[serverCode] || serverCode
    }

    let matchHistoryBase = ''
    let commonBase = ''

    const endpoints = SGP_SERVERS[serverCode]
    if (endpoints) {
      matchHistoryBase = endpoints.matchHistory
      commonBase = endpoints.common
    } else if (entToken?.issuer?.includes('.qq.com')) {
      const tencentMatch = entToken.issuer.match(/https?:\/\/([a-z0-9]+)(?:-[a-z0-9]+)*\.lol\.qq\.com/)
      if (tencentMatch) {
        const code = tencentMatch[1]
        const base = code.startsWith('hn') || code.startsWith('bgp')
          ? `https://${code}-k8s-sgp.lol.qq.com:21019`
          : `https://${code}-sgp.lol.qq.com:21019`
        matchHistoryBase = base
        commonBase = base
      }
    }

    if (!matchHistoryBase) matchHistoryBase = SGP_SERVERS.EUW.matchHistory
    if (!commonBase) commonBase = SGP_SERVERS.EUW.common

    const context: SgpContext = {
      accessToken: entToken?.accessToken,
      sgpBase: matchHistoryBase,
      matchHistoryBase,
      commonBase,
      expiresAt: now + CONTEXT_TTL_MS,
    }
    contextCache.set(cacheKey, context)
    return context
  })()

  contextInFlight.set(cacheKey, promise)
  try {
    return await promise
  } finally {
    contextInFlight.delete(cacheKey)
  }
}

export interface SgpPlayerSummary {
  puuid: string
  alias: string
  region: string
  rankedTier?: string
  rankedDivision?: string
  leaguePoints?: number
  wins: number
  losses: number
}

/**
 * Direct SGP player lookup — cross-player, works for any puuid the caller
 * already has (not just the local summoner). This is a policy-sensitive
 * capability (plan.md §6.1): callers should gate who can trigger it.
 * On any failure this throws rather than returning fabricated data — the
 * previous implementation's catch-and-return-fake-zeros silently lied to
 * the UI about the player having 0 wins/losses instead of surfacing the
 * lookup as failed.
 */
export async function lookupSgpPlayer(lcu: LcuClient, puuid: string, region = 'NA1'): Promise<SgpPlayerSummary> {
  const { accessToken, commonBase } = await getSgpContext(lcu, region)
  const url = `${commonBase}/match-history-query/v1/products/lol/player/${puuid}/SUMMARY`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`SGP query failed with status ${res.status}`)
  }

  const raw = await res.json()
  const parsed = SgpSummarySchema.parse(raw)

  return {
    puuid,
    alias: parsed.alias || `Summoner#${puuid.slice(0, 4)}`,
    region,
    rankedTier: parsed.rankedTier,
    rankedDivision: parsed.rankedDivision,
    leaguePoints: parsed.leaguePoints,
    wins: parsed.wins,
    losses: parsed.losses,
  }
}

/** Raw SGP match history for a player — ported from Snooze's getSgpMatchHistory. */
export async function getSgpMatchHistory(
  lcu: LcuClient,
  puuid: string,
  startIndex = 0,
  count = 20,
  tag = '',
  overrideRegion?: string
): Promise<unknown> {
  const { accessToken, sgpBase } = await getSgpContext(lcu, overrideRegion)

  let url = `${sgpBase}/match-history-query/v1/products/lol/player/${puuid}/SUMMARY?startIndex=${startIndex}&count=${count}`
  if (tag) url += `&tag=${tag}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'LeagueOfLegendsClient',
    },
  })
  if (!res.ok) throw new Error(`SGP match history request failed: HTTP ${res.status}`)
  return res.json()
}
