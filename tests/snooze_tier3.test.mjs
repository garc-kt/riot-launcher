import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { validateModuleDescriptor } from '../packages/contracts/src/module.ts'
import {
  TIER_1_MODULES,
  TIER_2_MODULES,
  TIER_3_MODULES,
  snoozeBalanceTooltipModule,
  modeSelectorTweaksModule,
  profileTweaksModule,
  socialPanelTweaksModule,
} from '../personal/snooze/src/index.ts'
import {
  getModeKey,
  parseStatsBlock,
  parseWikiLua,
  buildStatsHtml,
} from '../personal/snooze/src/snoozeBalanceTooltip.ts'
import { getModeLabel } from '../personal/snooze/src/modeSelectorTweaks.ts'
import {
  getCurrentPreferences,
  removeBanner,
  removeBorder,
  updatePlayerTokens,
} from '../personal/snooze/src/profileTweaks.ts'
import {
  generatePartyColor,
  formatGameQueue,
} from '../personal/snooze/src/socialPanelTweaks.ts'
import { ModuleHost } from '../app/src/modules/host.ts'

describe('Snooze Personal — Tier 3 Module Descriptors', () => {
  test('all 4 Tier 3 modules pass validateModuleDescriptor()', () => {
    for (const mod of TIER_3_MODULES) {
      const errors = validateModuleDescriptor(mod)
      assert.deepEqual(errors, [], `Module ${mod.id} failed validation: ${errors.join(', ')}`)
    }
  })

  test('snoozeBalanceTooltipModule descriptor has correct schema, capabilities, and external hosts', () => {
    assert.equal(snoozeBalanceTooltipModule.id, 'SnoozeBalanceTooltip')
    assert.equal(typeof snoozeBalanceTooltipModule.name(), 'string')
    assert.equal(typeof snoozeBalanceTooltipModule.description(), 'string')
    assert.equal(snoozeBalanceTooltipModule.capabilities?.usesEmber, true)
    assert.deepEqual(snoozeBalanceTooltipModule.capabilities?.external, ['wiki.leagueoflegends.com'])
    assert.equal(snoozeBalanceTooltipModule.settings.length, 1)
    assert.equal(snoozeBalanceTooltipModule.settings[0].key, 'enabled')
    assert.equal(snoozeBalanceTooltipModule.settings[0].type, 'toggle')
  })

  test('modeSelectorTweaksModule descriptor has correct schema and capabilities', () => {
    assert.equal(modeSelectorTweaksModule.id, 'modeSelectorTweaks')
    assert.equal(typeof modeSelectorTweaksModule.name(), 'string')
    assert.equal(typeof modeSelectorTweaksModule.description(), 'string')
    assert.equal(modeSelectorTweaksModule.capabilities?.usesEmber, true)
    assert.equal(modeSelectorTweaksModule.settings.length, 1)
    assert.equal(modeSelectorTweaksModule.settings[0].key, 'enabled')
    assert.equal(modeSelectorTweaksModule.settings[0].type, 'toggle')
  })

  test('profileTweaksModule descriptor has correct schema and capabilities', () => {
    assert.equal(profileTweaksModule.id, 'profileTweaks')
    assert.equal(typeof profileTweaksModule.name(), 'string')
    assert.equal(typeof profileTweaksModule.description(), 'string')
    assert.equal(profileTweaksModule.settings.length, 4)
    assert.equal(profileTweaksModule.settings[0].key, 'unlockProfileBackground')
    assert.equal(profileTweaksModule.settings[0].type, 'toggle')
    assert.equal(profileTweaksModule.settings[1].key, 'tokenSlot1')
    assert.equal(profileTweaksModule.settings[1].type, 'text')
  })

  test('socialPanelTweaksModule descriptor has correct schema and capabilities', () => {
    assert.equal(socialPanelTweaksModule.id, 'socialPanelTweaks')
    assert.equal(typeof socialPanelTweaksModule.name(), 'string')
    assert.equal(typeof socialPanelTweaksModule.description(), 'string')
    assert.equal(socialPanelTweaksModule.capabilities?.usesEmber, true)
    assert.equal(socialPanelTweaksModule.settings.length, 5)
    assert.equal(socialPanelTweaksModule.settings[0].key, 'enabled')
    assert.equal(socialPanelTweaksModule.settings[1].key, 'partyGroup')
    assert.equal(socialPanelTweaksModule.settings[2].key, 'folderInvite')
    assert.equal(socialPanelTweaksModule.settings[3].key, 'sidebarToggle')
    assert.equal(socialPanelTweaksModule.settings[4].key, 'collapseMethod')
    assert.equal(socialPanelTweaksModule.settings[4].type, 'select')
  })
})

