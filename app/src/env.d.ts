/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  DataStore?: {
    has(key: string): boolean
    get<T>(key: string, fallback?: T): T | undefined
    set(key: string, value: any): boolean
    remove(key: string): boolean
  }
  Effect?: {
    apply(type: string, options?: any): void
    clear(): void
    setTheme(theme: string): void
  }
  Companion?: any
  Pengu?: any
  openDevTools?: () => void
  reloadClient?: () => void
  restartClient?: () => void
  __companion_context?: any
}
