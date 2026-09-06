import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { validateModuleDescriptor } from '../packages/contracts/src/module.ts'
import {
  TIER_1_MODULES,
  TIER_2_MODULES,
  TIER_3_MODULES,
  TIER_4_MODULES,
  autoQueueModule,
  clientWindowTweaksModule,
  autoLockChampionModule,
} from '../personal/snooze/src/index.ts'
import {
  queueDisplayName,
  lobbyQueueId,
  waitForLobbyReady,
  reQueue,
} from '../personal/snooze/src/autoQueue.ts'
import {
  calculateZoom,
  calculateDragBarPixels,
  isLetterboxNeeded,
  PRESETS,
} from '../personal/snooze/src/clientWindowTweaks.ts'
import {
  asChampionList,
  getPriorityList,
  setPriorityList,
  getBannedChampionIds,
  getPickedChampionIds,
  getTeammateIntents,
  chooseChampionForAction,
  getCurrentActiveActions,
} from '../personal/snooze/src/autoLockChampion.ts'
import { ModuleHost } from '../app/src/modules/host.ts'

describe('Snooze Personal — Tier 4 Module Descriptors', () => {
  test('all 3 Tier 4 modules pass validateModuleDescriptor()', () => {
    assert.equal(TIER_4_MODULES.length, 3)
    for (const mod of TIER_4_MODULES) {
      const errors = validateModuleDescriptor(mod)
      assert.deepEqual(errors, [], `Module ${mod.id} failed validation: ${errors.join(', ')}`)
    }
  })

  test('autoQueueModule descriptor has correct schema, capabilities and autoActs', () => {
    assert.equal(autoQueueModule.id, 'autoQueue')
    assert.equal(typeof autoQueueModule.name(), 'string')
    assert.equal(typeof autoQueueModule.description(), 'string')
    assert.equal(autoQueueModule.capabilities?.autoActs, true)
    assert.equal(autoQueueModule.settings.length, 4)
    assert.equal(autoQueueModule.settings[0].key, 'enabled')
    assert.equal(autoQueueModule.settings[0].type, 'toggle')
    assert.equal(autoQueueModule.settings[1].key, 'requeueLastLobby')
    assert.equal(autoQueueModule.settings[1].type, 'toggle')
    assert.equal(autoQueueModule.settings[2].key, 'queueId')
    assert.equal(autoQueueModule.settings[2].type, 'number')
    assert.equal(autoQueueModule.settings[3].key, 'delay')
    assert.equal(autoQueueModule.settings[3].type, 'number')
  })

  test('clientWindowTweaksModule descriptor has correct schema, capabilities and passive-dom policy', () => {
    assert.equal(clientWindowTweaksModule.id, 'clientWindowTweaks')
    assert.equal(typeof clientWindowTweaksModule.name(), 'string')
    assert.equal(typeof clientWindowTweaksModule.description(), 'string')
    assert.equal(clientWindowTweaksModule.capabilities?.passive, 'passive-dom')
    assert.equal(clientWindowTweaksModule.settings.length, 9)
    assert.equal(clientWindowTweaksModule.settings[0].key, 'enabled')
    assert.equal(clientWindowTweaksModule.settings[1].key, 'applyResolution')
    assert.equal(clientWindowTweaksModule.settings[2].key, 'width')
    assert.equal(clientWindowTweaksModule.settings[3].key, 'height')
    assert.equal(clientWindowTweaksModule.settings[4].key, 'applyTitle')
    assert.equal(clientWindowTweaksModule.settings[5].key, 'title')
    assert.equal(clientWindowTweaksModule.settings[6].key, 'applyDragBar')
    assert.equal(clientWindowTweaksModule.settings[7].key, 'dragBarPercentage')
    assert.equal(clientWindowTweaksModule.settings[8].key, 'fullscreenEnabled')
  })

  test('autoLockChampionModule descriptor has correct schema, capabilities, autoActs and usesEmber', () => {
    assert.equal(autoLockChampionModule.id, 'autoLockChampion')
    assert.equal(typeof autoLockChampionModule.name(), 'string')
    assert.equal(typeof autoLockChampionModule.description(), 'string')
    assert.equal(autoLockChampionModule.capabilities?.autoActs, true)
    assert.equal(autoLockChampionModule.capabilities?.usesEmber, true)
    assert.equal(typeof autoLockChampionModule.installEmberHooks, 'function')
    assert.equal(autoLockChampionModule.settings.length, 8)
    assert.equal(autoLockChampionModule.settings[0].key, 'enabled')
    assert.equal(autoLockChampionModule.settings[1].key, 'lockMode')
    assert.equal(autoLockChampionModule.settings[1].type, 'select')
    assert.equal(autoLockChampionModule.settings[2].key, 'lockTime')
    assert.equal(autoLockChampionModule.settings[3].key, 'hoverDelay')
    assert.equal(autoLockChampionModule.settings[4].key, 'instantPick')
    assert.equal(autoLockChampionModule.settings[5].key, 'instantBan')
    assert.equal(autoLockChampionModule.settings[6].key, 'respectTeamIntent')
    assert.equal(autoLockChampionModule.settings[7].key, 'respectManualPick')
  })
})

