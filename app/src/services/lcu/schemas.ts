import { z } from 'zod'

export const SummonerSchema = z.object({
  accountId: z.number(),
  displayName: z.string(),
  gameName: z.string().optional(),
  tagLine: z.string().optional(),
  internalName: z.string().default(''),
  nameChangeFlag: z.boolean().default(false),
  percentCompleteForNextLevel: z.number().default(0),
  privacy: z.string().default('PUBLIC'),
  profileIconId: z.number().default(1),
  puuid: z.string(),
  summonerId: z.number(),
  summonerLevel: z.number(),
  xpSinceLastLevel: z.number().default(0),
  xpUntilNextLevel: z.number().default(100),
})

export const MatchParticipantSchema = z.object({
  puuid: z.string().default(''),
  summonerName: z.string().default(''),
  riotIdGameName: z.string().optional(),
  riotIdTagline: z.string().optional(),
  championId: z.number(),
  championName: z.string().optional(),
  teamId: z.number(),
  win: z.boolean().default(false),
  kills: z.number().default(0),
  deaths: z.number().default(0),
  assists: z.number().default(0),
  goldEarned: z.number().default(0),
  totalDamageDealtToChampions: z.number().default(0),
  totalMinionsKilled: z.number().default(0),
  neutralMinionsKilled: z.number().default(0),
  visionScore: z.number().default(0),
  items: z.array(z.number()).default([]),
  spell1Id: z.number().default(0),
  spell2Id: z.number().default(0),
})

export const MatchHistoryItemSchema = z.object({
  gameId: z.number(),
  gameCreation: z.number(),
  gameDuration: z.number(),
  gameMode: z.string().default('CLASSIC'),
  gameType: z.string().default('MATCHED_GAME'),
  mapId: z.number().default(11),
  queueId: z.number().default(420),
  gameVersion: z.string().default(''),
  participants: z.array(MatchParticipantSchema).default([]),
})

export const GameVersionSchema = z.string()

export const GameflowPhaseSchema = z.enum([
  'None',
  'Lobby',
  'Matchmaking',
  'ReadyCheck',
  'ChampSelect',
  'InProgress',
  'WaitingForStats',
  'PreEndOfGame',
  'EndOfGame',
  'TerminatedInError',
])
