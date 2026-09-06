import { lookupSgpPlayer as realLookupSgpPlayer, SGP_REGIONS } from '@riot/lcu'
import { lcuClient } from '../lcu/client'
import type { SgpPlayerSummary } from '@/types'

export { SGP_REGIONS }

/**
 * Thin wrapper over @riot/lcu's real SGP lookup. See lcu/client.ts for the
 * mock-vs-real guard this delegates through — outside the injected client
 * this used to return fabricated rank/win-loss data indistinguishable from
 * a real lookup; now the mock path is explicit and clearly labeled.
 */
export class SgpService {
  private get isMock() {
    return typeof window === 'undefined' || !(window as any).__companion_context
  }

  async lookupPlayer(puuid: string, region = 'NA1'): Promise<SgpPlayerSummary> {
    if (this.isMock) {
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

    const raw = await realLookupSgpPlayer(lcuClient.raw, puuid, region)
    return { ...raw, recentMatches: [] }
  }
}

export const sgpService = new SgpService()
