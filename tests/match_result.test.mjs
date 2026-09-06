// A remake comes back with win:false, identical to a defeat. Reading `win`
// alone paints them red and makes a run of aborted games look like a losing
// streak, so the early-surrender flag must win.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  matchResult,
  MATCH_RESULT_LABEL,
  MATCH_RESULT_COLOR,
  championItemUsage,
} from '../packages/contracts/src/match-result.ts'

describe('Match result classification', () => {
  test('a win is a victory', () => {
    assert.equal(matchResult({ win: true }), 'victory')
  })

  test('a loss is a defeat', () => {
    assert.equal(matchResult({ win: false }), 'defeat')
  })

  test('an early surrender is a remake, not a defeat', () => {
    assert.equal(matchResult({ win: false, gameEndedInEarlySurrender: true }), 'remake')
  })

  test('remake beats a win flag too', () => {
    // The winning side of a remade game is still a remake, not a victory.
    assert.equal(matchResult({ win: true, gameEndedInEarlySurrender: true }), 'remake')
  })

  test('missing data degrades to defeat rather than throwing', () => {
    assert.equal(matchResult(undefined), 'defeat')
    assert.equal(matchResult(null), 'defeat')
    assert.equal(matchResult({}), 'defeat')
  })

  test('every outcome has a label and a token-backed colour', () => {
    for (const result of ['victory', 'defeat', 'remake']) {
      assert.ok(MATCH_RESULT_LABEL[result], `${result} needs a label`)
      assert.match(MATCH_RESULT_COLOR[result], /^var\(--[a-z-]+\)$/, `${result} must use a token`)
    }
    assert.equal(MATCH_RESULT_COLOR.victory, 'var(--success)')
    assert.equal(MATCH_RESULT_COLOR.remake, 'var(--neutral)')
  })
})

describe('Champion item usage', () => {
  const match = (championId, items, puuid = 'me') => ({
    participants: [
      { puuid: 'other', championId: 999, items: [1, 2, 3] },
      { puuid, championId, items },
    ],
  })

  test('ranks items by how many games they appear in', () => {
    const usage = championItemUsage([
      match(103, [3020, 6655]),
      match(103, [3020, 4645]),
      match(103, [3020, 6655]),
    ], 103, 'me')

    assert.equal(usage[0].itemId, 3020)
    assert.equal(usage[0].games, 3)
    assert.equal(usage[1].itemId, 6655)
    assert.equal(usage[1].games, 2)
  })

  test('ignores games on other champions', () => {
    const usage = championItemUsage([match(103, [3020]), match(238, [3142])], 103, 'me')
    assert.deepEqual(usage.map(u => u.itemId), [3020])
  })

  test('drops empty slots (item id 0)', () => {
    const usage = championItemUsage([match(103, [3020, 0, 0])], 103, 'me')
    assert.deepEqual(usage.map(u => u.itemId), [3020])
  })

  test('counts an item once per game even if slotted twice', () => {
    const usage = championItemUsage([match(103, [2003, 2003, 2003])], 103, 'me')
    assert.equal(usage[0].games, 1)
  })

  test('returns nothing when the player has no games on the champion', () => {
    assert.deepEqual(championItemUsage([match(238, [3142])], 103, 'me'), [])
    assert.deepEqual(championItemUsage([], 103, 'me'), [])
    assert.deepEqual(championItemUsage(null, 103, 'me'), [])
    assert.deepEqual(championItemUsage([match(103, [1])], 0, 'me'), [])
  })

  test('respects the limit', () => {
    const usage = championItemUsage([match(103, [1, 2, 3, 4, 5, 6, 7, 8])], 103, 'me', 3)
    assert.equal(usage.length, 3)
  })
})