describe('Snooze Personal — AutoQueue Logic', () => {
  test('queueDisplayName formats known queue IDs and mode names', () => {
    assert.equal(queueDisplayName({ id: 4320, name: 'Normal' }), 'CO-OP SR (Classic)')
    assert.equal(queueDisplayName({ id: 2450 }), 'Mayhem (Classic)')
    assert.equal(queueDisplayName({ id: 450, gameMode: 'ARAM', name: 'ARAM' }), 'ARAM')
    assert.equal(queueDisplayName({ id: 9999, name: 'Special Mode' }), 'Special Mode')
  })

  test('lobbyQueueId extracts queue ID reliably', () => {
    assert.equal(lobbyQueueId({ gameConfig: { queueId: 420 } }), 420)
    assert.equal(lobbyQueueId({ gameConfig: { queueId: '440' } }), 440)
    assert.equal(lobbyQueueId({ gameConfig: { queueId: 0 } }), null)
    assert.equal(lobbyQueueId(null), null)
  })

  test('waitForLobbyReady resolves when lobby is ready and leader', async () => {
    let pushedCallback = null
    const mockCtx = {
      lcu: {
        get: async () => ({
          gameConfig: { queueId: 420 },
          localMember: { isLeader: true },
          canStartActivity: true,
        }),
        post: async () => ({}),
        observe: (uri, cb) => {
          pushedCallback = cb
          return () => {}
        },
      },
      log: () => {},
    }

    const ready = await waitForLobbyReady(mockCtx, 'adopt')
    assert.equal(ready.ok, true)
    assert.equal(lobbyQueueId(ready.lobby), 420)
  })

  test('reQueue triggers search when lobby is ready and un-panicked', async () => {
    const memory = new Map([
      ['enabled', true],
      ['requeueLastLobby', true],
      ['delay', 0],
    ])
    const store = {
      get: (k, fb) => (memory.has(k) ? memory.get(k) : fb),
      set: (k, v) => memory.set(k, v),
    }

    let searchCalled = false
    const mockCtx = {
      store,
      lcu: {
        get: async (uri) => {
          if (uri === '/lol-lobby/v2/lobby/matchmaking/search-state') {
            return searchCalled ? { searchState: 'Searching' } : { searchState: 'Canceled' }
          }
          if (uri === '/lol-lobby/v2/lobby') {
            return {
              gameConfig: { queueId: 420 },
              localMember: { isLeader: true },
              canStartActivity: true,
            }
          }
          return {}
        },
        post: async (uri) => {
          if (uri === '/lol-lobby/v2/lobby/matchmaking/search') {
            searchCalled = true
          }
          return {}
        },
        observe: () => () => {},
      },
      toast: { success: () => {}, error: () => {}, warning: () => {}, info: () => {} },
      panic: { register: () => () => {} },
      log: () => {},
    }

    const success = await reQueue(mockCtx, 'endOfGame')
    assert.equal(success, true)
    assert.equal(searchCalled, true)
  })
})

