/// <reference types="vite/client" />

declare interface Window {
  isMac: boolean
  appVersion: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}