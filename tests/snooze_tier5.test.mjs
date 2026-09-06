import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { validateModuleDescriptor } from '../packages/contracts/src/module.ts'
import {
  TIER_5_MODULES,
  MODULE_REGISTRY,
  gameAnalysisPopupModule,
  whaleHelperModule,
  nameSpooferModule,
} from '../personal/snooze/src/index.ts'
import {
  divisionScore,
  divisionScoreToLabel,
  computeTeamAvgLabel,
  buildMatchAnalysisSummary,
  getTierColor,
} from '../personal/snooze/src/gameAnalysisPopup.ts'
import {
  getSkinRarityBadge,
  pickRandomSkin,
  filterUnownedSkins,
  calculateLootPoolStats,
} from '../personal/snooze/src/whaleHelper.ts'
import {
  catLabel,
  spoofIdentity,
  isSpoofingActive,
  resetCategoryMaps,
} from '../personal/snooze/src/nameSpoofer.ts'
import { ModuleHost } from '../app/src/modules/host.ts'

describe('Snooze Personal — Tier 5 Module Descriptors', () => {
  test('all 3 Tier 5 modules pass validateModuleDescriptor()', () => {
    assert.equal(TIER_5_MODULES.length, 3)
    for (const mod of TIER_5_MODULES) {
      const errors = validateModuleDescriptor(mod)
      assert.deepEqual(errors, [], `Module ${mod.id} failed validation: ${errors.join(', ')}`)
    }
  })

  test('gameAnalysisPopupModule descriptor has correct schema and active passive policy', () => {
    assert.equal(gameAnalysisPopupModule.id, 'gameAnalysisPopup')
    assert.equal(typeof gameAnalysisPopupModule.name(), 'string')
    assert.equal(typeof gameAnalysisPopupModule.description(), 'string')
    assert.equal(gameAnalysisPopupModule.capabilities?.passive, 'active')
    assert.equal(gameAnalysisPopupModule.settings.length, 4)
    assert.equal(gameAnalysisPopupModule.settings[0].key, 'enabled')
    assert.equal(gameAnalysisPopupModule.settings[1].key, 'autoOpenChampSelect')
    assert.equal(gameAnalysisPopupModule.settings[2].key, 'autoOpenInProgress')
    assert.equal(gameAnalysisPopupModule.settings[3].key, 'includeAllQueues')
  })

  test('whaleHelperModule descriptor has correct schema and capabilities', () => {
    assert.equal(whaleHelperModule.id, 'whaleHelper')
    assert.equal(typeof whaleHelperModule.name(), 'string')
    assert.equal(typeof whaleHelperModule.description(), 'string')
    assert.equal(whaleHelperModule.capabilities?.usesEmber, true)
    assert.equal(typeof whaleHelperModule.installEmberHooks, 'function')
    assert.equal(whaleHelperModule.settings.length, 5)
    assert.equal(whaleHelperModule.settings[0].key, 'lootHelperEnabled')
    assert.equal(whaleHelperModule.settings[1].key, 'skinTierEnabled')
    assert.equal(whaleHelperModule.settings[2].key, 'dropOddsEnabled')
    assert.equal(whaleHelperModule.settings[3].key, 'hideUnownedSkins')
    assert.equal(whaleHelperModule.settings[4].key, 'skinRandomizer')
  })

  test('nameSpooferModule descriptor has correct schema and capabilities', () => {
    assert.equal(nameSpooferModule.id, 'nameSpoofer')
    assert.equal(typeof nameSpooferModule.name(), 'string')
    assert.equal(typeof nameSpooferModule.description(), 'string')
    assert.equal(nameSpooferModule.capabilities?.usesEmber, true)
    assert.equal(typeof nameSpooferModule.installEmberHooks, 'function')
    assert.equal(nameSpooferModule.settings.length, 12)
    assert.equal(nameSpooferModule.settings[0].key, 'enabled')
    assert.equal(nameSpooferModule.settings[1].key, 'spoofSelf')
    assert.equal(nameSpooferModule.settings[2].key, 'gameName')
    assert.equal(nameSpooferModule.settings[3].key, 'tagLine')
    assert.equal(nameSpooferModule.settings[4].key, 'friendName')
    assert.equal(nameSpooferModule.settings[5].key, 'friendNumbers')
    assert.equal(nameSpooferModule.settings[6].key, 'globalName')
    assert.equal(nameSpooferModule.settings[7].key, 'globalNumbers')
    assert.equal(nameSpooferModule.settings[8].key, 'spoofFriends')
    assert.equal(nameSpooferModule.settings[9].key, 'spoofLobby')
    assert.equal(nameSpooferModule.settings[10].key, 'spoofChampSelect')
    assert.equal(nameSpooferModule.settings[11].key, 'spoofMatchHistory')
  })
})