describe('Snooze Personal — ClientWindowTweaks Logic', () => {
  test('calculateZoom returns expected height-ratio zoom', () => {
    assert.equal(calculateZoom(720), 1.0)
    assert.equal(calculateZoom(1080), 1.5)
    assert.equal(calculateZoom(900), 1.25)
    assert.equal(calculateZoom(1440), 2.0)
  })

  test('calculateDragBarPixels scales correctly with height and percentage', () => {
    assert.equal(calculateDragBarPixels(720, 7), 50)
    assert.equal(calculateDragBarPixels(900, 7), 63)
    assert.equal(calculateDragBarPixels(1080, 10), 108)
  })

  test('isLetterboxNeeded detects aspect ratio distortion', () => {
    assert.equal(isLetterboxNeeded(1280, 720), false) // 16:9
    assert.equal(isLetterboxNeeded(1920, 1080), false) // 16:9
    assert.equal(isLetterboxNeeded(1600, 900), false) // 16:9
    assert.equal(isLetterboxNeeded(1000, 1000), true) // 1:1 distorted
  })

  test('PRESETS contains valid resolution values', () => {
    assert.ok(PRESETS.length >= 10)
    for (const p of PRESETS) {
      assert.ok(p.width > 0)
      assert.ok(p.height > 0)
      assert.ok(typeof p.label === 'string')
    }
  })
})

describe('Snooze Personal — AutoLockChampion Logic', () => {
  test('asChampionList deduplicates, strips invalid IDs, and caps at 3 slots', () => {
    assert.deepEqual(asChampionList([103, 103, 266, 0, -5, '99', 51, 88]), [103, 266, 99])
    assert.deepEqual(asChampionList([]), [])
    assert.deepEqual(asChampionList(null), [])
    assert.deepEqual(asChampionList(64), [64])
  })

  test('getPriorityList and setPriorityList handles role specialization with fallback', () => {
    const memory = new Map()
    const ctx = {
      store: {
        get: (k) => memory.get(k),
        set: (k, v) => memory.set(k, v),
      },
    }

    setPriorityList(ctx, 'pickIds', 'default', [103, 266, 51])
    assert.deepEqual(getPriorityList(ctx, 'pickIds', 'default'), [103, 266, 51])

    // Specific role fallback when unset
    assert.deepEqual(getPriorityList(ctx, 'pickIds', 'top'), [103, 266, 51])

    // Specific role override when set
    setPriorityList(ctx, 'pickIds', 'top', [266, 88])
    assert.deepEqual(getPriorityList(ctx, 'pickIds', 'top'), [266, 88])
    assert.deepEqual(getPriorityList(ctx, 'pickIds', 'default'), [103, 266, 51])
  })

  test('getBannedChampionIds and getPickedChampionIds parse session arrays correctly', () => {
    const session = {
      bans: {
        myTeamBans: [103, 64],
        theirTeamBans: [266],
      },
      myTeam: [{ cellId: 0, championId: 51 }, { cellId: 1, championId: 99 }],
      theirTeam: [{ cellId: 5, championId: 88 }],
      actions: [
        [
          { type: 'ban', completed: true, championId: 157 },
          { type: 'pick', completed: true, championId: 222 },
        ],
      ],
    }

    const banned = getBannedChampionIds(session)
    assert.ok(banned.has(103))
    assert.ok(banned.has(64))
    assert.ok(banned.has(266))
    assert.ok(banned.has(157))

    const picked = getPickedChampionIds(session)
    assert.ok(picked.has(51))
    assert.ok(picked.has(99))
    assert.ok(picked.has(88))
    assert.ok(picked.has(222))
  })

  test('getTeammateIntents returns champion intents from teammates only', () => {
    const session = {
      localPlayerCellId: 2,
      myTeam: [
        { cellId: 0, championPickIntent: 103 },
        { cellId: 1, championPickIntent: 0 },
        { cellId: 2, championPickIntent: 266 }, // Local player intent - ignored
        { cellId: 3, championPickIntent: 51 },
      ],
    }
    const intents = getTeammateIntents(session)
    assert.ok(intents.has(103))
    assert.ok(intents.has(51))
    assert.equal(intents.has(266), false, 'Local player intent must not be in teammate intents')
  })

  test('chooseChampionForAction picks top priority not banned, not picked, and respecting team intent', () => {
    const memory = new Map([
      ['pickIds', [103, 266, 51]],
      ['banIds', [99, 103, 88]],
      ['respectTeamIntent', true],
    ])
    const ctx = {
      store: {
        get: (k, fb) => (memory.has(k) ? memory.get(k) : fb),
      },
    }

    const session = {
      localPlayerCellId: 0,
      myTeam: [{ cellId: 1, championPickIntent: 103 }],
    }

    const banned = new Set([103])
    const picked = new Set()

    // 103 is banned, so next priority 266 is picked
    const pickAction = { type: 'pick' }
    const chosenPick = chooseChampionForAction(ctx, session, pickAction, 'default', banned, picked)
    assert.equal(chosenPick, 266)

    // For ban: 99 is free, so 99 is banned
    const banAction = { type: 'ban' }
    const chosenBan = chooseChampionForAction(ctx, session, banAction, 'default', new Set(), picked)
    assert.equal(chosenBan, 99)
  })

  test('getCurrentActiveActions returns only incomplete actions for active stage', () => {
    const session = {
      timer: { phase: 'BAN_PICK' },
      actions: [
        [
          { id: 1, actorCellId: 0, completed: true },
          { id: 2, actorCellId: 1, completed: true },
        ],
        [
          { id: 3, actorCellId: 0, completed: false },
          { id: 4, actorCellId: 5, completed: false },
        ],
        [
          { id: 5, actorCellId: 2, completed: false },
        ],
      ],
    }
    const active = getCurrentActiveActions(session)
    assert.equal(active.length, 2)
    assert.equal(active[0].id, 3)
    assert.equal(active[1].id, 4)
  })
})

