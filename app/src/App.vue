<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppWindow from '@/components/shared/AppWindow.vue'
import { useUiStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import { lcuClient } from '@/services/lcu/client'
import { useLcuEvent } from '@/composables/useLcuSocket'
import type { GameflowPhase } from '@/types'
import { Sparkles } from 'lucide-vue-next'

const uiStore = useUiStore()
const settingsStore = useSettingsStore()

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
    <button
      v-if="!uiStore.isOpen && !uiStore.isMatchActive"
      class="hud-btn hud-panel fixed bottom-6 right-6 z-[99999] flex h-11 w-11 items-center justify-center rounded-full"
      title="Open companion"
      @click="uiStore.toggleOpen"
    >
      <Sparkles class="h-5 w-5" />
    </button>

    <!-- Passive mode (§0): fully unmounted during a live match, no DOM work or fetches -->
    <div v-if="uiStore.isMatchActive && settingsStore.settings.passiveModeInGame" hidden />

    <AppWindow
      v-else-if="uiStore.isOpen"
      title="Companion"
      @close="uiStore.toggleOpen"
    >
      <RouterView />
    </AppWindow>
  </div>
</template>
