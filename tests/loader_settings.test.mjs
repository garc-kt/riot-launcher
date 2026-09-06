import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  serializeModuleSchema,
  deserializeModuleSchema,
} from '../packages/contracts/src/module.ts'

describe('Phase 13: Loader-side Settings Infrastructure', () => {
  test('serializes and deserializes all 8 field types without loss', () => {
    const mockModule = {
      id: 'comprehensivePlugin',
      name: () => 'Comprehensive Plugin',
      description: () => 'A plugin with all field types',
      settings: [
        {
          key: 'toggleOpt',
          type: 'toggle',
          label: () => 'Enable Toggle',
          description: () => 'Toggle description',
          default: true,
        },
        {
          key: 'selectOpt',
          type: 'select',
          label: () => 'Select Option',
          options: [
            { value: 'a', label: () => 'Alpha' },
            { value: 'b', label: () => 'Beta' },
          ],
          default: 'a',
        },
        {
          key: 'numberOpt',
          type: 'number',
          label: () => 'Number Option',
          min: 1,
          max: 100,
          step: 5,
          default: 25,
        },
        {
          key: 'textOpt',
          type: 'text',
          label: () => 'Text Option',
          placeholder: () => 'Enter text...',
          default: 'default text',
        },
        {
          key: 'textareaOpt',
          type: 'textarea',
          label: () => 'Textarea Option',
          placeholder: () => 'Enter multiline text...',
          default: 'line 1\nline 2',
        },
        {
          key: 'hotkeyOpt',
          type: 'hotkey',
          label: () => 'Panic Key',
          default: {
            ctrlKey: false,
            shiftKey: false,
            altKey: false,
            metaKey: false,
            code: 'F2',
            display: 'F2',
          },
        },
        {
          key: 'infoOpt',
          type: 'info',
          label: () => 'Note: This is informational text.',
        },
        {
          key: 'customOpt',
          type: 'custom',
          component: 'ChampionPicker',
          label: () => 'Pick Champions',
          default: [1, 2, 3],
        },
      ],
      init: () => {},
      unload: () => {},
    }

    const serialized = serializeModuleSchema(mockModule)
    assert.equal(serialized.id, 'comprehensivePlugin')
    assert.equal(serialized.name, 'Comprehensive Plugin')
    assert.equal(serialized.description, 'A plugin with all field types')
    assert.equal(serialized.settings.length, 8)

    // Verify JSON serialization round-trip (e.g. plugins_data/<id>.schema.json)
    const jsonStr = JSON.stringify(serialized, null, 2)
    const parsedFromJson = JSON.parse(jsonStr)

    const deserialized = deserializeModuleSchema(parsedFromJson)
    assert.equal(deserialized.length, 8)

    // 1. toggle
    assert.equal(deserialized[0].key, 'toggleOpt')
    assert.equal(deserialized[0].type, 'toggle')
    assert.equal(deserialized[0].label(), 'Enable Toggle')
    assert.equal(deserialized[0].description?.(), 'Toggle description')
    assert.equal(deserialized[0].default, true)

    // 2. select
    assert.equal(deserialized[1].key, 'selectOpt')
    assert.equal(deserialized[1].type, 'select')
    assert.equal(deserialized[1].label(), 'Select Option')
    assert.equal(deserialized[1].options?.length, 2)
    assert.equal(deserialized[1].options?.[0].value, 'a')
    assert.equal(deserialized[1].options?.[0].label(), 'Alpha')
    assert.equal(deserialized[1].options?.[1].value, 'b')
    assert.equal(deserialized[1].options?.[1].label(), 'Beta')
    assert.equal(deserialized[1].default, 'a')

    // 3. number
    assert.equal(deserialized[2].key, 'numberOpt')
    assert.equal(deserialized[2].type, 'number')
    assert.equal(deserialized[2].min, 1)
    assert.equal(deserialized[2].max, 100)
    assert.equal(deserialized[2].step, 5)
    assert.equal(deserialized[2].default, 25)

    // 4. text
    assert.equal(deserialized[3].key, 'textOpt')
    assert.equal(deserialized[3].type, 'text')
    assert.equal(deserialized[3].placeholder?.(), 'Enter text...')
    assert.equal(deserialized[3].default, 'default text')

    // 5. textarea
    assert.equal(deserialized[4].key, 'textareaOpt')
    assert.equal(deserialized[4].type, 'textarea')
    assert.equal(deserialized[4].placeholder?.(), 'Enter multiline text...')
    assert.equal(deserialized[4].default, 'line 1\nline 2')

    // 6. hotkey
    assert.equal(deserialized[5].key, 'hotkeyOpt')
    assert.equal(deserialized[5].type, 'hotkey')
    assert.deepEqual(deserialized[5].default, {
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      code: 'F2',
      display: 'F2',
    })

    // 7. info
    assert.equal(deserialized[6].key, 'infoOpt')
    assert.equal(deserialized[6].type, 'info')
    assert.equal(deserialized[6].label(), 'Note: This is informational text.')

    // 8. custom
    assert.equal(deserialized[7].key, 'customOpt')
    assert.equal(deserialized[7].type, 'custom')
    assert.equal(deserialized[7].component, 'ChampionPicker')
    assert.deepEqual(deserialized[7].default, [1, 2, 3])
  })

  test('combines multiple module schemas and scopes keys with modules: prefix', () => {
    const modA = {
      id: 'modA',
      name: () => 'Module Alpha',
      description: () => 'First module',
      settings: [
        { key: 'enabled', type: 'toggle', label: () => 'Enable Alpha', default: true },
        { key: 'count', type: 'number', label: () => 'Alpha Count', default: 3 },
      ],
      init: () => {},
      unload: () => {},
    }

    const modB = {
      id: 'modB',
      name: () => 'Module Beta',
      description: () => 'Second module',
      settings: [
        { key: 'enabled', type: 'toggle', label: () => 'Enable Beta', default: false },
        { key: 'name', type: 'text', label: () => 'Beta Name', default: 'Hero' },
      ],
      init: () => {},
      unload: () => {},
    }

    const serializedA = serializeModuleSchema(modA)
    const serializedB = serializeModuleSchema(modB)

    // Simulate multi-module directory aggregation (PluginManager.getPluginSchema logic)
    const combinedSettings = []
    const schemaList = [serializedA, serializedB]
    for (const modSchema of schemaList) {
      if (schemaList.length > 1) {
        combinedSettings.push({
          key: `__info_${modSchema.id}`,
          type: 'info',
          label: modSchema.name || modSchema.id,
        })
      }
      for (const s of modSchema.settings) {
        const key = s.key.startsWith('modules:') ? s.key : `modules:${modSchema.id}:${s.key}`
        combinedSettings.push({ ...s, key })
      }
    }

    assert.equal(combinedSettings.length, 6) // 2 headers + 4 settings
    assert.equal(combinedSettings[0].key, '__info_modA')
    assert.equal(combinedSettings[1].key, 'modules:modA:enabled')
    assert.equal(combinedSettings[2].key, 'modules:modA:count')
    assert.equal(combinedSettings[3].key, '__info_modB')
    assert.equal(combinedSettings[4].key, 'modules:modB:enabled')
    assert.equal(combinedSettings[5].key, 'modules:modB:name')

    // Simulate settings values update
    const values = {}
    values[combinedSettings[1].key] = false
    values[combinedSettings[2].key] = 10
    values[combinedSettings[4].key] = true
    values[combinedSettings[5].key] = 'Champion'

    // Verify stored JSON matches format expected by ModuleHost / ScopedStore
    const savedJson = JSON.stringify(values)
    const restored = JSON.parse(savedJson)
    assert.equal(restored['modules:modA:enabled'], false)
    assert.equal(restored['modules:modA:count'], 10)
    assert.equal(restored['modules:modB:enabled'], true)
    assert.equal(restored['modules:modB:name'], 'Champion')
  })
})
