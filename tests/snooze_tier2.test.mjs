import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { validateModuleDescriptor } from '../packages/contracts/src/module.ts'
import {
  TIER_1_MODULES,
  TIER_2_MODULES,
  autoAcceptModule,
  arenaGodModule,
  customOnlineStatusModule,
  autoHonorModule,
} from '../personal/snooze/src/index.ts'
import { Scoring } from '../personal/snooze/src/scoring.ts'
import { ModuleHost } from '../app/src/modules/host.ts'

describe('Snooze Personal — Tier 2 Module Descriptors', () => {
  test('all 4 Tier 2 modules pass validateModuleDescriptor()', () => {
    const tier2 = [autoAcceptModule, arenaGodModule, customOnlineStatusModule, autoHonorModule]
    for (const mod of tier2) {
      const errors = validateModuleDescriptor(mod)
      assert.deepEqual(errors, [], `Module ${mod.id} failed validation: ${errors.join(', ')}`)
    }
  })

  test('autoAcceptModule descriptor has correct schema, capabilities and autoActs', () => {
    assert.equal(autoAcceptModule.id, 'autoAccept')
    assert.equal(typeof autoAcceptModule.name(), 'string')
    assert.equal(typeof autoAcceptModule.description(), 'string')
    assert.equal(autoAcceptModule.capabilities?.autoActs, true)
    assert.equal(autoAcceptModule.capabilities?.usesEmber, true)
    assert.equal(autoAcceptModule.settings.length, 5)
    assert.equal(autoAcceptModule.settings[0].key, 'enabled')
    assert.equal(autoAcceptModule.settings[0].type, 'toggle')
    assert.equal(autoAcceptModule.settings[1].key, 'delay')
    assert.equal(autoAcceptModule.settings[1].type, 'number')
    assert.equal(autoAcceptModule.settings[2].key, 'exitOnDecline')
    assert.equal(autoAcceptModule.settings[3].key, 'exitOnDodge')
    assert.equal(autoAcceptModule.settings[4].key, 'hideReadyCheck')
  })

  test('arenaGodModule descriptor has correct schema and capabilities', () => {
    assert.equal(arenaGodModule.id, 'arenaGod')
    assert.equal(typeof arenaGodModule.name(), 'string')
    assert.equal(typeof arenaGodModule.description(), 'string')
    assert.equal(arenaGodModule.capabilities?.usesEmber, true)
    assert.equal(arenaGodModule.settings.length, 1)
    assert.equal(arenaGodModule.settings[0].key, 'enabled')
    assert.equal(arenaGodModule.settings[0].type, 'toggle')
  })

  test('customOnlineStatusModule descriptor has correct schema and capabilities', () => {
    assert.equal(customOnlineStatusModule.id, 'customOnlineStatus')
    assert.equal(typeof customOnlineStatusModule.name(), 'string')
    assert.equal(typeof customOnlineStatusModule.description(), 'string')
    assert.equal(customOnlineStatusModule.capabilities?.usesEmber, true)
    assert.equal(customOnlineStatusModule.settings.length, 3)
    assert.equal(customOnlineStatusModule.settings[0].key, 'enabled')
    assert.equal(customOnlineStatusModule.settings[0].type, 'toggle')
    assert.equal(customOnlineStatusModule.settings[1].key, 'status')
    assert.equal(customOnlineStatusModule.settings[1].type, 'select')
    assert.equal(customOnlineStatusModule.settings[2].key, 'statusMsg')
    assert.equal(customOnlineStatusModule.settings[2].type, 'textarea')
  })

  test('autoHonorModule descriptor has correct schema, capabilities and autoActs', () => {
    assert.equal(autoHonorModule.id, 'autoHonor')
    assert.equal(typeof autoHonorModule.name(), 'string')
    assert.equal(typeof autoHonorModule.description(), 'string')
    assert.equal(autoHonorModule.capabilities?.autoActs, true)
    assert.equal(autoHonorModule.capabilities?.usesEmber, true)
    assert.equal(autoHonorModule.settings.length, 7)
    assert.equal(autoHonorModule.settings[0].key, 'enabled')
    assert.equal(autoHonorModule.settings[1].key, 'mode')
    assert.equal(autoHonorModule.settings[1].type, 'select')
    assert.equal(autoHonorModule.settings[2].key, 'delayMs')
    assert.equal(autoHonorModule.settings[2].type, 'number')
    assert.equal(autoHonorModule.settings[3].key, 'skip')
    assert.equal(autoHonorModule.settings[4].key, 'prioritizeByContribution')
    assert.equal(autoHonorModule.settings[5].key, 'preferFriends')
    assert.equal(autoHonorModule.settings[6].key, 'showScoreOnCard')
  })
})

