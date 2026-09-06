import { ref, watch } from 'vue'
import type { ScopedStore } from '@/types'

function getScopedStore(): ScopedStore | undefined {
  return (window as any).__companion_context?.ext?.store
}

/**
 * Persists through context.ext.store (plugins_data/@companion.json,
 * already debounced 100ms — see plugins/src/preload/ext/index.ts) rather
 * than the global window.DataStore this used to write through. The global
 * store is one shared, unbacked-up file every plugin's DataStore.set()
 * whole-file-rewrites; routing app settings through it meant every
 * keystroke here re-serialized every OTHER plugin's data too. Falls back
 * to window.DataStore, then localStorage, if ext.store isn't available
 * (e.g. running outside the injected client during local dev).
 */
export function useDataStore<T>(key: string, defaultValue: T) {
  const storedValue = ref<T>(defaultValue)

  const load = () => {
    const scoped = getScopedStore()
    if (scoped) {
      const val = scoped.get<T>(key)
      if (val !== undefined) {
        storedValue.value = val
        return
      }
    } else if (typeof window !== 'undefined' && window.DataStore) {
      const val = window.DataStore.get<T>('companion_app:' + key)
      if (val !== undefined) {
        storedValue.value = val
        return
      }
    } else if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem('companion_app:' + key)
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

  let timeout: any = null
  watch(
    storedValue,
    (newVal) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        const scoped = getScopedStore()
        if (scoped) {
          scoped.set(key, newVal)
        } else if (typeof window !== 'undefined' && window.DataStore) {
          window.DataStore.set('companion_app:' + key, newVal)
        } else if (typeof localStorage !== 'undefined') {
          localStorage.setItem('companion_app:' + key, JSON.stringify(newVal))
        }
      }, 150)
    },
    { deep: true }
  )

  return storedValue
}
