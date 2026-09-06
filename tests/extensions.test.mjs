import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  createScopedStore,
  createScopedFs,
  commands,
  createPluginExtensions,
  EmberHookManager,
  NetHookManager,
  isPreloadExtDisabled,
} from '../plugins/src/preload/ext/index.ts'

describe('Runtime Extensions API (context.ext)', () => {
  test('scoped store namespaces keys properly preventing collisions', () => {
    const storeA = createScopedStore('pluginA')
    const storeB = createScopedStore('pluginB')

    storeA.set('theme', 'dark')
    storeB.set('theme', 'light')

    assert.equal(storeA.get('theme'), 'dark')
    assert.equal(storeB.get('theme'), 'light')
    assert.equal(storeA.has('theme'), true)
    assert.equal(storeB.has('theme'), true)

    assert.deepEqual(storeA.entries(), [['theme', 'dark']])
    assert.deepEqual(storeB.entries(), [['theme', 'light']])

    storeA.clear()
    assert.equal(storeA.has('theme'), false)
    assert.equal(storeB.has('theme'), true)
  })

  test('scoped store delete and fallback defaults work', () => {
    const store = createScopedStore('myPlugin')
    assert.equal(store.get('missing', 'fallbackVal'), 'fallbackVal')

    store.set('active', true)
    assert.equal(store.has('active'), true)
    store.delete('active')
    assert.equal(store.has('active'), false)
  })

  test('scoped fs handles virtual read, write, and exists', async () => {
    const fs = createScopedFs('test_plugin')
    await fs.writeText('config.json', '{"enabled": true}')
    assert.equal(await fs.exists('config.json'), true)
    const content = await fs.readText('config.json')
    assert.equal(content, '{"enabled": true}')
    const list = await fs.list()
    assert.ok(list.includes('config.json'))
  })

  test('commands registry allows registration, list, execution, and unregister', () => {
    let executed = false
    const unregister = commands.register({
      id: 'test:action',
      name: 'Test Action',
      perform: () => { executed = true },
    })

    assert.equal(commands.list().length, 1)
    commands.execute('test:action')
    assert.equal(executed, true)

    unregister()
    assert.equal(commands.list().length, 0)
  })
  test('createPluginExtensions exposes store, fs, assets, commands, theme, ember, net', () => {
    const ext = createPluginExtensions('samplePlugin')
    assert.ok(ext.store)
    assert.ok(ext.fs)
    assert.ok(ext.assets)
    assert.ok(ext.commands)
    assert.ok(ext.theme)
    assert.ok(ext.ember)
    assert.ok(ext.net)
  })

  test('ember hook registers rules, applies mixins and wraps to Component.extend', () => {
    const manager = new EmberHookManager()
    let mixinApplied = false
    let wrapCalled = false

    const unregister = manager.registerRule({
      name: 'test-component-rule',
      matcher: 'test-class',
      mixin: () => {
        mixinApplied = true
        return { injectedProp: 123 }
      },
      wraps: [
        {
          name: 'someMethod',
          replacement: (caller, args) => {
            wrapCalled = true
            return caller(...args) + ' [wrapped]'
          },
        },
      ],
    })

    assert.equal(manager.getRulesCount(), 1)

    // Mock Ember object with Component.extend
    const mockProto = {
      someMethod(arg) {
        return `original: ${arg}`
      },
    }
    const mockKlass = {
      proto: () => mockProto,
      extend: (mixin) => {
        Object.assign(mockProto, mixin)
        return mockKlass
      },
    }
    const mockEmber = {
      Component: {
        extend(...args) {
          return mockKlass
        },
      },
      Service: {
        extend(...args) {
          return mockKlass
        },
      },
    }

    // Install on mock ember
    manager._hookComponentExtend(mockEmber)

    const Extended = mockEmber.Component.extend({ classNames: ['test-class'] })
    assert.ok(Extended)
    assert.equal(mixinApplied, true)
    assert.equal(mockProto.injectedProp, 123)

    const result = mockProto.someMethod('hello')
    assert.equal(wrapCalled, true)
    assert.equal(result, 'original: hello [wrapped]')

    unregister()
    assert.equal(manager.getRulesCount(), 0)
  })

  test('ember hook error isolation: throwing wrap gracefully falls back to caller', () => {
    const manager = new EmberHookManager()
    manager.registerRule({
      name: 'failing-wrap',
      matcher: '*',
      wraps: [
        {
          name: 'safeMethod',
          replacement: () => {
            throw new Error('wrap failure')
          },
        },
      ],
    })

    const mockProto = {
      safeMethod(val) {
        return val * 2
      },
    }
    const mockKlass = {
      proto: () => mockProto,
      extend: () => mockKlass,
    }
    const mockEmber = {
      Component: {
        extend: () => mockKlass,
      },
    }

    manager._hookComponentExtend(mockEmber)
    mockEmber.Component.extend()

    // Must not throw, caller must execute despite wrap throwing
    const out = mockProto.safeMethod(5)
    assert.equal(out, 10)
  })

  test('net hook intercepts and mutates fetch responses', async () => {
    const manager = new NetHookManager()
    let reqIntercepted = false

    const unregisterReq = manager.hookFetchReq('/lol-test/api', (input) => {
      reqIntercepted = true
    })
    const unregisterRes = manager.hookFetchRes('/lol-test/api', (text) => {
      const data = JSON.parse(text)
      data.modified = true
      return JSON.stringify(data)
    })

    // Setup global window.fetch mock
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      return {
        ok: true,
        status: 200,
        text: async () => '{"name":"original"}',
        json: async () => ({ name: 'original' }),
      }
    }
    globalThis.window = { fetch: globalThis.fetch }

    try {
      manager.install()
      const res = await window.fetch('https://127.0.0.1/lol-test/api/v1')
      assert.equal(reqIntercepted, true)
      const text = await res.text()
      assert.deepEqual(JSON.parse(text), { name: 'original', modified: true })
    } finally {
      globalThis.fetch = originalFetch
      delete globalThis.window
      unregisterReq()
      unregisterRes()
    }
  })

  test('net hook intercepts and mutates websocket published messages', () => {
    const manager = new NetHookManager()
    let publishedEndpoint = ''
    let publishedPayload = null

    const mockDispatcher = {
      publish: (ep, payload) => {
        publishedEndpoint = ep
        publishedPayload = payload
      },
    }

    const unregister = manager.hookWs('/lol-chat/v1/me', (ep, payload) => {
      return { ...payload, statusMessage: 'Overridden' }
    })

    manager.installWs({ socket: { _dispatcher: mockDispatcher } })

    mockDispatcher.publish('/lol-chat/v1/me', { statusMessage: 'Online', id: 1 })
    assert.equal(publishedEndpoint, '/lol-chat/v1/me')
    assert.deepEqual(publishedPayload, { statusMessage: 'Overridden', id: 1 })

    unregister()
  })

  test('escape hatch isPreloadExtDisabled correctly flags bypass', () => {
    // 1. Default (clean env)
    assert.equal(isPreloadExtDisabled(), false)

    // 2. Via window.Pengu.no_preload_ext
    globalThis.window = { Pengu: { no_preload_ext: true } }
    assert.equal(isPreloadExtDisabled(), true)

    // 3. Via window.Pengu.noPreloadExt camelCase
    globalThis.window = { Pengu: { noPreloadExt: true } }
    assert.equal(isPreloadExtDisabled(), true)

    // 4. Via location.search
    globalThis.window = { Pengu: {} }
    globalThis.location = { search: '?foo=bar&no_preload_ext=1' }
    assert.equal(isPreloadExtDisabled(), true)

    // 5. Via localStorage
    globalThis.location = { search: '' }
    globalThis.localStorage = { getItem: (k) => (k === 'no_preload_ext' ? '1' : null) }
    assert.equal(isPreloadExtDisabled(), true)

    // Cleanup
    delete globalThis.location
    delete globalThis.localStorage
    delete globalThis.window
    assert.equal(isPreloadExtDisabled(), false)
  })

  test('ember hook install registers on rcp.postInit and does not latch _installed if rcp is absent', () => {
    const manager = new EmberHookManager()
    assert.equal(manager.isInstalled(), false)

    // Call install without rcp: must not latch _installed
    manager.install({})
    assert.equal(manager.isInstalled(), false)

    // Now call with rcp
    let postInitName = ''
    let postInitCb = null
    let postInitBlocking = null
    const mockRcp = {
      postInit: (name, cb, blocking) => {
        postInitName = name
        postInitCb = cb
        postInitBlocking = blocking
        return true
      },
    }

    manager.install({ rcp: mockRcp })
    assert.equal(manager.isInstalled(), true)
    assert.equal(postInitName, 'rcp-fe-ember-libs')
    assert.equal(postInitBlocking, true)
    assert.equal(typeof postInitCb, 'function')
  })

  test('ember hook prototype inheritance: subclass rules do not mutate parent prototype set', () => {
    const manager = new EmberHookManager()
    const parentProto = { method() { return 'parent' } }
    const childProto = Object.create(parentProto)
    childProto.method = function () { return 'child' }

    const parentKlass = { proto: () => parentProto, extend: () => parentKlass }
    const childKlass = { proto: () => childProto, extend: () => childKlass }

    manager.registerRule({
      name: 'rule-parent',
      matcher: 'parent-class',
      wraps: [{ name: 'method', replacement: (caller, args) => caller(...args) + '+wrappedParent' }],
    })

    let currentKlass = parentKlass
    const mockEmber = { Component: { extend: () => currentKlass } }
    manager._hookComponentExtend(mockEmber)

    // Apply rule to parent
    mockEmber.Component.extend({ classNames: ['parent-class'] })
    assert.equal(parentProto.method(), 'parent+wrappedParent')

    // Now apply rule to child
    manager.registerRule({
      name: 'rule-child',
      matcher: 'child-class',
      wraps: [{ name: 'method', replacement: (caller, args) => caller(...args) + '+wrappedChild' }],
    })
    currentKlass = childKlass
    mockEmber.Component.extend({ classNames: ['child-class'] })

    assert.equal(childProto.method(), 'child+wrappedChild')
    // Parent proto must not have been contaminated with rule-child
    assert.equal(parentProto.method(), 'parent+wrappedParent')
  })

  test('net hook fetch cached response text handles multiple reads and .json()', async () => {
    const manager = new NetHookManager()
    let streamReadCount = 0

    manager.hookFetchRes('/test/stream', (text) => {
      return text.replace('hello', 'world')
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => {
      return {
        ok: true,
        text: async () => {
          streamReadCount++
          if (streamReadCount > 1) {
            throw new TypeError('body stream already read')
          }
          return '{"msg":"hello"}'
        },
      }
    }
    globalThis.window = { fetch: globalThis.fetch }

    try {
      manager.install()
      const res = await window.fetch('https://127.0.0.1/test/stream')
      // First read: .text()
      const text = await res.text()
      assert.equal(text, '{"msg":"world"}')

      // Second read: .json() — must not throw "body stream already read"
      const json = await res.json()
      assert.deepEqual(json, { msg: 'world' })
      assert.equal(streamReadCount, 1)
    } finally {
      globalThis.fetch = originalFetch
      delete globalThis.window
    }
  })

  test('net hook uninstall restores original fetch, xhr open, and ws dispatcher', () => {
    const manager = new NetHookManager()
    const origFetch = () => 'origFetch'
    const origOpen = () => 'origOpen'
    const origPublish = () => 'origPublish'

    const mockDispatcher = { publish: origPublish }
    globalThis.window = { fetch: origFetch }
    globalThis.XMLHttpRequest = function () {}
    globalThis.XMLHttpRequest.prototype.open = origOpen

    try {
      manager.hookFetchReq('/api', () => {})
      manager.hookXhrReq('/api', () => {})
      manager.hookWs('/api', () => {})
      manager.installWs({ socket: { _dispatcher: mockDispatcher } })

      assert.notEqual(window.fetch, origFetch)
      assert.notEqual(XMLHttpRequest.prototype.open, origOpen)
      assert.notEqual(mockDispatcher.publish, origPublish)
      assert.equal(manager.isInstalled(), true)

      manager.uninstall()

      assert.equal(window.fetch, origFetch)
      assert.equal(XMLHttpRequest.prototype.open, origOpen)
      assert.equal(mockDispatcher.publish, origPublish)
      assert.equal(manager.isInstalled(), false)
    } finally {
      delete globalThis.window
      delete globalThis.XMLHttpRequest
    }
  })
})
