/**
 * Ported from Snooze Manager's modules/aramNocd.js
 * Original author: SnoozeFest - github@ReformedDoge
 *
 * Removes ARAM bench cooldowns.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import type { ModuleContext } from './types'

let _hookCleanups: Array<() => void> = []
let _currentCtx: ModuleContext | null = null

function isEnabled(): boolean {
  return _currentCtx?.store?.get<boolean>('enabled', false) ?? false
}

function makeComputedOverride(Ember: any, valueToForce: unknown) {
  if (!Ember?.computed) return false
  const version = Ember.VERSION ? parseFloat(Ember.VERSION) : 1.0
  if (version >= 1.12) {
    return Ember.computed({
      get() {
        return isEnabled() ? valueToForce : false
      },
      set(_key: string, value: unknown) {
        return isEnabled() ? valueToForce : value
      },
    })
  } else {
    return Ember.computed(function (this: any, ...args: any[]) {
      if (args.length > 1) {
        return isEnabled() ? valueToForce : args[1]
      }
      return isEnabled() ? valueToForce : false
    })
  }
}

const getCooldownMixin = (Ember: any) => ({
  init(this: any, ...args: any[]) {
    if (typeof this._super === 'function') {
      this._super(...args)
    }
    if (isEnabled()) {
      this.set('onCooldownFromAllySwap', false)
      this.set('showCooldownAnimation2', false)
      this.set('showCooldownAnimation3', false)
      this.set('benchSwapOnCooldown', false)
      this.set('benchSoundOnCooldown', false)
      this.set('pendingRequest', false)
    }
  },
  _triggerCooldownAnimation(this: any, ...args: any[]) {
    if (isEnabled()) {
      this.set('onCooldownFromAllySwap', false)
      this.set('showCooldownAnimation2', false)
      this.set('showCooldownAnimation3', false)
      return
    }
    if (typeof this._super === 'function') {
      return this._super(...args)
    }
  },
  onCooldownFromAllySwap: makeComputedOverride(Ember, false),
  showCooldownAnimation2: makeComputedOverride(Ember, false),
  showCooldownAnimation3: makeComputedOverride(Ember, false),
  benchSwapOnCooldown: makeComputedOverride(Ember, false),
  benchSoundOnCooldown: makeComputedOverride(Ember, false),
  pendingRequest: makeComputedOverride(Ember, false),
})

export const aramNocdModule: ModuleDescriptor = {
  id: 'aramNocd',
  name: () => 'ARAM No Cooldown',
  description: () => 'Removes the cooldown when swapping champions with the ARAM bench.',

  settings: [
    {
      key: 'enabled',
      type: 'toggle',
      label: () => 'Enable ARAM No Cooldown',
      default: false,
    },
  ],

  capabilities: {
    usesEmber: true,
  },

  installEmberHooks(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    const ember = ctx?.ember || (typeof window !== 'undefined' ? (window as any).__riotEmberHook : null)
    if (!ember || typeof ember.registerRule !== 'function') return

    // Hook parent bench container
    const unregBench = ember.registerRule({
      name: 'aram-nocd-bench-hook',
      matcher: 'champion-bench',
      mixin(Ember: any) {
        const base = getCooldownMixin(Ember)
        return {
          ...base,
          championClicked(this: any, ...args: any[]) {
            if (isEnabled()) {
              this.set('benchSwapOnCooldown', false)
              this.set('pendingRequest', false)
            }
            if (typeof this._super === 'function') {
              return this._super(...args)
            }
          },
        }
      },
    })
    if (unregBench) _hookCleanups.push(unregBench)

    // Hook individual bench slots
    const unregItem = ember.registerRule({
      name: 'aram-nocd-bench-item-hook',
      matcher: 'champion-bench-item',
      mixin(Ember: any) {
        const base = getCooldownMixin(Ember)
        return {
          ...base,
          click(this: any, ...args: any[]) {
            if (isEnabled()) {
              this.set('onCooldownFromAllySwap', false)
              this.set('benchSwapOnCooldown', false)
            }
            if (typeof this._super === 'function') {
              return this._super(...args)
            }
          },
        }
      },
    })
    if (unregItem) _hookCleanups.push(unregItem)
  },

  init(rawCtx: unknown) {
    _currentCtx = rawCtx as ModuleContext
  },

  unload() {
    for (const cleanup of _hookCleanups) cleanup?.()
    _hookCleanups = []
    _currentCtx = null
  },
}
