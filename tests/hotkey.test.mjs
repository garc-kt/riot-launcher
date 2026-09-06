import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  COMPANION_TOGGLE_KEY,
  isEditableTarget,
  matchesHotkey,
} from '../packages/contracts/src/hotkey.ts'

/** Build a KeyboardEvent-shaped object. `path` models composedPath() retargeting. */
function keyEvent(key, { path, target, ...flags } = {}) {
  const event = { key, ...flags }
  if (target !== undefined) event.target = target
  if (path !== undefined) event.composedPath = () => path
  return event
}

const el = (tagName, extra = {}) => ({ tagName, ...extra })

describe('Companion hotkey matching', () => {
  test('F1 is the companion toggle key', () => {
    assert.equal(COMPANION_TOGGLE_KEY, 'F1')
  })

  test('matches a bare F1 press', () => {
    assert.equal(matchesHotkey(keyEvent('F1'), 'F1'), true)
  })

  test('ignores other keys', () => {
    assert.equal(matchesHotkey(keyEvent('F2'), 'F1'), false)
    assert.equal(matchesHotkey(keyEvent('a'), 'F1'), false)
  })

  test('ignores F1 with any modifier held', () => {
    // The loader's native handler owns Ctrl+Shift chords (keyboard.cc); a bare
    // hotkey must never swallow a modified press.
    for (const mod of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey']) {
      assert.equal(
        matchesHotkey(keyEvent('F1', { [mod]: true }), 'F1'),
        false,
        `${mod} held should not match`,
      )
    }
  })

  test('ignores auto-repeat so holding F1 does not flap the panel', () => {
    assert.equal(matchesHotkey(keyEvent('F1', { repeat: true }), 'F1'), false)
  })

  test('does not fire while typing in a text field', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
      assert.equal(
        matchesHotkey(keyEvent('F1', { target: el(tag) }), 'F1'),
        false,
        `${tag} should suppress the hotkey`,
      )
    }
    assert.equal(
      matchesHotkey(keyEvent('F1', { target: el('DIV', { isContentEditable: true }) }), 'F1'),
      false,
      'contenteditable should suppress the hotkey',
    )
  })

  test('fires normally over non-editable elements', () => {
    assert.equal(matchesHotkey(keyEvent('F1', { target: el('DIV') }), 'F1'), true)
    assert.equal(matchesHotkey(keyEvent('F1', { target: el('BODY') }), 'F1'), true)
  })

  test('sees through shadow-DOM retargeting', () => {
    // The companion mounts in a shadow root, so `target` is retargeted to the
    // <companion-root> host. Reading only `target` would miss the focused input
    // inside and fire the hotkey mid-typing.
    const host = el('COMPANION-ROOT')
    const input = el('INPUT')

    assert.equal(
      isEditableTarget({ target: host, composedPath: () => [input, host] }),
      true,
      'composedPath()[0] must win over the retargeted host',
    )
    assert.equal(
      matchesHotkey({ key: 'F1', target: host, composedPath: () => [input, host] }, 'F1'),
      false,
    )
    assert.equal(
      matchesHotkey({ key: 'F1', target: host, composedPath: () => [el('DIV'), host] }, 'F1'),
      true,
    )
  })

  test('tolerates events with no target information', () => {
    assert.equal(matchesHotkey(keyEvent('F1', { path: [] }), 'F1'), true)
    assert.equal(isEditableTarget({}), false)
  })
})
