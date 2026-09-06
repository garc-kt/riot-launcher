/**
 * Ported from Snooze Manager's modules/PenaltyUISuppress.js
 * Original author: SnoozeFest - github@ReformedDoge
 *
 * Suppresses low priority queue / leaverbuster warnings and player restriction info tooltips in the Ember layer.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import type { ModuleContext } from './types'

let _hookCleanups: Array<() => void> = []
let _currentCtx: ModuleContext | null = null
let _api: any = null
let _originalApiGetModalManager: any = null
let _originalModalManagerAdd: any = null
let modalManager: any = null
let bypassModalHook = false

function isEnabled(): boolean {
  return _currentCtx?.store?.get<boolean>('enabled', true) ?? true
}

function isRestrictionInfoEnabled(): boolean {
  return _currentCtx?.store?.get<boolean>('restrictionInfoEnabled', true) ?? true
}

function findModalWrapperDeep(el: any): any {
  let current = el
  while (current) {
    if (current.nodeType === 1 /* Node.ELEMENT_NODE */) {
      if (current.matches?.('.modal')) {
        return current
      }
    }
    if (current.parentNode) {
      current = current.parentNode
    } else if (current.host) {
      current = current.host
    } else {
      current = null
    }
  }
  return null
}

function suppress() {
  if (typeof document === 'undefined') return
  const targets = document.querySelectorAll(
    '.parties-queue-error-dialog, .queue-dodge-error-dialog, ' +
      '.ready-check-failer-error-dialog, .disruptive-gameplay-lockout-error-dialog, ' +
      '.leaver-buster-lockout-error-dialog, .low-priority-dialog, ' +
      '.low-priority-queue-warning, .queue-restriction-notification'
  )

  targets.forEach((el) => {
    const modal = findModalWrapperDeep(el)
    if (modal) {
      modal.remove()
    } else {
      el.remove()
    }
  })

  document.querySelectorAll('.modal').forEach((modal) => {
    const txt = (modal.textContent || '').toLowerCase()
    if (
      txt.includes('low priority') ||
      txt.includes('queue delay') ||
      txt.includes('leaverbuster') ||
      txt.includes('dodge') ||
      txt.includes('failed') ||
      txt.includes('lockout')
    ) {
      if (modal.querySelector('.low-prio-warning-suppress-settings')) return
      modal.remove()
    }
  })
}

function suppressRestrictionInfo() {
  if (typeof document === 'undefined') return
  document
    .querySelectorAll('.player-restriction-info-component, .player-restriction-warning-icon')
    .forEach((el) => {
      el.remove()
    })
}

function isLockoutModal(options: any): boolean {
  if (bypassModalHook) return false
  if (!options || !options.data) return false

  const contents = options.data.contents
  if (!contents) return false

  if (typeof contents === 'string') {
    const lower = contents.toLowerCase()
    return (
      lower === 'parties-queue-error-dialog' ||
      lower === 'queue-dodge-error-dialog' ||
      lower === 'ready-check-failer-error-dialog' ||
      lower === 'disruptive-gameplay-lockout-error-dialog' ||
      lower === 'leaver-buster-lockout-error-dialog' ||
      lower === 'low-priority-dialog'
    )
  }

  if (contents.nodeType === 1) {
    const hasPenaltyClass =
      contents.classList?.contains('PartyQueueErrorDialogComponent') ||
      contents.classList?.contains('LowPriorityQueueModalComponent') ||
      contents.matches?.(
        '.parties-queue-error-dialog, .queue-dodge-error-dialog, .ready-check-failer-error-dialog, .disruptive-gameplay-lockout-error-dialog, .leaver-buster-lockout-error-dialog, .low-priority-dialog, .leaver-buster-dialog'
      ) ||
      contents.querySelector?.(
        '.parties-queue-error-dialog, .queue-dodge-error-dialog, .ready-check-failer-error-dialog, .disruptive-gameplay-lockout-error-dialog, .leaver-buster-lockout-error-dialog, .low-priority-dialog, .leaver-buster-dialog'
      )
    if (hasPenaltyClass) return true
  }

  return false
}

