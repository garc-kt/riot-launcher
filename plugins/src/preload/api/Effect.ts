import { native } from './native';

const Win11MicaMaterial = {
  auto: 0,
  none: 1,
  mica: 2,
  acrylic: 3,
  tabbed: 4,
}

type EffectName =
  | 'transparent'
  | 'blurbehind'
  | 'acrylic'
  | 'unified'
  | 'mica'
  | 'vibrancy'

const WinBackdropType = {
  transparent: 0,
  blurbehind: 1,
  acrylic: 2,
  unified: 3,
  mica: 4,
}

function parseHexColor(color: string): number {
  if (typeof color === 'string') {
    if (color.startsWith('#')) {
      let hex = color.slice(1)
      let size = hex.length
      let i = 0, step = size > 4 ? 1 : 0

      let r = parseInt(hex[i] + hex[i += step], 16);
      let g = parseInt(hex[++i] + hex[i += step], 16)
      let b = parseInt(hex[++i] + hex[i += step], 16)
      let a = 255

      if (size === 4 || size === 8) {
        a = parseInt(hex[++i] + hex[i += step], 16)
      }

      return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
    }
  }
  return 0
}

function applyWindowEffectWin(name: EffectName, options: any) {
  if (name === 'vibrancy') {
    console.warn('Vibrancy effect is a macOS-only feature not available on Windows.')
    return
  }

  if (name in WinBackdropType) {
    if (name === 'mica') {
      const material = String(options.material || 'mica')
      if (material in Win11MicaMaterial) {
        native.SetWindowVibrancy(WinBackdropType.mica, Win11MicaMaterial[material as keyof typeof Win11MicaMaterial])
      } else {
        console.warn('Unsupported mica material: %s', material)
      }
    } else {
      const color = parseHexColor(options.color)
      native.SetWindowVibrancy(WinBackdropType[name], color)
    }
  } else {
    console.warn('Unknown window visual effect: %s', name)
  }
}

window.Effect = {

  apply(name: EffectName, options?: any) {
    options = options || {}
    applyWindowEffectWin(name, options)
  },

  clear() {
    native.SetWindowVibrancy(null);
  },

  setTheme(theme: string) {
    if (theme === 'light')
      native.SetWindowTheme(false)
    else if (theme === 'dark')
      native.SetWindowTheme(true)
  },

}