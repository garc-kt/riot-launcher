/**
 * Ported from Snooze Manager's modules/autoHonor.js
 * Original author: SnoozeFest - github@ReformedDoge
 * Kept in personal/ workspace for personal use only under the project's licensing policy.
 *
 * Automatically honor players after matches, with optional prioritization
 * of friends or selection based on contributions, and score display on honor cards.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import type { ModuleContext } from './types'
import { Scoring, type PlayerScoreSummary } from './scoring.ts'

let isEnabled = false
let honorAttemptedForCurrentGame = false
let eogStatsCache: any = null
let friendPuuidsCache: Set<string> | null = null
let scoresMapCache: Map<string, PlayerScoreSummary> | null = null
let pendingScoreCards: Array<{ element: HTMLElement; puuid: string }> = []
let _hookCleanups: Array<() => void> = []
let _lcuUnsubs: Array<() => void> = []
let _currentCtx: ModuleContext | null = null
let _panicCancelled = false

function scoreColor(ratio: number): string {
  if (ratio >= 0.5) {
    const t = (ratio - 0.5) * 2
    return `rgb(${Math.round(160 - t * 160)}, ${Math.round(160 + t * 60)}, ${Math.round(160 - t * 20)})`
  } else {
    const t = ratio * 2
    return `rgb(${Math.round(220 - t * 60)}, ${Math.round(60 + t * 100)}, ${Math.round(70 + t * 90)})`
  }
}

function injectScoreOnHonorCard(element: HTMLElement, puuid: string) {
  if (typeof document === 'undefined' || !element || !element.isConnected) return
  if (element.querySelector('.ah-score-badge')) return
  if (!scoresMapCache) return
  const rating = scoresMapCache.get(puuid)
  if (!rating) return

  const wrapper = element.querySelector('.vote-ceremony-candidate-champ-image-wrapper') as HTMLElement
  if (!wrapper) return

  const color = scoreColor(rating._scoreRatio)
  const chip = document.createElement('div')
  chip.className = 'ah-score-badge'
  chip.style.cssText =
    'position:absolute;top:6px;right:6px;background:rgba(10,10,22,0.75);border-radius:4px;padding:4px 7px;text-align:center;line-height:1.4;pointer-events:none;z-index:10;'
  chip.innerHTML = `
    <div style="color:#e8d5a3;font-weight:700;font-size:11px;">${rating.kills}/${rating.deaths}/${rating.assists}</div>
    <div style="font-size:9px;display:flex;gap:6px;justify-content:center;">
      <span style="font-weight:600;color:#c0b89a;">${rating.kda} KDA</span>
      <span style="color:${color};font-weight:700;">Score: ${rating.score}</span>
    </div>
  `

  wrapper.style.position = 'relative'
  wrapper.appendChild(chip)
}

function injectFriendBadge(element: HTMLElement, puuid: string) {
  if (typeof document === 'undefined' || !element || !element.isConnected) return
  if (element.querySelector('.ah-friend-badge')) return
  if (!friendPuuidsCache || !friendPuuidsCache.has(puuid)) return

  const wrapper = element.querySelector('.vote-ceremony-candidate-champ-image-wrapper') as HTMLElement
  if (!wrapper) return

  const chip = document.createElement('div')
  chip.className = 'ah-friend-badge'
  chip.innerHTML = `
    <span style="color:#ff6b8a;font-size:11px;text-shadow:0 0 4px rgba(0,0,0,0.9);">♥</span>
    <span style="color:#e8d5a3;font-weight:700;font-size:10px;letter-spacing:0.3px;text-shadow:0 0 4px rgba(0,0,0,0.9);">Friend</span>
  `

  const roleIndicator = element.querySelector('.vote-ceremony-candidate-role')
  if (roleIndicator) {
    const wrapperRect = wrapper.getBoundingClientRect()
    const roleRect = roleIndicator.getBoundingClientRect()
    const badgeTop = roleRect.top - wrapperRect.top
    const badgeLeft = (roleRect.left - wrapperRect.left) + roleRect.width + 6
    chip.style.cssText = `position:absolute;top:${badgeTop}px;left:${badgeLeft}px;background:rgba(10,10,22,0.75);border-radius:4px;padding:3px 6px;display:flex;align-items:center;gap:3px;pointer-events:none;z-index:10;`
  } else {
    chip.style.cssText = 'position:absolute;top:6px;left:6px;background:rgba(10,10,22,0.75);border-radius:4px;padding:3px 6px;display:flex;align-items:center;gap:3px;pointer-events:none;z-index:10;'
  }

  wrapper.style.position = 'relative'
  wrapper.appendChild(chip)
}

let friendsPromise: Promise<Set<string>> | null = null
async function getFriendPuuids(ctx: ModuleContext): Promise<Set<string>> {
  if (friendPuuidsCache) return friendPuuidsCache
  if (friendsPromise) return friendsPromise
  friendsPromise = ctx.lcu.get<any>('/lol-chat/v1/friends').catch(() => null).then((friends) => {
    const set = new Set<string>()
    if (Array.isArray(friends)) {
      for (const f of friends) {
        if (f?.puuid) set.add(f.puuid)
      }
    }
    friendPuuidsCache = set
    friendsPromise = null
    return set
  })
  return friendsPromise
}

function loadScoresMap() {
  if (eogStatsCache?.teams?.length) {
    scoresMapCache = Scoring.computeScores(Scoring.normalizeEogStats(eogStatsCache))
    const queue = pendingScoreCards
    pendingScoreCards = []
    for (const { element, puuid } of queue) {
      injectScoreOnHonorCard(element, puuid)
    }
  } else {
    scoresMapCache = null
  }
}

async function getValidBallot(ctx: ModuleContext): Promise<any> {
  let ballot = await ctx.lcu.get<any>('/lol-honor-v2/v1/ballot').catch(() => null)
  if (ballot?.eligibleAllies?.length || ballot?.eligibleOpponents?.length) {
    return ballot
  }

  await ctx.lcu.post('/lol-honor-v2/v1/ballot/refresh').catch(() => {})
  return new Promise((resolve) => {
    let resolved = false
    const disconnect = ctx.lcu.observe<any>('/lol-honor-v2/v1/ballot', (data) => {
      if (data?.eligibleAllies?.length || data?.eligibleOpponents?.length) {
        resolved = true
        disconnect()
        resolve(data)
      }
    })

    setTimeout(() => {
      if (!resolved) {
        disconnect()
        ctx.lcu.get('/lol-honor-v2/v1/ballot').then(resolve).catch(() => resolve(null))
      }
    }, 5000)
  })
}

async function autoHonorTeammate(ctx: ModuleContext) {
  if (!ctx.store.get<boolean>('enabled', false)) return
  if (_panicCancelled) return

  ctx.log('[AutoHonor] Starting auto-honor sequence...')

  try {
    const skip = ctx.store.get<boolean>('skip', false)
    const prioritize = ctx.store.get<boolean>('prioritizeByContribution', false)
    const ballot = await getValidBallot(ctx)
    if (!ballot) {
      ctx.log('[AutoHonor] No ballot returned. Aborting.')
      return
    }

    let didVote = false

    if (skip) {
      ctx.log('[AutoHonor] Skip Honor is active.')
      await ctx.lcu.post('/lol-honor-v2/v1/honor-player', { honorCategory: '', summonerId: 0 }).then(() => {
        didVote = true
      }).catch(() => {})
    } else {
      const mode = ctx.store.get<string>('mode', 'allies')
      let candidates: any[] = []

      if (mode === 'allies') candidates = [...(ballot.eligibleAllies || [])]
      else if (mode === 'enemies') candidates = [...(ballot.eligibleOpponents || [])]
      else if (mode === 'random') {
        candidates = [...(ballot.eligibleAllies || []), ...(ballot.eligibleOpponents || [])]
      }

      const preferFriends = ctx.store.get<boolean>('preferFriends', false)
      const voteCount = ballot.votePool?.votes || 1

      if (candidates.length > 0) {
        let friendCandidates: any[] = []
        let otherCandidates: any[] = []

        if (preferFriends) {
          const friendPuuids = await getFriendPuuids(ctx)
          for (const c of candidates) {
            if (friendPuuids.has(c.puuid)) friendCandidates.push(c)
            else otherCandidates.push(c)
          }
        } else {
          otherCandidates = [...candidates]
        }

        let selected = [...friendCandidates]

        if (prioritize && eogStatsCache) {
          const scoresMap = Scoring.computeScores(Scoring.normalizeEogStats(eogStatsCache))
          otherCandidates.sort((a, b) => {
            const scoreA = scoresMap.get(a.puuid)?.score || 0
            const scoreB = scoresMap.get(b.puuid)?.score || 0
            return scoreB - scoreA
          })
        } else {
          otherCandidates.sort(() => 0.5 - Math.random())
        }

        selected = selected.concat(otherCandidates)

        const delayMs = ctx.store.get<number>('delayMs', 200)

        for (let i = 0; i < Math.min(voteCount, selected.length); i++) {
          if (_panicCancelled) {
            ctx.log('[AutoHonor] Cancelled via panic hotkey.')
            break
          }
          const target = selected[i]
          await ctx.lcu.post('/lol-honor/v1/honor', {
            honorType: 'HEART',
            recipientPuuid: target.puuid,
          }).then(() => {
            ctx.log(`[AutoHonor] Staged vote for ${target.puuid}`)
          }).catch(() => {})

          if (i < Math.min(voteCount, selected.length) - 1 && delayMs > 0) {
            await new Promise((r) => setTimeout(r, delayMs))
          }
        }
        didVote = true
      }
    }

    if (didVote && !_panicCancelled) {
      await ctx.lcu.post('/lol-honor/v1/ballot').catch(() => {})
      await ctx.lcu.post('/lol-honor-v2/v1/level-change/ack').catch(() => {})
    }
  } catch (err) {
    ctx.log('[AutoHonor] Runtime error:', err)
  }
}

export const autoHonorModule: ModuleDescriptor = {
  id: 'autoHonor',
  name: () => 'Auto Honor',
  description: () =>
    'Automatically honors a teammate, enemy, or random player when the game finishes.',

  settings: [
    {
      key: 'enabled',
      type: 'toggle',
      label: () => 'Enable Auto Honor',
      default: false,
    },
    {
      key: 'mode',
      type: 'select',
      label: () => 'Honor Target',
      options: [
        { value: 'allies', label: () => 'Honor Allies' },
        { value: 'enemies', label: () => 'Honor Enemies' },
        { value: 'random', label: () => 'Honor Random (Any)' },
      ],
      default: 'allies',
    },
    {
      key: 'delayMs',
      type: 'number',
      label: () => 'Delay between votes (ms)',
      default: 200,
    },
    {
      key: 'skip',
      type: 'toggle',
      label: () => 'Skip Honor',
      default: false,
    },
    {
      key: 'prioritizeByContribution',
      type: 'toggle',
      label: () => 'Prioritize by Contribution',
      default: false,
    },
    {
      key: 'preferFriends',
      type: 'toggle',
      label: () => 'Prefer Friends',
      default: false,
    },
    {
      key: 'showScoreOnCard',
      type: 'toggle',
      label: () => 'Show KDA & Score on Honor Card',
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

    const unreg = ember.registerRule({
      name: 'ah-honor-card-badges',
      matcher: (args: any[]) =>
        args.some((a) => a && typeof a === 'object' && a.baseClassName === 'vote-ceremony-player-card'),
      hookMethods: [
        {
          name: 'didRender',
          callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
            original(...args)
            if (!this.element) return
            const activeCtx = _currentCtx || ctx
            const showScore = activeCtx?.store?.get<boolean>('showScoreOnCard', false)
            const preferFriends = activeCtx?.store?.get<boolean>('preferFriends', false)
            if (!showScore && !preferFriends) return

            const candidate = this.get?.('candidate')
            if (!candidate?.puuid) return

            if (showScore) {
              if (scoresMapCache && scoresMapCache.has(candidate.puuid)) {
                injectScoreOnHonorCard(this.element, candidate.puuid)
              } else {
                if (!pendingScoreCards.some((p) => p.puuid === candidate.puuid)) {
                  pendingScoreCards.push({ element: this.element, puuid: candidate.puuid })
                }
              }
            }

            if (preferFriends) {
              if (friendPuuidsCache && friendPuuidsCache.has(candidate.puuid)) {
                injectFriendBadge(this.element, candidate.puuid)
              } else if (!friendPuuidsCache && activeCtx) {
                getFriendPuuids(activeCtx).then(() => {
                  if (this.element?.isConnected) {
                    injectFriendBadge(this.element, candidate.puuid)
                  }
                }).catch(() => {})
              }
            }
          },
        },
      ],
    })
    if (unreg) _hookCleanups.push(unreg)
  },

  init(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    _currentCtx = ctx
    isEnabled = ctx.store.get<boolean>('enabled', false)
    _panicCancelled = false

    if (ctx.store.get<boolean>('preferFriends', false)) {
      getFriendPuuids(ctx).catch(() => {})
    }

    // Invariant: autoActs module MUST register with ctx.panic
    ctx.panic.register(() => {
      _panicCancelled = true
      ctx.log('[AutoHonor] Panic received: cancelling pending honor.')
    })

    const unsubStats = ctx.lcu.observe<any>('/lol-end-of-game/v1/eog-stats-block', (event) => {
      if (eogStatsCache) return
      if (event?.teams?.length) {
        eogStatsCache = event
        loadScoresMap()
      }
    })
    _lcuUnsubs.push(unsubStats)

    const unsubPhase = ctx.lcu.observe<string>('/lol-gameflow/v1/gameflow-phase', (phase) => {
      const active = ctx.store.get<boolean>('enabled', false) || ctx.store.get<boolean>('showScoreOnCard', false)
      const isHonorPhase = phase === 'PreEndOfGame' || phase === 'EndOfGame'

      if (!isHonorPhase && phase !== 'WaitingForStats') {
        honorAttemptedForCurrentGame = false
        eogStatsCache = null
        friendPuuidsCache = null
        scoresMapCache = null
        pendingScoreCards = []
        _panicCancelled = false
        return
      }

      if (active && ['PreEndOfGame', 'WaitingForStats', 'EndOfGame'].includes(phase) && !eogStatsCache) {
        ctx.lcu.get<any>('/lol-end-of-game/v1/eog-stats-block').then((data) => {
          if (data?.teams?.length) {
            eogStatsCache = data
            loadScoresMap()
          }
        }).catch(() => {})
      }

      if (active && isHonorPhase && !honorAttemptedForCurrentGame) {
        honorAttemptedForCurrentGame = true
        autoHonorTeammate(ctx)
      }
    })
    _lcuUnsubs.push(unsubPhase)
  },

  unload() {
    _panicCancelled = false
    honorAttemptedForCurrentGame = false
    eogStatsCache = null
    friendPuuidsCache = null
    scoresMapCache = null
    pendingScoreCards = []
    for (const unsub of _lcuUnsubs) unsub()
    _lcuUnsubs = []
    for (const cleanup of _hookCleanups) cleanup()
    _hookCleanups = []
    _currentCtx = null
  },

  onSettingChange(_rawCtx: unknown, key: string, value: unknown) {
    if (key === 'enabled') {
      isEnabled = Boolean(value)
    }
  },
}
