/**
 * Ported from Snooze Manager's modules/autoQueue.js
 * Original author: SnoozeFest - github@ReformedDoge
 * Kept in personal/ workspace for personal use only under the project's licensing policy.
 *
 * Automatically re-queues after a game ends. Supports lobby adoption, queue enforcement,
 * ready-state waiting, delay before queueing, and panic key cancellation.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import type { ModuleContext } from './types'

let _armed = false
let _queuing = false
let _unloaded = false
let _lcuUnsubs: Array<() => void> = []
let _cancelPendingRequeue: (() => void) | null = null
let _cancelActiveRun: (() => void) | null = null
let _waitKick: (() => void) | null = null
let _panicUnregister: (() => void) | null = null
let _currentCtx: ModuleContext | null = null

export const SEARCH_VERIFY_DELAY_MS = 1500

export const QUEUE_NAME_OVERRIDES: Record<number, string> = {
  4320: 'CO-OP SR (Classic)',
  3280: 'Custom Mayhem (Classic)',
  3270: 'Custom Mayhem',
  3262: 'Custom Draft (Classic)',
  3260: 'Custom Blind (Classic)',
  2450: 'Mayhem (Classic)',
  4310: 'SR (Classic)',
}

export function queueDisplayName(q: { id: number | string; name?: string; gameMode?: string; description?: string }): string {
  const id = Number(q.id)
  if (QUEUE_NAME_OVERRIDES[id]) return QUEUE_NAME_OVERRIDES[id]
  const lower = (q.name || '').toLowerCase()
  const gm = (q.gameMode || '').toUpperCase()
  if (gm === 'KIWI_JADE') return 'Mayhem (Classic)'
  if (gm === 'KIWI') return 'ARAM: Mayhem'
  if (lower.includes('mayhem classic')) return 'Mayhem (Classic)'
  if (lower.includes('mayhem')) return 'ARAM: Mayhem'
  if (lower.includes('jade') || gm === 'JADE') return 'SR (Classic)'
  return q.name || q.description || String(id)
}

export function isAutoQueueEnabled(ctx: ModuleContext): boolean {
  return Boolean(ctx.store.get<boolean>('enabled', false))
}

export function isQueuing(): boolean {
  return _queuing
}

export function isArmed(): boolean {
  return _armed
}

export async function getCurrentLobby(ctx: ModuleContext): Promise<any | null> {
  try {
    return await ctx.lcu.get('/lol-lobby/v2/lobby')
  } catch {
    return null
  }
}

export function lobbyQueueId(lobby: any): number | null {
  const q = Number(lobby?.gameConfig?.queueId)
  return Number.isFinite(q) && q > 0 ? q : null
}

export async function inMatchmakingSearch(ctx: ModuleContext): Promise<boolean> {
  try {
    const state = await ctx.lcu.get<any>('/lol-lobby/v2/lobby/matchmaking/search-state')
    const s = state?.searchState
    return s === 'Searching' || s === 'Found'
  } catch {
    return false
  }
}

export function requestStop() {
  _cancelPendingRequeue?.()
  _cancelPendingRequeue = null
  _cancelActiveRun?.()
  _cancelActiveRun = null
  _waitKick?.()
  _waitKick = null
}

export function waitForLobbyReady(
  ctx: ModuleContext,
  mode: 'adopt' | 'enforce',
  targetQueueId?: number | null,
  isCancelled: () => boolean = () => false
): Promise<{ ok: boolean; reason?: string; lobby?: any }> {
  return new Promise((resolve) => {
    let settled = false
    let unsub: (() => void) | null = null
    let createAttempted = false
    let rewriteAttemptedFor: number | null = null

    const finish = (result: { ok: boolean; reason?: string; lobby?: any }) => {
      if (settled) return
      settled = true
      _waitKick = null
      unsub?.()
      resolve(result)
    }

    const createLobby = async (queueId: number) => {
      try {
        await ctx.lcu.post('/lol-lobby/v2/lobby', { queueId: Number(queueId) })
      } catch (err: any) {
        ctx.log('ERROR creating lobby:', err?.message ?? err)
      }
    }

    const evaluate = (lobby: any) => {
      if (settled) return
      if (isCancelled() || _unloaded) return finish({ ok: false, reason: 'cancelled' })

      if (!lobby || !lobby.gameConfig) {
        if (mode === 'enforce' && !createAttempted && targetQueueId != null) {
          createAttempted = true
          createLobby(targetQueueId)
        }
        return
      }

      if (!lobby.localMember) return
      if (!lobby.localMember.isLeader) return finish({ ok: false, reason: 'not-leader', lobby })

      const currentQueue = lobbyQueueId(lobby)
      if (mode === 'enforce' && targetQueueId != null && currentQueue !== targetQueueId) {
        if (rewriteAttemptedFor !== currentQueue) {
          rewriteAttemptedFor = currentQueue
          createLobby(targetQueueId)
        }
        return
      }

      if (lobby.canStartActivity) {
        finish({ ok: true, lobby })
      }
    }

    // Subscribe to lobby updates (LcuClient delivers unwrapped raw data)
    unsub = ctx.lcu.observe('/lol-lobby/v2/lobby', (data: any) => evaluate(data))

    _waitKick = () => evaluate(null)

    // Initial check in case lobby is already sitting ready
    getCurrentLobby(ctx).then((lobby) => evaluate(lobby)).catch(() => {})
  })
}

export async function reQueue(ctx: ModuleContext, trigger: 'manual' | 'endOfGame'): Promise<boolean> {
  if (_queuing) {
    ctx.log(`reQueue(${trigger}) skipped — already queuing.`)
    return false
  }

  if (!isAutoQueueEnabled(ctx)) {
    if (trigger === 'manual') ctx.toast.warning('Enable Auto Queue first.')
    return false
  }

  const requeueLast = Boolean(ctx.store.get<boolean>('requeueLastLobby', true))
  let targetQueueId: number | null = null
  if (!requeueLast) {
    targetQueueId = Number(ctx.store.get<number>('queueId', 420))
    if (!Number.isFinite(targetQueueId) || targetQueueId <= 0) {
      ctx.toast.error('Auto Queue: no valid queue selected.')
      return false
    }
  }

  _queuing = true
  try {
    const delaySec = Number(ctx.store.get<number>('delay', 5)) || 0
    const delayMs = delaySec * 1000

    let cancelled = false
    _cancelActiveRun = () => {
      cancelled = true
    }
    const unregPanic = ctx.panic.register(() => {
      cancelled = true
      requestStop()
    })

    try {
      if (await inMatchmakingSearch(ctx)) {
        if (trigger === 'manual') ctx.toast.info('Auto Queue: already in matchmaking.')
        return false
      }

      if (trigger === 'endOfGame') {
        try {
          await ctx.lcu.post('/lol-lobby/v2/play-again', {})
        } catch {
          // If already past EOG, ignore 404
        }
      } else if (requeueLast) {
        const lobby = await getCurrentLobby(ctx)
        if (!lobby || !lobby.gameConfig) {
          ctx.toast.warning('Auto Queue: no lobby found to re-queue.')
          return false
        }
      }

      const mode = requeueLast ? 'adopt' : 'enforce'
      const ready = await waitForLobbyReady(ctx, mode, targetQueueId, () => cancelled)
      if (!ready.ok) {
        if (ready.reason === 'cancelled') {
          ctx.log('Cancelled via Panic Key / Stop.')
        } else if (ready.reason === 'not-leader') {
          ctx.toast.warning('Auto Queue: you are not the party leader.')
        } else {
          ctx.log('Lobby wait ended without readiness.')
        }
        return false
      }

      if (delayMs > 0) {
        let isDelayCancelled = false
        await new Promise<void>((resolve) => {
          let settled = false
          let unregDelayPanic: (() => void) | null = null

          const finish = (wasCancelled: boolean) => {
            if (settled) return
            settled = true
            isDelayCancelled = wasCancelled
            clearTimeout(timer)
            unregDelayPanic?.()
            unregDelayPanic = null
            if (_cancelPendingRequeue === cancel) _cancelPendingRequeue = null
            resolve()
          }

          const cancel = () => finish(true)
          const timer = setTimeout(() => finish(false), delayMs)
          unregDelayPanic = ctx.panic.register(cancel)
          _cancelPendingRequeue = cancel
        })

        if (isDelayCancelled || cancelled) {
          ctx.log('Cancelled during delay.')
          return false
        }
        if (!isAutoQueueEnabled(ctx)) {
          ctx.log('Auto Queue disabled during delay.')
          return false
        }
      }

      try {
        await ctx.lcu.post('/lol-lobby/v2/lobby/matchmaking/search', {})
        ctx.toast.success('Auto Queue: searching for a match...')
      } catch (err: any) {
        ctx.toast.error('Auto Queue: failed to start matchmaking.')
        return false
      }

      // Best-effort search verification
      await new Promise((r) => setTimeout(r, Math.min(SEARCH_VERIFY_DELAY_MS, 50)))
      if (cancelled || _unloaded) return true

      try {
        const state = await ctx.lcu.get<any>('/lol-lobby/v2/lobby/matchmaking/search-state')
        const errors = state?.errors
        if (Array.isArray(errors) && errors.length > 0) {
          const msg = errors[0]?.message || errors[0]?.errorType || 'Search error'
          ctx.toast.warning(`Auto Queue matchmaking error: ${msg}`)
        }
      } catch {}

      return true
    } finally {
      unregPanic()
    }
  } catch (err) {
    ctx.log('Unexpected error during reQueue:', err)
    return false
  } finally {
    _cancelActiveRun = null
    _queuing = false
  }
}

export const autoQueueModule: ModuleDescriptor = {
  id: 'autoQueue',
  name: () => 'Auto Queue',
  description: () => 'Automatically re-queues after a game ends. Supports lobby adoption, queue enforcement, and cancel on panic.',

  capabilities: {
    autoActs: true,
  },

  settings: [
    {
      key: 'enabled',
      type: 'toggle',
      label: () => 'Enable Auto Queue',
      description: () => 'Automatically re-queues into matchmaking when a match finishes.',
      default: false,
    },
    {
      key: 'requeueLastLobby',
      type: 'toggle',
      label: () => 'Requeue Last Lobby',
      description: () => 'Adopts whatever queue and party was previously active (ignores queue selection).',
      default: true,
    },
    {
      key: 'queueId',
      type: 'number',
      label: () => 'Queue ID',
      description: () => 'Specific queue ID to enforce if not adopting last lobby (e.g. 420 for Ranked Solo, 450 for ARAM).',
      default: 420,
    },
    {
      key: 'delay',
      type: 'number',
      label: () => 'Delay before Queue (Seconds)',
      description: () => 'Countdown in seconds to wait after lobby is ready before starting matchmaking.',
      min: 0,
      max: 900,
      step: 1,
      default: 5,
    },
  ],

  init(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    _currentCtx = ctx
    _unloaded = false

    // Register panic cancel hook to satisfy static autoActs invariant
    _panicUnregister = ctx.panic.register(() => {
      requestStop()
    })
  },

  load() {
    if (!_currentCtx) return
    const ctx = _currentCtx
    _unloaded = false

    const unsubPhase = ctx.lcu.observe<string>('/lol-gameflow/v1/gameflow-phase', (phase) => {
      const enabled = isAutoQueueEnabled(ctx)
      if (!enabled) {
        _armed = false
        _queuing = false
        return
      }

      if (phase === 'WaitingForStats' || phase === 'PreEndOfGame') {
        _armed = true
        return
      }

      if (phase === 'EndOfGame') {
        if (_armed) {
          _armed = false
          void reQueue(ctx, 'endOfGame')
        }
        return
      }

      _armed = false
    })

    _lcuUnsubs.push(unsubPhase)
  },

  unload() {
    _unloaded = true
    requestStop()
    _panicUnregister?.()
    _panicUnregister = null
    for (const unsub of _lcuUnsubs) unsub()
    _lcuUnsubs = []
    _armed = false
    _queuing = false
    _currentCtx = null
  },

  onSettingChange(rawCtx: unknown, key: string, value: unknown) {
    if (key === 'enabled' && !value) {
      requestStop()
      _armed = false
    }
  },
}
