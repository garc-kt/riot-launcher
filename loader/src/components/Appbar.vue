<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { appWindow } from '@tauri-apps/api/window'
import { useRoot } from '../lib/root'
import { vTippy } from '../lib/utils'
import { MoonIcon, SettingsIcon, SunIcon } from './Icons'
import icon from '../assets/icon-sm.png'

defineProps<{
  isHome: boolean
}>()

const { settings, themeMode, toggleThemeMode } = useRoot()
const appVersion = (typeof window !== 'undefined' ? (window as any).appVersion : '1.0.2') || '1.0.2'
const isFocused = ref(true)
let unlistenFocus: (() => void) | null = null

const minimize = () => appWindow.minimize()
const close = () => appWindow.close()

onMounted(async () => {
  try {
    isFocused.value = await appWindow.isFocused()
    unlistenFocus = await appWindow.onFocusChanged(e => {
      isFocused.value = e.payload
    })
  } catch (err) {
    console.warn('Failed to listen to window focus:', err)
  }
})

onUnmounted(() => {
  unlistenFocus?.()
})
</script>

<template>
  <div
    data-tauri-drag-region
    class="flex items-center justify-between h-10 border-b border-border bg-background/90 backdrop-blur-md select-none transition-all duration-200 px-3"
    :class="{ 'opacity-85': !isFocused }"
  >
    <!-- Brand / League Client Header Style -->
    <div class="flex items-center h-full pointer-events-none gap-2.5">
      <img :src="icon" class="size-5 rounded border border-border shadow-sm" alt="Riot Loader" />
      <div class="flex items-baseline gap-2">
        <span class="text-xs font-bold tracking-[0.16em] uppercase text-foreground font-serif">
          Riot Loader
        </span>
        <span class="text-[10px] px-1.5 py-0.2 rounded border border-border bg-card text-muted-foreground font-mono">
          v{{ appVersion }}
        </span>
      </div>
    </div>

    <!-- Right-hand Action & Window Controls -->
    <div class="flex items-center h-full">
      <template v-if="isHome">
        <button
          v-tippy="themeMode === 'cosmic' ? 'Switch to Vanilla (Light)' : 'Switch to Hextech Dark'"
          class="flex justify-center items-center size-8 hover:bg-muted rounded transition-all cursor-pointer text-muted-foreground hover:text-foreground mr-1"
          @click="toggleThemeMode"
        >
          <SunIcon v-if="themeMode === 'cosmic'" :size="15" />
          <MoonIcon v-else :size="15" />
        </button>

        <button
          v-tippy="'Client Settings'"
          class="flex justify-center items-center size-8 hover:bg-muted rounded transition-all cursor-pointer text-muted-foreground hover:text-foreground mr-2"
          @click="settings.show"
        >
          <SettingsIcon :size="15" />
        </button>
      </template>

      <!-- League Client Window Controls -->
      <div class="flex items-center h-full pl-1 border-l border-border">
        <button
          v-tippy="'Minimize'"
          class="flex justify-center items-center w-9 h-full hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
          @click="minimize"
        >
          <svg width="10" height="2" viewBox="0 0 10.2 1" fill="currentColor">
            <rect x="0" y="0" width="10.2" height="1" />
          </svg>
        </button>

        <button
          v-tippy="'Close'"
          class="flex justify-center items-center w-9 h-full hover:text-white hover:bg-destructive transition-colors cursor-pointer text-muted-foreground"
          @click="close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <polygon points="10.2,0.7 9.5,0 5.1,4.4 0.7,0 0,0.7 4.4,5.1 0,9.5 0.7,10.2 5.1,5.8 9.5,10.2 10.2,9.5 5.8,5.1" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