describe('Snooze Personal — SnoozeBalanceTooltip Logic & Parsing', () => {
  test('getModeKey maps special queue names to canonical mode keys', () => {
    assert.equal(getModeKey('cherry'), 'ar')
    assert.equal(getModeKey('arena'), 'ar')
    assert.equal(getModeKey('ARAM'), 'aram')
    assert.equal(getModeKey('kiwi'), 'aram')
    assert.equal(getModeKey('nexusblitz'), 'nb')
    assert.equal(getModeKey('URF'), 'urf')
    assert.equal(getModeKey('oneforall'), 'ofa')
    assert.equal(getModeKey('ultbook'), 'usb')
    assert.equal(getModeKey('swiftplay'), 'swift')
    assert.equal(getModeKey('classic'), null)
    assert.equal(getModeKey(null), null)
  })

  test('parseStatsBlock and parseWikiLua correctly extracts champion balance stats', () => {
    const mockLua = `
return {
  ["Ahri"] = {
    ["id"] = 103,
    ["stats"] = {
      ["aram"] = {
        ["dmg_dealt"] = 0.95,
        ["dmg_taken"] = 1.05,
        ["ability_haste"] = -10,
      },
      ["ar"] = {
        ["dmg_dealt"] = 1.00,
        ["hp_base"] = 50,
      }
    }
  },
  ["Aatrox"] = {
    ["id"] = 266,
    ["stats"] = {
      ["aram"] = {
        ["dmg_dealt"] = 1.05,
        ["dmg_taken"] = 0.95,
      }
    }
  }
}
`
    const parsed = parseWikiLua(mockLua)
    assert.ok(parsed['103'], 'Ahri (103) parsed')
    assert.equal(parsed['103'].name, 'Ahri')
    assert.equal(parsed['103'].stats.aram?.dmg_dealt, 0.95)
    assert.equal(parsed['103'].stats.aram?.dmg_taken, 1.05)
    assert.equal(parsed['103'].stats.aram?.ability_haste, -10)
    assert.equal(parsed['103'].stats.ar?.hp_base, 50)

    assert.ok(parsed['266'], 'Aatrox (266) parsed')
    assert.equal(parsed['266'].stats.aram?.dmg_dealt, 1.05)
  })

  test('buildStatsHtml renders formatted modifier badges', () => {
    const stats = {
      dmg_dealt: 1.05,
      dmg_taken: 0.95,
      ability_haste: 10,
      hp_base: 60,
    }
    const html = buildStatsHtml(stats)
    assert.match(html, /Damage Dealt/)
    assert.match(html, /\+5\.0%/)
    assert.match(html, /Damage Taken/)
    assert.match(html, /-5\.0%/)
    assert.match(html, /Ability Haste/)
    assert.match(html, /\+10/)
    assert.match(html, /Base Health/)
    assert.match(html, /\+60/)
  })

  test('buildStatsHtml returns fallback when no adjustments exist', () => {
    const html = buildStatsHtml({})
    assert.match(html, /No balance adjustments/)
  })
})

describe('Snooze Personal — ModeSelectorTweaks Logic', () => {
  test('getModeLabel maps internal category keys to user-facing labels', () => {
    assert.equal(getModeLabel('kPvP'), 'PvP')
    assert.equal(getModeLabel('kVersusAI'), 'Co-op vs. AI')
    assert.equal(getModeLabel('kTraining'), 'Training')
    assert.equal(getModeLabel('CLASSIC'), "Summoner's Rift")
    assert.equal(getModeLabel('CHERRY'), 'Arena')
    assert.equal(getModeLabel('unknown_mode'), 'unknown_mode')
  })
})

