import { ref } from 'vue'

export type ThemeMode = 'dark' | 'light'

const ready = ref(false)
const themeMode = ref<ThemeMode>('dark')
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
    document.documentElement.classList.remove('theme-dark', 'theme-light')
    document.documentElement.classList.add(`theme-${mode}`)
    document.body.classList.remove('theme-dark', 'theme-light')
    document.body.classList.add(`theme-${mode}`)
    try {
      localStorage.setItem('riot_theme_mode', mode)
    } catch {}
  }
}

const toggleThemeMode = () => {
  setThemeMode(themeMode.value === 'dark' ? 'light' : 'dark')
}

if (typeof document !== 'undefined') {
  try {
    const saved = localStorage.getItem('riot_theme_mode') as ThemeMode
    if (saved === 'dark' || saved === 'light') {
      setThemeMode(saved)
    } else {
      setThemeMode('dark')
    }
  } catch {
    setThemeMode('dark')
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
