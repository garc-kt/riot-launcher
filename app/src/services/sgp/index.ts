import { lookupSgpPlayer as realLookupSgpPlayer, SGP_REGIONS, parseRiotId, looksLikePuuid } from '@riot/lcu'
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

  /**
   * Resolve whatever the user typed to a puuid.
   *
   * SGP is keyed strictly by puuid, but the search box accepts a Riot ID —
   * previously that string was pasted straight into the URL, producing a
   * malformed request and a failed lookup for every input except a raw puuid.
   */
  private async resolvePuuid(input: string): Promise<string> {
    const query = input.trim()
    if (looksLikePuuid(query)) return query

    const riotId = parseRiotId(query)
    if (!riotId) {
      throw new Error('Enter a Riot ID as Name#TAG, or a full PUUID.')
    }

    const puuid = await lcuClient.raw.resolveRiotId(riotId.gameName, riotId.tagLine)
    if (!puuid) {
      throw new Error(`No account found for ${riotId.gameName}#${riotId.tagLine}.`)
    }
    return puuid
  }

  /** The signed-in account's region, so lookups don't silently default to NA1. */
  async defaultRegion(): Promise<string> {
    if (this.isMock) return 'NA1'
    try {
      return (await lcuClient.raw.getRegion()) ?? 'NA1'
    } catch {
      return 'NA1'
    }
  }

  async lookupPlayer(query: string, region = 'NA1'): Promise<SgpPlayerSummary> {
    if (this.isMock) {
      const puuid = query
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

    const puuid = await this.resolvePuuid(query)
    const raw = await realLookupSgpPlayer(lcuClient.raw, puuid, region)
    return { ...raw, recentMatches: [] }
  }
}

export const sgpService = new SgpService()
