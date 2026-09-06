/**
 * Ported from Snooze Manager's modules/clientWindowTweaks.js
 * Original author: SnoozeFest - github@ReformedDoge
 * Kept in personal/ workspace for personal use only under the project's licensing policy.
 *
 * Client window tweaks: custom resolution presets, custom window title,
 * and dynamic drag-bar height scaling.
 */
import type { ModuleDescriptor } from '../../../packages/contracts/src/module.ts'
import type { ModuleContext } from './types'

export interface WindowPreset {
  id: string
  label: string
  width: number
  height: number
}

export const PRESETS: WindowPreset[] = [
  { id: 'native-426x240', label: '426 x 240', width: 426, height: 240 },
  { id: 'native-640x360', label: '640 x 360', width: 640, height: 360 },
  { id: 'native-854x480', label: '854 x 480', width: 854, height: 480 },
  { id: 'native-960x540', label: '960 x 540', width: 960, height: 540 },
  { id: 'native-1024x576', label: '1024 x 576', width: 1024, height: 576 },
  { id: 'native-1152x648', label: '1152 x 648', width: 1152, height: 648 },
  { id: 'native-1280x720', label: '1280 x 720', width: 1280, height: 720 },
  { id: 'native-1366x768', label: '1366 x 768', width: 1366, height: 768 },
  { id: 'native-1600x900', label: '1600 x 900', width: 1600, height: 900 },
  { id: 'native-1920x1080', label: '1920 x 1080', width: 1920, height: 1080 },
  { id: 'native-2560x1440', label: '2560 x 1440', width: 2560, height: 1440 },
  { id: 'native-3200x1800', label: '3200 x 1800', width: 3200, height: 1800 },
  { id: 'native-3840x2160', label: '3840 x 2160', width: 3840, height: 2160 },
  { id: 'native-5120x2880', label: '5120 x 2880', width: 5120, height: 2880 },
  { id: 'native-7680x4320', label: '7680 x 4320', width: 7680, height: 4320 },
]

export const TITLE_DEFAULT = 'League of Legends'
export const DRAGBAR_DEFAULT = 7

let isEnabled = false
let _hookCleanups: Array<() => void> = []
let _fullscreenKeyListener: ((e: KeyboardEvent) => void) | null = null
let _currentCtx: ModuleContext | null = null

export function calculateZoom(targetHeight: number): number {
  return targetHeight / 720
}

export function calculateDragBarPixels(targetHeight: number, percentage: number): number {
  return Math.round((percentage / 100) * targetHeight)
}

export function isLetterboxNeeded(width: number, height: number, isCollapsedCrop = false): boolean {
  const expectedRatio = isCollapsedCrop ? (1280 - 224) / 720 : 16 / 9
  return Math.abs(width / height - expectedRatio) > 0.02
}

export function applyZoom(targetWidth: number, targetHeight: number, isCollapsedCrop = false) {
  if (typeof document === 'undefined') return
  const cssZoom = calculateZoom(targetHeight)
  document.documentElement.style.zoom = String(cssZoom)

  if (isLetterboxNeeded(targetWidth, targetHeight, isCollapsedCrop)) {
    document.documentElement.style.backgroundColor = '#000'
  } else {
    document.documentElement.style.backgroundColor = ''
  }
}

export function clearZoom() {
  if (typeof document === 'undefined') return
  document.documentElement.style.zoom = ''
  document.documentElement.style.backgroundColor = ''
}

export function riotInvoke(name: string, params: any[] = [], callbacks: Record<string, any> = {}) {
  if (typeof window !== 'undefined' && typeof (window as any).riotInvoke === 'function') {
    try {
      ;(window as any).riotInvoke({
        request: JSON.stringify({ name, params }),
        ...callbacks,
      })
    } catch (err) {
      console.warn('[ClientWindowTweaks] riotInvoke failed:', err)
    }
  }
}

export function enableFreeResizing(enable: boolean) {
  if (enable) {
    riotInvoke('Mouse.SetResizeEnabled', [true])
    riotInvoke('Mouse.SetResizeBounds', [426, 240, 7680, 4320])
    riotInvoke('Window.SetResizeBounds', [426, 240, 7680, 4320])
  } else {
    riotInvoke('Mouse.SetResizeEnabled', [false])
  }
}

export function applyWindowSize(width: number, height: number) {
  if (width <= 0 || height <= 0) return
  riotInvoke('Window.ResizeTo', [width, height])
  applyZoom(width, height)
  riotInvoke('Window.CenterToScreen', [])
}

export function applySettings(ctx: ModuleContext) {
  if (!isEnabled) return

  const resizeEnabled = ctx.store.get<boolean>('applyResolution', true)
  const width = Number(ctx.store.get<number>('width', 1600)) || 1600
  const height = Number(ctx.store.get<number>('height', 900)) || 900

  const titleEnabled = ctx.store.get<boolean>('applyTitle', true)
  const title = String(ctx.store.get<string>('title', TITLE_DEFAULT) || '').trim()

  const dragEnabled = ctx.store.get<boolean>('applyDragBar', true)
  const dragBarPct = Number(ctx.store.get<number>('dragBarPercentage', DRAGBAR_DEFAULT))

  if (resizeEnabled && width > 0 && height > 0) {
    enableFreeResizing(true)
    applyWindowSize(width, height)
    if (dragEnabled && dragBarPct >= 0) {
      const pixels = calculateDragBarPixels(height, dragBarPct)
      riotInvoke('Mouse.SetDragBarHeight', [pixels])
    }
  } else {
    enableFreeResizing(false)
    clearZoom()
    if (dragEnabled && dragBarPct >= 0) {
      const pixels = calculateDragBarPixels(720, dragBarPct)
      riotInvoke('Mouse.SetDragBarHeight', [pixels])
    } else {
      riotInvoke('Mouse.SetDragBarHeight', [48])
    }
  }

  if (titleEnabled && title) {
    riotInvoke('Window.SetTitle', [title])
  } else if (!titleEnabled) {
    riotInvoke('Window.SetTitle', [TITLE_DEFAULT])
  }

  const fullscreenEnabled = ctx.store.get<boolean>('fullscreenEnabled', false)
  if (fullscreenEnabled) {
    installFullscreenListener()
  } else {
    uninstallFullscreenListener()
  }
}

