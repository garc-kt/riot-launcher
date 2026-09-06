import { createApp, type App as VueApp } from 'vue'
import { createPinia } from 'pinia'
import { router } from './router'
import App from './App.vue'
import companionCss from './styles/main.css?inline'

let appInstance: VueApp | null = null
let hostElement: HTMLElement | null = null
let stylesheet: CSSStyleSheet | null = null

function getStylesheet(): CSSStyleSheet {
  if (!stylesheet) {
    stylesheet = new CSSStyleSheet()
    stylesheet.replaceSync(companionCss)
  }
  return stylesheet
}

export function bootstrapCompanion(targetContainer?: HTMLElement) {
  if (appInstance) return appInstance

  let mountTarget: HTMLElement

  if (targetContainer) {
    // Test/host-provided container: mount directly, no shadow root. Used by
    // the passive-mode test harness, which asserts on plain DOM.
    mountTarget = targetContainer
  } else {
    hostElement = document.createElement('companion-root')
    // Marker checked by the native theming patch (theming/index.ts) so a
    // user's client-wide theme doesn't bleed into the HUD's own chrome by
    // default — see `data-theme-target` there for the opt-in.
    hostElement.setAttribute('data-companion-root', '')
    document.body.appendChild(hostElement)

    const shadow = hostElement.attachShadow({ mode: 'open' })
    try {
      shadow.adoptedStyleSheets = [getStylesheet()]
    } catch {
      // Older CEF/Chromium fallback: a plain inline <style>.
      const style = document.createElement('style')
      style.textContent = companionCss
      shadow.appendChild(style)
    }

    mountTarget = document.createElement('div')
    shadow.appendChild(mountTarget)
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
  if (hostElement && hostElement.parentNode) {
    hostElement.parentNode.removeChild(hostElement)
  }
  hostElement = null
}
