import { ref, watch } from 'vue'

const PLUGIN_PREFIX = 'companion_app:'

export function useDataStore<T>(key: string, defaultValue: T) {
  const fullKey = PLUGIN_PREFIX + key
  const storedValue = ref<T>(defaultValue)

  // Initialize from DataStore or localStorage
  const load = () => {
    if (typeof window !== 'undefined' && window.DataStore) {
      const val = window.DataStore.get<T>(fullKey)
      if (val !== undefined) {
        storedValue.value = val
        return
      }
    } else if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(fullKey)
      if (val !== null) {
        try {
          storedValue.value = JSON.parse(val)
          return
        } catch {}
      }
    }
    storedValue.value = defaultValue
  }

  load()

  // Watch and persist changes debounced
  let timeout: any = null
  watch(
    storedValue,
    (newVal) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        if (typeof window !== 'undefined' && window.DataStore) {
          window.DataStore.set(fullKey, newVal)
        } else if (typeof localStorage !== 'undefined') {
          localStorage.setItem(fullKey, JSON.stringify(newVal))
        }
      }, 150)
    },
    { deep: true }
  )

  return storedValue
}
