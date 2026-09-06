import { defineStore } from 'pinia'
import { useDataStore } from '@/composables/useDataStore'

export interface AppSettings {
  autoAccept: boolean
  passiveModeInGame: boolean
  darkTheme: boolean
  windowScale: number
  showFloatingButton: boolean
  themeColor: string
}

const defaultSettings: AppSettings = {
  autoAccept: false,
  passiveModeInGame: true,
  darkTheme: true,
  windowScale: 1.0,
  showFloatingButton: true,
  themeColor: '#c89b3c',
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = useDataStore<AppSettings>('user_settings', defaultSettings)

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    settings.value[key] = value
  }

  return {
    settings,
    updateSetting,
  }
})
