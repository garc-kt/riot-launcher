import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  SummonerSchema,
  MatchParticipantSchema,
  MatchHistoryItemSchema,
  GameflowPhaseSchema,
} from '../app/src/services/lcu/schemas.ts'
import { normalizeMatchGame } from '../app/src/services/lcu/client.ts'

describe('LCU Runtime Validation Schemas', () => {
  test('valid summoner parses successfully with defaults', () => {
    const raw = {
      accountId: 12345,
      displayName: 'TestPlayer',
      puuid: 'abc-123-xyz',
      summonerId: 99999,
      summonerLevel: 50,
    }
    const res = SummonerSchema.safeParse(raw)
    assert.equal(res.success, true)
    if (res.success) {
      assert.equal(res.data.displayName, 'TestPlayer')
      assert.equal(res.data.profileIconId, 1)
      assert.equal(res.data.privacy, 'PUBLIC')
      assert.equal(res.data.nameChangeFlag, false)
    }
  })

  test('invalid summoner missing required fields fails validation', () => {
    const raw = {
      displayName: 'TestPlayer',
      // missing accountId, puuid, summonerId, summonerLevel
    }
    const res = SummonerSchema.safeParse(raw)
    assert.equal(res.success, false)
  })

  test('match participant schema fills defaults correctly', () => {
    const raw = {
      championId: 103,
      teamId: 100,
    }
    const res = MatchParticipantSchema.safeParse(raw)
    assert.equal(res.success, true)
    if (res.success) {
      assert.equal(res.data.win, false)
      assert.equal(res.data.kills, 0)
      assert.deepEqual(res.data.items, [])
    }
  })

  test('gameflow phase schema validates exact LCU enum values', () => {
    assert.equal(GameflowPhaseSchema.safeParse('InProgress').success, true)
    assert.equal(GameflowPhaseSchema.safeParse('Lobby').success, true)
    assert.equal(GameflowPhaseSchema.safeParse('ChampSelect').success, true)
    assert.equal(GameflowPhaseSchema.safeParse('RandomPhase').success, false)
  })

  test('normalizeMatchGame maps nested LCU participantIdentities and stats to flat participants', () => {
    const rawLcuGame = {
      gameId: 987654,
      gameCreation: 1700000000000,
      gameDuration: 1800,
      gameMode: 'CLASSIC',
      participantIdentities: [
        {
          participantId: 1,
          player: {
            puuid: 'p-uuid-1',
            summonerName: 'MidLaner',
            gameName: 'AhriMaster',
            tagLine: 'NA1',
          },
        },
      ],
      participants: [
        {
          participantId: 1,
          championId: 103,
          teamId: 100,
          stats: {
            win: true,
            kills: 10,
            deaths: 1,
            assists: 8,
            goldEarned: 15000,
            totalDamageDealtToChampions: 28000,
            totalMinionsKilled: 210,
            neutralMinionsKilled: 12,
            visionScore: 35,
            item0: 3089,
            item1: 3020,
          },
        },
      ],
    }

    const normalized = normalizeMatchGame(rawLcuGame)
    const parsed = MatchHistoryItemSchema.safeParse(normalized)
    assert.equal(parsed.success, true)
    if (parsed.success) {
      assert.equal(parsed.data.participants.length, 1)
      const p = parsed.data.participants[0]
      assert.equal(p.puuid, 'p-uuid-1')
      assert.equal(p.summonerName, 'MidLaner')
      assert.equal(p.riotIdGameName, 'AhriMaster')
      assert.equal(p.riotIdTagline, 'NA1')
      assert.equal(p.championId, 103)
      assert.equal(p.win, true)
      assert.equal(p.kills, 10)
      assert.equal(p.deaths, 1)
      assert.equal(p.assists, 8)
      assert.deepEqual(p.items, [3089, 3020])
    }
  })
})