describe('Snooze Personal — ModuleHost Integration with Full Tiers 1, 2, 3, & 4 Registry', () => {
  test('ModuleHost initializes all 15 modules and satisfies autoActs invariant', async () => {
    const tier1to4 = [...TIER_1_MODULES, ...TIER_2_MODULES, ...TIER_3_MODULES, ...TIER_4_MODULES]
    assert.equal(tier1to4.length, 15)

    const memoryStore = new Map()
    const store = {
      get: (k, fb) => (memoryStore.has(k) ? memoryStore.get(k) : fb),
      set: (k, v) => { memoryStore.set(k, v); return true },
      delete: (k) => memoryStore.delete(k),
      has: (k) => memoryStore.has(k),
      clear: () => memoryStore.clear(),
      entries: () => [...memoryStore.entries()],
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

    const mockNet = {
      hookWs: () => () => {},
      hookXhrReq: () => () => {},
      hookXhrRes: () => () => {},
    }

    const mockLcu = {
      observe: () => () => {},
      get: async (uri) => {
        if (uri === '/lol-gameflow/v1/gameflow-phase') return 'None'
        if (uri === '/lol-chat/v1/friends') return []
        return {}
      },
      post: async () => ({}),
      put: async () => ({}),
      delete: async () => ({}),
      patch: async () => ({}),
      getGameflowPhase: async () => 'None',
    }

    const host = new ModuleHost({
      lcu: mockLcu,
      store,
      toast: { success: () => {}, error: () => {}, info: () => {}, warning: () => {} },
      ember: mockEmber,
      net: mockNet,
      log: () => {},
    })

    // Register all 15 modules across Tiers 1, 2, 3, 4
    host.register(tier1to4)
    assert.equal(host.registry.length, 15)

    // Synchronous installEmberHooks + initAll verifies autoActs panic invariant
    await host.initAll()
    assert.ok(rules.length >= 9, `Ember rules should be registered across modules, found ${rules.length}`)

    await host.loadAll()

    // Test phase transition
    await host.onPhaseChange('InProgress')
    await host.onPhaseChange('Lobby')

    // Test panicAll
    host.panicAll()

    // Teardown all
    await host.unloadAll()
    assert.equal(rules.length, 0, 'All Ember rules must be cleanly deregistered on unloadAll')
  })
})
