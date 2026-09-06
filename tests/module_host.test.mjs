import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { ModuleHost } from '../app/src/modules/host.ts'

function createMockStore() {
  const map = new Map()
  return {
    get: (k, fb) => (map.has(k) ? map.get(k) : fb),
    set: (k, v) => { map.set(k, v); return true },
    delete: (k) => map.delete(k),
    has: (k) => map.has(k),
    clear: () => map.clear(),
    entries: () => [...map.entries()],
  }
}

function createMockLcu() {
  return {
    observe: () => () => {},
    getGameflowPhase: async () => 'None',
    post: async () => ({}),
  }
}

function createMockToast() {
  return {
    success: () => {},
    error: () => {},
    info: () => {},
    warning: () => {},
  }
}

describe('ModuleHost — Lifecycle & Execution Ordering', () => {
  test('installs Ember hooks synchronously across all modules BEFORE any init()', async () => {
    const executionOrder = []

    const mod1 = {
      id: 'mod1',
      name: () => 'Mod 1',
      description: () => 'Mod 1 Desc',
      settings: [],
      capabilities: { usesEmber: true },
      installEmberHooks: () => {
        executionOrder.push('mod1:installEmberHooks')
      },
      init: () => {
        executionOrder.push('mod1:init')
      },
      unload: () => {},
    }

    const mod2 = {
      id: 'mod2',
      name: () => 'Mod 2',
      description: () => 'Mod 2 Desc',
      settings: [],
      capabilities: { usesEmber: true },
      installEmberHooks: () => {
        executionOrder.push('mod2:installEmberHooks')
      },
      init: () => {
        executionOrder.push('mod2:init')
      },
      unload: () => {},
    }

    const host = new ModuleHost({
      lcu: createMockLcu(),
      store: createMockStore(),
      toast: createMockToast(),
      log: () => {},
    })

    host.register([mod1, mod2])
    await host.initAll()

    assert.deepEqual(executionOrder, [
      'mod1:installEmberHooks',
      'mod2:installEmberHooks',
      'mod1:init',
      'mod2:init',
    ])
  })

  test('modules without optional load() are fully initialized and torn down on unloadAll()', async () => {
    let unloaded = false

    const mod = {
      id: 'noLoadMod',
      name: () => 'No Load Mod',
      description: () => 'No Load Description',
      settings: [],
      init: () => {},
      // load is omitted
      unload: () => {
        unloaded = true
      },
    }

    const host = new ModuleHost({
      lcu: createMockLcu(),
      store: createMockStore(),
      toast: createMockToast(),
      log: () => {},
    })

    host.register([mod])
    await host.initAll()
    await host.loadAll()

    const stateBefore = host.getState('noLoadMod')
    assert.equal(stateBefore.initialized, true)
    assert.equal(stateBefore.loaded, true)

    await host.unloadAll()

    assert.equal(unloaded, true)
    const stateAfter = host.getState('noLoadMod')
    assert.equal(stateAfter.initialized, false)
    assert.equal(stateAfter.loaded, false)
  })

  test('unloadAll executes teardown in strict reverse registration order', async () => {
    const teardownOrder = []

    const makeMod = (id) => ({
      id,
      name: () => id,
      description: () => id,
      settings: [],
      init: () => {},
      load: () => {},
      unload: () => {
        teardownOrder.push(id)
      },
    })

    const host = new ModuleHost({
      lcu: createMockLcu(),
      store: createMockStore(),
      toast: createMockToast(),
      log: () => {},
    })

    host.register([makeMod('first'), makeMod('second'), makeMod('third')])
    await host.initAll()
    await host.loadAll()
    await host.unloadAll()

    assert.deepEqual(teardownOrder, ['third', 'second', 'first'])
  })
})

