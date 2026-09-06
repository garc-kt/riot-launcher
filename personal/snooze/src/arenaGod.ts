/**
 * Ported from Snooze Manager's modules/arenaGod.js
 * Original author: SnoozeFest - github@ReformedDoge
 * Kept in personal/ workspace for personal use only under the project's licensing policy.
 *
 * Enhances Arena mode champion grid and progress display.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import type { ModuleContext } from './types'

const PLAYED_ID = '602001'
const FIRST_ID = '602002'
const ARENA_QUEUES = [1700, 1710, 1720]
const STYLE_ID = 'sm-arena-god-styles'

let isEnabled = false
let currentArenaMode = false
let progressCache: {
  played: Set<number>
  first: Set<number>
  currentValue: number
  required: number
} | null = null
let progressPanel: HTMLElement | null = null
let _hookCleanup: (() => void) | null = null
let _phaseUnsub: (() => void) | null = null
let _currentCtx: ModuleContext | null = null

const ARENA_CSS = `
.champion-grid.sm-arena-active .grid-champion[data-sm-status] .grid-champion-overlay {
  opacity: 1 !important;
  display: block !important;
}

.champion-grid.sm-arena-active .grid-champion[data-sm-status]::after {
  content: '';
  position: absolute;
  top: 50px;
  left: 33px;
  width: 32px;
  transform: translate(25%, -25%);
  height: 36px;
  z-index: 100;
  pointer-events: none;
  background-size: contain;
  background-repeat: no-repeat;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
}

.champion-grid.sm-arena-active .grid-champion[data-sm-status="played"]::after {
  background-image: url("data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><defs><linearGradient id='psg' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%23FFD6EC'/><stop offset='100%' stop-color='%23FF69B4'/></linearGradient></defs><path d='M64 10 L79 45 L118 48 L88 72 L97 110 L64 90 L31 110 L40 72 L10 48 L49 45 Z' fill='url(%23psg)' stroke='%23FF4FA0' stroke-width='5' stroke-linejoin='round'/><circle cx='45' cy='44' r='4' fill='white' opacity='0.95'/><circle cx='53' cy='36' r='2' fill='white' opacity='0.8'/><circle cx='85' cy='40' r='3' fill='%23FFF5FA' opacity='0.7'/><ellipse cx='50' cy='66' rx='4' ry='5' fill='%237A1E48'/><ellipse cx='78' cy='66' rx='4' ry='5' fill='%237A1E48'/><circle cx='51' cy='64' r='1.2' fill='white'/><circle cx='79' cy='64' r='1.2' fill='white'/><path d='M52 82 Q64 92 76 82' stroke='%237A1E48' stroke-width='4' fill='none' stroke-linecap='round'/><ellipse cx='40' cy='76' rx='6' ry='3' fill='%23FF9FCF' opacity='0.6'/><ellipse cx='88' cy='76' rx='6' ry='3' fill='%23FF9FCF' opacity='0.6'/></svg>");
}

.champion-grid.sm-arena-active .grid-champion[data-sm-status="first"]::after {
  background-image: url("data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><defs><linearGradient id='gg' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%23FFF3A3'/><stop offset='100%' stop-color='%23F4B400'/></linearGradient></defs><path d='M24 36 C12 36 10 58 26 66' fill='none' stroke='%23D89B00' stroke-width='8' stroke-linecap='round'/><path d='M104 36 C116 36 118 58 102 66' fill='none' stroke='%23D89B00' stroke-width='8' stroke-linecap='round'/><path d='M34 22 H94 V44 C94 72 78 88 64 88 C50 88 34 72 34 44 Z' fill='url(%23gg)' stroke='%23D89B00' stroke-width='5'/><path d='M46 32 Q52 44 48 60' stroke='white' stroke-width='5' opacity='0.5' fill='none' stroke-linecap='round'/><path d='M64 42 L69 54 L82 55 L72 63 L75 76 L64 69 L53 76 L56 63 L46 55 L59 54 Z' fill='%23FFF1A8' stroke='%23E0A800' stroke-width='2'/><rect x='50' y='88' width='28' height='14' rx='4' fill='%23C98700'/><rect x='40' y='102' width='48' height='12' rx='4' fill='%23A86E00'/></svg>");
}
`

function injectStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = ARENA_CSS
  document.head.appendChild(style)
}

function removeStyles() {
  if (typeof document === 'undefined') return
  document.getElementById(STYLE_ID)?.remove()
}

function updatePanelContent() {
  if (!progressPanel || !progressCache) return

  const current = progressCache.currentValue || 0
  const required = progressCache.required || 0
  const playedCount = progressCache.played?.size || 0

  const pct = required ? Math.min(100, Math.round((current / required) * 100)) : 0
  const remaining = Math.max(0, required - current)

  progressPanel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;">
      <div style="font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;color:#c8aa6e;">
        Arena God
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:12px;color:#b7b1a1;">
          ${remaining} left
        </span>
        <span
          id="sm-arena-god-close"
          style="font-size:11px;color:#7e786d;cursor:pointer;line-height:1;padding:2px 4px;border-radius:3px;"
          title="Close"
        >
          ✕
        </span>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px;">
      <div>
        <div style="display:flex;align-items:baseline;gap:4px;">
          <span style="font-size:18px;font-weight:700;color:#f0e6d2;">
            ${current}
          </span>
          <span style="font-size:12px;color:#b7b1a1;">
            / ${required} unique champions
          </span>
        </div>
        <div style="font-size:11px;color:#8b8578;margin-top:2px;">
          first place wins
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:13px;font-weight:600;color:#d3c7b3;">
          ${playedCount}
        </div>
        <div style="font-size:10px;color:#6f6a63;margin-top:2px;">
          champions played
        </div>
      </div>
    </div>
    <div style="height:5px;background:#1e2328;border:1px solid #2a2218;border-radius:999px;overflow:hidden;">
      <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#c8aa6e,#f0e6d2);border-radius:999px;"></div>
    </div>
  `

  const closeBtn = progressPanel.querySelector('#sm-arena-god-close')
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      progressPanel?.remove()
      progressPanel = null
    })
  }
}

function makeDraggable(el: HTMLElement, ctx: ModuleContext) {
  el.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement)?.closest('#sm-arena-god-close')) return
    e.preventDefault()

    const rect = el.getBoundingClientRect()
    el.style.right = ''
    el.style.left = `${rect.left}px`
    el.style.top = `${rect.top}px`

    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top

    el.style.cursor = 'grabbing'
    el.setPointerCapture(e.pointerId)

    const onMove = (moveEvent: PointerEvent) => {
      el.style.left = `${moveEvent.clientX - offsetX}px`
      el.style.top = `${moveEvent.clientY - offsetY}px`
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener(
      'pointerup',
      () => {
        el.removeEventListener('pointermove', onMove)
        el.style.cursor = 'grab'
        ctx.store.set('pos', {
          left: el.style.left,
          top: el.style.top,
        })
      },
      { once: true }
    )
  })
}

function renderProgressPanel(ctx?: ModuleContext) {
  if (typeof document === 'undefined') return
  if (!progressCache || !isEnabled || !currentArenaMode) {
    if (progressPanel) {
      progressPanel.remove()
      progressPanel = null
    }
    return
  }

  const activeCtx = ctx || _currentCtx
  if (!progressPanel || !document.body.contains(progressPanel)) {
    progressPanel = document.createElement('div')
    progressPanel.id = 'sm-arena-god-progress'
    const savedPos = activeCtx?.store?.get<{ left: string; top: string }>('pos')
    if (savedPos?.left && savedPos?.top) {
      progressPanel.style.cssText = `position:fixed;left:${savedPos.left};top:${savedPos.top};z-index:19000;min-width:200px;background:rgba(1,10,19,0.92);border:1px solid #785a28;border-radius:3px;box-shadow:0 8px 24px rgba(0,0,0,0.45);padding:10px 12px;color:#f0e6d2;font-family:sans-serif;cursor:grab;`
    } else {
      progressPanel.style.cssText =
        'position:fixed;right:1.7vw;top:80vh;z-index:19000;min-width:200px;background:rgba(1,10,19,0.92);border:1px solid #785a28;border-radius:3px;box-shadow:0 8px 24px rgba(0,0,0,0.45);padding:10px 12px;color:#f0e6d2;font-family:sans-serif;cursor:grab;'
    }
    document.body.appendChild(progressPanel)
    if (activeCtx) makeDraggable(progressPanel, activeCtx)
  }

  updatePanelContent()
}

async function refreshProgress(ctx: ModuleContext) {
  try {
    const res = await ctx.lcu.get<any>('/lol-challenges/v1/challenges/local-player')
    const firstPlaceData = res?.[FIRST_ID] || {}
    progressCache = {
      played: new Set((res?.[PLAYED_ID]?.completedIds || []).map(Number)),
      first: new Set((firstPlaceData.completedIds || []).map(Number)),
      currentValue: Number(firstPlaceData.currentValue || 0),
      required: Number(firstPlaceData.thresholds?.MASTER?.value || 60),
    }
    renderProgressPanel(ctx)
  } catch {}
}

async function handlePhaseChange(ctx: ModuleContext, phase: string) {
  if (phase === 'ChampSelect' && isEnabled) {
    const session = await ctx.lcu.get<any>('/lol-gameflow/v1/session').catch(() => null)
    const mode = (session?.gameData?.queue?.gameMode || '').toLowerCase()
    const qId = session?.gameData?.queue?.id

    if (mode === 'cherry' || mode === 'arena' || ARENA_QUEUES.includes(qId)) {
      currentArenaMode = true
      await refreshProgress(ctx)
    }
  } else {
    if (currentArenaMode) {
      currentArenaMode = false
      if (progressPanel) {
        progressPanel.remove()
        progressPanel = null
      }
      if (typeof document !== 'undefined') {
        document.querySelectorAll('.champion-grid').forEach((el) => el.classList.remove('sm-arena-active'))
        document
          .querySelectorAll('.grid-champion[data-sm-status]')
          .forEach((el) => el.removeAttribute('data-sm-status'))
      }
    }
  }
}

export const arenaGodModule: ModuleDescriptor = {
  id: 'arenaGod',
  name: () => 'Arena God Tracker',
  description: () =>
    'Enhances Arena mode champion grid and progress display with status icons on individual grid tiles.',

  settings: [
    {
      key: 'enabled',
      type: 'toggle',
      label: () => 'Enable Arena God Tracker',
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

    _hookCleanup = ember.registerRule({
      name: 'arena-god-grid-champion-hook',
      matcher: 'grid-champion',
      hookMethods: [
        {
          name: 'didRender',
          callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
            original(...args)
            if (!isEnabled || !currentArenaMode || !this.element || !progressCache) return

            const id = this.get?.('championConfiguration.champion.id')
            if (!id) return

            const gridContainer = this.element.closest?.('.champion-grid')
            if (gridContainer && !gridContainer.classList.contains('sm-arena-active')) {
              gridContainer.classList.add('sm-arena-active')
            }

            if (progressCache.first.has(id)) {
              this.element.setAttribute('data-sm-status', 'first')
            } else if (progressCache.played.has(id)) {
              this.element.setAttribute('data-sm-status', 'played')
            } else {
              this.element.removeAttribute('data-sm-status')
            }
          },
        },
        {
          name: 'willDestroyElement',
          callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
            if (this.element) {
              this.element.removeAttribute('data-sm-status')
            }
            original(...args)
          },
        },
      ],
    })
  },

  init(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    _currentCtx = ctx
    isEnabled = ctx.store.get<boolean>('enabled', false)
    injectStyles()

    _phaseUnsub = ctx.lcu.observe<string>('/lol-gameflow/v1/gameflow-phase', (phase) => {
      handlePhaseChange(ctx, phase)
    })
    ctx.lcu
      .get<string>('/lol-gameflow/v1/gameflow-phase')
      .then((p) => handlePhaseChange(ctx, p))
      .catch(() => {})
  },

  unload() {
    _phaseUnsub?.()
    _phaseUnsub = null
    _hookCleanup?.()
    _hookCleanup = null
    progressPanel?.remove()
    progressPanel = null
    progressCache = null
    currentArenaMode = false
    removeStyles()
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.champion-grid').forEach((el) => el.classList.remove('sm-arena-active'))
      document
        .querySelectorAll('.grid-champion[data-sm-status]')
        .forEach((el) => el.removeAttribute('data-sm-status'))
    }
    _currentCtx = null
  },

  onSettingChange(rawCtx: unknown, key: string, value: unknown) {
    if (key === 'enabled') {
      isEnabled = Boolean(value)
      const ctx = (rawCtx as ModuleContext) || _currentCtx
      if (ctx) {
        ctx.lcu
          .get<string>('/lol-gameflow/v1/gameflow-phase')
          .then((p) => handlePhaseChange(ctx, p))
          .catch(() => {})
      }
    }
  },
}
