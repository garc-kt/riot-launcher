// The companion and personal/snooze load as two independent Pengu plugins,
// each with its own ModuleHost and no guaranteed load order. This registry is
// what lets the companion's Modules tab render a host it did not create.

import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  registerModuleSource,
  unregisterModuleSource,
  getModuleSources,
  clearModuleSources,
} from '../packages/contracts/src/module-bridge.ts'

const source = (id, host = { registry: [] }) => ({
  id,
  label: id,
  getHost: () => host,
})

describe('Cross-plugin module registry', () => {
  beforeEach(() => clearModuleSources())

  test('starts empty', () => {
    assert.deepEqual(getModuleSources(), [])
  })

  test('registers and exposes a source', () => {
    const host = { registry: [{ id: 'autoAccept' }] }
    registerModuleSource(source('snooze', host))

    const sources = getModuleSources()
    assert.equal(sources.length, 1)
    assert.equal(sources[0].id, 'snooze')
    assert.deepEqual(sources[0].getHost().registry, [{ id: 'autoAccept' }])
  })

  test('re-registering the same id replaces rather than duplicates', () => {
    // A plugin reloaded in place must not show its modules twice.
    registerModuleSource(source('snooze', { registry: [{ id: 'v1' }] }))
    registerModuleSource(source('snooze', { registry: [{ id: 'v2' }] }))

    const sources = getModuleSources()
    assert.equal(sources.length, 1)
    assert.deepEqual(sources[0].getHost().registry, [{ id: 'v2' }])
  })

  test('keeps distinct sources separate and ordered', () => {
    registerModuleSource(source('a'))
    registerModuleSource(source('b'))
    assert.deepEqual(getModuleSources().map(s => s.id), ['a', 'b'])
  })

  test('unregisters by id', () => {
    registerModuleSource(source('a'))
    registerModuleSource(source('b'))
    unregisterModuleSource('a')
    assert.deepEqual(getModuleSources().map(s => s.id), ['b'])
    unregisterModuleSource('missing') // must not throw
  })

  test('works regardless of which plugin registers first', () => {
    // Pengu gives no ordering guarantee, so the registry has to be creatable
    // by whichever side touches it first. Reading before any write must not
    // throw or wipe a later registration.
    assert.deepEqual(getModuleSources(), [])
    registerModuleSource(source('late'))
    assert.equal(getModuleSources().length, 1)
  })

  test('tolerates a host that is not ready yet', () => {
    // Sources register during init(), before their host exists.
    let host = null
    registerModuleSource({ id: 'pending', label: 'Pending', getHost: () => host })
    assert.equal(getModuleSources()[0].getHost(), null)

    host = { registry: [{ id: 'ready' }] }
    assert.deepEqual(getModuleSources()[0].getHost().registry, [{ id: 'ready' }])
  })

  test('returns a copy so callers cannot mutate the registry', () => {
    registerModuleSource(source('a'))
    getModuleSources().push(source('injected'))
    assert.equal(getModuleSources().length, 1)
  })
})
