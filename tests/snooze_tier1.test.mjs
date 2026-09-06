import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { validateModuleDescriptor } from '../packages/contracts/src/module.ts'
import {
  TIER_1_MODULES,
  champSelectQuitButtonModule,
  aramNocdModule,
  penaltyUISuppressModule,
  useClientDuringGameModule,
} from '../personal/snooze/src/index.ts'
import { ModuleHost } from '../app/src/modules/host.ts'

describe('Snooze Personal — Tier 1 Module Descriptors', () => {
  test('every module in TIER_1_MODULES passes validateModuleDescriptor()', () => {
    assert.equal(TIER_1_MODULES.length, 4)
    for (const mod of TIER_1_MODULES) {
      const errors = validateModuleDescriptor(mod)
      assert.deepEqual(errors, [], `Module ${mod.id} failed validation: ${errors.join(', ')}`)
    }
  })

  test('champSelectQuitButtonModule descriptor has correct schema and capabilities', () => {
    assert.equal(champSelectQuitButtonModule.id, 'champSelectQuitButton')
    assert.equal(typeof champSelectQuitButtonModule.name(), 'string')
    assert.equal(typeof champSelectQuitButtonModule.description(), 'string')
    assert.equal(champSelectQuitButtonModule.capabilities?.usesEmber, true)
    assert.equal(champSelectQuitButtonModule.settings.length, 1)
    assert.equal(champSelectQuitButtonModule.settings[0].key, 'enabled')
    assert.equal(champSelectQuitButtonModule.settings[0].type, 'toggle')
    assert.equal(champSelectQuitButtonModule.settings[0].default, false)
  })

  test('aramNocdModule descriptor has correct schema and capabilities', () => {
    assert.equal(aramNocdModule.id, 'aramNocd')
    assert.equal(typeof aramNocdModule.name(), 'string')
    assert.equal(typeof aramNocdModule.description(), 'string')
    assert.equal(aramNocdModule.capabilities?.usesEmber, true)
    assert.equal(aramNocdModule.settings.length, 1)
    assert.equal(aramNocdModule.settings[0].key, 'enabled')
    assert.equal(aramNocdModule.settings[0].type, 'toggle')
    assert.equal(aramNocdModule.settings[0].default, false)
  })

  test('penaltyUISuppressModule descriptor has correct schema and capabilities', () => {
    assert.equal(penaltyUISuppressModule.id, 'lowPrioWarningSuppress')
    assert.equal(typeof penaltyUISuppressModule.name(), 'string')
    assert.equal(typeof penaltyUISuppressModule.description(), 'string')
    assert.equal(penaltyUISuppressModule.capabilities?.usesEmber, true)
    assert.equal(penaltyUISuppressModule.settings.length, 2)
    assert.equal(penaltyUISuppressModule.settings[0].key, 'enabled')
    assert.equal(penaltyUISuppressModule.settings[0].default, true)
    assert.equal(penaltyUISuppressModule.settings[1].key, 'restrictionInfoEnabled')
    assert.equal(penaltyUISuppressModule.settings[1].default, true)
  })

  test('useClientDuringGameModule descriptor has passive-dom policy', () => {
    assert.equal(useClientDuringGameModule.id, 'useClientDuringGame')
    assert.equal(useClientDuringGameModule.capabilities?.passive, 'passive-dom')
    assert.equal(useClientDuringGameModule.settings.length, 1)
  })
})

describe('Snooze Personal — Tier 1 Ember Hook Registration', () => {
  test('champSelectQuitButton registers champion-select rule with didInsertElement and willDestroyElement', () => {
    let registeredRule = null
    const mockEmber = {
      registerRule: (rule) => {
        registeredRule = rule
        return () => { registeredRule = null }
      },
    }

    champSelectQuitButtonModule.installEmberHooks?.({ ember: mockEmber })
    assert.ok(registeredRule)
    assert.equal(registeredRule.name, 'champ-select-quit-button-hook')
    assert.equal(registeredRule.matcher, 'champion-select')
    assert.equal(registeredRule.hookMethods.length, 2)
    assert.equal(registeredRule.hookMethods[0].name, 'didInsertElement')
    assert.equal(registeredRule.hookMethods[1].name, 'willDestroyElement')

    champSelectQuitButtonModule.unload()
    assert.equal(registeredRule, null)
  })

  test('aramNocd registers 2 rules: bench and bench-item hooks', () => {
    const rules = []
    const mockEmber = {
      registerRule: (rule) => {
        rules.push(rule)
        return () => {
          const idx = rules.indexOf(rule)
          if (idx >= 0) rules.splice(idx, 1)
        }
      },
    }

    aramNocdModule.installEmberHooks?.({ ember: mockEmber })
    assert.equal(rules.length, 2)
    assert.equal(rules[0].name, 'aram-nocd-bench-hook')
    assert.equal(rules[0].matcher, 'champion-bench')
    assert.equal(rules[1].name, 'aram-nocd-bench-item-hook')
    assert.equal(rules[1].matcher, 'champion-bench-item')

    aramNocdModule.unload()
    assert.equal(rules.length, 0)
  })

  test('penaltyUISuppress registers matchmaking monitor and dialog fallback rules', () => {
    const rules = []
    const mockEmber = {
      registerRule: (rule) => {
        rules.push(rule)
        return () => {
          const idx = rules.indexOf(rule)
          if (idx >= 0) rules.splice(idx, 1)
        }
      },
    }

    penaltyUISuppressModule.installEmberHooks?.({ ember: mockEmber })
    assert.ok(rules.length >= 8) // monitor + 6 dialogs + restriction info
    assert.ok(rules.some((r) => r.name === 'matchmaking-error-monitor-suppress'))
    assert.ok(rules.some((r) => r.name === 'parties-queue-error-dialog-suppress'))
    assert.ok(rules.some((r) => r.name === 'low-priority-dialog-suppress'))
    assert.ok(rules.some((r) => r.name === 'player-restriction-info-suppress'))

    penaltyUISuppressModule.unload()
    assert.equal(rules.length, 0)
  })
})

describe('Snooze Personal — ModuleHost Integration with Tier 1 Registry', () => {
  test('ModuleHost registers, inits, and teardowns Tier 1 modules without crashing', async () => {
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
      getGameflowPhase: async () => 'None',
      post: async () => ({}),
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

    const host = new ModuleHost({
      lcu: mockLcu,
      store,
      toast,
      ember: mockEmber,
      log: () => {},
    })

    host.register(TIER_1_MODULES)
    assert.equal(host.registry.length, 4)

    await host.initAll()
    await host.loadAll()

    assert.ok(rules.length > 0, 'Ember rules should be registered after initAll')

    for (const mod of TIER_1_MODULES) {
      const state = host.getState(mod.id)
      assert.ok(state, `State missing for ${mod.id}`)
      assert.equal(state.disabled, false, `${mod.id} was disabled`)
    }

    // Setting update round-trip
    await host.setModuleSetting('champSelectQuitButton', 'enabled', true)
    assert.equal(host.getModuleSetting('champSelectQuitButton', 'enabled'), true)

    await host.setModuleSetting('lowPrioWarningSuppress', 'enabled', false)
    assert.equal(host.getModuleSetting('lowPrioWarningSuppress', 'enabled'), false)

    await host.unloadAll()
    assert.equal(rules.length, 0, 'All Ember rules must be cleaned up on unloadAll')
  })
})