describe('Snooze Personal — ProfileTweaks Logic & Endpoints', () => {
  test('getCurrentPreferences extracts title, crest, banner and challengeIds', () => {
    const summary = {
      title: { itemId: '10100008', name: 'Master' },
      bannerId: '24',
      crestId: '2',
      prestigeCrestBorderLevel: 400,
      challengeIds: [1, 2, 3, 4],
    }
    const prefs = getCurrentPreferences(summary)
    assert.equal(prefs.title, '10100008')
    assert.equal(prefs.bannerAccent, '24')
    assert.equal(prefs.crestBorder, '2')
    assert.equal(prefs.prestigeCrestBorderLevel, 400)
    assert.deepEqual(prefs.challengeIds, [1, 2, 3])
  })

  test('removeBanner, removeBorder, and updatePlayerTokens invoke correct endpoints', async () => {
    const posts = []
    const puts = []
    const toasts = []

    const mockLcu = {
      get: async (uri) => {
        if (uri === '/lol-challenges/v1/summary-player-data/local-player') {
          return {
            title: { itemId: '10100001' },
            bannerId: '10',
            crestId: '1',
            prestigeCrestBorderLevel: 250,
            challengeIds: [100, 200, 300],
          }
        }
        return {}
      },
      post: async (uri, body) => {
        posts.push({ uri, body })
        return {}
      },
      put: async (uri, body) => {
        puts.push({ uri, body })
        return {}
      },
    }

    const ctx = {
      lcu: mockLcu,
      store: { get: () => null, set: () => true },
      toast: {
        success: (m) => toasts.push({ type: 'success', m }),
        error: (m) => toasts.push({ type: 'error', m }),
      },
      log: () => {},
    }

    const bannerSuccess = await removeBanner(ctx)
    assert.equal(bannerSuccess, true)
    assert.equal(posts[0].uri, '/lol-challenges/v1/update-player-preferences')
    assert.equal(posts[0].body.bannerAccent, '2')

    const borderSuccess = await removeBorder(ctx)
    assert.equal(borderSuccess, true)
    assert.equal(puts[0].uri, '/lol-regalia/v2/current-summoner/regalia')
    assert.equal(puts[0].body.preferredBannerType, 'blank')

    const tokensSuccess = await updatePlayerTokens(ctx, ['101', '202', '303'])
    assert.equal(tokensSuccess, true)
    assert.equal(posts[1].uri, '/lol-challenges/v1/update-player-preferences')
    assert.deepEqual(posts[1].body.challengeIds, [101, 202, 303])
  })
})

describe('Snooze Personal — SocialPanelTweaks Logic', () => {
  test('generatePartyColor returns solid and alpha HSL strings', () => {
    const c1 = generatePartyColor(0)
    const c2 = generatePartyColor(1)
    assert.ok(c1.solid.startsWith('hsl('))
    assert.ok(c1.alpha.startsWith('hsla('))
    assert.notEqual(c1.solid, c2.solid, 'Different party index should yield different colors')
  })

  test('formatGameQueue maps queue IDs to readable mode names', () => {
    assert.equal(formatGameQueue(420), 'Ranked Solo')
    assert.equal(formatGameQueue(440), 'Ranked Flex')
    assert.equal(formatGameQueue(450), 'ARAM')
    assert.equal(formatGameQueue(1700), 'Arena')
    assert.equal(formatGameQueue(999999), 'In Game')
  })
})

describe('Snooze Personal — ModuleHost Integration with Full Tiers 1, 2, & 3 Registry', () => {
  test('ModuleHost initializes all 12 modules and manages full lifecycle cleanly', async () => {
    const tier1to3 = [...TIER_1_MODULES, ...TIER_2_MODULES, ...TIER_3_MODULES]
    assert.equal(tier1to3.length, 12)

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

    // Register all 12 modules across Tiers 1, 2, 3
    host.register(tier1to3)
    assert.equal(host.registry.length, 12)

    // Synchronous installEmberHooks + initAll
    await host.initAll()
    assert.ok(rules.length >= 8, `Ember rules should be registered across modules, found ${rules.length}`)

    await host.loadAll()

    // Test phase transition
    await host.onPhaseChange('InProgress')
    await host.onPhaseChange('Lobby')

    // Teardown all
    await host.unloadAll()
    assert.equal(rules.length, 0, 'All Ember rules must be cleanly deregistered on unloadAll')
  })
})
