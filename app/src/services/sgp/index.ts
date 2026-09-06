import { lcuClient } from '../lcu/client'
import type { SgpPlayerSummary, MatchHistoryItem } from '@/types'
import { z } from 'zod'

const SgpSummarySchema = z.object({
  puuid: z.string(),
  alias: z.string().optional(),
  rankedTier: z.string().optional(),
  rankedDivision: z.string().optional(),
  leaguePoints: z.number().optional(),
  wins: z.number().default(0),
  losses: z.number().default(0),
})

export const SGP_REGIONS: Record<string, string> = {
  NA1: 'https://na-blue-1.lol.sgp.pvp.net',
  EUW1: 'https://euw1-blue-1.lol.sgp.pvp.net',
  EUN1: 'https://eun1-blue-1.lol.sgp.pvp.net',
  KR: 'https://kr-blue-1.lol.sgp.pvp.net',
  BR1: 'https://br-blue-1.lol.sgp.pvp.net',
  LA1: 'https://la1-blue-1.lol.sgp.pvp.net',
  LA2: 'https://la2-blue-1.lol.sgp.pvp.net',
  OC1: 'https://oc1-blue-1.lol.sgp.pvp.net',
  TR1: 'https://tr1-blue-1.lol.sgp.pvp.net',
  RU: 'https://ru-blue-1.lol.sgp.pvp.net',
}

export class SgpService {
  private isBrowserOrMock = typeof window === 'undefined' || !window.location.origin.includes('riot:')

  async lookupPlayer(puuid: string, region = 'NA1'): Promise<SgpPlayerSummary> {
    if (this.isBrowserOrMock) {
      return {
        puuid,
        alias: puuid.includes('#') ? puuid : `Player_${puuid.slice(0, 6)}`,
        region,
        rankedTier: 'EMERALD',
        rankedDivision: 'II',
        leaguePoints: 54,
        wins: 48,
        losses: 39,
        recentMatches: [],
      }
    }

    try {
      const { accessToken } = await lcuClient.getEntitlements()
      const sgpBase = SGP_REGIONS[region.toUpperCase()] || SGP_REGIONS['NA1']
      const url = `${sgpBase}/match-history-query/v1/products/lol/player/${puuid}/SUMMARY`

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
      const parsed = SgpSummarySchema.safeParse(raw)

      return {
        puuid,
        alias: parsed.success ? (parsed.data.alias || `Summoner#${puuid.slice(0, 4)}`) : puuid,
        region,
        rankedTier: parsed.success ? parsed.data.rankedTier : 'UNRANKED',
        rankedDivision: parsed.success ? parsed.data.rankedDivision : '',
        leaguePoints: parsed.success ? parsed.data.leaguePoints : 0,
        wins: parsed.success ? parsed.data.wins : 0,
        losses: parsed.success ? parsed.data.losses : 0,
        recentMatches: [],
      }
    } catch (err) {
      console.warn(`SGP direct lookup failed for ${puuid}:`, err)
      // Fallback
      return {
        puuid,
        alias: `Player_${puuid.slice(0, 6)}`,
        region,
        wins: 0,
        losses: 0,
        recentMatches: [],
      }
    }
  }
}

export const sgpService = new SgpService()
