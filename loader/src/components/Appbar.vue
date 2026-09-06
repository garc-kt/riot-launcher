<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { appWindow } from '@tauri-apps/api/window'
import { useRoot } from '../lib/root'
import { vTippy } from '../lib/utils'
import { MoonIcon, PaletteIcon, PluginIcon, SettingsIcon, StoreIcon, SunIcon } from './Icons'
import icon from '../assets/icon-sm.png'

defineProps<{
  isHome: boolean
}>()

const { settings, tab, setTab, themeMode, toggleThemeMode } = useRoot()
const appVersion = (typeof window !== 'undefined' ? (window as any).appVersion : '1.0.0') || '1.0.0'
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
    class="flex items-center justify-between h-11 border-b border-white/5 bg-[#23212C] select-none transition-opacity"
    :class="{ 'opacity-80': !isFocused }"
  >
    <!-- Brand -->
    <div class="flex items-center px-3 h-full pointer-events-none gap-2">
      <img :src="icon" class="size-5 rounded-md" alt="Riot Loader" />
      <span class="text-sm font-semibold tracking-tight text-white">Riot Loader</span>
      <span class="text-[11px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-400 font-mono">v{{ appVersion }}</span>
    </div>

    <!-- Navigation tabs -->
    <div v-if="isHome" class="flex items-center h-full gap-1">
      <button
        class="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer"
        :class="tab === 'plugins' ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'"
        @click="setTab('plugins')"
      >
        <PluginIcon :size="14" />
        <span>Plugins</span>
      </button>

      <button
        class="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer"
        :class="tab === 'themes' ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'"
        @click="setTab('themes')"
      >
        <PaletteIcon :size="14" />
        <span>Themes</span>
      </button>

      <button
        class="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer"
        :class="tab === 'store' ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'"
        @click="setTab('store')"
      >
        <StoreIcon :size="14" />
        <span>Store</span>
      </button>
    </div>

    <!-- Action / Window Controls -->
    <div class="flex items-center h-full">
      <template v-if="isHome">
        <button
          v-tippy="themeMode === 'cosmic' ? 'Switch to Vanilla (Light)' : 'Switch to Cosmic (Dark)'"
          class="flex justify-center items-center px-3 h-full hover:bg-white/10 transition-colors cursor-pointer text-neutral-400 hover:text-white"
          @click="toggleThemeMode"
        >
          <SunIcon v-if="themeMode === 'cosmic'" :size="15" />
          <MoonIcon v-else :size="15" />
        </button>

        <button
          v-tippy="'Settings'"
          class="flex justify-center items-center px-3 h-full hover:bg-white/10 transition-colors cursor-pointer text-neutral-400 hover:text-white"
          @click="settings.show"
        >
          <SettingsIcon :size="15" />
        </button>
      </template>

      <button
        v-tippy="'Minimize'"
        class="flex justify-center items-center px-3 h-full hover:bg-white/10 transition-colors cursor-pointer text-neutral-400 hover:text-white"
        @click="minimize"
      >
        <svg width="10" height="10" viewBox="0 0 10.2 1" fill="currentColor">
          <rect x="0" y="50%" width="10.2" height="1" />
        </svg>
      </button>

      <button
        v-tippy="'Close'"
        class="flex justify-center items-center px-3 h-full hover:text-white hover:bg-rose-600/90 transition-colors cursor-pointer text-neutral-400"
        @click="close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <polygon points="10.2,0.7 9.5,0 5.1,4.4 0.7,0 0,0.7 4.4,5.1 0,9.5 0.7,10.2 5.1,5.8 9.5,10.2 10.2,9.5 5.8,5.1" />
        </svg>
      </button>
    </div>
  </div>
</template>
