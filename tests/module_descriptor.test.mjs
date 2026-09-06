import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateModuleDescriptor,
  validateAutoActsRegisterPanic,
  serializeModuleSchema,
  deserializeModuleSchema,
} from '../packages/contracts/src/module.ts'

function makeModule(overrides = {}) {
  return {
    id: 'testModule',
    name: () => 'Test Module',
    description: () => 'A test module',
    settings: [],
    init: () => {},
    unload: () => {},
    ...overrides,
  }
}

describe('validateModuleDescriptor', () => {
  test('a minimal valid module passes with no errors', () => {
    assert.deepEqual(validateModuleDescriptor(makeModule()), [])
  })

  test('rejects a static string name/description instead of a thunk (the exact Snooze bug this prevents)', () => {
    const errors = validateModuleDescriptor(makeModule({ name: 'Test Module' }))
    assert.ok(errors.some(e => e.includes('name must be a thunk')))
  })

  test('rejects a missing init or unload', () => {
    const noInit = validateModuleDescriptor({ ...makeModule(), init: undefined })
    const noUnload = validateModuleDescriptor({ ...makeModule(), unload: undefined })
    assert.ok(noInit.some(e => e.includes('missing init')))
    assert.ok(noUnload.some(e => e.includes('missing unload')))
  })

  test('accepts a full set of settings field types', () => {
    const mod = makeModule({
      settings: [
        { key: 'enabled', type: 'toggle', label: () => 'Enabled', default: true },
        { key: 'mode', type: 'select', label: () => 'Mode', options: [{ value: 'a', label: () => 'A' }], default: 'a' },
        { key: 'delay', type: 'number', label: () => 'Delay', default: 0 },
        { key: 'note', type: 'text', label: () => 'Note', default: '' },
        { key: 'css', type: 'textarea', label: () => 'CSS', default: '' },
        { key: 'panic', type: 'hotkey', label: () => 'Panic key', default: { ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, code: 'F2', display: 'F2' } },
        { key: 'info', type: 'info', label: () => 'Just info' },
        { key: 'picker', type: 'custom', label: () => 'Champion picker', component: 'ChampionPicker' },
      ],
    })
    assert.deepEqual(validateModuleDescriptor(mod), [])
  })

  test('rejects a settings field with an unknown type', () => {
    const mod = makeModule({ settings: [{ key: 'x', type: 'not-a-real-type', label: () => 'X' }] })
    const errors = validateModuleDescriptor(mod)
    assert.ok(errors.some(e => e.includes('invalid field')))
  })

  test('rejects a select field with no options array', () => {
    const mod = makeModule({ settings: [{ key: 'x', type: 'select', label: () => 'X' }] })
    const errors = validateModuleDescriptor(mod)
    assert.ok(errors.some(e => e.includes('invalid field')))
  })

  test('capabilities.usesEmber requires installEmberHooks', () => {
    const mod = makeModule({ capabilities: { usesEmber: true } })
    const errors = validateModuleDescriptor(mod)
    assert.ok(errors.some(e => e.includes('installEmberHooks')))
  })

  test('capabilities.usesEmber with installEmberHooks present passes', () => {
    const mod = makeModule({ capabilities: { usesEmber: true }, installEmberHooks: () => {} })
    assert.deepEqual(validateModuleDescriptor(mod), [])
  })
})

describe('validateAutoActsRegisterPanic — the autoActs invariant over the real registry', () => {
  test('a module declaring autoActs that registers with panic passes', () => {
    const mod = makeModule({ id: 'autoAccept', capabilities: { autoActs: true } })
    const errors = validateAutoActsRegisterPanic([mod], new Set(['autoAccept']))
    assert.deepEqual(errors, [])
  })

  test('a module declaring autoActs that never registers with panic fails the check', () => {
    const mod = makeModule({ id: 'autoAccept', capabilities: { autoActs: true } })
    const errors = validateAutoActsRegisterPanic([mod], new Set())
    assert.equal(errors.length, 1)
    assert.match(errors[0], /autoAccept.*panic\.register/)
  })

  test('a module without autoActs is not required to register with panic', () => {
    const mod = makeModule({ id: 'aramNocd' })
    const errors = validateAutoActsRegisterPanic([mod], new Set())
    assert.deepEqual(errors, [])
  })

  test('checks every module in a mixed registry independently', () => {
    const good = makeModule({ id: 'autoAccept', capabilities: { autoActs: true } })
    const bad = makeModule({ id: 'autoQueue', capabilities: { autoActs: true } })
    const unaffected = makeModule({ id: 'aramNocd' })
    const errors = validateAutoActsRegisterPanic([good, bad, unaffected], new Set(['autoAccept']))
    assert.equal(errors.length, 1)
    assert.match(errors[0], /autoQueue/)
  })
})

describe('serializeModuleSchema & deserializeModuleSchema (Phase 13)', () => {
  test('serializes and round-trips module settings schemas for desktop loader', () => {
    const mod = makeModule({
      id: 'testSettings',
      name: () => 'Test Settings',
      description: () => 'Settings description',
      settings: [
        { key: 'enabled', type: 'toggle', label: () => 'Enable Feature', default: true },
        {
          key: 'mode',
          type: 'select',
          label: () => 'Select Mode',
          options: [
            { value: 'opt1', label: () => 'Option 1' },
            { value: 'opt2', label: () => 'Option 2' },
          ],
          default: 'opt1',
        },
        { key: 'delay', type: 'number', label: () => 'Delay', min: 0, max: 10, default: 5 },
        { key: 'query', type: 'text', label: () => 'Search', placeholder: () => 'Type here...', default: '' },
      ],
    })

    const serialized = serializeModuleSchema(mod)
    assert.equal(serialized.id, 'testSettings')
    assert.equal(serialized.name, 'Test Settings')
    assert.equal(serialized.description, 'Settings description')
    assert.equal(serialized.settings.length, 4)
    assert.equal(serialized.settings[0].label, 'Enable Feature')
    assert.equal(serialized.settings[1].options[0].label, 'Option 1')
    assert.equal(serialized.settings[3].placeholder, 'Type here...')

    // Deserialization restores thunk functions
    const deserialized = deserializeModuleSchema(serialized)
    assert.equal(deserialized.length, 4)
    assert.equal(typeof deserialized[0].label, 'function')
    assert.equal(deserialized[0].label(), 'Enable Feature')
    assert.equal(typeof deserialized[1].options[0].label, 'function')
    assert.equal(deserialized[1].options[0].label(), 'Option 1')
    assert.equal(typeof deserialized[3].placeholder, 'function')
    assert.equal(deserialized[3].placeholder(), 'Type here...')
  })
})