describe('Snooze Personal — Performance Scoring Utility', () => {
  test('normalizeEogStats and computeScores produces normalized ratings', () => {
    const mockEogStats = {
      teams: [
        {
          teamId: 100,
          players: [
            {
              puuid: 'player-1',
              championName: 'Ahri',
              stats: {
                CHAMPIONS_KILLED: 10,
                NUM_DEATHS: 2,
                ASSISTS: 8,
                TOTAL_DAMAGE_DEALT_TO_CHAMPIONS: 25000,
                GOLD_EARNED: 14000,
                MINIONS_KILLED: 180,
                WIN: true,
              },
            },
            {
              puuid: 'player-2',
              championName: 'Nami',
              stats: {
                CHAMPIONS_KILLED: 1,
                NUM_DEATHS: 3,
                ASSISTS: 18,
                TOTAL_DAMAGE_DEALT_TO_CHAMPIONS: 5000,
                GOLD_EARNED: 8000,
                MINIONS_KILLED: 20,
                TOTAL_HEAL_ON_TEAMMATES: 12000,
                WIN: true,
              },
            },
          ],
        },
      ],
    }

    const players = Scoring.normalizeEogStats(mockEogStats)
    assert.equal(players.length, 2)
    assert.equal(players[0].puuid, 'player-1')
    assert.equal(players[0].kills, 10)
    assert.equal(players[1].puuid, 'player-2')

    const scores = Scoring.computeScores(players)
    assert.ok(scores.has('player-1'))
    assert.ok(scores.has('player-2'))

    const s1 = scores.get('player-1')
    assert.ok(s1.score >= 1.0 && s1.score <= 10.0)
    assert.equal(s1.kills, 10)
    assert.equal(s1.deaths, 2)
    assert.equal(s1.assists, 8)
  })
})

