<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppWindow from '@/components/shared/AppWindow.vue'
import { useUiStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import { lcuClient } from '@/services/lcu/client'
import { useLcuEvent } from '@/composables/useLcuSocket'
import type { GameflowPhase } from '@/types'
import { Sparkles, Moon } from 'lucide-vue-next'

const uiStore = useUiStore()
const settingsStore = useSettingsStore()

// Listen to live gameflow phase changes
useLcuEvent<GameflowPhase>('/lol-gameflow/v1/gameflow-phase', (phase) => {
  if (phase) {
    uiStore.setPhase(phase)
  }
})

onMounted(async () => {
  const phase = await lcuClient.getGameflowPhase()
  uiStore.setPhase(phase)
})
</script>

<template>
  <div class="companion-app-root">
    <!-- Floating toggle button in client -->
    <button
      v-if="!uiStore.isOpen && !uiStore.isMatchActive"
      @click="uiStore.toggleOpen"
      class="cp-fixed cp-bottom-6 cp-right-6 cp-z-[99999] cp-flex cp-h-12 cp-w-12 cp-items-center cp-justify-center cp-rounded-full cp-border cp-border-[#c89b3c] cp-bg-[#091428] cp-text-[#c89b3c] cp-shadow-xl hover:cp-scale-105 cp-transition-transform"
      title="Open Companion"
    >
      <Sparkles class="cp-h-6 cp-w-6" />
    </button>

    <!-- In-Game Passive Mode Overlay Placeholder (§0: Fully passive during matches) -->
    <div
      v-if="uiStore.isMatchActive && settingsStore.settings.passiveModeInGame"
      class="cp-hidden"
    >
      <!-- Passive: UI unmounted, no DOM work or fetches -->
    </div>

    <!-- Active App Window -->
    <AppWindow
      v-else-if="uiStore.isOpen"
      @close="uiStore.toggleOpen"
      title="LoL Companion Platform"
    >
      <RouterView />
    </AppWindow>
  </div>
</template>

<style scoped>
.companion-app-root {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
</style>
