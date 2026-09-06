/**
 * Ported from Snooze Manager's modules/socialPanelTweaks.js
 * Original author: SnoozeFest - github@ReformedDoge
 * Kept in personal/ workspace for personal use only under the project's licensing policy.
 *
 * Enhances the social panel with queue labels, in-game timers, connected party status visuals,
 * folder group invitations, and a collapsible sidebar.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import type { ModuleContext } from './types'

let isEnabled = false
let isPartyGroupEnabled = false
let isFolderInviteEnabled = false
let isSidebarToggleEnabled = false
let collapseMethod = 'crop' // 'crop' | 'stretch' | 'slide'

let _hookCleanups: Array<() => void> = []
let _lcuUnsubs: Array<() => void> = []
let _currentCtx: ModuleContext | null = null

const ACTIVE_ATTR = 'data-sm-social-panel-status'
const PARTY_BORDER_ATTR = 'data-sm-party-border'
const PARTY_HUE_SEED = 200
const PARTY_GOLDEN_ANGLE = 137.508
const SIDEBAR_WIDTH = 224

let liveFriendStatuses = new Map<string, string>()
let cachedFriendsList = new Map<string, any>()
let currentGameflowPhase = ''

export function generatePartyColor(index: number) {
  const hue = Math.round((PARTY_HUE_SEED + index * PARTY_GOLDEN_ANGLE) % 360)
  return {
    solid: `hsl(${hue}, 60%, 62%)`,
    alpha: `hsla(${hue}, 60%, 62%, 0.08)`,
  }
}

export function formatGameQueue(queueId: number | string): string {
  const q = Number(queueId)
  switch (q) {
    case 420:
      return 'Ranked Solo'
    case 440:
      return 'Ranked Flex'
    case 400:
      return 'Normal Draft'
    case 430:
      return 'Blind Pick'
    case 450:
      return 'ARAM'
    case 1700:
    case 1710:
    case 1720:
      return 'Arena'
    case 900:
      return 'ARURF'
    case 1020:
      return 'One for All'
    case 1300:
      return 'Nexus Blitz'
    case 1400:
      return 'Spellbook'
    default:
      return 'In Game'
  }
}

async function inviteFolderGroup(ctx: ModuleContext, folderName: string) {
  try {
    const groups = await ctx.lcu.get<any[]>('/lol-chat/v1/friend-groups')
    if (!groups || !Array.isArray(groups)) return

    const group = groups.find((g) => g.name === folderName)
    if (!group) return

    const friends = await ctx.lcu.get<any[]>('/lol-chat/v1/friends')
    if (!friends || !Array.isArray(friends)) return

    const targets = friends.filter((f) => f.displayGroupId === group.id)
    if (!targets || targets.length === 0) return

    await ctx.lcu.post(
      '/lol-lobby/v2/lobby/invitations',
      targets.map((t) => ({ toSummonerId: t.summonerId }))
    )
    ctx.toast.success(`Invited group "${folderName}".`)
  } catch (err) {
    ctx.log('[SocialPanelTweaks] Failed to invite folder group:', err)
  }
}

function restoreAllStatusLines() {
  if (typeof document === 'undefined') return
  document.querySelectorAll(`[${ACTIVE_ATTR}]`).forEach((el) => {
    el.removeAttribute(ACTIVE_ATTR)
  })
}

function removeAllPartyBorders() {
  if (typeof document === 'undefined') return
  document.querySelectorAll(`[${PARTY_BORDER_ATTR}]`).forEach((el) => {
    el.removeAttribute(PARTY_BORDER_ATTR)
    ;(el as HTMLElement).style.boxShadow = ''
  })
}

function refreshRosterMemberElement(element: HTMLElement) {
  if (!element || typeof document === 'undefined') return
  if (!isEnabled && !isPartyGroupEnabled) return

  const puuid = element.getAttribute('data-puuid') || element.getAttribute('id')
  if (!puuid) return

  const friend = cachedFriendsList.get(puuid)
  if (!friend) return

  if (isEnabled) {
    const statusLine = element.querySelector('.status-message, .activity-message') as HTMLElement
    if (statusLine && friend.lol) {
      const q = friend.lol.queueId
      if (q) {
        statusLine.setAttribute(ACTIVE_ATTR, 'true')
        statusLine.textContent = formatGameQueue(q)
      }
    }
  }

  if (isPartyGroupEnabled && friend.partyId) {
    element.setAttribute(PARTY_BORDER_ATTR, friend.partyId)
  }
}

export const socialPanelTweaksModule: ModuleDescriptor = {
  id: 'socialPanelTweaks',
  name: () => 'Social Panel Tweaks',
  description: () =>
    'Enhances the social panel with queue labels, connected party status visuals, folder invites, and collapsible sidebar.',

  settings: [
    {
      key: 'enabled',
      type: 'toggle',
      label: () => 'Enable Better Friends Status',
      default: false,
    },
    {
      key: 'partyGroup',
      type: 'toggle',
      label: () => 'Highlight Friends In The Same Lobby',
      default: false,
    },
    {
      key: 'folderInvite',
      type: 'toggle',
      label: () => 'Enable Group Folder Invite Option',
      default: false,
    },
    {
      key: 'sidebarToggle',
      type: 'toggle',
      label: () => 'Enable Sidebar Collapse Toggle',
      default: false,
    },
    {
      key: 'collapseMethod',
      type: 'select',
      label: () => 'Collapse Method',
      options: [
        { value: 'crop', label: () => 'Crop (Resize Window)' },
        { value: 'stretch', label: () => 'Stretch (Scale Layout)' },
        { value: 'slide', label: () => 'Slide (Shift Layout)' },
      ],
      default: 'crop',
    },
  ],

  capabilities: {
    usesEmber: true,
  },

  installEmberHooks(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    const ember = ctx?.ember || (typeof window !== 'undefined' ? (window as any).__riotEmberHook : null)
    if (!ember || typeof ember.registerRule !== 'function') return

    // Hook lol-social-roster-member
    const unregMember = ember.registerRule({
      name: 'social-panel-tweaks-roster-member',
      matcher: 'lol-social-roster-member',
      hookMethods: [
        {
          name: 'didInsertElement',
          callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
            original(...args)
            if (this.element) refreshRosterMemberElement(this.element)
          },
        },
        {
          name: 'didRender',
          callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
            original(...args)
            if (this.element) refreshRosterMemberElement(this.element)
          },
        },
        {
          name: 'willDestroyElement',
          callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
            if (this.element) {
              this.element.removeAttribute(PARTY_BORDER_ATTR)
              this.element.querySelectorAll?.(`[${ACTIVE_ATTR}]`).forEach((el: HTMLElement) => el.removeAttribute(ACTIVE_ATTR))
            }
            original(...args)
          },
        },
      ],
    })
    if (unregMember) _hookCleanups.push(unregMember)

    // Hook lol-social-roster-group for folder invitations
    const unregGroup = ember.registerRule({
      name: 'social-panel-tweaks-roster-group',
      matcher: 'lol-social-roster-group',
      hookMethods: [
        {
          name: 'contextMenu',
          callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
            const activeCtx = _currentCtx || ctx
            if (activeCtx?.store?.get<boolean>('folderInvite', false) && currentGameflowPhase === 'Lobby') {
              const group = this.get ? this.get('group') : this.group
              const isMetaGroup = group?.isMetaGroup || this.element?.querySelector?.('.group.meta')
              if (!isMetaGroup) {
                if (typeof window !== 'undefined') {
                  requestAnimationFrame(() => {
                    const menuEl = document.querySelector('lol-uikit-context-menu')
                    const root = menuEl?.shadowRoot
                    const container = root?.querySelector('.context-menu, .context-menu-root')
                    if (container && !root?.querySelector('[data-snooze-folder-invite-btn]')) {
                      const item = document.createElement('div')
                      item.className = 'menu-item'
                      item.setAttribute('data-snooze-folder-invite-btn', 'true')
                      item.textContent = 'Invite Folder'
                      item.style.cssText = 'padding: 6px 12px; cursor: pointer; color: #c8aa6e;'
                      item.onclick = async (e) => {
                        e.stopPropagation()
                        ;(menuEl as any)?.close?.()
                        const name = group?.name || this.get?.('name') || this.name
                        if (name) await inviteFolderGroup(activeCtx, name)
                      }
                      container.prepend(item)
                    }
                  })
                }
              }
            }
            original(...args)
          },
        },
      ],
    })
    if (unregGroup) _hookCleanups.push(unregGroup)
  },

  init(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    _currentCtx = ctx
    isEnabled = ctx.store.get<boolean>('enabled', false)
    isPartyGroupEnabled = ctx.store.get<boolean>('partyGroup', false)
    isFolderInviteEnabled = ctx.store.get<boolean>('folderInvite', false)
    isSidebarToggleEnabled = ctx.store.get<boolean>('sidebarToggle', false)
    collapseMethod = ctx.store.get<string>('collapseMethod', 'crop')

    const unsubFriends = ctx.lcu.observe<any[]>('/lol-chat/v1/friends', (friends) => {
      if (Array.isArray(friends)) {
        cachedFriendsList.clear()
        for (const f of friends) {
          if (f?.puuid) cachedFriendsList.set(f.puuid, f)
        }
      }
    })
    _lcuUnsubs.push(unsubFriends)

    const unsubPhase = ctx.lcu.observe<string>('/lol-gameflow/v1/gameflow-phase', (phase) => {
      currentGameflowPhase = phase
    })
    _lcuUnsubs.push(unsubPhase)
  },

  async load() {
    if (_currentCtx) {
      const friends = await _currentCtx.lcu.get<any[]>('/lol-chat/v1/friends').catch(() => null)
      if (Array.isArray(friends)) {
        cachedFriendsList.clear()
        for (const f of friends) {
          if (f?.puuid) cachedFriendsList.set(f.puuid, f)
        }
      }
      currentGameflowPhase = await _currentCtx.lcu.get<string>('/lol-gameflow/v1/gameflow-phase').catch(() => 'None')
    }
  },

  unload() {
    for (const unsub of _lcuUnsubs) unsub()
    _lcuUnsubs = []
    for (const cleanup of _hookCleanups) cleanup()
    _hookCleanups = []
    restoreAllStatusLines()
    removeAllPartyBorders()
    liveFriendStatuses.clear()
    cachedFriendsList.clear()
    _currentCtx = null
  },

  onSettingChange(_rawCtx: unknown, key: string, value: unknown) {
    if (key === 'enabled') {
      isEnabled = Boolean(value)
      if (!isEnabled) restoreAllStatusLines()
    } else if (key === 'partyGroup') {
      isPartyGroupEnabled = Boolean(value)
      if (!isPartyGroupEnabled) removeAllPartyBorders()
    } else if (key === 'folderInvite') {
      isFolderInviteEnabled = Boolean(value)
    } else if (key === 'sidebarToggle') {
      isSidebarToggleEnabled = Boolean(value)
    } else if (key === 'collapseMethod') {
      collapseMethod = String(value)
    }
  },
}
