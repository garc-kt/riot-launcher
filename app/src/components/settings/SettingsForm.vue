<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'
import { useNative } from '@/composables/useNative'
import { Terminal, RefreshCw, Power } from 'lucide-vue-next'

const settingsStore = useSettingsStore()
const { openDevTools, reloadClient, restartClient } = useNative()
</script>

<template>
  <div class="space-y-6 text-sm">
    <!-- Behavior Section -->
    <div class="space-y-3">
      <h3 class="text-xs font-semibold text-[var(--hud-foreground-muted)]">
        Safety & behavior
      </h3>

      <div class="rounded-lg border border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)] p-4 space-y-4">
        <label class="flex items-start justify-between gap-4 cursor-pointer">
          <div>
            <div class="font-medium text-[var(--hud-foreground)]">Passive In-Game Mode</div>
            <div class="text-xs text-[var(--hud-foreground-muted)]">
              Automatically pauses all DOM updates, fetches, and unmounts companion overlay when match starts (InProgress).
            </div>
          </div>
          <input
            type="checkbox"
            v-model="settingsStore.settings.passiveModeInGame"
            class="mt-1 h-4 w-4 rounded border-[var(--hud-border)] bg-[rgba(255,255,255,0.05)] text-[var(--hud-foreground-muted)] focus:ring-0"
          />
        </label>

        <label class="flex items-start justify-between gap-4 cursor-pointer">
          <div>
            <div class="font-medium text-[var(--hud-foreground)]">Dark Mode Theming</div>
            <div class="text-xs text-[var(--hud-foreground-muted)]">
              Applies client-wide dark styling via the native constructable stylesheet engine.
            </div>
          </div>
          <input
            type="checkbox"
            v-model="settingsStore.settings.darkTheme"
            class="mt-1 h-4 w-4 rounded border-[var(--hud-border)] bg-[rgba(255,255,255,0.05)] text-[var(--hud-foreground-muted)] focus:ring-0"
          />
        </label>
      </div>
    </div>

    <!-- Client Developer Actions -->
    <div class="space-y-3">
      <h3 class="text-xs font-semibold text-[var(--hud-foreground-muted)]">
        Client actions
      </h3>

      <div class="flex flex-wrap gap-3">
        <button
          @click="openDevTools"
          class="flex items-center gap-2 rounded border border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-xs font-medium text-[var(--hud-foreground)] hover:bg-[var(--hud-border)] hover:text-[var(--hud-foreground)]"
        >
          <Terminal class="h-4 w-4 text-[var(--hud-foreground-muted)]" />
          Open DevTools
        </button>

        <button
          @click="reloadClient"
          class="flex items-center gap-2 rounded border border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-xs font-medium text-[var(--hud-foreground)] hover:bg-[var(--hud-border)] hover:text-[var(--hud-foreground)]"
        >
          <RefreshCw class="h-4 w-4 text-[var(--hud-foreground-muted)]" />
          Reload Client
        </button>

        <button
          @click="restartClient"
          class="flex items-center gap-2 rounded border border-destructive/40 bg-[rgba(255,255,255,0.04)] px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
        >
          <Power class="h-4 w-4" />
          Full Client Restart
        </button>
      </div>
    </div>
  </div>
</template>
