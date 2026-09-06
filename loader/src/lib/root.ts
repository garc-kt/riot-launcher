import { ref } from 'vue'

export type ThemeMode = 'cosmic' | 'vanilla'

const ready = ref(false)
const themeMode = ref<ThemeMode>('cosmic')
const settingsVisible = ref(false)
const searchQuery = ref('')

const settings = {
  visible: settingsVisible,
  show: () => { settingsVisible.value = true },
  hide: () => { settingsVisible.value = false }
}

const setThemeMode = (mode: ThemeMode) => {
  themeMode.value = mode
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('theme-cosmic', 'theme-vanilla')
    document.documentElement.classList.add(`theme-${mode}`)
    document.body.classList.remove('theme-cosmic', 'theme-vanilla')
    document.body.classList.add(`theme-${mode}`)
    try {
      localStorage.setItem('riot_theme_mode', mode)
    } catch {}
  }
}

const toggleThemeMode = () => {
  setThemeMode(themeMode.value === 'cosmic' ? 'vanilla' : 'cosmic')
}

if (typeof document !== 'undefined') {
  try {
    const saved = localStorage.getItem('riot_theme_mode') as ThemeMode
    if (saved === 'cosmic' || saved === 'vanilla') {
      setThemeMode(saved)
    } else {
      setThemeMode('cosmic')
    }
  } catch {
    setThemeMode('cosmic')
  }
}

const rootState = {
  ready,
  setReady: (val: boolean) => { ready.value = val },
  settings,
  themeMode,
  setThemeMode,
  toggleThemeMode,
  searchQuery,
}

export const useRoot = () => rootState