import { createApp, type App as VueApp } from 'vue'
import { createPinia } from 'pinia'
import { router } from './router'
import App from './App.vue'
import './styles/main.css'

let appInstance: VueApp | null = null
let mountTarget: HTMLElement | null = null

export function bootstrapCompanion(targetContainer?: HTMLElement) {
  if (appInstance) return appInstance

  if (!targetContainer) {
    mountTarget = document.createElement('div')
    mountTarget.id = 'companion-app-mount'
    document.body.appendChild(mountTarget)
  } else {
    mountTarget = targetContainer
  }

  const pinia = createPinia()
  const app = createApp(App)

  app.use(pinia)
  app.use(router)

  app.mount(mountTarget)
  appInstance = app

  return app
}

export function teardownCompanion() {
  if (appInstance) {
    appInstance.unmount()
    appInstance = null
  }
  if (mountTarget && mountTarget.parentNode) {
    mountTarget.parentNode.removeChild(mountTarget)
    mountTarget = null
  }
}
