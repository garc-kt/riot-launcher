<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'
import { useNative } from '@/composables/useNative'
import { Terminal, RefreshCw, Power } from 'lucide-vue-next'

const settingsStore = useSettingsStore()
const { openDevTools, reloadClient, restartClient } = useNative()
</script>

<template>
  <div class="cp-space-y-6 cp-text-sm">
    <!-- Behavior Section -->
    <div class="cp-space-y-3">
      <h3 class="cp-text-xs cp-font-bold cp-uppercase cp-tracking-wider cp-text-[#a09b8c]">
        Safety & Behavior
      </h3>

      <div class="cp-rounded-lg cp-border cp-border-[#1e282d] cp-bg-[#091428] cp-p-4 cp-space-y-4">
        <label class="cp-flex cp-items-start cp-justify-between cp-gap-4 cp-cursor-pointer">
          <div>
            <div class="cp-font-medium cp-text-[#f0e6d2]">Passive In-Game Mode</div>
            <div class="cp-text-xs cp-text-[#a09b8c]">
              Automatically pauses all DOM updates, fetches, and unmounts companion overlay when match starts (InProgress).
            </div>
          </div>
          <input
            type="checkbox"
            v-model="settingsStore.settings.passiveModeInGame"
            class="cp-mt-1 cp-h-4 cp-w-4 cp-rounded cp-border-[#1e282d] cp-bg-[#010a13] cp-text-[#c89b3c] focus:cp-ring-0"
          />
        </label>

        <label class="cp-flex cp-items-start cp-justify-between cp-gap-4 cp-cursor-pointer">
          <div>
            <div class="cp-font-medium cp-text-[#f0e6d2]">Dark Mode Theming</div>
            <div class="cp-text-xs cp-text-[#a09b8c]">
              Applies client-wide dark styling via the native constructable stylesheet engine.
            </div>
          </div>
          <input
            type="checkbox"
            v-model="settingsStore.settings.darkTheme"
            class="cp-mt-1 cp-h-4 cp-w-4 cp-rounded cp-border-[#1e282d] cp-bg-[#010a13] cp-text-[#c89b3c] focus:cp-ring-0"
          />
        </label>
      </div>
    </div>

    <!-- Client Developer Actions -->
    <div class="cp-space-y-3">
      <h3 class="cp-text-xs cp-font-bold cp-uppercase cp-tracking-wider cp-text-[#a09b8c]">
        Client Actions
      </h3>

      <div class="cp-flex cp-flex-wrap cp-gap-3">
        <button
          @click="openDevTools"
          class="cp-flex cp-items-center cp-gap-2 cp-rounded cp-border cp-border-[#1e282d] cp-bg-[#091428] cp-px-3 cp-py-2 cp-text-xs cp-font-medium cp-text-[#cdbe91] hover:cp-bg-[#1e282d] hover:cp-text-[#f0e6d2]"
        >
          <Terminal class="cp-h-4 cp-w-4 cp-text-[#c89b3c]" />
          Open DevTools
        </button>

        <button
          @click="reloadClient"
          class="cp-flex cp-items-center cp-gap-2 cp-rounded cp-border cp-border-[#1e282d] cp-bg-[#091428] cp-px-3 cp-py-2 cp-text-xs cp-font-medium cp-text-[#cdbe91] hover:cp-bg-[#1e282d] hover:cp-text-[#f0e6d2]"
        >
          <RefreshCw class="cp-h-4 cp-w-4 cp-text-[#0ac8b9]" />
          Reload Client
        </button>

        <button
          @click="restartClient"
          class="cp-flex cp-items-center cp-gap-2 cp-rounded cp-border cp-border-rose-900/60 cp-bg-[#091428] cp-px-3 cp-py-2 cp-text-xs cp-font-medium cp-text-rose-300 hover:cp-bg-rose-950/40"
        >
          <Power class="cp-h-4 cp-w-4" />
          Full Client Restart
        </button>
      </div>
    </div>
  </div>
</template>
