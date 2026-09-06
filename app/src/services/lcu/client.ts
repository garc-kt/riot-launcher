import { ENDPOINTS } from './endpoints.ts'
import {
  SummonerSchema,
  MatchHistoryItemSchema,
  GameVersionSchema,
  GameflowPhaseSchema,
} from './schemas.ts'
import type { SummonerData, MatchHistoryItem, GameflowPhase } from '../../types/index.ts'

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

export function normalizeMatchGame(game: any): any {
  if (!game) return game

  if (Array.isArray(game.participants) && game.participants.length > 0 && 'kills' in game.participants[0]) {
    return game
  }

  const identities = new Map<number, any>()
  if (Array.isArray(game.participantIdentities)) {
    for (const identity of game.participantIdentities) {
      if (identity && identity.participantId) {
        identities.set(identity.participantId, identity.player || {})
      }
    }
  }

  const rawParticipants = Array.isArray(game.participants) ? game.participants : []
  const normalizedParticipants = rawParticipants.map((p: any) => {
    const player = identities.get(p.participantId) || {}
    const stats = p.stats || {}
    const items = [
      stats.item0,
      stats.item1,
      stats.item2,
      stats.item3,
      stats.item4,
      stats.item5,
      stats.item6,
    ].filter((it) => typeof it === 'number')

    return {
      puuid: p.puuid || player.puuid || '',
      summonerName: player.summonerName || player.gameName || p.summonerName || '',
      riotIdGameName: player.gameName || p.riotIdGameName,
      riotIdTagline: player.tagLine || p.riotIdTagline,
      championId: p.championId || 0,
      championName: p.championName,
      teamId: p.teamId || (stats.win ? 100 : 200),
      win: Boolean(stats.win ?? p.win),
      kills: Number(stats.kills ?? p.kills ?? 0),
      deaths: Number(stats.deaths ?? p.deaths ?? 0),
      assists: Number(stats.assists ?? p.assists ?? 0),
      goldEarned: Number(stats.goldEarned ?? p.goldEarned ?? 0),
      totalDamageDealtToChampions: Number(stats.totalDamageDealtToChampions ?? p.totalDamageDealtToChampions ?? 0),
      totalMinionsKilled: Number(stats.totalMinionsKilled ?? p.totalMinionsKilled ?? 0),
      neutralMinionsKilled: Number(stats.neutralMinionsKilled ?? p.neutralMinionsKilled ?? 0),
      visionScore: Number(stats.visionScore ?? p.visionScore ?? 0),
      items: items.length > 0 ? items : (p.items || []),
      spell1Id: p.spell1Id || 0,
      spell2Id: p.spell2Id || 0,
    }
  })

  return {
    ...game,
    participants: normalizedParticipants,
  }
}

export class LcuClient {
  private isBrowserOrMock = typeof window === 'undefined' || !window.location.origin.includes('riot:')

  async getGameVersion(): Promise<string> {
    if (this.isBrowserOrMock) return '14.17.1'
    try {
      const res = await fetch(ENDPOINTS.GAME_VERSION)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.json()
      const parsed = GameVersionSchema.safeParse(raw)
      return parsed.success ? parsed.data : '14.17.1'
    } catch {
      return '14.17.1'
    }
  }

  async getCurrentSummoner(): Promise<SummonerData> {
    if (this.isBrowserOrMock) return MOCK_SUMMONER
    const res = await fetch(ENDPOINTS.CURRENT_SUMMONER)
    if (!res.ok) throw new Error(`Failed to fetch current summoner: HTTP ${res.status}`)
    const raw = await res.json()
    const parsed = SummonerSchema.safeParse(raw)
    if (!parsed.success) {
      console.warn('SummonerSchema validation failed:', parsed.error)
      return raw as SummonerData
    }
    return parsed.data as SummonerData
  }

  async getMatchHistory(puuid?: string): Promise<MatchHistoryItem[]> {
    if (this.isBrowserOrMock) return MOCK_MATCHES
    const url = puuid ? ENDPOINTS.MATCH_HISTORY(puuid) : ENDPOINTS.CURRENT_MATCH_HISTORY()
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch match history: HTTP ${res.status}`)
    const raw = await res.json()
    const games = raw?.games?.games || []
    const items: MatchHistoryItem[] = []

    for (const game of games) {
      const normalized = normalizeMatchGame(game)
      const parsed = MatchHistoryItemSchema.safeParse(normalized)
      if (parsed.success) {
        items.push(parsed.data as MatchHistoryItem)
      } else {
        items.push(normalized as MatchHistoryItem)
      }
    }
    return items
  }

  async getGameflowPhase(): Promise<GameflowPhase> {
    if (this.isBrowserOrMock) return 'None'
    try {
      const res = await fetch(ENDPOINTS.GAMEFLOW_PHASE)
      if (!res.ok) return 'None'
      const raw = await res.json()
      const parsed = GameflowPhaseSchema.safeParse(raw)
      return parsed.success ? parsed.data : 'None'
    } catch {
      return 'None'
    }
  }

  async getEntitlements(): Promise<{ token: string; accessToken: string }> {
    if (this.isBrowserOrMock) {
      return { token: 'mock_token', accessToken: 'mock_access' }
    }
    const res = await fetch(ENDPOINTS.ENTITLEMENTS_TOKEN)
    if (!res.ok) throw new Error('Failed to retrieve entitlements token')
    return await res.json()
  }
}

export const lcuClient = new LcuClient()
