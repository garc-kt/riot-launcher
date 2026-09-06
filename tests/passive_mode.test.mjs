import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createLifecycleManager } from '../app/src/services/lifecycle.ts'

describe('Passive During Matches Rule (§0 & §4.5)', () => {
  test('entering InProgress phase triggers unmount and ceases activity', () => {
    let bootstrapCount = 0
    let teardownCount = 0

    const manager = createLifecycleManager({
      bootstrap: () => { bootstrapCount++ },
      teardown: () => { teardownCount++ },
      isDocumentComplete: () => true,
    })

    // Initial load
    manager.load()
    assert.equal(manager.isMounted(), true)
    assert.equal(bootstrapCount, 1)

    // Simulate match start: InProgress phase
    manager.handlePhaseChange('InProgress')
    assert.equal(manager.isMounted(), false, 'UI should be unmounted during match')
    assert.equal(teardownCount, 1, 'Teardown should be invoked on match start')

    // Repeated InProgress should be idempotent
    manager.handlePhaseChange('InProgress')
    assert.equal(teardownCount, 1, 'Repeated InProgress should not re-trigger teardown')

    // Simulate match end
    manager.handlePhaseChange('EndOfGame')
    assert.equal(manager.isMounted(), true, 'UI should remount after match ends')
    assert.equal(bootstrapCount, 2, 'Bootstrap should be called when match ends')
  })

  test('kill-switch event immediately unmounts companion overlay and prevents automatic remount', () => {
    let bootstrapCount = 0
    let teardownCount = 0

    const manager = createLifecycleManager({
      bootstrap: () => { bootstrapCount++ },
      teardown: () => { teardownCount++ },
      isDocumentComplete: () => true,
    })

    manager.load()
    assert.equal(manager.isMounted(), true)

    // Trigger panic hotkey Ctrl+Shift+Alt+K
    manager.handleKeyDown({ ctrlKey: true, shiftKey: true, altKey: true, code: 'KeyK' })
    assert.equal(manager.isKilled(), true, 'Kill switch must set isKilled flag')
    assert.equal(manager.isMounted(), false, 'Kill switch must immediately unmount overlay')
    assert.equal(teardownCount, 1)

    // When killed, phase changes must NOT resurrect the companion
    manager.handlePhaseChange('ChampSelect')
    manager.handlePhaseChange('EndOfGame')
    manager.load()
    assert.equal(manager.isMounted(), false, 'Companion must stay deactivated while killed')

    // User explicitly re-enables via command toggle
    const handled = manager.handleToggle()
    assert.equal(handled, true)
    assert.equal(manager.isKilled(), false, 'Toggle should clear kill flag')
    assert.equal(manager.isMounted(), true, 'Toggle should re-mount companion')
  })
})