describe('ModuleHost — Crash Isolation & Error Recovery', () => {
  test('disables and unloads a module after 3 consecutive errors in guarded methods', async () => {
    let throwCount = 0
    let unloaded = false
    let warningMessage = ''

    const toast = {
      ...createMockToast(),
      warning: (msg) => { warningMessage = msg },
    }

    const buggyMod = {
      id: 'buggy',
      name: () => 'Buggy Module',
      description: () => 'Throws repeatedly',
      settings: [
        { key: 'testKey', type: 'toggle', label: () => 'Test', default: false },
      ],
      init: () => {},
      load: () => {},
      onSettingChange: () => {
        throwCount++
        throw new Error(`Crash #${throwCount}`)
      },
      unload: () => {
        unloaded = true
      },
    }

    const host = new ModuleHost({
      lcu: createMockLcu(),
      store: createMockStore(),
      toast,
      log: () => {},
    })

    host.register([buggyMod])
    await host.initAll()
    await host.loadAll()

    // First crash
    await host.setModuleSetting('buggy', 'testKey', true)
    assert.equal(host.getState('buggy').crashCount, 1)
    assert.equal(host.getState('buggy').disabled, false)

    // Second crash
    await host.setModuleSetting('buggy', 'testKey', false)
    assert.equal(host.getState('buggy').crashCount, 2)
    assert.equal(host.getState('buggy').disabled, false)

    // Third crash -> triggers disable and unloadOne
    await host.setModuleSetting('buggy', 'testKey', true)
    assert.equal(host.getState('buggy').crashCount, 3)
    assert.equal(host.getState('buggy').disabled, true)
    assert.equal(unloaded, true)
    assert.ok(warningMessage.includes('buggy'))

    // Further calls are guarded and ignored
    await host.setModuleSetting('buggy', 'testKey', false)
    assert.equal(throwCount, 3)
  })
})

describe('ModuleHost — Panic Hotkey & Cancel Registrations', () => {
  test('panicAll invokes registered cancel callbacks across all modules', async () => {
    let cancel1Called = false
    let cancel2Called = false

    const mod1 = {
      id: 'mod1',
      name: () => 'Mod 1',
      description: () => 'Desc 1',
      settings: [],
      capabilities: { autoActs: true },
      init: (ctx) => {
        ctx.panic.register(() => {
          cancel1Called = true
        })
      },
      unload: () => {},
    }

    const mod2 = {
      id: 'mod2',
      name: () => 'Mod 2',
      description: () => 'Desc 2',
      settings: [],
      capabilities: { autoActs: true },
      init: (ctx) => {
        ctx.panic.register(() => {
          cancel2Called = true
        })
      },
      unload: () => {},
    }

    const host = new ModuleHost({
      lcu: createMockLcu(),
      store: createMockStore(),
      toast: createMockToast(),
      log: () => {},
    })

    host.register([mod1, mod2])
    await host.initAll()

    host.panicAll()
    assert.equal(cancel1Called, true)
    assert.equal(cancel2Called, true)
  })

  test('initAll throws if an autoActs module fails to call ctx.panic.register', async () => {
    const badMod = {
      id: 'badAutoActs',
      name: () => 'Bad Auto Acts',
      description: () => 'Forgot panic',
      settings: [],
      capabilities: { autoActs: true },
      init: () => {
        // Forgot to call ctx.panic.register(...)
      },
      unload: () => {},
    }

    const host = new ModuleHost({
      lcu: createMockLcu(),
      store: createMockStore(),
      toast: createMockToast(),
      log: () => {},
    })

    host.register([badMod])
    await assert.rejects(
      async () => {
        await host.initAll()
      },
      (err) => {
        assert.match(err.message, /panic registration invariant failed/)
        assert.match(err.message, /badAutoActs/)
        return true
      }
    )
  })
})

