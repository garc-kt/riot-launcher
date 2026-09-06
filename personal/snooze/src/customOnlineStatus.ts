/**
 * Ported from Snooze Manager's modules/customOnlineStatus.js
 * Original author: SnoozeFest - github@ReformedDoge
 * Kept in personal/ workspace for personal use only under the project's licensing policy.
 *
 * Adds custom chat availability and status message controls.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import type { ModuleContext } from './types'

let isEnabled = false
let statusMenu: HTMLElement | null = null
let _currentCtx: ModuleContext | null = null
let _emberRuleCleanup: (() => void) | null = null
let _apiHookCleanups: Array<() => void> = []
let _documentClickHandler: ((e: MouseEvent) => void) | null = null

async function syncAvailability(ctx: ModuleContext) {
  if (!ctx.store.get<boolean>('enabled', false)) return
  try {
    await ctx.lcu.put('/lol-chat/v1/me', {
      availability: ctx.store.get<string>('status', 'chat'),
      statusMessage: ctx.store.get<string>('statusMsg', ''),
    })
  } catch {}
}

function getStatusMenu(ctx: ModuleContext): HTMLElement {
  if (typeof document === 'undefined') return {} as any
  if (statusMenu && document.body.contains(statusMenu)) {
    return statusMenu
  }

  document.querySelectorAll('#pm-status-menu').forEach((menu) => menu.remove())

  const customMenu = document.createElement('div')
  customMenu.id = 'pm-status-menu'
  Object.assign(customMenu.style, {
    position: 'fixed',
    minWidth: '160px',
    background: 'rgba(1,10,19,0.97)',
    border: '1px solid #785a28',
    borderRadius: '3px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
    zIndex: '999999',
    display: 'none',
    padding: '6px',
    pointerEvents: 'auto',
    color: '#a09b8c',
    fontSize: '12px',
  })
  document.body.appendChild(customMenu)

  const opts = [
    { v: 'chat', l: 'Online (Green)', d: '#43b581' },
    { v: 'away', l: 'Away (Red)', d: '#f04747' },
    { v: 'dnd', l: 'Do Not Disturb (Yellow)', d: '#faa61a' },
    { v: 'mobile', l: 'Mobile (Green)', d: '#43b581' },
    { v: 'offline', l: 'Offline (Gray)', d: '#747f8d' },
  ]

  opts.forEach((o) => {
    const item = document.createElement('div')
    Object.assign(item.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 12px',
      cursor: 'pointer',
      borderRadius: '2px',
    })
    item.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${o.d}"></span><span>${o.l}</span>`
    item.onclick = async (ev) => {
      ev.stopPropagation()
      customMenu.style.display = 'none'
      try {
        ctx.store.set('status', o.v)
        if (ctx.store.get<boolean>('enabled', false)) {
          await ctx.lcu.put('/lol-chat/v1/me', { availability: o.v })
        }
      } catch {}
    }
    customMenu.appendChild(item)
  })

  const inputWrap = document.createElement('div')
  Object.assign(inputWrap.style, {
    padding: '6px 4px 0',
    marginTop: '4px',
    borderTop: '1px solid #3e2e13',
  })
  const statusMsgInput = document.createElement('textarea')
  statusMsgInput.setAttribute('data-pm-status-message', 'true')
  statusMsgInput.placeholder = 'Custom Status Message...'
  statusMsgInput.value = ctx.store.get<string>('statusMsg', '')
  Object.assign(statusMsgInput.style, {
    width: '100%',
    background: '#111',
    border: '1px solid #785a28',
    color: '#f0e6d2',
    padding: '6px 10px',
    borderRadius: '2px',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: '60px',
    fontFamily: 'inherit',
    fontSize: '13px',
  })
  statusMsgInput.onchange = async (ev) => {
    try {
      const val = (ev.target as HTMLTextAreaElement).value
      ctx.store.set('statusMsg', val)
      if (ctx.store.get<boolean>('enabled', false)) {
        await ctx.lcu.put('/lol-chat/v1/me', { statusMessage: val })
      }
    } catch {}
  }
  statusMsgInput.onclick = (ev) => ev.stopPropagation()
  inputWrap.appendChild(statusMsgInput)
  customMenu.appendChild(inputWrap)

  statusMenu = customMenu
  return statusMenu
}

export const customOnlineStatusModule: ModuleDescriptor = {
  id: 'customOnlineStatus',
  name: () => 'Custom Online Status',
  description: () =>
    'Overrides your online status indicator. Menu available by clicking the availability icon under your icon.',

  settings: [
    {
      key: 'enabled',
      type: 'toggle',
      label: () => 'Enable Custom Online Status',
      default: false,
    },
    {
      key: 'status',
      type: 'select',
      label: () => 'Custom Status',
      options: [
        { value: 'chat', label: () => 'Online (Green)' },
        { value: 'away', label: () => 'Away (Red)' },
        { value: 'dnd', label: () => 'Do Not Disturb (Yellow)' },
        { value: 'mobile', label: () => 'Mobile (Green)' },
        { value: 'offline', label: () => 'Offline (Gray)' },
      ],
      default: 'chat',
    },
    {
      key: 'statusMsg',
      type: 'textarea',
      label: () => 'Custom Status Message',
      default: '',
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
      name: 'custom-online-status-identity',
      matcher: 'lol-social-identity',
      hookMethods: [
        {
          name: 'didInsertElement',
          callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
            original(...args)
            const activeCtx = _currentCtx || ctx
            const hitbox = this.element?.querySelector?.('.lol-social-availability-hitbox')
            if (hitbox && !hitbox.hasAttribute('data-pm-status-menu-hook')) {
              hitbox.setAttribute('data-pm-status-menu-hook', 'true')
              hitbox.addEventListener(
                'click',
                (e: MouseEvent) => {
                  if (!activeCtx?.store?.get<boolean>('enabled', false)) return
                  e.stopPropagation()
                  e.stopImmediatePropagation()
                  const menu = getStatusMenu(activeCtx)
                  const r = hitbox.getBoundingClientRect()
                  menu.style.left = 'auto'
                  menu.style.right = `${window.innerWidth - r.right}px`
                  menu.style.top = `${r.bottom + 5}px`
                  menu.style.display = 'block'
                },
                true
              )
            }
          },
        },
      ],
    })
  },

  init(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    _currentCtx = ctx
    isEnabled = ctx.store.get<boolean>('enabled', false)

    // Install WS & XHR hooks if net is available
    const net = ctx.net || (typeof window !== 'undefined' ? (window as any).__riotNetHook : null)
    if (net) {
      // Inbound WS hook to lock status UI
      if (typeof net.hookWs === 'function') {
        const unregWs = net.hookWs('/lol-chat/v1/me', (_endpoint: string, payload: any) => {
          if (!isEnabled || !payload || typeof payload !== 'object') return payload
          const desired = ctx.store.get<string>('status', 'chat')
          const desiredMsg = ctx.store.get<string>('statusMsg', '')
          const patched = { ...payload }
          if (patched.availability !== undefined) patched.availability = desired
          if (patched.statusMessage !== undefined) patched.statusMessage = desiredMsg
          return patched
        })
        if (unregWs) _apiHookCleanups.push(unregWs)
      }

      // Outbound XHR hook to rewrite PUT /lol-chat/v1/me
      if (typeof net.hookXhrReq === 'function') {
        const unregXhr = net.hookXhrReq(
          '/lol-chat/v1/me',
          (method: string, _url: string, _xhr: any, body: any) => {
            if (method !== 'PUT' && method !== 'put') return body
            if (!isEnabled) return body
            let parsed: any
            try {
              parsed = JSON.parse(body)
            } catch {
              return body
            }
            const desired = ctx.store.get<string>('status', 'chat')
            const desiredMsg = ctx.store.get<string>('statusMsg', '')
            if (parsed.availability !== undefined) parsed.availability = desired
            if (parsed.statusMessage !== undefined) parsed.statusMessage = desiredMsg
            return JSON.stringify(parsed)
          }
        )
        if (unregXhr) _apiHookCleanups.push(unregXhr)
      }
    }

    if (typeof document !== 'undefined') {
      _documentClickHandler = (e: MouseEvent) => {
        if (statusMenu && !statusMenu.contains(e.target as Node)) {
          statusMenu.style.display = 'none'
        }
      }
      document.addEventListener('click', _documentClickHandler)
    }

    syncAvailability(ctx).catch(() => {})
  },

  unload() {
    if (typeof document !== 'undefined' && _documentClickHandler) {
      document.removeEventListener('click', _documentClickHandler)
      _documentClickHandler = null
    }
    _emberRuleCleanup?.()
    _emberRuleCleanup = null
    for (const cleanup of _apiHookCleanups) cleanup()
    _apiHookCleanups = []
    statusMenu?.remove()
    statusMenu = null
    _currentCtx = null
  },

  async onSettingChange(rawCtx: unknown, key: string, value: unknown) {
    const ctx = (rawCtx as ModuleContext) || _currentCtx
    if (key === 'enabled') {
      isEnabled = Boolean(value)
      if (!isEnabled) {
        if (statusMenu) statusMenu.style.display = 'none'
      } else if (ctx) {
        await syncAvailability(ctx)
      }
    } else if ((key === 'status' || key === 'statusMsg') && ctx) {
      await syncAvailability(ctx)
    }
  },
}
