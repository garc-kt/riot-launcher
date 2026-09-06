<script setup lang="ts">
import { ref } from 'vue'
import { useRoot } from '../../lib/root'
import TabGeneral from './TabGeneral.vue'
import TabClient from './TabClient.vue'
import TabAbout from './TabAbout.vue'

const { settings } = useRoot()

const activeTabIndex = ref(0)
const tabs = [
  { name: 'General', component: TabGeneral },
  { name: 'League Client', component: TabClient },
  { name: 'About', component: TabAbout },
]
</script>

<template>
  <div
    v-if="settings.visible.value"
    class="h-screen fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex justify-center items-center select-none"
  >
    <div data-tauri-drag-region class="absolute top-0 w-full h-10" />

    <div
      class="border border-border rounded-lg relative flex w-[800px] h-[490px] shadow-2xl overflow-hidden bg-card"
      style="box-shadow: inset 0 0 0 1px rgba(200, 170, 110, 0.15), 0 24px 48px rgba(0, 0, 0, 0.6);"
    >
      <!-- Close button -->
      <button
        class="absolute top-3 right-3 flex justify-center items-center size-7 text-muted-foreground hover:text-white hover:bg-destructive rounded cursor-pointer transition-colors z-10"
        @click="settings.hide"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <polygon points="10.2,0.7 9.5,0 5.1,4.4 0.7,0 0,0.7 4.4,5.1 0,9.5 0.7,10.2 5.1,5.8 9.5,10.2 10.2,9.5 5.8,5.1" />
        </svg>
      </button>

      <!-- League Style Sidebar Navigation -->
      <div class="flex flex-col border-r border-border p-4 w-[210px] py-6 bg-secondary/40">
        <h1 class="text-muted-foreground text-[11px] font-bold uppercase tracking-[0.16em] mx-3 mb-3 font-serif">
          Settings
        </h1>
        <nav class="flex flex-col space-y-1">
          <button
            v-for="(tabItem, index) in tabs"
            :key="tabItem.name"
            class="px-3 py-2 rounded text-xs text-left transition-all cursor-pointer font-serif uppercase tracking-wider"
            :class="activeTabIndex === index
              ? 'border-l-2 border-primary bg-primary/10 text-foreground font-bold pl-2.5'
              : 'border-l-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted font-medium'"
            @click="activeTabIndex = index"
          >
            {{ tabItem.name }}
          </button>
        </nav>
      </div>

      <!-- Content View -->
      <div class="flex flex-col flex-1 p-5 py-6">
        <div class="border-b border-border pb-3 mb-4">
          <h1 class="text-foreground text-base font-bold uppercase tracking-[0.12em] font-serif">
            {{ tabs[activeTabIndex].name }}
          </h1>
        </div>
        <div class="flex flex-col space-y-3 pr-4 pb-4 flex-auto h-0 overflow-y-auto">
          <component :is="tabs[activeTabIndex].component" />
        </div>
      </div>
    </div>
  </div>
</template>
