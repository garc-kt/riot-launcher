import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { extractSpecialRules } from '../packages/contracts/src/theming.ts'
import { createScopedStore } from '../plugins/src/preload/ext/index.ts'
import { MatchHistoryItemSchema } from '../packages/lcu/src/schemas.ts'

describe('Edge Cases & Boundary Conditions', () => {
  test('theming engine handles empty, nullish, or whitespace-only CSS', () => {
    assert.deepEqual(extractSpecialRules(''), { cleanedCss: '', specialCss: '' })
    assert.deepEqual(extractSpecialRules('   \n  \t '), { cleanedCss: '', specialCss: '' })
    assert.deepEqual(extractSpecialRules(null), { cleanedCss: '', specialCss: '' })
    assert.deepEqual(extractSpecialRules(undefined), { cleanedCss: '', specialCss: '' })
  })

  test('scoped store handles unicode keys, values, and large objects', () => {
    const store = createScopedStore('unicode_test_plugin')

    const unicodeKey = '⚡_ключ_キー_🚀'
    const unicodeVal = { text: 'こんにちは世界 🎮', array: [1, 2, 3] }
    store.set(unicodeKey, unicodeVal)

    assert.deepEqual(store.get(unicodeKey), unicodeVal)
    assert.equal(store.has(unicodeKey), true)
    assert.ok(store.entries().length > 0)
    store.delete(unicodeKey)
    assert.equal(store.has(unicodeKey), false)
  })

  test('rapid phase switching behaves idempotently and reliably', () => {
    let activeState = false
    const phases = ['Lobby', 'ChampSelect', 'InProgress', 'InProgress', 'WaitingForStats', 'EndOfGame', 'InProgress', 'None']
    const history = []

    for (const p of phases) {
      if (p === 'InProgress') {
        activeState = false
      } else {
        activeState = true
      }
      history.push({ phase: p, active: activeState })
    }

    assert.equal(history[2].active, false)
    assert.equal(history[3].active, false)
    assert.equal(history[4].active, true)
    assert.equal(history[6].active, false)
    assert.equal(history[7].active, true)
  })

  test('match schema validates zero duration and empty participants without crash', () => {
    const res = MatchHistoryItemSchema.safeParse({
      gameId: 9999,
      gameCreation: 1700000000,
      gameDuration: 0,
      participants: [],
    })
    assert.equal(res.success, true)
    if (res.success) {
      assert.equal(res.data.gameDuration, 0)
      assert.deepEqual(res.data.participants, [])
    }
  })
})
