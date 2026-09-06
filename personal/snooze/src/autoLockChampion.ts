/**
 * Ported from Snooze Manager's modules/autoLockChampion.js
 * Original author: SnoozeFest - github@ReformedDoge
 * Kept in personal/ workspace for personal use only under the project's licensing policy.
 *
 * Auto-locks priority champions during champ select with role-specific picks and bans,
 * hover delay, timer threshold tracking, teammate intent respect, and panic cancellation.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import type { ModuleContext } from './types'

export const MAX_PRIORITY_CHAMPS = 3
export const PICK_PRIORITY_KEY = 'pickIds'
export const BAN_PRIORITY_KEY = 'banIds'
export const LOCK_MODE_KEY = 'lockMode'
export const LOCK_TIME_KEY = 'lockTime'
export const HOVER_DELAY_KEY = 'hoverDelay'

export type AssignedRole = 'default' | 'top' | 'jungle' | 'middle' | 'bottom' | 'utility'

let isEnabled = false
let panicActive = false
let _unloaded = false
let _lcuUnsubs: Array<() => void> = []
let _hookCleanups: Array<() => void> = []
let _panicUnregister: (() => void) | null = null
let _currentCtx: ModuleContext | null = null
let _emberTimerMs: number | null = null

let lastSessionData: any = null
const actionActiveStartTimes = new Map<number, number>()
const actionHoverStartTimes = new Map<number, number>()
const lastPatchTimes = new Map<string, number>()
const pluginSetChampionIds = new Map<number, number>()
const manuallyOverriddenActionIds = new Set<number>()
const pendingTimers = new Set<any>()

export function asChampionList(value: unknown): number[] {
  const raw = Array.isArray(value) ? value : value ? [value] : []
  const seen = new Set<number>()
  const ids: number[] = []

  raw.forEach((item) => {
    const id = Number(item)
    if (!id || id <= 0 || seen.has(id)) return
    seen.add(id)
    ids.push(id)
  })

  return ids.slice(0, MAX_PRIORITY_CHAMPS)
}

export function getPriorityList(ctx: ModuleContext, key: string, role: string = 'default'): number[] {
  const actualKey = role === 'default' ? key : `${key}_${role}`
  const current = asChampionList(ctx.store.get(actualKey))

  // Fallback to default role list if specific role has no entries
  if (current.length === 0 && role !== 'default') {
    return asChampionList(ctx.store.get(key))
  }

  return current
}

export function setPriorityList(ctx: ModuleContext, key: string, role: string, ids: number[]) {
  const actualKey = role === 'default' ? key : `${key}_${role}`
  ctx.store.set(actualKey, ids.slice(0, MAX_PRIORITY_CHAMPS))
}

export function getBannedChampionIds(session: any): Set<number> {
  const banned = new Set<number>()
  const bans = session?.bans
  if (bans) {
    if (Array.isArray(bans.myTeamBans)) {
      bans.myTeamBans.forEach((id: any) => {
        if (Number(id) > 0) banned.add(Number(id))
      })
    }
    if (Array.isArray(bans.theirTeamBans)) {
      bans.theirTeamBans.forEach((id: any) => {
        if (Number(id) > 0) banned.add(Number(id))
      })
    }
  }

  const allActions = session?.actions ? session.actions.flat(2) : []
  allActions.forEach((a: any) => {
    if (a.type === 'ban' && a.completed && Number(a.championId) > 0) {
      banned.add(Number(a.championId))
    }
  })
  return banned
}

export function getPickedChampionIds(session: any): Set<number> {
  const picked = new Set<number>()
  if (Array.isArray(session?.myTeam)) {
    session.myTeam.forEach((m: any) => {
      if (Number(m.championId) > 0) picked.add(Number(m.championId))
    })
  }
  if (Array.isArray(session?.theirTeam)) {
    session.theirTeam.forEach((m: any) => {
      if (Number(m.championId) > 0) picked.add(Number(m.championId))
    })
  }
  const allActions = session?.actions ? session.actions.flat(2) : []
  allActions.forEach((a: any) => {
    if (a.type === 'pick' && a.completed && Number(a.championId) > 0) {
      picked.add(Number(a.championId))
    }
  })
  return picked
}

export function getTeammateIntents(session: any): Set<number> {
  const intents = new Set<number>()
  if (Array.isArray(session?.myTeam)) {
    session.myTeam.forEach((p: any) => {
      if (p.cellId !== session.localPlayerCellId) {
        const intent = Number(p.championPickIntent)
        if (intent > 0) intents.add(intent)
      }
    })
  }
  return intents
}

export function chooseChampionForAction(
  ctx: ModuleContext,
  session: any,
  action: any,
  role: string = 'default',
  bannedIds = getBannedChampionIds(session),
  pickedIds = getPickedChampionIds(session)
): number | null {
  const isPick = action.type === 'pick'
  const key = isPick ? PICK_PRIORITY_KEY : BAN_PRIORITY_KEY
  const priorityList = getPriorityList(ctx, key, role)
  if (priorityList.length === 0) return null

  const respectTeamIntent = ctx.store.get<boolean>('respectTeamIntent', true)
  const teammateIntents = respectTeamIntent ? getTeammateIntents(session) : new Set<number>()

  for (const champId of priorityList) {
    if (bannedIds.has(champId)) continue
    if (pickedIds.has(champId)) continue
    // If banning, do not ban a champion your teammate intended to pick
    if (!isPick && teammateIntents.has(champId)) continue

    return champId
  }

  return null
}

export function getCurrentActiveActions(session: any): any[] {
  const actions = session?.actions
  if (!Array.isArray(actions)) return []
  for (const actionSet of actions) {
    if (Array.isArray(actionSet) && actionSet.length > 0) {
      const playerActions = actionSet.filter((a: any) => a.actorCellId >= 0)
      if (playerActions.length === 0) continue
      const allCompleted = playerActions.every((a: any) => a.completed)
      if (!allCompleted) {
        return actionSet.filter((a: any) => !a.completed && a.actorCellId >= 0)
      }
    }
  }
  return []
}

export async function processChampSelectSession(ctx: ModuleContext, s: any) {
  if (!isEnabled || !s || panicActive) return

  if (lastSessionData && s.gameId !== lastSessionData.gameId) {
    manuallyOverriddenActionIds.clear()
    pluginSetChampionIds.clear()
    actionActiveStartTimes.clear()
    actionHoverStartTimes.clear()
    lastPatchTimes.clear()
    panicActive = false
  }
  lastSessionData = s

  // Determine local player position
  let myPosition: AssignedRole = 'default'
  if (Array.isArray(s.myTeam)) {
    const me = s.myTeam.find((p: any) => p.cellId === s.localPlayerCellId)
    if (me?.assignedPosition) {
      const norm = String(me.assignedPosition).toLowerCase()
      if (['top', 'jungle', 'middle', 'bottom', 'utility'].includes(norm)) {
        myPosition = norm as AssignedRole
      }
    }
  }

  const allActions = s.actions ? s.actions.flat(2) : []
  const activeActions = getCurrentActiveActions(s)
  const activeActionIds = new Set(activeActions.map((a: any) => a.id))

  // Check manual overrides if enabled
  if (ctx.store.get<boolean>('respectManualPick', false)) {
    for (const action of allActions) {
      if (action.actorCellId === s.localPlayerCellId && !action.completed && (action.type === 'pick' || action.type === 'ban')) {
        const curId = Number(action.championId || 0)
        if (curId && pluginSetChampionIds.has(action.id) && curId !== pluginSetChampionIds.get(action.id)) {
          manuallyOverriddenActionIds.add(action.id)
        }
      }
    }
  }

  const myActions = allActions.filter((a: any) => {
    if (a.actorCellId !== s.localPlayerCellId || a.completed) return false
    if (a.type !== 'pick' && a.type !== 'ban') return false
    return activeActionIds.has(a.id) || (a.type === 'pick' && s.timer?.phase === 'PLANNING')
  })

  if (myActions.length === 0) return

  const bannedIds = getBannedChampionIds(s)
  const pickedIds = getPickedChampionIds(s)

  const instantPick = ctx.store.get<boolean>('instantPick', true)
  const instantBan = ctx.store.get<boolean>('instantBan', true)
  const lockMode = ctx.store.get<string>(LOCK_MODE_KEY, 'before')
  const lockTime = Number(ctx.store.get<number>(LOCK_TIME_KEY, 0)) || 0
  const hoverDelaySec = Number(ctx.store.get<number>(HOVER_DELAY_KEY, 3)) || 0
  const hoverDelayMs = hoverDelaySec * 1000
  const now = Date.now()

  for (const action of myActions) {
    if (manuallyOverriddenActionIds.has(action.id)) continue

    const isActionActive = activeActionIds.has(action.id)
    const isPlanning = s.timer?.phase === 'PLANNING'

    // === HOVER PASS ===
    if (!actionHoverStartTimes.has(action.id)) {
      actionHoverStartTimes.set(action.id, now)
    }

    const hoverElapsed = now - (actionHoverStartTimes.get(action.id) || now)
    const champId = chooseChampionForAction(ctx, s, action, myPosition, bannedIds, pickedIds)
    if (!champId) continue

    if (hoverElapsed >= hoverDelayMs && action.championId !== champId) {
      const lastHover = lastPatchTimes.get(`${action.id}_hover`) || 0
      if (now - lastHover >= 1200) {
        lastPatchTimes.set(`${action.id}_hover`, now)
        try {
          await ctx.lcu.patch(`/lol-champ-select/v1/session/actions/${action.id}`, {
            championId: champId,
            completed: false,
          })
          pluginSetChampionIds.set(action.id, champId)
        } catch {}
      }
    }

    // === LOCK-IN PASS ===
    if (!isActionActive || isPlanning) continue

    if (!actionActiveStartTimes.has(action.id)) {
      actionActiveStartTimes.set(action.id, now)
    }

    const isInstant = action.type === 'pick' ? instantPick : instantBan
    let shouldLock = false

    if (isInstant && lockTime <= 0) {
      shouldLock = true
    } else if (lockMode === 'after' && lockTime > 0) {
      const activeElapsed = now - (actionActiveStartTimes.get(action.id) || now)
      if (activeElapsed >= lockTime * 1000) {
        shouldLock = true
      }
    } else if (lockMode === 'before' && lockTime > 0) {
      const remainingMs = _emberTimerMs ?? s.timer?.adjustedTimeLeftInPhase ?? 0
      if (remainingMs > 0 && remainingMs <= lockTime * 1000) {
        shouldLock = true
      }
    } else if (isInstant) {
      shouldLock = true
    }

    if (shouldLock) {
      const lastLock = lastPatchTimes.get(`${action.id}_lock`) || 0
      if (now - lastLock >= 1200) {
        lastPatchTimes.set(`${action.id}_lock`, now)
        try {
          await ctx.lcu.patch(`/lol-champ-select/v1/session/actions/${action.id}`, {
            championId: champId,
            completed: true,
          })
          pluginSetChampionIds.set(action.id, champId)
        } catch {}
      }
    }
  }
}

export const autoLockChampionModule: ModuleDescriptor = {
  id: 'autoLockChampion',
  name: () => 'Auto Select',
  description: () => 'Automatically hovers, locks, or bans champions by priority & role in champion select, with separate top-3 priority lists per role.',

  capabilities: {
    autoActs: true,
    usesEmber: true,
  },

  settings: [
    {
      key: 'enabled',
      type: 'toggle',
      label: () => 'Enable Auto Select Champion',
      description: () => 'Automatically pick and ban champions according to your priority list.',
      default: false,
    },
    {
      key: 'lockMode',
      type: 'select',
      label: () => 'Auto Lock Timing Mode',
      options: [
        { value: 'before', label: () => 'Before turn ends' },
        { value: 'after', label: () => 'After turn starts' },
      ],
      default: 'before',
    },
    {
      key: 'lockTime',
      type: 'number',
      label: () => 'Lock Timing (Seconds, 0 = instant)',
      min: 0,
      max: 60,
      step: 0.5,
      default: 0,
    },
    {
      key: 'hoverDelay',
      type: 'number',
      label: () => 'Hover Delay (Seconds)',
      min: 0,
      max: 30,
      step: 0.5,
      default: 3,
    },
    {
      key: 'instantPick',
      type: 'toggle',
      label: () => 'Auto Lock-in Pick',
      default: true,
    },
    {
      key: 'instantBan',
      type: 'toggle',
      label: () => 'Auto Lock-in Ban',
      default: true,
    },
    {
      key: 'respectTeamIntent',
      type: 'toggle',
      label: () => 'Respect Team Intent',
      description: () => 'Do not ban champions hovering/intended by teammates.',
      default: true,
    },
    {
      key: 'respectManualPick',
      type: 'toggle',
      label: () => 'Allow Manual Pick Override',
      description: () => 'Backs off if you manually select another champion during champ select.',
      default: false,
    },
  ],

  installEmberHooks(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    const ember = ctx?.ember || (typeof window !== 'undefined' ? (window as any).__riotEmberHook : null)
    if (!ember || typeof ember.registerRule !== 'function') return

    const unreg = ember.registerRule({
      name: 'sm-auto-lock-timer',
      matcher: 'champion-select',
      hookMethods: [
        {
          name: 'didInsertElement',
          callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
            original(...args)
            _emberTimerMs = this.get?.('session.timer.timeRemainingInMs') ?? null
            this._smUpdateTimer = () => {
              _emberTimerMs = this.get?.('session.timer.timeRemainingInMs') ?? null
              if (isEnabled && !panicActive && _currentCtx && lastSessionData) {
                void processChampSelectSession(_currentCtx, lastSessionData)
              }
            }
            if (typeof this.addObserver === 'function') {
              this.addObserver('session.timer.timeRemainingInMs', this, '_smUpdateTimer')
            }
          },
        },
        {
          name: 'willDestroyElement',
          callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
            if (typeof this.removeObserver === 'function') {
              this.removeObserver('session.timer.timeRemainingInMs', this, '_smUpdateTimer')
            }
            _emberTimerMs = null
            original(...args)
          },
        },
      ],
    })

    if (unreg) _hookCleanups.push(unreg)
  },

  init(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    _currentCtx = ctx
    _unloaded = false
    isEnabled = ctx.store.get<boolean>('enabled', false)

    // Register with panic system for autoActs invariant
    _panicUnregister = ctx.panic.register(() => {
      panicActive = true
      ctx.log('Panic activated: Auto Select suspended for this champion select.')
    })
  },

  load() {
    if (!_currentCtx) return
    const ctx = _currentCtx
    _unloaded = false

    const unsubSession = ctx.lcu.observe('/lol-champ-select/v1/session', (session: any) => {
      if (_unloaded) return
      void processChampSelectSession(ctx, session)
    })
    _lcuUnsubs.push(unsubSession)
  },

  unload() {
    _unloaded = true
    _panicUnregister?.()
    _panicUnregister = null
    for (const unsub of _lcuUnsubs) unsub()
    _lcuUnsubs = []
    for (const cleanup of _hookCleanups) cleanup()
    _hookCleanups = []
    for (const timer of pendingTimers) clearTimeout(timer)
    pendingTimers.clear()
    lastSessionData = null
    actionActiveStartTimes.clear()
    actionHoverStartTimes.clear()
    lastPatchTimes.clear()
    pluginSetChampionIds.clear()
    manuallyOverriddenActionIds.clear()
    panicActive = false
    _emberTimerMs = null
    _currentCtx = null
  },

  onSettingChange(rawCtx: unknown, key: string, value: unknown) {
    if (key === 'enabled') {
      isEnabled = Boolean(value)
      if (!isEnabled) {
        panicActive = false
        actionActiveStartTimes.clear()
      }
    }
  },
}
