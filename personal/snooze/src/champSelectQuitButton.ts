/**
 * Ported from Snooze Manager's modules/champSelectQuitButton.js
 * Original author: SnoozeFest - github@ReformedDoge
 *
 * Adds a dodge button in champion select for quick lobby exit.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import type { ModuleContext } from './types'

let _emberRuleCleanup: (() => void) | null = null
let _currentCtx: ModuleContext | null = null

async function dodgeQueue(ctx: ModuleContext) {
  const endpoint =
    '/lol-login/v1/session/invoke?destination=lcdsServiceProxy&method=call&args=["","teambuilder-draft","quitV2",""]'
  const payload = '["","teambuilder-draft","quitV2",""]'

  for (let i = 0; i < 10; i++) {
    try {
      await ctx.lcu.post(endpoint, payload)
      ctx.log(`[DodgeButton] quitV2 attempt ${i + 1} sent`)
    } catch (err) {
      ctx.log(`[DodgeButton] quitV2 attempt ${i + 1} failed:`, err)
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  try {
    await ctx.lcu.post('/lol-lobby/v1/lobby/custom/cancel-champ-select', null)
    ctx.log('[DodgeButton] cancel-champ-select sent')
  } catch (err) {
    ctx.log('[DodgeButton] cancel-champ-select failed:', err)
  }
}

export const champSelectQuitButtonModule: ModuleDescriptor = {
  id: 'champSelectQuitButton',
  name: () => 'Champ Select Dodge Button',
  description: () => 'Adds a dodge button in champion select for quick lobby exit.',

  settings: [
    {
      key: 'enabled',
      type: 'toggle',
      label: () => 'Enable Champ Select Dodge Button',
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

    _emberRuleCleanup = ember.registerRule({
      name: 'champ-select-quit-button-hook',
      matcher: 'champion-select',
      hookMethods: [
        {
          name: 'didInsertElement',
          callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
            original(...args)
            const activeCtx = _currentCtx || ctx
            if (!activeCtx?.store?.get<boolean>('enabled', false)) return
            if (!this.element) return

            const container = this.element.querySelector('.bottom-right-buttons')
            if (!container) return

            if (!container.querySelector('#pm-quit-btn')) {
              const btn = document.createElement('lol-uikit-flat-button') as HTMLElement & { disabled?: boolean }
              btn.id = 'pm-quit-btn'
              btn.textContent = 'Dodge'
              btn.style.cssText =
                'margin-right: 10px; margin-top: 5px; width: auto; min-width: 80px; text-align: center;'

              let dodging = false
              btn.onclick = async () => {
                if (dodging) return
                dodging = true
                btn.disabled = true
                try {
                  await dodgeQueue(activeCtx)
                } finally {
                  setTimeout(() => {
                    dodging = false
                    btn.disabled = false
                  }, 1000)
                }
              }

              if (container.firstChild) {
                container.insertBefore(btn, container.firstChild)
              } else {
                container.appendChild(btn)
              }
            }
          },
        },
        {
          name: 'willDestroyElement',
          callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
            const btn = document.getElementById('pm-quit-btn')
            if (btn) btn.remove()
            original(...args)
          },
        },
      ],
    })
  },

  init(rawCtx: unknown) {
    _currentCtx = rawCtx as ModuleContext
  },

  unload() {
    _emberRuleCleanup?.()
    _emberRuleCleanup = null
    _currentCtx = null
    if (typeof document !== 'undefined') {
      document.querySelectorAll('#pm-quit-btn').forEach((btn) => btn.remove())
    }
  },

  onSettingChange(_rawCtx: unknown, key: string, value: unknown) {
    if (key === 'enabled' && !value) {
      if (typeof document !== 'undefined') {
        document.querySelectorAll('#pm-quit-btn').forEach((btn) => btn.remove())
      }
    }
  },
}
