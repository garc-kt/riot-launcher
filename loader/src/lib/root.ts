import { createRoot, createSignal } from 'solid-js'

function useSettings() {
  const [visible, setVisible] = createSignal(false)
  const show = () => setVisible(true)
  const hide = () => setVisible(false)

  return {
    visible,
    show, hide,
  }
}

export type ActiveTab = 'plugins' | 'themes' | 'store'
export type ThemeMode = 'cosmic' | 'vanilla'

const _root = createRoot(() => {
  const [ready, setReady] = createSignal(false)
  const [tab, setTab] = createSignal<ActiveTab>('plugins')
  const [themeMode, _setThemeMode] = createSignal<ThemeMode>('cosmic')
  const settings = useSettings()

  const isStore = () => tab() === 'store'
  const setStore = (store: boolean) => setTab(store ? 'store' : 'plugins')

  const setThemeMode = (mode: ThemeMode) => {
    _setThemeMode(mode)
    if (typeof document !== 'undefined') {
      document.body.classList.remove('theme-cosmic', 'theme-vanilla')
      document.body.classList.add(`theme-${mode}`)
      try {
        localStorage.setItem('riot_theme_mode', mode)
      } catch {}
    }
  }

  const toggleThemeMode = () => {
    setThemeMode(themeMode() === 'cosmic' ? 'vanilla' : 'cosmic')
  }

  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem('riot_theme_mode') as ThemeMode
      if (saved === 'cosmic' || saved === 'vanilla') {
        setThemeMode(saved)
      }
    } catch {}
  }

  return {
    ready, setReady,
    tab, setTab,
    isStore, setStore,
    settings,
    themeMode, setThemeMode, toggleThemeMode,
  }
})

export const useRoot = () => _root