import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  migrateSnoozeStore,
  LEGACY_MIGRATION_MAP,
  SNOOZE_MODERN_KEY,
  SNOOZE_LEGACY_TEMP_KEY,
} from '../packages/contracts/src/snooze-migration.ts'

/** In-memory stand-in for window.DataStore, matching its get/has contract. */
function createReader(seed = {}) {
  const data = new Map(Object.entries(seed))
  return {
    has: (key) => data.has(key),
    get: (key, fallback) => (data.has(key) ? data.get(key) : fallback),
  }
}

describe('migrateSnoozeStore — legacy sm:* keys (index.js LEGACY_MIGRATION_MAP)', () => {
  test('migrates every one of the ~28 legacy keys to its target module.key', () => {
    const seed = {}
    for (const [oldKey] of Object.entries(LEGACY_MIGRATION_MAP)) {
      seed[oldKey] = true
    }
    const reader = createReader(seed)
    const result = migrateSnoozeStore(reader)

    for (const [, target] of Object.entries(LEGACY_MIGRATION_MAP)) {
      assert.equal(
        result.store.modules[target.module]?.[target.key],
        true,
        `expected modules.${target.module}.${target.key} to be migrated`
      )
    }
    // sm:exitOnDecline and sm:autoAcceptExitOnDecline both target
    // autoAccept.exitOnDecline — one unique target field, so the migrated
    // count is one less than the raw map size, not equal to it.
    const uniqueTargets = new Set(Object.values(LEGACY_MIGRATION_MAP).map(t => `${t.module}.${t.key}`))
    assert.equal(result.legacyKeyCount, uniqueTargets.size)
  })

  test('two legacy keys mapping to the same module.key (sm:exitOnDecline / sm:autoAcceptExitOnDecline) both settle on autoAccept.exitOnDecline', () => {
    const reader = createReader({
      'sm:autoAcceptExitOnDecline': true,
      'sm:exitOnDecline': false,
    })
    const result = migrateSnoozeStore(reader)
    // First one encountered in the map wins; either true is acceptable —
    // what matters is exactly one coherent value, not both overwriting
    // each other into an inconsistent state.
    assert.equal(typeof result.store.modules.autoAccept.exitOnDecline, 'boolean')
  })

  test('coerces a JSON-object-shaped legacy string value (e.g. autoLockChampionPickIds)', () => {
    const reader = createReader({
      'sm:autoLockChampionPickIds': '{"top":["Darius"],"jungle":[]}',
    })
    const result = migrateSnoozeStore(reader)
    assert.deepEqual(result.store.modules.autoLockChampion.pickIds, { top: ['Darius'], jungle: [] })
  })

  test('coerces a JSON-array-shaped legacy string value', () => {
    const reader = createReader({
      'sm:autoLockChampionBanIds': '[1,2,3]',
    })
    const result = migrateSnoozeStore(reader)
    assert.deepEqual(result.store.modules.autoLockChampion.banIds, [1, 2, 3])
  })

  test('leaves a plain (non-JSON-looking) string value untouched', () => {
    const reader = createReader({
      'sm:customStatusMsg': 'Do not disturb, grinding ranked',
    })
    const result = migrateSnoozeStore(reader)
    assert.equal(result.store.modules.customOnlineStatus.statusMsg, 'Do not disturb, grinding ranked')
  })

  test('a malformed JSON-looking string falls back to the raw string rather than throwing', () => {
    const reader = createReader({
      'sm:autoLockChampionPickIds': '{not valid json',
    })
    const result = migrateSnoozeStore(reader)
    assert.equal(result.store.modules.autoLockChampion.pickIds, '{not valid json')
  })

  test('numeric and falsy-but-defined legacy values survive (delay: 0 is not the same as unset)', () => {
    const reader = createReader({
      'sm:autoAcceptDelay': 0,
      'sm:autoHonorSkip': false,
    })
    const result = migrateSnoozeStore(reader)
    assert.equal(result.store.modules.autoAccept.delay, 0)
    assert.equal(result.store.modules.autoHonor.skip, false)
  })

  test('absent legacy keys are simply not present in the result (no undefined placeholders)', () => {
    const reader = createReader({})
    const result = migrateSnoozeStore(reader)
    assert.deepEqual(result.store.modules, {})
    assert.equal(result.legacyKeyCount, 0)
  })
})

