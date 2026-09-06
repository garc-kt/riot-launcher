/**
 * Ported from Snooze Manager's modules/useClientDuringGame.js
 * Original author: SnoozeFest - github@ReformedDoge
 *
 * Dismisses the "game in progress" blocker so the client can be browsed
 * during a live match, and disables the PLAY button so a new game can't
 * be queued while one is running.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import type { ModuleContext } from './types'

const STYLE_ID = 'sm-use-client-in-game-style'

const BYPASS_CSS = `
.rcp-fe-lol-game-in-progress { display: none !important; }
.rcp-fe-lol-navigation {
  visibility: visible !important;
}
.patcher-play-button {
  opacity: 0.4 !important;
  cursor: default !important;
}
.patcher-play-button,
.patcher-play-button * {
  pointer-events: none !important;
}
`

function injectBypass() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = BYPASS_CSS
  document.head.appendChild(style)
}

function removeBypass() {
  if (typeof document === 'undefined') return
  document.getElementById(STYLE_ID)?.remove()
}

let unsubscribe: (() => void) | null = null

function applyPhase(ctx: ModuleContext, phase: string) {
  const enabled = ctx.store.get<boolean>('enabled', false)
  if (enabled && phase === 'InProgress') {
    injectBypass()
    ctx.log('Bypass CSS injected.')
  } else {
    removeBypass()
  }
}

export const useClientDuringGameModule: ModuleDescriptor = {
  id: 'useClientDuringGame',
  name: () => 'Use Client In Game',
  description: () =>
    'Dismiss the "game in progress" screen so you can browse the client during a live game. The screen returns automatically when a reconnect is needed.',

  settings: [
    {
      key: 'enabled',
      type: 'toggle',
      label: () => 'Enable Use Client In Game',
      default: false,
    },
  ],

  capabilities: {
    passive: 'passive-dom',
  },

  async init(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext

    unsubscribe = ctx.lcu.observe<string>('/lol-gameflow/v1/gameflow-phase', (phase) => {
      applyPhase(ctx, phase)
    })

    try {
      const phase = await ctx.lcu.getGameflowPhase()
      applyPhase(ctx, phase)
    } catch (err) {
      ctx.log('Initial phase fetch failed:', err)
    }
  },

  async unload() {
    unsubscribe?.()
    unsubscribe = null
    removeBypass()
  },

  onSettingChange(rawCtx: unknown, key: string) {
    if (key !== 'enabled') return
    const ctx = rawCtx as ModuleContext
    applyPhase(ctx, ctx.phase())
  },
}