export const penaltyUISuppressModule: ModuleDescriptor = {
  id: 'lowPrioWarningSuppress',
  name: () => 'Penalty UI Suppression',
  description: () =>
    'Suppresses low priority queue, leaverbuster, queue dodge, ready-check-failer warning dialogs, and player restriction info tooltips.',

  settings: [
    {
      key: 'enabled',
      type: 'toggle',
      label: () => 'Low Priority Warning Suppression',
      default: true,
    },
    {
      key: 'restrictionInfoEnabled',
      type: 'toggle',
      label: () => 'Restriction Info Tooltip Suppression',
      default: true,
    },
  ],

  capabilities: {
    usesEmber: true,
  },

  installEmberHooks(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    const ember = ctx?.ember || (typeof window !== 'undefined' ? (window as any).__riotEmberHook : null)
    if (!ember || typeof ember.registerRule !== 'function') return

    // Intercept showQueueErrorModal on matchmaking error monitor component
    const unregMonitor = ember.registerRule({
      name: 'matchmaking-error-monitor-suppress',
      matcher: (args: any[]) =>
        args.some((arg) => arg && typeof arg === 'object' && 'showQueueErrorModal' in arg),
      hookMethods: [
        {
          name: 'showQueueErrorModal',
          callback(Ember: any, original: (...args: any[]) => any, ...args: any[]) {
            const [errorType, errorId] = args
            if (
              isEnabled() &&
              typeof errorType === 'string' &&
              (errorType.includes('LEAVER_BUSTER') ||
                errorType.includes('LOW_PRIORITY') ||
                errorType.includes('DISRUPTIVE_GAMEPLAY') ||
                errorType === 'QUEUE_DODGER' ||
                errorType === 'READY_CHECK_FAILER')
            ) {
              const notified = this.get('_notifiedSearchErrorIds') || Ember?.Object?.create?.({}) || {}
              notified[errorId] = true
              this.set?.('_notifiedSearchErrorIds', notified)
              this.set?.('_isTransitioningState', false)
              return
            }
            return original(...args)
          },
        },
      ],
    })
    if (unregMonitor) _hookCleanups.push(unregMonitor)

    // Fallback Ember rules for lockout dialog components
    const matchers = [
      'parties-queue-error-dialog',
      'queue-dodge-error-dialog',
      'ready-check-failer-error-dialog',
      'disruptive-gameplay-lockout-error-dialog',
      'leaver-buster-lockout-error-dialog',
      'low-priority-dialog',
    ]

    for (const matcher of matchers) {
      const unreg = ember.registerRule({
        name: `${matcher}-suppress`,
        matcher,
        mixin: (Ember: any) => ({
          showError: Ember?.computed?.('errorType', 'dialogSubComponent', function (this: any) {
            const errorType = this.get?.('errorType')
            if (!isEnabled()) {
              return Ember?.isEmpty ? !Ember.isEmpty(this.get('dialogSubComponent')) : true
            }
            if (
              errorType &&
              (errorType.includes('LEAVER_BUSTER') ||
                errorType.includes('LOW_PRIORITY') ||
                errorType.includes('DISRUPTIVE_GAMEPLAY') ||
                errorType === 'QUEUE_DODGER' ||
                errorType === 'READY_CHECK_FAILER')
            ) {
              return false
            }
            return Ember?.isEmpty ? !Ember.isEmpty(this.get('dialogSubComponent')) : true
          }),

          didInsertElement(this: any, ...args: any[]) {
            if (typeof this._super === 'function') this._super(...args)
            if (!isEnabled()) return
            const el = this.$?.() || (this.element ? [this.element] : null)
            if (el && el.length) {
              const domNode = el[0]
              const modal = findModalWrapperDeep(domNode)
              if (modal) {
                modal.remove()
              } else {
                domNode.remove?.()
              }
            }
          },
        }),
      })
      if (unreg) _hookCleanups.push(unreg)
    }

    // Suppress player restriction info component
    const unregRestriction = ember.registerRule({
      name: 'player-restriction-info-suppress',
      matcher: 'player-restriction-info-component',
      mixin: (Ember: any) => ({
        isWarningShown: Ember?.computed?.(
          'isSocialPanelRestrictionEnabled',
          'isProfileRestrictionsIntegrationEnabled',
          'hasChatRestriction',
          'hasRankedRestriction',
          'hasRedemptionGamesRemaining',
          'hasRestrictions',
          function (this: any) {
            if (!isRestrictionInfoEnabled()) {
              return (
                !this.get?.('isSocialPanelRestrictionEnabled') &&
                (this.get?.('isProfileRestrictionsIntegrationEnabled')
                  ? this.get?.('hasRestrictions')
                  : this.get?.('hasChatRestriction') ||
                    this.get?.('hasRankedRestriction') ||
                    this.get?.('hasRedemptionGamesRemaining'))
              )
            }
            return false
          }
        ),

        didInsertElement(this: any, ...args: any[]) {
          if (typeof this._super === 'function') this._super(...args)
          if (!isRestrictionInfoEnabled()) return
          const el = this.$?.() || (this.element ? [this.element] : null)
          if (el && el.length) {
            el[0].remove?.()
          }
        },
      }),
    })
    if (unregRestriction) _hookCleanups.push(unregRestriction)
  },

  init(rawCtx: unknown) {
    _currentCtx = rawCtx as ModuleContext

    // Hook ModalManager.add inside rcp-fe-lol-uikit if rcp is available
    const rcpInstance =
      (rawCtx as any)?.rcp || (typeof window !== 'undefined' ? (window as any).rcp : null)
    if (rcpInstance && typeof rcpInstance.postInit === 'function') {
      rcpInstance.postInit(
        'rcp-fe-lol-uikit',
        (api: any) => {
          if (!api || typeof api.getModalManager !== 'function') return
          _api = api
          _originalApiGetModalManager = api.getModalManager
          api.getModalManager = function (this: any, ...args: any[]) {
            modalManager = _originalApiGetModalManager.apply(this, args)
            if (modalManager && !modalManager.__riotWrapped) {
              modalManager.__riotWrapped = true
              _originalModalManagerAdd = modalManager.add
              modalManager.add = function (this: any, options: any, ...rest: any[]) {
                if (isEnabled() && isLockoutModal(options)) {
                  return {
                    acceptPromise: Promise.resolve(),
                    declinePromise: Promise.resolve(),
                    closePromise: Promise.resolve(),
                    domNode: typeof document !== 'undefined' ? document.createElement('div') : null,
                  }
                }
                return _originalModalManagerAdd.apply(this, [options, ...rest])
              }
            }
            return modalManager
          }
        },
        true
      )
    }
  },

  load() {
    suppress()
    if (isRestrictionInfoEnabled()) {
      suppressRestrictionInfo()
    }
  },

  unload() {
    if (_api && _originalApiGetModalManager) {
      _api.getModalManager = _originalApiGetModalManager
    }
    if (modalManager && _originalModalManagerAdd) {
      delete modalManager.__riotWrapped
      modalManager.add = _originalModalManagerAdd
    }
    for (const cleanup of _hookCleanups) cleanup?.()
    _hookCleanups = []
    _api = null
    modalManager = null
    _currentCtx = null
  },

  onSettingChange(_rawCtx: unknown, key: string, value: unknown) {
    if (key === 'enabled' && value) {
      suppress()
    } else if (key === 'restrictionInfoEnabled' && value) {
      suppressRestrictionInfo()
    }
  },
}