describe('Snooze Personal — GameAnalysisPopup Logic', () => {
  test('divisionScore maps tier and division correctly', () => {
    assert.equal(divisionScore('IRON', 'IV'), 1)
    assert.equal(divisionScore('IRON', 'I'), 4)
    assert.equal(divisionScore('BRONZE', 'IV'), 5)
    assert.equal(divisionScore('GOLD', 'II'), 15)
    assert.equal(divisionScore('DIAMOND', 'I'), 28)
    assert.equal(divisionScore('MASTER', 'I'), null)
  })

  test('divisionScoreToLabel formats score to tier and division string', () => {
    assert.equal(divisionScoreToLabel(1), 'Iron IV')
    assert.equal(divisionScoreToLabel(15), 'Gold II')
    assert.equal(divisionScoreToLabel(28), 'Diamond I')
  })

  test('computeTeamAvgLabel averages division ranks across team', () => {
    const team = [
      { tier: 'GOLD', division: 'IV', lp: 0, isUnranked: false },
      { tier: 'GOLD', division: 'II', lp: 0, isUnranked: false },
    ]
    const avg = computeTeamAvgLabel(team)
    assert.equal(avg, 'Gold III')
  })

  test('computeTeamAvgLabel handles high Elo Master+ lobbies', () => {
    const highEloTeam = [
      { tier: 'MASTER', division: '', lp: 100, isUnranked: false },
      { tier: 'MASTER', division: '', lp: 200, isUnranked: false },
    ]
    const avg = computeTeamAvgLabel(highEloTeam)
    assert.match(avg, /Master ~150 LP/)
  })

  test('buildMatchAnalysisSummary computes statistics correctly', () => {
    const matches = [
      { win: true, kills: 10, deaths: 2, assists: 8, cs: 200, gameDurationSeconds: 1800 },
      { win: false, kills: 2, deaths: 6, assists: 4, cs: 150, gameDurationSeconds: 1800 },
    ]
    const summary = buildMatchAnalysisSummary(matches)
    assert.equal(summary.games, 2)
    assert.equal(summary.winRate, 50)
    assert.equal(summary.avgKda, 3.0)
    assert.equal(summary.csPerMin, 5.8)
  })

  test('getTierColor returns correct hex color', () => {
    assert.equal(getTierColor('DIAMOND'), '#4f75b5')
    assert.equal(getTierColor('CHALLENGER'), '#e58c2c')
  })
})

describe('Snooze Personal — WhaleHelper Logic', () => {
  test('getSkinRarityBadge labels and colors rarities accurately', () => {
    const ultimate = getSkinRarityBadge('kUltimate')
    assert.equal(ultimate.label, 'Ultimate')
    assert.equal(ultimate.color, '#e58c2c')
    assert.equal(ultimate.isClassic, false)

    const classic = getSkinRarityBadge('kDefault')
    assert.equal(classic.isClassic, true)
  })

  test('pickRandomSkin selects owned skin excluding blacklisted', () => {
    const owned = [1001, 1002, 1003]
    const blacklist = new Set([1001, 1002])
    const chosen = pickRandomSkin(owned, blacklist)
    assert.equal(chosen, 1003)

    const empty = pickRandomSkin(owned, new Set([1001, 1002, 1003]))
    assert.equal(empty, null)
  })

  test('filterUnownedSkins filters when hideUnowned is enabled', () => {
    const skins = [
      { id: 1, owned: true },
      { id: 2, owned: false },
      { id: 3, owned: true },
    ]
    assert.equal(filterUnownedSkins(skins, false).length, 3)
    assert.equal(filterUnownedSkins(skins, true).length, 2)
  })

  test('calculateLootPoolStats computes counts and percentages', () => {
    const items = [
      { id: 1, owned: true },
      { id: 2, owned: true },
      { id: 3, owned: false },
      { id: 4, owned: false },
    ]
    const stats = calculateLootPoolStats(items)
    assert.equal(stats.total, 4)
    assert.equal(stats.owned, 2)
    assert.equal(stats.unowned, 2)
    assert.equal(stats.percentOwned, 50.0)
  })
})

describe('Snooze Personal — NameSpoofer Logic', () => {
  test('catLabel provides stable numbered aliases per entity', () => {
    resetCategoryMaps()
    const config = {
      enabled: true,
      friendName: 'Ally',
      friendNumbers: true,
      globalName: 'Player',
      globalNumbers: true,
    }
    const a1 = catLabel('friend', 'puuid-1', config)
    const a2 = catLabel('friend', 'puuid-2', config)
    const a1Repeat = catLabel('friend', 'puuid-1', config)

    assert.equal(a1, 'Ally 1')
    assert.equal(a2, 'Ally 2')
    assert.equal(a1Repeat, 'Ally 1')
  })

  test('spoofIdentity replaces gameName and tagLine when enabled', () => {
    const config = {
      enabled: true,
      gameName: 'Faker',
      tagLine: 'T1',
    }
    const original = { gameName: 'RealUser', tagLine: 'NA1', displayName: 'RealUser#NA1' }
    const spoofed = spoofIdentity(original, config)
    assert.equal(spoofed.gameName, 'Faker')
    assert.equal(spoofed.tagLine, 'T1')
    assert.equal(spoofed.displayName, 'Faker#T1')

    const disabledConfig = { enabled: false }
    const untouched = spoofIdentity(original, disabledConfig)
    assert.equal(untouched.gameName, 'RealUser')
  })

  test('isSpoofingActive prevents spoofing in ranked champ select', () => {
    const config = {
      enabled: true,
      spoofChampSelect: true,
      spoofLobby: true,
    }
    assert.equal(isSpoofingActive(config, 'ChampSelect', true), false) // Ranked champ select blocked
    assert.equal(isSpoofingActive(config, 'ChampSelect', false), true) // Normal champ select allowed
    assert.equal(isSpoofingActive(config, 'Lobby', false), true)
  })
})

describe('Snooze Personal — ModuleHost Integration with Complete 18-Module Registry', () => {
  test('ModuleHost initializes all 18 modules across Tiers 1-5 and satisfies all invariants', async () => {
    assert.equal(MODULE_REGISTRY.length, 18)

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

    // Register all 18 modules
    host.register(MODULE_REGISTRY)
    assert.equal(host.registry.length, 18)

    // Synchronous installEmberHooks + initAll verifies autoActs panic invariant
    await host.initAll()
    assert.ok(rules.length >= 10, `Ember rules should be registered across modules, found ${rules.length}`)

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
