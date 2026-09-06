/**
 * Ported from Snooze Manager's modules/modeSelectorTweaks.js
 * Original author: SnoozeFest - github@ReformedDoge
 * Kept in personal/ workspace for personal use only under the project's licensing policy.
 *
 * Declutters the play screen by hiding unwanted navigation categories, game modes, and queues.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import type { ModuleContext } from './types'

let isEnabled = false
let hiddenNavs = new Set<string>()
let hiddenModes = new Set<string>()
let hiddenQueues = new Set<string>()

let _hookCleanup: (() => void) | null = null
let _currentCtx: ModuleContext | null = null

const STYLE_ID = 'pm-mode-selector-styles'
let styleEl: HTMLElement | null = null
let EmberRef: any = null
let partiesViewInstance: any = null

const NAME_MAP: Record<string, string> = {
  kPvP: 'PvP',
  kVersusAI: 'Co-op vs. AI',
  kTraining: 'Training',
  CreateCustom: 'Create Custom',
  JoinCustom: 'Join Custom',
  CLASSIC: "Summoner's Rift",
  ARAM: 'ARAM',
  CHERRY: 'Arena',
  KIWI: 'ARAM: Mayhem',
  KIWI_JADE: 'Mayhem (Classic)',
  JADE: 'SR (Classic)',
  TFT: 'Teamfight Tactics',
  TUTORIAL: 'Tutorial',
  PRACTICETOOL: 'Practice Tool',
}

export function getModeLabel(id: string): string {
  return NAME_MAP[id] || id
}

function ensureStyleElement() {
  if (typeof document === 'undefined') return
  if (!styleEl) {
    styleEl = document.getElementById(STYLE_ID)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = STYLE_ID
      document.head.appendChild(styleEl)
    }
  }
}

function stripCompactClass() {
  if (!isEnabled || typeof document === 'undefined') return
  document.querySelectorAll('.game-type-card.compact').forEach((el) => el.classList.remove('compact'))
}

function findComponentByElementId(view: any, id: string): any {
  if (!view) return null
  if (view.elementId === id) return view

  let children = view.childViews || []
  if (typeof children.toArray === 'function') children = children.toArray()

  for (let i = 0; i < children.length; i++) {
    const found = findComponentByElementId(children[i], id)
    if (found) return found
  }
  return null
}

function enforceValidSelection() {
  if (!isEnabled || !partiesViewInstance || !EmberRef) return
  if (partiesViewInstance.isDestroyed || partiesViewInstance.isDestroying) return

  const container = partiesViewInstance.element
  if (!container) return

  const activeCard = container.querySelector('.game-type-card.selected')
  const isSelectedModeHidden = activeCard && hiddenModes.has(activeCard.getAttribute('data-game-mode'))

  if (isSelectedModeHidden || !activeCard) {
    const allCards = Array.from(container.querySelectorAll('.game-type-card')) as HTMLElement[]
    const firstVisibleCard = allCards.find((card) => !hiddenModes.has(card.getAttribute('data-game-mode') || ''))

    if (firstVisibleCard && partiesViewInstance) {
      const cardView = findComponentByElementId(partiesViewInstance, firstVisibleCard.id)
      if (cardView && typeof cardView.send === 'function') {
        EmberRef.run(() => {
          const origPlaySound = cardView.playSound
          if (origPlaySound) cardView.playSound = function () {}

          const parent = cardView.get('parentView')
          const origParentPlaySound = parent ? parent.playSound : null
          if (parent && typeof parent.playSound === 'function') {
            parent.playSound = function () {}
          }

          try {
            cardView.send('selectGameType')
          } catch {}
          try {
            cardView.send('selectQueue')
          } catch {}

          if (origPlaySound) cardView.playSound = origPlaySound
          if (parent && origParentPlaySound) parent.playSound = origParentPlaySound
        })
      } else {
        const clickTarget = (firstVisibleCard.querySelector('.parties-game-type-upper-half') || firstVisibleCard) as HTMLElement
        clickTarget.click()
      }
      return
    }
  }

  const currentQueueId = partiesViewInstance.get('selected.queueId')
  if (currentQueueId && hiddenQueues.has(currentQueueId.toString())) {
    if (activeCard) {
      const queueElements = Array.from(activeCard.querySelectorAll('.parties-game-type-card-category-div')) as HTMLElement[]
      const firstValidQueueEl = queueElements.find((el) => {
        const btn = el.querySelector('[data-queue-id]')
        return btn && !hiddenQueues.has(btn.getAttribute('data-queue-id') || '')
      })

      if (firstValidQueueEl) {
        const queueView = findComponentByElementId(partiesViewInstance, firstValidQueueEl.id)
        EmberRef.run(() => {
          let origPlaySound: any = null
          let parent: any = null
          let origParentPlaySound: any = null

          if (queueView) {
            origPlaySound = queueView.playSound
            if (origPlaySound) queueView.playSound = function () {}

            parent = queueView.get('parentView')
            origParentPlaySound = parent && typeof parent.playSound === 'function' ? parent.playSound : null
            if (origParentPlaySound) parent.playSound = function () {}
          }

          const btn = firstValidQueueEl.querySelector('[data-queue-id]') as HTMLElement
          if (btn) btn.click()
          else firstValidQueueEl.click()

          if (queueView) {
            if (origPlaySound) queueView.playSound = origPlaySound
            if (origParentPlaySound) parent.playSound = origParentPlaySound
          }
        })
      }
    }
  }
}

export function refreshCSS() {
  if (typeof document === 'undefined') return
  if (!isEnabled) {
    if (styleEl) styleEl.textContent = ''
    return
  }
  ensureStyleElement()
  if (!styleEl) return

  let css = ''
  css += `.parties-view:has(.parties-game-select-screen.game-select-hide) #pm-mode-config-btn { display: none !important; }\n`

  hiddenNavs.forEach((nav) => {
    css += `lol-uikit-navigation-item[data-category="${nav}"] { display: none !important; }\n`
  })
  hiddenModes.forEach((mode) => {
    css += `div[data-game-mode="${mode}"] { display: none !important; }\n`
  })
  hiddenQueues.forEach((qId) => {
    css += `div.parties-game-type-card-category-div:has([data-queue-id="${qId}"]) { display: none !important; }\n`
  })

  css += `.parties-game-select-screen.compact .parties-game-type-select-wrapper .game-type-card { width: 220px !important; }\n`

  if (hiddenModes.size > 0) {
    let visibleCount = 0
    if (partiesViewInstance && partiesViewInstance.element) {
      const cards = partiesViewInstance.element.querySelectorAll('.game-type-card')
      visibleCount = Array.from(cards).filter(
        (card: any) => !hiddenModes.has(card.getAttribute('data-game-mode'))
      ).length
    }

    if (visibleCount <= 1) {
      css += `.parties-game-select-screen.compact .parties-game-type-select-wrapper { justify-content: center !important; }\n`
    } else if (visibleCount === 2) {
      css += `.parties-game-select-screen.compact .parties-game-type-select-wrapper { justify-content: center !important; gap: 48px !important; }\n`
    } else {
      css += `.parties-game-select-screen.compact .parties-game-type-select-wrapper { justify-content: space-evenly !important; }\n`
    }
  }

  const leftHidden = hiddenNavs.has('kPvP') && hiddenNavs.has('kVersusAI') && hiddenNavs.has('kTraining')
  const rightHidden = hiddenNavs.has('CreateCustom') && hiddenNavs.has('JoinCustom')
  if (leftHidden || rightHidden) {
    css += `.parties-game-navs-break { display: none !important; }\n`
  }

  styleEl.textContent = css
  if (EmberRef && partiesViewInstance) {
    EmberRef.run?.scheduleOnce?.('afterRender', null, () => {
      stripCompactClass()
      enforceValidSelection()
    })
  }
}

function loadConfig(ctx: ModuleContext) {
  hiddenNavs = new Set(ctx.store.get<string[]>('hiddenNavs', []))
  hiddenModes = new Set(ctx.store.get<string[]>('hiddenModes', []))
  hiddenQueues = new Set(ctx.store.get<string[]>('hiddenQueues', []))
}

function saveConfig(ctx: ModuleContext) {
  ctx.store.set('hiddenNavs', Array.from(hiddenNavs))
  ctx.store.set('hiddenModes', Array.from(hiddenModes))
  ctx.store.set('hiddenQueues', Array.from(hiddenQueues))
}

function injectButton(ctx: ModuleContext) {
  if (typeof document === 'undefined') return
  if (!partiesViewInstance || !partiesViewInstance.element) return

  const partiesView = partiesViewInstance.element
  if (partiesView.querySelector('#pm-mode-config-btn')) return

  const existing = document.getElementById('pm-mode-config-btn')
  if (existing) existing.remove()

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.id = 'pm-mode-config-btn'
  btn.title = 'Configure Mode Selector'
  btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`

  btn.style.cssText =
    'position: absolute; right: 58px; top: 91px; background: transparent; color: #c8aa6e; border: none; padding: 4px; display: flex; justify-content: center; align-items: center; cursor: pointer; opacity: 0.7; transition: opacity 0.2s, color 0.2s;'

  btn.onmouseenter = () => {
    btn.style.opacity = '1'
    btn.style.color = '#f0e6d2'
  }
  btn.onmouseleave = () => {
    btn.style.opacity = '0.7'
    btn.style.color = '#c8aa6e'
  }
  btn.onclick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    openConfigModal(ctx)
  }

  partiesView.appendChild(btn)
}

function openConfigModal(ctx: ModuleContext) {
  if (typeof document === 'undefined') return
  if (document.getElementById('pm-mode-modal-overlay')) return

  const overlay = document.createElement('div')
  overlay.id = 'pm-mode-modal-overlay'
  overlay.style.cssText =
    'position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.45); pointer-events: auto;'

  const modal = document.createElement('div')
  modal.id = 'pm-mode-modal'
  modal.style.cssText =
    'position: relative; width: 600px; max-height: 80vh; background: rgba(1, 10, 19, 0.95); border: 1px solid rgba(200, 170, 110, 0.3); border-radius: 6px; display: flex; flex-direction: column; overflow: hidden; color: #a09b8c; padding: 20px;'

  const header = document.createElement('div')
  header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;'
  header.innerHTML = '<h3 style="margin:0;color:#f0e6d2;font-size:16px;">MODE SELECTOR TWEAKS</h3>'

  const closeBtn = document.createElement('button')
  closeBtn.textContent = '✕'
  closeBtn.style.cssText = 'background:none; border:none; color:#a09b8c; font-size:18px; cursor:pointer;'
  closeBtn.onclick = () => overlay.remove()
  header.appendChild(closeBtn)

  const content = document.createElement('div')
  content.style.cssText = 'overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 12px;'

  const navSection = document.createElement('div')
  navSection.innerHTML = '<div style="color:#c8aa6e;font-size:13px;font-weight:700;margin-bottom:8px;">NAVIGATION TABS</div>'
  const navKeys = ['kPvP', 'kVersusAI', 'kTraining', 'CreateCustom', 'JoinCustom']
  navKeys.forEach((key) => {
    const row = document.createElement('label')
    row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px; background:rgba(255,255,255,0.03); border-radius:4px; cursor:pointer;'
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = !hiddenNavs.has(key)
    cb.onchange = () => {
      if (cb.checked) hiddenNavs.delete(key)
      else hiddenNavs.add(key)
      saveConfig(ctx)
      refreshCSS()
    }
    const span = document.createElement('span')
    span.textContent = getModeLabel(key)
    span.style.color = '#f0e6d2'
    row.appendChild(span)
    row.appendChild(cb)
    navSection.appendChild(row)
  })
  content.appendChild(navSection)

  modal.appendChild(header)
  modal.appendChild(content)
  overlay.appendChild(modal)
  document.body.appendChild(overlay)
}

export const modeSelectorTweaksModule: ModuleDescriptor = {
  id: 'modeSelectorTweaks',
  name: () => 'Mode Selector Tweaks',
  description: () => 'Declutter the game mode selection screen by hiding entire tabs, modes, or specific queues.',

  settings: [
    {
      key: 'enabled',
      type: 'toggle',
      label: () => 'Enable Mode Selector Tweaks',
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
      name: 'mode-selector-tweaks-hook',
      matcher: 'parties-view',
      mixin(Ember: any) {
        EmberRef = Ember
        return {
          init(this: any, ...args: any[]) {
            if (typeof this._super === 'function') this._super(...args)
            this.addObserver?.('selected.queueId', this, 'checkHiddenSelectionChange')
            this.addObserver?.('selected.gameMode', this, 'checkHiddenSelectionChange')
          },
          willDestroy(this: any, ...args: any[]) {
            this.removeObserver?.('selected.queueId', this, 'checkHiddenSelectionChange')
            this.removeObserver?.('selected.gameMode', this, 'checkHiddenSelectionChange')
            if (typeof this._super === 'function') this._super(...args)
          },
          checkHiddenSelectionChange(this: any) {
            if (!isEnabled) return
            partiesViewInstance = this
            Ember.run?.scheduleOnce?.('afterRender', null, () => {
              stripCompactClass()
              enforceValidSelection()
            })
          },
          didRender(this: any, ...args: any[]) {
            partiesViewInstance = this
            if (typeof this._super === 'function') this._super(...args)
            if (!isEnabled) return

            refreshCSS()
            stripCompactClass()
            const activeCtx = _currentCtx || ctx
            if (activeCtx) injectButton(activeCtx)
            Ember.run?.scheduleOnce?.('afterRender', null, enforceValidSelection)
          },
          willDestroyElement(this: any, ...args: any[]) {
            if (this.element) {
              const btn = this.element.querySelector('#pm-mode-config-btn')
              if (btn) btn.remove()
            }
            if (partiesViewInstance === this) partiesViewInstance = null
            if (typeof this._super === 'function') this._super(...args)
          },
        }
      },
    })
  },

  init(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    _currentCtx = ctx
    isEnabled = ctx.store.get<boolean>('enabled', false)
    loadConfig(ctx)
  },

  load() {
    refreshCSS()
  },

  unload() {
    _hookCleanup?.()
    _hookCleanup = null
    if (styleEl) {
      styleEl.remove()
      styleEl = null
    }
    if (typeof document !== 'undefined') {
      document.getElementById('pm-mode-modal-overlay')?.remove()
      document.getElementById('pm-mode-config-btn')?.remove()
    }
    partiesViewInstance = null
    EmberRef = null
    _currentCtx = null
  },

  onSettingChange(_rawCtx: unknown, key: string, value: unknown) {
    if (key === 'enabled') {
      isEnabled = Boolean(value)
      refreshCSS()
      if (!isEnabled && typeof document !== 'undefined') {
        document.getElementById('pm-mode-config-btn')?.remove()
      }
    }
  },
}
