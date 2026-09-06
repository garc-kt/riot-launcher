import { LcuClient as RealLcuClient, normalizeMatchGame } from '@riot/lcu'
import type { SummonerData, MatchHistoryItem, GameflowPhase } from '../../types/index.ts'

export { normalizeMatchGame }

// Mock data generator for standalone development / tests
export const MOCK_SUMMONER: SummonerData = {
  accountId: 12345678,
  displayName: 'CompanionTester',
  gameName: 'CompanionTester',
  tagLine: 'NA1',
  internalName: 'companiontester',
  nameChangeFlag: false,
  percentCompleteForNextLevel: 45,
  privacy: 'PUBLIC',
  profileIconId: 4216,
  puuid: '00000000-0000-0000-0000-000000000001',
  rerollPoints: {
    currentPoints: 250,
    maxRolls: 2,
    numberOfRolls: 1,
    pointsCostToRoll: 250,
    pointsToReroll: 250,
  },
  summonerId: 98765432,
  summonerLevel: 142,
  xpSinceLastLevel: 1200,
  xpUntilNextLevel: 2800,
}

export const MOCK_MATCHES: MatchHistoryItem[] = [
  {
    gameId: 10001,
    gameCreation: Date.now() - 3600000,
    gameDuration: 1845,
    gameMode: 'CLASSIC',
    gameType: 'MATCHED_GAME',
    mapId: 11,
    queueId: 420,
    gameVersion: '14.17.1',
    participants: [
      {
        puuid: '00000000-0000-0000-0000-000000000001',
        summonerName: 'CompanionTester',
        championId: 103, // Ahri
        championName: 'Ahri',
        teamId: 100,
        win: true,
        kills: 8,
        deaths: 2,
        assists: 11,
        goldEarned: 14250,
        totalDamageDealtToChampions: 24800,
        totalMinionsKilled: 198,
        neutralMinionsKilled: 12,
        visionScore: 28,
        items: [6655, 3020, 4645, 3089, 3157, 1056, 3364],
        spell1Id: 4,
        spell2Id: 14,
      },
    ],
  },
  {
    gameId: 10002,
    gameCreation: Date.now() - 7200000,
    gameDuration: 1520,
    gameMode: 'CLASSIC',
    gameType: 'MATCHED_GAME',
    mapId: 11,
    queueId: 420,
    gameVersion: '14.17.1',
    participants: [
      {
        puuid: '00000000-0000-0000-0000-000000000001',
        summonerName: 'CompanionTester',
        championId: 238, // Zed
        championName: 'Zed',
        teamId: 100,
        win: false,
        kills: 6,
        deaths: 5,
        assists: 3,
        goldEarned: 11200,
        totalDamageDealtToChampions: 18400,
        totalMinionsKilled: 165,
        neutralMinionsKilled: 8,
        visionScore: 19,
        items: [3142, 3158, 6692, 3071, 0, 0, 3364],
        spell1Id: 4,
        spell2Id: 14,
      },
    ],
  },
]

/**
 * Thin wrapper over @riot/lcu's real client: serves mock data outside the
 * injected client, delegates everything else. The mock guard checks for
 * `window.__companion_context` — set only by this app's own init(context)
 * when actually loaded as a plugin — rather than sniffing the page's
 * origin string, which could in principle match inside the real client
 * too and silently serve fake data there.
 */
export class LcuClient {
  private real = new RealLcuClient()
  private get isMock() {
    return typeof window === 'undefined' || !(window as any).__companion_context
  }

  /** The underlying @riot/lcu client, for callers (e.g. the SGP service)
   * that need the real transport directly rather than this mock-aware wrapper. */
  get raw(): RealLcuClient {
    return this.real
  }

  bind(ctx: Parameters<RealLcuClient['bind']>[0]) {
    this.real.bind(ctx)
  }

  unbind() {
    this.real.unbind()
  }

  observe<T = any>(uri: string, cb: (data: T) => void | Promise<void>) {
    return this.real.observe(uri, cb)
  }

  async getGameVersion(): Promise<string> {
    if (this.isMock) return '14.17.1'
    return this.real.getGameVersion().catch(() => '14.17.1')
  }

  async getCurrentSummoner(): Promise<SummonerData> {
    if (this.isMock) return MOCK_SUMMONER
    return this.real.getCurrentSummoner() as unknown as Promise<SummonerData>
  }

  async getMatchHistory(puuid?: string): Promise<MatchHistoryItem[]> {
    if (this.isMock) return MOCK_MATCHES
    return this.real.getMatchHistory(puuid) as unknown as Promise<MatchHistoryItem[]>
  }

  async getGameflowPhase(): Promise<GameflowPhase> {
    if (this.isMock) return 'None'
    return this.real.getGameflowPhase() as unknown as Promise<GameflowPhase>
  }

  async getEntitlements(): Promise<{ token?: string; accessToken?: string }> {
    if (this.isMock) return { token: 'mock_token', accessToken: 'mock_access' }
    return this.real.getEntitlements()
  }
}

export const lcuClient = new LcuClient()