describe('ModuleHost — Phase Transitions & Passive Policies', () => {
  test('unloads strict modules during InProgress and re-inits upon returning to Lobby', async () => {
    let strictUnloaded = false
    let strictInitedCount = 0
    let passiveDomUnloaded = false

    const strictMod = {
      id: 'strictMod',
      name: () => 'Strict Mod',
      description: () => 'Strict',
      settings: [],
      capabilities: { passive: 'strict' },
      init: () => {
        strictInitedCount++
      },
      load: () => {},
      unload: () => {
        strictUnloaded = true
      },
    }

    const passiveDomMod = {
      id: 'passiveDomMod',
      name: () => 'Passive DOM Mod',
      description: () => 'Passive DOM',
      settings: [],
      capabilities: { passive: 'passive-dom' },
      init: () => {},
      load: () => {},
      unload: () => {
        passiveDomUnloaded = true
      },
    }

    const host = new ModuleHost({
      lcu: createMockLcu(),
      store: createMockStore(),
      toast: createMockToast(),
      log: () => {},
    })

    host.register([strictMod, passiveDomMod])
    await host.initAll()
    await host.loadAll()
    assert.equal(strictInitedCount, 1)

    // Enter match: InProgress
    await host.onPhaseChange('InProgress')
    assert.equal(strictUnloaded, true)
    assert.equal(passiveDomUnloaded, false) // passive-dom continues running
    assert.equal(host.getState('strictMod').loaded, false)

    // Leave match: EndOfGame -> Lobby
    strictUnloaded = false
    await host.onPhaseChange('Lobby')
    assert.equal(strictInitedCount, 2)
    assert.equal(host.getState('strictMod').loaded, true)
    assert.equal(passiveDomUnloaded, false)
  })

  test('re-installs Ember hooks when strict module recovers from InProgress', async () => {
    let hooksInstalledCount = 0

    const strictEmberMod = {
      id: 'strictEmberMod',
      name: () => 'Strict Ember Mod',
      description: () => 'Strict Ember',
      settings: [],
      capabilities: { usesEmber: true, passive: 'strict' },
      installEmberHooks: () => {
        hooksInstalledCount++
      },
      init: () => {},
      load: () => {},
      unload: () => {},
    }

    const host = new ModuleHost({
      lcu: createMockLcu(),
      store: createMockStore(),
      toast: createMockToast(),
      log: () => {},
    })

    host.register([strictEmberMod])
    await host.initAll()
    await host.loadAll()
    assert.equal(hooksInstalledCount, 1)

    // Match starts
    await host.onPhaseChange('InProgress')
    // Match ends -> recovers to Lobby
    await host.onPhaseChange('Lobby')

    // installEmberHooks must have been called again on recovery
    assert.equal(hooksInstalledCount, 2)
  })

  test('publishSchemas writes schema.json for modules with settings', async () => {
    const writtenFiles = new Map()
    const mockFs = {
      write: (path, content) => {
        writtenFiles.set(path, content)
        return true
      },
    }

    const testMod = {
      id: 'schemaMod',
      name: () => 'Schema Mod',
      description: () => 'Schema Mod Description',
      settings: [
        { key: 'enabled', type: 'toggle', label: () => 'Enable Schema Mod', default: true },
        { key: 'delay', type: 'number', label: () => 'Delay', default: 3 },
      ],
      init: () => {},
      unload: () => {},
    }

    const host = new ModuleHost({
      lcu: createMockLcu(),
      store: createMockStore(),
      toast: createMockToast(),
      fs: mockFs,
      log: () => {},
    })

    host.register([testMod])
    await host.initAll()

    assert.ok(writtenFiles.has('schemaMod.schema.json'))
    const parsed = JSON.parse(writtenFiles.get('schemaMod.schema.json'))
    assert.equal(parsed.id, 'schemaMod')
    assert.equal(parsed.name, 'Schema Mod')
    assert.equal(parsed.settings.length, 2)
    assert.equal(parsed.settings[0].key, 'enabled')
    assert.equal(parsed.settings[0].label, 'Enable Schema Mod')
  })
})

