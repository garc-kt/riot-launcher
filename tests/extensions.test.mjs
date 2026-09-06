import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createScopedStore, createScopedFs, commands } from '../plugins/src/preload/ext/index.ts'

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
})
