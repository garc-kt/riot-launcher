/**
 * Ported from Snooze Manager's modules/autoAccept.js
 * Original author: SnoozeFest - github@ReformedDoge
 * Kept in personal/ workspace for personal use only under the project's licensing policy.
 *
 * Automatically accept ready checks with optional delay and decline handling.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import type { ModuleContext } from './types'

let isEnabled = false
let acceptedCurrentReadyCheck = false
let wasInReadyCheck = false
let pendingAcceptTimer: any = null
let pendingPanicUnsub: (() => void) | null = null

let _currentCtx: ModuleContext | null = null
let _hookCleanups: Array<() => void> = []
let _lcuUnsubs: Array<() => void> = []

function cancelPendingAccept() {
  if (pendingAcceptTimer !== null) {
    clearTimeout(pendingAcceptTimer)
    pendingAcceptTimer = null
  }
  pendingPanicUnsub?.()
  pendingPanicUnsub = null
}

function exitQueueOnDodge(ctx: ModuleContext, source: string) {
  ctx.log(`[AutoAccept] Dodge detected via ${source}. Exiting queue...`)
  ctx.lcu.delete('/lol-lobby/v2/lobby/matchmaking/search').catch(() => {})
}

function getDelay(ctx: ModuleContext): number {
  const v = ctx.store.get<number>('delay', 0)
  if (v === undefined || v === null) return 0
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.min(10, Math.max(0, n))
}

export const autoAcceptModule: ModuleDescriptor = {
  id: 'autoAccept',
  name: () => 'Auto Accept',
  description: () =>
    'Automatically accepts matchmaking ready checks with optional delay and queue exit on decline.',

  settings: [
    {
      key: 'enabled',
      type: 'toggle',
      label: () => 'Enable Auto Accept',
      default: false,
    },
    {
      key: 'delay',
      type: 'number',
      label: () => 'Accept Delay (seconds)',
      default: 0,
    },
    {
      key: 'exitOnDecline',
      type: 'toggle',
      label: () => 'Exit queue if someone declines',
      default: false,
    },
    {
      key: 'exitOnDodge',
      type: 'toggle',
      label: () => 'Exit queue if someone dodges',
      default: false,
    },
    {
      key: 'hideReadyCheck',
      type: 'toggle',
      label: () => 'Hide queue pop',
      default: false,
    },
  ],

  capabilities: {
    autoActs: true,
    usesEmber: true,
  },

  installEmberHooks(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    const ember = ctx?.ember || (typeof window !== 'undefined' ? (window as any).__riotEmberHook : null)
    if (!ember || typeof ember.registerRule !== 'function') return

    const unregHide = ember.registerRule({
      name: 'autoAccept-hideReadyCheck',
      matcher: 'ready-check-root-element',
      hookMethods: [
        {
          name: 'didInsertElement',
          callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
            const activeCtx = _currentCtx || ctx
            const hide =
              activeCtx?.store?.get<boolean>('enabled', false) &&
              activeCtx?.store?.get<boolean>('hideReadyCheck', false)
            if (!hide) {
              original(...args)
              return
            }
            if (typeof this._super === 'function') this._super(...args)
            if (typeof this.registerStateMachineElement === 'function') this.registerStateMachineElement()
            if (typeof this.setUpAudioListeners === 'function') this.setUpAudioListeners()
            const e = this.element?.parentElement?.parentElement
            if (e && e.parentElement) {
              e.parentElement.removeChild(e)
            }
          },
        },
      ],
    })
    if (unregHide) _hookCleanups.push(unregHide)

    const unregDodge = ember.registerRule({
      name: 'autoAccept-exitOnDodge',
      matcher: 'parties-notifications',
      hookMethods: [
        {
          name: '_strangerDodged',
          callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
            original(...args)
            const activeCtx = _currentCtx || ctx
            if (!activeCtx?.store?.get<boolean>('exitOnDodge', false)) return
            exitQueueOnDodge(activeCtx, 'EmberHook:parties-notifications._strangerDodged')
          },
        },
      ],
    })
    if (unregDodge) _hookCleanups.push(unregDodge)
  },

  init(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    _currentCtx = ctx
    isEnabled = ctx.store.get<boolean>('enabled', false)

    // Invariant: autoActs module MUST register with ctx.panic
    ctx.panic.register(() => {
      cancelPendingAccept()
      ctx.log('[AutoAccept] Panic received: cancelled pending accept.')
    })

    // Setup LCU observers
    const unsubPhase = ctx.lcu.observe<string>('/lol-gameflow/v1/gameflow-phase', (phase) => {
      const exitOnDecline = ctx.store.get<boolean>('exitOnDecline', false)
      if (phase === 'ReadyCheck') {
        wasInReadyCheck = true
        if (!ctx.store.get<boolean>('enabled', false)) return
        if (acceptedCurrentReadyCheck) return
        acceptedCurrentReadyCheck = true

        const delay = getDelay(ctx)
        if (delay <= 0) {
          ctx.lcu.post('/lol-matchmaking/v1/ready-check/accept').catch(() => {})
        } else {
          cancelPendingAccept()
          let isCancelled = false
          pendingPanicUnsub = ctx.panic.register(() => {
            isCancelled = true
            cancelPendingAccept()
          })

          pendingAcceptTimer = setTimeout(() => {
            pendingAcceptTimer = null
            pendingPanicUnsub?.()
            pendingPanicUnsub = null
            if (isCancelled || !ctx.store.get<boolean>('enabled', false) || !acceptedCurrentReadyCheck) return
            ctx.lcu.post('/lol-matchmaking/v1/ready-check/accept').catch(() => {})
          }, delay * 1000)
        }
      } else if (phase === 'Lobby' && wasInReadyCheck && exitOnDecline) {
        cancelPendingAccept()
        wasInReadyCheck = false
        acceptedCurrentReadyCheck = false
        ctx.log('[AutoAccept] ReadyCheck ended without accepting. Exiting queue...')
        ctx.lcu.delete('/lol-lobby/v2/lobby/matchmaking/search').catch(() => {})
      } else {
        cancelPendingAccept()
        wasInReadyCheck = false
        acceptedCurrentReadyCheck = false
      }
    })
    _lcuUnsubs.push(unsubPhase)

    const unsubReadyCheck = ctx.lcu.observe<any>('/lol-matchmaking/v1/ready-check', (data) => {
      if (!data || !ctx.store.get<boolean>('exitOnDecline', false)) return
      if (data.state === 'StrangerNotReady' || data.state === 'PartyNotReady') {
        ctx.log('[AutoAccept] Queue declined by someone. Exiting queue...')
        ctx.lcu.delete('/lol-lobby/v2/lobby/matchmaking/search').catch(() => {})
      }
    })
    _lcuUnsubs.push(unsubReadyCheck)

    const unsubNotifs = ctx.lcu.observe<any>('/lol-lobby/v2/notifications', (data) => {
      if (!data || !ctx.store.get<boolean>('exitOnDodge', false)) return
      const notifications = Array.isArray(data) ? data : [data]
      for (const n of notifications) {
        if (n?.notificationReason === 'StrangerDodged') {
          exitQueueOnDodge(ctx, 'WS:/lol-lobby/v2/notifications')
          break
        }
      }
    })
    _lcuUnsubs.push(unsubNotifs)
  },

  unload() {
    cancelPendingAccept()
    acceptedCurrentReadyCheck = false
    wasInReadyCheck = false
    for (const unsub of _lcuUnsubs) unsub()
    _lcuUnsubs = []
    for (const cleanup of _hookCleanups) cleanup()
    _hookCleanups = []
    _currentCtx = null
  },

  onSettingChange(rawCtx: unknown, key: string, value: unknown) {
    if (key === 'enabled') {
      isEnabled = Boolean(value)
      if (!isEnabled) cancelPendingAccept()
    }
  },
}