describe('migrateSnoozeStore — modern Snooze-Store (wholesale)', () => {
  test('copies Snooze-Store modules wholesale', () => {
    const reader = createReader({
      [SNOOZE_MODERN_KEY]: {
        schemaVersion: 1,
        autoQueue: { enabled: true, delay: 5000 },
        whaleHelper: { lootHelperEnabled: true },
      },
    })
    const result = migrateSnoozeStore(reader)
    assert.deepEqual(result.store.modules.autoQueue, { enabled: true, delay: 5000 })
    assert.deepEqual(result.store.modules.whaleHelper, { lootHelperEnabled: true })
  })

  test('modern Snooze-Store data wins over a legacy sm:* key for the same field', () => {
    const reader = createReader({
      [SNOOZE_MODERN_KEY]: { autoAccept: { delay: 10 } },
      'sm:autoAcceptDelay': 999,
    })
    const result = migrateSnoozeStore(reader)
    assert.equal(result.store.modules.autoAccept.delay, 10, 'modern value must not be clobbered by a stale legacy one')
  })

  test('legacy sm:* keys still fill in fields the modern store does not cover', () => {
    const reader = createReader({
      [SNOOZE_MODERN_KEY]: { autoAccept: { delay: 10 } },
      'sm:autoAccept': true, // enabled — not present in the modern snapshot above
    })
    const result = migrateSnoozeStore(reader)
    assert.equal(result.store.modules.autoAccept.delay, 10)
    assert.equal(result.store.modules.autoAccept.enabled, true)
  })

  test('the top-level schemaVersion field on the legacy blob is not copied in as a fake module', () => {
    const reader = createReader({
      [SNOOZE_MODERN_KEY]: { schemaVersion: 1, aramNocd: { enabled: true } },
    })
    const result = migrateSnoozeStore(reader)
    assert.equal('schemaVersion' in result.store.modules, false)
  })
})

describe('migrateSnoozeStore — Snooze-Modules (older temp key) promotion', () => {
  test('promotes Snooze-Modules content when the modern key was never written', () => {
    const reader = createReader({
      [SNOOZE_LEGACY_TEMP_KEY]: { aramNocd: { enabled: true } },
    })
    const result = migrateSnoozeStore(reader)
    assert.deepEqual(result.store.modules.aramNocd, { enabled: true })
  })

  test('Snooze-Store (modern) takes priority when both the temp and modern keys exist', () => {
    const reader = createReader({
      [SNOOZE_LEGACY_TEMP_KEY]: { aramNocd: { enabled: false } },
      [SNOOZE_MODERN_KEY]: { aramNocd: { enabled: true } },
    })
    const result = migrateSnoozeStore(reader)
    assert.equal(result.store.modules.aramNocd.enabled, true)
  })
})

describe('migrateSnoozeStore — shape, idempotency, safety', () => {
  test('result always carries schemaVersion 2 and a migratedAt timestamp', () => {
    const result = migrateSnoozeStore(createReader({}))
    assert.equal(result.store.schemaVersion, 2)
    assert.ok(typeof result.store.migratedAt === 'number' && result.store.migratedAt > 0)
  })

  test('is idempotent: running it twice against the same reader yields the same module data', () => {
    const seed = { 'sm:aramNocd': true, [SNOOZE_MODERN_KEY]: { whaleHelper: { lootHelperEnabled: true } } }
    const reader = createReader(seed)
    const first = migrateSnoozeStore(reader)
    const second = migrateSnoozeStore(reader)
    assert.deepEqual(first.store.modules, second.store.modules)
  })

  test('never calls a mutating method on the reader — has/get only (no legacy keys are deleted)', () => {
    let removeCalled = false
    const reader = createReader({ 'sm:aramNocd': true })
    reader.remove = () => { removeCalled = true }
    migrateSnoozeStore(reader)
    assert.equal(removeCalled, false)
  })

  test('an empty/fresh DataStore migrates to an empty modules map without warnings', () => {
    const result = migrateSnoozeStore(createReader({}))
    assert.deepEqual(result.store.modules, {})
    assert.deepEqual(result.warnings, [])
    assert.equal(result.migratedFieldCount, 0)
  })

  test('warns but does not throw when Snooze-Store exists with a non-object value', () => {
    const reader = createReader({ [SNOOZE_MODERN_KEY]: 'not-an-object' })
    const result = migrateSnoozeStore(reader)
    assert.equal(result.warnings.length, 1)
    assert.deepEqual(result.store.modules, {})
  })
})