export function restoreAllNativeSettings() {
  enableFreeResizing(false)
  clearZoom()
  riotInvoke('Window.ResizeTo', [1280, 720])
  riotInvoke('Window.CenterToScreen', [])
  riotInvoke('Window.SetTitle', [TITLE_DEFAULT])
  riotInvoke('Mouse.SetDragBarHeight', [48])
  uninstallFullscreenListener()
}

function installFullscreenListener() {
  if (typeof document === 'undefined') return
  if (_fullscreenKeyListener) return

  _fullscreenKeyListener = (e: KeyboardEvent) => {
    if (e.key === 'F11') {
      e.preventDefault()
      e.stopPropagation()
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {})
      } else {
        document.documentElement.requestFullscreen?.().catch(() => {})
      }
    }
  }
  document.addEventListener('keydown', _fullscreenKeyListener, true)
}

function uninstallFullscreenListener() {
  if (typeof document === 'undefined') return
  if (_fullscreenKeyListener) {
    document.removeEventListener('keydown', _fullscreenKeyListener, true)
    _fullscreenKeyListener = null
  }
  if (document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {})
  }
}

export const clientWindowTweaksModule: ModuleDescriptor = {
  id: 'clientWindowTweaks',
  name: () => 'Client Window Tweaks',
  description: () => 'Apply custom client resolution presets, title, and drag-area height on startup or any time.',

  capabilities: {
    passive: 'passive-dom',
  },

  settings: [
    {
      key: 'enabled',
      type: 'toggle',
      label: () => 'Enable Client Window Tweaks',
      description: () => 'Master toggle for custom resolution, title, and drag bar scaling.',
      default: false,
    },
    {
      key: 'applyResolution',
      type: 'toggle',
      label: () => 'Apply Custom Resolution',
      description: () => 'Resize the League Client window to the configured dimensions.',
      default: true,
    },
    {
      key: 'width',
      type: 'number',
      label: () => 'Window Width',
      min: 426,
      max: 7680,
      default: 1600,
    },
    {
      key: 'height',
      type: 'number',
      label: () => 'Window Height',
      min: 240,
      max: 4320,
      default: 900,
    },
    {
      key: 'applyTitle',
      type: 'toggle',
      label: () => 'Apply Window Title',
      description: () => 'Change the client window title bar text.',
      default: true,
    },
    {
      key: 'title',
      type: 'text',
      label: () => 'Window Title',
      default: 'League of Legends',
    },
    {
      key: 'applyDragBar',
      type: 'toggle',
      label: () => 'Apply Dynamic Drag Bar',
      description: () => 'Adjust the top drag region proportional to window height.',
      default: true,
    },
    {
      key: 'dragBarPercentage',
      type: 'number',
      label: () => 'Drag Bar Height (%)',
      min: 0,
      max: 50,
      step: 1,
      default: 7,
    },
    {
      key: 'fullscreenEnabled',
      type: 'toggle',
      label: () => 'Enable F11 Fullscreen',
      description: () => 'Allow toggling borderless fullscreen using the F11 key.',
      default: false,
    },
  ],

  init(rawCtx: unknown) {
    const ctx = rawCtx as ModuleContext
    _currentCtx = ctx
    isEnabled = ctx.store.get<boolean>('enabled', false)

    // Inbound WS hook to preserve custom ZoomScale across settings queries
    const net = ctx.net || (typeof window !== 'undefined' ? (window as any).__riotNetHook : null)
    if (net && typeof net.hookWs === 'function') {
      const unhook = net.hookWs('/lol-settings/v1/local/video', (_endpoint: string, payload: any) => {
        if (!isEnabled || !ctx.store.get<boolean>('applyResolution', true)) return payload
        const h = Number(ctx.store.get<number>('height', 900)) || 900
        const targetZoom = calculateZoom(h)
        if (payload && payload.data) {
          return {
            ...payload,
            data: {
              ...payload.data,
              ZoomScale: targetZoom,
            },
          }
        }
        return payload
      })
      if (unhook) _hookCleanups.push(unhook)
    }
  },

  load() {
    if (!_currentCtx) return
    isEnabled = _currentCtx.store.get<boolean>('enabled', false)
    if (isEnabled) {
      applySettings(_currentCtx)
    }
  },

  unload() {
    restoreAllNativeSettings()
    for (const cleanup of _hookCleanups) cleanup()
    _hookCleanups = []
    isEnabled = false
    _currentCtx = null
  },

  onSettingChange(rawCtx: unknown, key: string, value: unknown) {
    const ctx = (rawCtx as ModuleContext) || _currentCtx
    if (!ctx) return

    if (key === 'enabled') {
      isEnabled = Boolean(value)
      if (isEnabled) {
        applySettings(ctx)
      } else {
        restoreAllNativeSettings()
      }
    } else if (isEnabled) {
      applySettings(ctx)
    }
  },
}
