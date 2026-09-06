import { bootstrapCompanion, teardownCompanion } from './src/main'
import { createLifecycleManager } from '@riot/contracts/lifecycle'
import { lcuClient } from './src/services/lcu/client'
import { bootstrapModules, loadModules, getModuleHost } from './src/modules'
import type { PluginContext } from './src/types'

let pluginContext: PluginContext | null = null
const lifecycle = createLifecycleManager({
  bootstrap: bootstrapCompanion,
  teardown: teardownCompanion,
})

/**
 * Plugin entry initialization (§4.2 contract)
 */
export async function init(context: PluginContext) {
  pluginContext = context
  ;(window as any).__companion_context = context
  lcuClient.bind(context)

  // Register command palette action via context.ext.commands (§9.2)
  if (context.ext?.commands) {
    context.ext.commands.register({
      id: 'companion:toggle',
      name: 'Toggle Companion Window',
      legend: 'Open or close the Companion stats window',
      tags: ['companion', 'stats', 'profile'],
      icon: 'sparkles',
      perform: () => {
        if (lifecycle.handleToggle()) {
          return
        }
        const toggleBtn = document.querySelector<HTMLButtonElement>('.companion-app-root button')
        if (toggleBtn) {
          toggleBtn.click()
        }
      },
    })
  }

  // Passive during matches rule (§0):
  // When match is InProgress, unmount DOM and halt fetches
  if (context.socket) {
    context.socket.observe<string>('/lol-gameflow/v1/gameflow-phase', (event) => {
      lifecycle.handlePhaseChange(event.data)
    })
  }

  // Panic hotkey kill-switch: Ctrl+Shift+Alt+K immediately tears down the
  // companion UI AND every effect module — previously this only unmounted
  // Vue, leaving any ported module running after a "kill everything" hotkey.
  window.addEventListener('keydown', (e) => {
    const wasKilled = lifecycle.isKilled()
    lifecycle.handleKeyDown(e)
    if (!wasKilled && lifecycle.isKilled()) {
      getModuleHost()?.unloadAll().catch(err => console.error('[Companion] Module teardown on kill-switch failed:', err))
    }
  })

  await bootstrapModules(context)

  console.info('[Companion] Initialized successfully with context:', context)
}

/**
 * Called on native window 'load' event
 */
export async function load() {
  lifecycle.load()
  await loadModules()
}

// Default export for compatibility
export default {
  init,
  load,
}
