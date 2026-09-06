/**
 * Ported from Snooze Manager's modules/SnoozeBalanceTooltip.js
 * Original author: SnoozeFest - github@ReformedDoge
 * Kept in personal/ workspace for personal use only under the project's licensing policy.
 *
 * Shows balance adjustment tooltips on champion hover in ARAM, Arena, URF, and special game modes.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import type { ModuleContext } from './types'

let isEnabled = false
let currentMode: string | null = null
let balanceData: Record<string, { name: string; stats: Record<string, Record<string, number>> }> = {}
let _hookCleanups: Array<() => void> = []
let _lcuUnsubs: Array<() => void> = []
let _currentCtx: ModuleContext | null = null

let ttRoot: HTMLElement | null = null
let ttCaption: HTMLElement | null = null
let ttContent: HTMLElement | null = null

const HOVER_COMPONENTS = [
  { name: 'champion-bench-item', pos: 'bottom' },
  { name: 'summoner-object', pos: 'right' },
  { name: 'grid-champion', pos: 'bottom' },
  { name: 'champion-card-component', pos: 'bottom' },
  { name: 'champion-card-select-component', pos: 'bottom' },
]

export function getModeKey(gameMode: string | undefined | null): string | null {
  const mode = (gameMode || '').toLowerCase()
  if (mode === 'nexusblitz' || mode === 'nb') return 'nb'
  if (mode === 'cherry' || mode === 'arena' || mode === 'ar') return 'ar'
  if (mode === 'urf' || mode === 'arurf') return 'urf'
  if (mode === 'oneforall' || mode === 'ofa') return 'ofa'
  if (mode === 'ultbook' || mode === 'usb') return 'usb'
  if (mode === 'aram' || mode === 'kiwi') return 'aram'
  if (mode === 'swift' || mode === 'swiftplay') return 'swift'
  return null
}

const MODE_NAMES: Record<string, string> = {
  aram: 'ARAM',
  ar: 'ARENA',
  nb: 'NEXUS BLITZ',
  ofa: 'ONE FOR ALL',
  urf: 'URF',
  usb: 'ULTIMATE SPELLBOOK',
  swift: 'SWIFTPLAY',
}

const LABELS: Record<string, string> = {
  dmg_dealt: 'Damage Dealt',
  dmg_taken: 'Damage Taken',
  healing: 'Healing',
  shielding: 'Shielding',
  ability_haste: 'Ability Haste',
  total_as: 'Total Attack Speed',
  energyregen_mod: 'Energy Regen',
  manaregen_mod: 'Mana Regen',
  ms_mod: 'Movement Speed',
  tenacity: 'Tenacity',
  crit_mod: 'Critical Damage',
  hp_base: 'Base Health',
  hp_lvl: 'Health per Level',
  mp_base: 'Base Resource',
  mp_lvl: 'Resource per Level',
  arm_base: 'Base Armor',
  arm_lvl: 'Armor per Level',
  mr_base: 'Base Magic Resist',
  mr_lvl: 'Magic Resist per Level',
  hp5_base: 'Base Health Regen',
  hp5_lvl: 'Health Regen per Level',
  mp5_base: 'Base Resource Regen',
  mp5_lvl: 'Resource Regen per Level',
  dam_base: 'Base Attack Damage',
  dam_lvl: 'Attack Damage per Level',
  as_base: 'Base Attack Speed',
  as_lvl: 'Attack Speed per Level',
  as_ratio: 'Attack Speed Ratio',
  ms: 'Base Movement Speed',
}

const STAT_OVERRIDE_KEYS = new Set([
  'hp_base', 'hp_lvl', 'mp_base', 'mp_lvl',
  'arm_base', 'arm_lvl', 'mr_base', 'mr_lvl',
  'hp5_base', 'hp5_lvl', 'mp5_base', 'mp5_lvl',
  'dam_base', 'dam_lvl', 'as_base', 'as_ratio', 'as_lvl', 'ms',
])

const DISPLAY_ORDER = [
  'dmg_dealt', 'dmg_taken', 'healing', 'shielding', 'total_as', 'ability_haste', 'ms_mod', 'tenacity', 'crit_mod', 'energyregen_mod', 'manaregen_mod',
  'hp_base', 'hp_lvl', 'mp_base', 'mp_lvl', 'arm_base', 'arm_lvl', 'mr_base', 'mr_lvl',
  'hp5_base', 'hp5_lvl', 'mp5_base', 'mp5_lvl', 'dam_base', 'dam_lvl', 'as_base', 'as_lvl', 'as_ratio', 'ms',
]

export function parseStatsBlock(content: string): Record<string, Record<string, number>> {
  const stats: Record<string, Record<string, number>> = {}
  const modes = ['aram', 'ar', 'nb', 'ofa', 'urf', 'usb', 'swift']
  const keyRegex = /\["([^"]+)"\]\s*=\s*(-?\d+\.?\d*)/g

  modes.forEach((mode) => {
    const modeStartIdx = content.indexOf(`["${mode}"] = {`)
    if (modeStartIdx === -1) return
    let balance = 0
    let modeEndIdx = -1
    const startSearch = modeStartIdx + `["${mode}"] = `.length
    for (let j = startSearch; j < content.length; j++) {
      if (content[j] === '{') balance++
      else if (content[j] === '}') {
        balance--
        if (balance === 0) {
          modeEndIdx = j + 1
          break
        }
      }
    }
    if (modeEndIdx !== -1) {
      const modeContent = content.substring(modeStartIdx, modeEndIdx)
      stats[mode] = {}
      let m: RegExpExecArray | null
      const localKeyRegex = new RegExp(keyRegex)
      while ((m = localKeyRegex.exec(modeContent)) !== null) {
        stats[mode][m[1]] = parseFloat(m[2])
      }
    }
  })
  return stats
}

export function parseWikiLua(lua: string): Record<string, { name: string; stats: Record<string, Record<string, number>> }> {
  const data: Record<string, { name: string; stats: Record<string, Record<string, number>> }> = {}
  const champRegex = /^\s*\["(.+?)"\] = \{/gm
  let match: RegExpExecArray | null

  while ((match = champRegex.exec(lua)) !== null) {
    const name = match[1]
    const startIdx = match.index
    let balance = 0
    let endIdx = -1
    const searchFrom = startIdx + `["${name}"] = `.length

    for (let j = searchFrom; j < lua.length; j++) {
      if (lua[j] === '{') balance++
      else if (lua[j] === '}') {
        balance--
        if (balance === 0) {
          endIdx = j + 1
          break
        }
      }
    }

    if (endIdx !== -1) {
      const entryContent = lua.substring(startIdx, endIdx)
      const idMatch = entryContent.match(/\["id"\]\s*=\s*(\d+)/)
      if (idMatch) {
        const id = idMatch[1]
        const statsMarker = '["stats"] = {'
        const statsStartIdx = entryContent.indexOf(statsMarker)
        if (statsStartIdx !== -1) {
          let sBalance = 0
          let statsEndIdx = -1
          for (let k = statsStartIdx + '["stats"] = '.length; k < entryContent.length; k++) {
            if (entryContent[k] === '{') sBalance++
            else if (entryContent[k] === '}') {
              sBalance--
              if (sBalance === 0) {
                statsEndIdx = k + 1
                break
              }
            }
          }
          if (statsEndIdx !== -1) {
            const statsBlock = entryContent.substring(statsStartIdx, statsEndIdx)
            data[id] = {
              name,
              stats: parseStatsBlock(statsBlock),
            }
          }
        }
      }
    }
    if (champRegex.lastIndex === startIdx) champRegex.lastIndex++
  }

  return data
}

export function buildStatsHtml(stats: Record<string, number>): string {
  const entries: Array<[string, number, 'addend' | 'haste' | 'multiplier']> = []
  for (const key of DISPLAY_ORDER) {
    const val = stats[key]
    if (typeof val !== 'number') continue
    if (STAT_OVERRIDE_KEYS.has(key)) {
      if (val === 0) continue
      entries.push([key, val, 'addend'])
    } else if (key === 'ability_haste') {
      if (val === 0) continue
      entries.push([key, val, 'haste'])
    } else {
      if (val === 1.0) continue
      entries.push([key, val, 'multiplier'])
    }
  }

  if (entries.length === 0) {
    return '<div style="color:#746e64;font-style:italic;font-size:12px;margin-top:4px;">No balance adjustments</div>'
  }

  return entries
    .map(([key, value, kind]) => {
      const label = LABELS[key] ?? key
      let isBuff = false
      let displayValue = ''

      if (kind === 'addend' || kind === 'haste') {
        isBuff = value > 0
        displayValue = (value > 0 ? '+' : '') + value
      } else {
        const percentChange = (value - 1.0) * 100
        isBuff = key === 'dmg_taken' ? value < 1.0 : value > 1.0
        displayValue = (percentChange >= 0 ? '+' : '') + percentChange.toFixed(1) + '%'
      }

      const color = isBuff ? '#5bbd72' : '#e84749'
      return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:13px; color:#a09b8c;">
        <span>${label}</span>
        <span style="color:${color}; font-weight:bold; margin-left:24px;">${displayValue}</span>
      </div>`
    })
    .join('')
}

function createCustomTooltip() {
  if (typeof document === 'undefined') return
  if (ttRoot) return
  ttRoot = document.createElement('div')
  ttRoot.id = 'sm-balance-tooltip'
  ttRoot.style.cssText =
    'position:fixed; z-index:19001; background:#1a1c21; border:1px solid #785a28; border-radius:2px; pointer-events:none; opacity:0; transition:opacity 0.1s; box-shadow:0 0 12px rgba(0,0,0,0.8); min-width:240px;'
  const body = document.createElement('div')
  body.style.cssText = 'padding:16px 20px;'
  ttCaption = document.createElement('div')
  ttCaption.style.cssText =
    'color:#f0e6d2; font-size:15px; font-weight:bold; letter-spacing:.075em; line-height:20px; text-transform:uppercase; margin-bottom:12px; border-bottom:1px solid #3e2e13; padding-bottom:8px;'
  ttContent = document.createElement('div')
  ttContent.style.cssText = 'display:flex; flex-direction:column;'
  body.appendChild(ttCaption)
  body.appendChild(ttContent)
  ttRoot.appendChild(body)
  document.body.appendChild(ttRoot)
}

function showTT(anchor: HTMLElement, position: string, caption: string, html: string) {
  if (typeof document === 'undefined') return
  if (!ttRoot) createCustomTooltip()
  if (!ttRoot || !ttCaption || !ttContent) return

  ttCaption.textContent = caption
  ttContent.innerHTML = html
  const rect = anchor.getBoundingClientRect()
  let left = position === 'bottom' ? rect.left + rect.width / 2 - 120 : rect.right + 12
  let top = position === 'bottom' ? rect.bottom + 8 : rect.top + rect.height / 2 - 80

  if (left + 260 > window.innerWidth) left = window.innerWidth - 268
  if (top + 200 > window.innerHeight) top = window.innerHeight - 208
  if (left < 8) left = 8
  if (top < 8) top = 8

  ttRoot.style.left = `${left}px`
  ttRoot.style.top = `${top}px`
  ttRoot.style.opacity = '1'
}

function hideTT() {
  if (ttRoot && ttRoot.style.opacity !== '0') {
    ttRoot.style.opacity = '0'
  }
}

function showBalanceTooltip(component: any, position: string) {
  if (!isEnabled || !currentMode || Object.keys(balanceData).length === 0) {
    hideTT()
    return
  }

  const champId =
    component?.get?.('champion.id') ||
    component?.get?.('summoner.championId') ||
    component?.get?.('championConfiguration.champion.id') ||
    component?.get?.('championId')

  if (!champId) {
    hideTT()
    return
  }

  const stats = balanceData[String(champId)]?.stats?.[currentMode] || {}
  const modeName = MODE_NAMES[currentMode] || currentMode.toUpperCase()
  if (component.element) {
    showTT(component.element, position, `${modeName} BALANCE`, buildStatsHtml(stats))
  }
}

async function fetchWikiData(ctx: ModuleContext) {
  try {
    const cached = ctx.store.get<Record<string, any>>('cachedBalanceData')
    if (cached && Object.keys(cached).length > 0) {
      balanceData = cached
    }

    if (typeof fetch === 'undefined') return
    const res = await fetch('https://wiki.leagueoflegends.com/en-us/Module:ChampionData/data?action=raw')
    if (!res.ok) throw new Error(`Wiki fetch failed: ${res.status}`)
    const lua = await res.text()
    const data = parseWikiLua(lua)
    if (Object.keys(data).length > 0) {
      balanceData = data
      ctx.store.set('cachedBalanceData', data)
      ctx.log(`[BalanceTooltip] Parsed Wiki data for ${Object.keys(data).length} champions.`)
    }
  } catch (err) {
    ctx.log('[BalanceTooltip] Wiki processing error:', err)
  }
}

async function syncMode(ctx: ModuleContext) {
  const session = await ctx.lcu.get<any>('/lol-gameflow/v1/session').catch(() => null)
  const rawMode = session?.gameData?.queue?.gameMode
  currentMode = getModeKey(rawMode)
}

async function handleGameflowPhase(ctx: ModuleContext, phase: string) {
  if (phase === 'ChampSelect' && isEnabled) {
    await syncMode(ctx).catch(() => {
      currentMode = null
    })
  } else {
    currentMode = null
  }
  hideTT()
}

export const snoozeBalanceTooltipModule: ModuleDescriptor = {
  id: 'SnoozeBalanceTooltip',
  name: () => 'Mode Balance Info',
  description: () => 'Shows balance adjustment tooltips on champion hover in special game modes (ARAM/URF/Arena).',

  settings: [
    {
      key: 'enabled',
      type: 'toggle',
      label: () => 'Enable Mode Balance Info',
      default: false,
    },
  ],

  capabilities: {
    usesEmber: true,
    external: ['wiki.leagueoflegends.com'],
  },

  installEmberHooks(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    const ember = ctx?.ember || (typeof window !== 'undefined' ? (window as any).__riotEmberHook : null)
    if (!ember || typeof ember.registerRule !== 'function') return

    HOVER_COMPONENTS.forEach((r) => {
      const unreg = ember.registerRule({
        name: `balance-tooltip-${r.name}-hook`,
        matcher: r.name,
        hookMethods: [
          {
            name: 'didInsertElement',
            callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
              original(...args)
              if (!this.element) return
              this.element.addEventListener('mouseenter', () => {
                showBalanceTooltip(this, r.pos)
              })
              this.element.addEventListener('mouseleave', () => {
                hideTT()
              })
            },
          },
          {
            name: 'willDestroyElement',
            callback(_Ember: any, original: (...args: any[]) => any, ...args: any[]) {
              hideTT()
              original(...args)
            },
          },
        ],
      })
      if (unreg) _hookCleanups.push(unreg)
    })
  },

  init(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    _currentCtx = ctx
    isEnabled = ctx.store.get<boolean>('enabled', false)

    const unsubPhase = ctx.lcu.observe<string>('/lol-gameflow/v1/gameflow-phase', (phase) => {
      handleGameflowPhase(ctx, phase)
    })
    _lcuUnsubs.push(unsubPhase)
  },

  async load() {
    if (_currentCtx) {
      await fetchWikiData(_currentCtx)
      const phase = await _currentCtx.lcu.get<string>('/lol-gameflow/v1/gameflow-phase').catch(() => 'None')
      await handleGameflowPhase(_currentCtx, phase)
    }
  },

  unload() {
    for (const unsub of _lcuUnsubs) unsub()
    _lcuUnsubs = []
    for (const cleanup of _hookCleanups) cleanup()
    _hookCleanups = []
    hideTT()
    ttRoot?.remove()
    ttRoot = null
    ttCaption = null
    ttContent = null
    currentMode = null
    _currentCtx = null
  },

  onSettingChange(rawCtx: unknown, key: string, value: unknown) {
    if (key === 'enabled') {
      isEnabled = Boolean(value)
      const ctx = (rawCtx as ModuleContext) || _currentCtx
      if (ctx) {
        ctx.lcu
          .get<string>('/lol-gameflow/v1/gameflow-phase')
          .then((p) => handleGameflowPhase(ctx, p))
          .catch(() => {})
      }
    }
  },
}
