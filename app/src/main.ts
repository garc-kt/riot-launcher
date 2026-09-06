import { createApp, type App as VueApp } from 'vue'
import { createPinia } from 'pinia'
import { router } from './router'
import App from './App.vue'
import companionCss from './styles/main.css?inline'

let appInstance: VueApp | null = null
let hostElement: HTMLElement | null = null
let stylesheet: CSSStyleSheet | null = null
let attachmentObserver: MutationObserver | null = null

/**
 * Keep <companion-root> attached to the live document.
 *
 * We mount into the client's own <body>, which the client owns and rebuilds as
 * it boots — when it swaps the loading splash for the real UI it can drop our
 * host along with everything else it didn't put there. Vue never notices: the
 * app stays "mounted" and keeps rendering into a detached tree, so the panel
 * silently disappears and hotkeys appear dead because they're toggling
 * something no longer in the document.
 *
 * Watching childList on <html> and <body> (deliberately not subtree — the
 * client mutates constantly and we only care about our own host being dropped
 * or <body> itself being replaced) is enough to notice and re-append.
 */
function keepHostAttached(host: HTMLElement): MutationObserver {
  let observedBody: HTMLElement | null = null

  const ensureAttached = () => {
    const body = document.body
    if (!body) return

    if (body !== observedBody) {
      // <body> itself was replaced — follow the new one.
      observer.observe(body, { childList: true })
      observedBody = body
    }

    if (!host.isConnected) {
      body.appendChild(host)
      console.info('[Companion] Host element was detached by the client — reattached.')
    }
  }

  const observer = new MutationObserver(ensureAttached)
  observer.observe(document.documentElement, { childList: true })
  ensureAttached()

  return observer
}

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

    attachmentObserver = keepHostAttached(hostElement)
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
  // Stop reattaching before we remove the host, or passive mode / the
  // kill-switch would immediately put it back.
  if (attachmentObserver) {
    attachmentObserver.disconnect()
    attachmentObserver = null
  }
  if (appInstance) {
    appInstance.unmount()
    appInstance = null
  }
  if (hostElement && hostElement.parentNode) {
    hostElement.parentNode.removeChild(hostElement)
  }
  hostElement = null
}
