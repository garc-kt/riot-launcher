import { ref, computed } from 'vue'

export type ActiveTab = 'plugins' | 'themes' | 'store'
export type ThemeMode = 'cosmic' | 'vanilla'

const ready = ref(false)
const tab = ref<ActiveTab>('plugins')
const themeMode = ref<ThemeMode>('cosmic')
const settingsVisible = ref(false)

const settings = {
  visible: settingsVisible,
  show: () => { settingsVisible.value = true },
  hide: () => { settingsVisible.value = false }
}

const isStore = computed(() => tab.value === 'store')
const setStore = (store: boolean) => {
  tab.value = store ? 'store' : 'plugins'
}

const setThemeMode = (mode: ThemeMode) => {
  themeMode.value = mode
  if (typeof document !== 'undefined') {
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

if (typeof localStorage !== 'undefined') {
  try {
    const saved = localStorage.getItem('riot_theme_mode') as ThemeMode
    if (saved === 'cosmic' || saved === 'vanilla') {
      setThemeMode(saved)
    }
  } catch {}
}

const rootState = {
  ready,
  setReady: (val: boolean) => { ready.value = val },
  tab,
  setTab: (val: ActiveTab) => { tab.value = val },
  isStore,
  setStore,
  settings,
  themeMode,
  setThemeMode,
  toggleThemeMode,
}

export const useRoot = () => rootState