describe('Snooze Personal — ModuleHost Integration with Tier 1 & Tier 2 Registry', () => {
  test('ModuleHost initializes all 8 modules and satisfies autoActs invariant', async () => {
    const tier1and2 = [...TIER_1_MODULES, ...TIER_2_MODULES]
    assert.equal(tier1and2.length, 8)

    const memoryStore = new Map()
    const store = {
      get: (k, fb) => (memoryStore.has(k) ? memoryStore.get(k) : fb),
      set: (k, v) => { memoryStore.set(k, v); return true },
      delete: (k) => memoryStore.delete(k),
      has: (k) => memoryStore.has(k),
      clear: () => memoryStore.clear(),
      entries: () => [...memoryStore.entries()],
    }

    const toast = {
      success: () => {},
      error: () => {},
      info: () => {},
      warning: () => {},
    }

    const mockLcu = {
      observe: () => () => {},
      get: async () => ({}),
      post: async () => ({}),
      put: async () => ({}),
      delete: async () => ({}),
      getGameflowPhase: async () => 'None',
    }

    const rules = []
    const mockEmber = {
      registerRule: (r) => {
        rules.push(r)
        return () => {
          const idx = rules.indexOf(r)
          if (idx >= 0) rules.splice(idx, 1)
        }
      },
    }

    const netHooks = []
    const mockNet = {
      hookWs: () => {
        const unreg = () => {}
        netHooks.push(unreg)
        return unreg
      },
      hookXhrReq: () => {
        const unreg = () => {}
        netHooks.push(unreg)
        return unreg
      },
    }

    const host = new ModuleHost({
      lcu: mockLcu,
      store,
      toast,
      ember: mockEmber,
      net: mockNet,
      log: () => {},
    })

    // Register all 8 modules — passes static validation
    host.register(tier1and2)
    assert.equal(host.registry.length, 8)

    // Initialize all — verifies autoActs register with panic invariant
    await host.initAll()
    await host.loadAll()

    // Test panicAll
    host.panicAll()

    // Teardown all
    await host.unloadAll()

    // Confirm Ember rules were all unregistered
    assert.equal(rules.length, 0)
  })

  test('autoAccept ignores duplicate ReadyCheck phase events while in ready check', async () => {
    let acceptPostCount = 0
    let phaseCallback = null

    const mockLcu = {
      observe: (uri, cb) => {
        if (uri === '/lol-gameflow/v1/gameflow-phase') {
          phaseCallback = cb
        }
        return () => {}
      },
      post: async (uri) => {
        if (uri === '/lol-matchmaking/v1/ready-check/accept') {
          acceptPostCount++
        }
        return {}
      },
      delete: async () => ({}),
      get: async () => ({}),
    }

    const storeMap = new Map([
      ['enabled', true],
      ['delay', 0],
    ])
    const store = {
      get: (k, fb) => (storeMap.has(k) ? storeMap.get(k) : fb),
      set: (k, v) => { storeMap.set(k, v); return true },
      delete: (k) => storeMap.delete(k),
      has: (k) => storeMap.has(k),
      clear: () => storeMap.clear(),
      entries: () => [...storeMap.entries()],
    }

    const panicCancels = []
    const ctx = {
      lcu: mockLcu,
      store,
      toast: { success: () => {}, error: () => {}, info: () => {}, warning: () => {} },
      panic: { register: (fn) => { panicCancels.push(fn); return () => {} } },
      log: () => {},
      phase: () => 'ReadyCheck',
    }

    autoAcceptModule.init(ctx)
    assert.ok(phaseCallback, 'Phase callback registered')

    // First ReadyCheck event -> triggers accept
    phaseCallback('ReadyCheck')
    assert.equal(acceptPostCount, 1)

    // Second consecutive ReadyCheck event (e.g. state change from another player accepting)
    // Guard must prevent duplicate accept post!
    phaseCallback('ReadyCheck')
    assert.equal(acceptPostCount, 1, 'Duplicate ReadyCheck event should not trigger another accept')

    autoAcceptModule.unload()
  })

  test('autoHonor queries /lol-chat/v1/friends and prioritizes friends', async () => {
    let friendsFetched = false
    let stagedHonors = []
    let phaseCallback = null

    const mockLcu = {
      observe: (uri, cb) => {
        if (uri === '/lol-gameflow/v1/gameflow-phase') {
          phaseCallback = cb
        }
        return () => {}
      },
      get: async (uri) => {
        if (uri === '/lol-chat/v1/friends') {
          friendsFetched = true
          return [
            { puuid: 'friend-puuid-1', summonerName: 'BestFriend' },
          ]
        }
        if (uri === '/lol-honor-v2/v1/ballot') {
          return {
            gameId: 12345,
            eligibleAllies: [
              { puuid: 'stranger-puuid-1', summonerName: 'Stranger1' },
              { puuid: 'friend-puuid-1', summonerName: 'BestFriend' },
            ],
            votePool: { votes: 1 },
          }
        }
        return {}
      },
      post: async (uri, body) => {
        if (uri === '/lol-honor/v1/honor') {
          stagedHonors.push(body)
        }
        return {}
      },
    }

    const storeMap = new Map([
      ['enabled', true],
      ['preferFriends', true],
      ['mode', 'allies'],
      ['delayMs', 0],
    ])
    const store = {
      get: (k, fb) => (storeMap.has(k) ? storeMap.get(k) : fb),
      set: (k, v) => { storeMap.set(k, v); return true },
      delete: (k) => storeMap.delete(k),
      has: (k) => storeMap.has(k),
      clear: () => storeMap.clear(),
      entries: () => [...storeMap.entries()],
    }

    const ctx = {
      lcu: mockLcu,
      store,
      toast: { success: () => {}, error: () => {}, info: () => {}, warning: () => {} },
      panic: { register: () => () => {} },
      log: () => {},
      phase: () => 'EndOfGame',
    }

    autoHonorModule.init(ctx)
    assert.equal(friendsFetched, true, 'Should prefetch friends when preferFriends is enabled')

    // Trigger end of game phase
    phaseCallback('EndOfGame')

    // Wait for microtasks/promises to settle
    await new Promise((r) => setTimeout(r, 50))

    assert.equal(stagedHonors.length, 1)
    assert.equal(stagedHonors[0].recipientPuuid, 'friend-puuid-1', 'Friend should be prioritized first over stranger')

    autoHonorModule.unload()
  })
})
