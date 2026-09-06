export type GameflowPhase =
  | 'None'
  | 'Lobby'
  | 'Matchmaking'
  | 'ReadyCheck'
  | 'ChampSelect'
  | 'InProgress'
  | 'WaitingForStats'
  | 'PreEndOfGame'
  | 'EndOfGame'
  | 'TerminatedInError'

export interface SummonerData {
  accountId: number
  displayName: string
  gameName?: string
  tagLine?: string
  internalName: string
  nameChangeFlag: boolean
  percentCompleteForNextLevel: number
  privacy: string
  profileIconId: number
  puuid: string
  rerollPoints: {
    currentPoints: number
    maxRolls: number
    numberOfRolls: number
    pointsCostToRoll: number
    pointsToReroll: number
  }
  summonerId: number
  summonerLevel: number
  xpSinceLastLevel: number
  xpUntilNextLevel: number
}

export interface MatchParticipant {
  puuid: string
  summonerName: string
  riotIdGameName?: string
  riotIdTagline?: string
  championId: number
  championName?: string
  teamId: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  goldEarned: number
  totalDamageDealtToChampions: number
  totalMinionsKilled: number
  neutralMinionsKilled: number
  visionScore: number
  items: number[]
  spell1Id: number
  spell2Id: number
}

export interface MatchHistoryItem {
  gameId: number
  gameCreation: number
  gameDuration: number
  gameMode: string
  gameType: string
  mapId: number
  queueId: number
  gameVersion: string
  participants: MatchParticipant[]
  myParticipant?: MatchParticipant
}

export interface ChampionSummary {
  id: number
  name: string
  alias: string
  title: string
  roles: string[]
  squarePortraitPath: string
  winRate?: number
  pickRate?: number
  banRate?: number
  kda?: string
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
  recentMatches: MatchHistoryItem[]
}

/** Matches ScopedStore from plugins/src/preload/ext/index.ts — duplicated
 *  here rather than imported since app/ and plugins/ are peer workspaces
 *  with no existing dependency edge, and this shape is small and stable. */
export interface ScopedStore {
  get<T = any>(key: string, defaultValue?: T): T | undefined
  set<T = any>(key: string, value: T): boolean
  delete(key: string): boolean
  has(key: string): boolean
  clear(): void
  entries(): [string, any][]
}

export interface PluginContext {
  rcp: any
  socket: {
    observe: <T = any>(event: string, callback: (event: { data: T; uri: string; eventType: string }) => void) => { disconnect(): void }
  }
  meta?: { name: string }
  ext?: {
    store: ScopedStore
    fs: any
    assets: any
    commands: any
    theme: any
    ember?: any
    net?: any
  }
}
