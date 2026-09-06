<script setup lang="ts">
import { ref } from 'vue'
import { useRoot } from '../../lib/root'
import { useI18n } from '../../lib/i18n'
import TabGeneral from './TabGeneral.vue'
import TabClient from './TabClient.vue'
import TabThemes from './TabThemes.vue'
import TabAbout from './TabAbout.vue'

const { settings } = useRoot()
const { t } = useI18n()

const activeTabIndex = ref(0)
const tabs = [
  { name: 'General', component: TabGeneral },
  { name: 'League Client', component: TabClient },
  { name: 'Themes', component: TabThemes },
  { name: 'About', component: TabAbout },
]
</script>

<template>
  <div
    v-if="settings.visible.value"
    class="h-screen fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center select-none"
  >
    <div data-tauri-drag-region class="absolute top-0 w-full h-10" />

    <div class="border border-border rounded-sm relative flex w-[800px] h-[490px] shadow-2xl overflow-hidden bg-surface">
      <button
        class="absolute top-3 right-3 flex justify-center items-center size-7 text-foreground-muted hover:text-destructive-foreground hover:bg-destructive rounded-sm cursor-pointer transition-colors z-10"
        @click="settings.hide"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <polygon points="10.2,0.7 9.5,0 5.1,4.4 0.7,0 0,0.7 4.4,5.1 0,9.5 0.7,10.2 5.1,5.8 9.5,10.2 10.2,9.5 5.8,5.1" />
        </svg>
      </button>

      <div class="flex flex-col border-r border-border p-3 w-[200px] py-6 bg-surface-2/60">
        <h1 class="text-foreground-subtle text-[11px] font-medium mx-2 mb-3">
          {{ t('Settings') }}
        </h1>
        <nav class="flex flex-col space-y-0.5">
          <button
            v-for="(tabItem, index) in tabs"
            :key="tabItem.name"
            class="px-2.5 py-2 rounded-sm text-xs text-left transition-colors cursor-pointer"
            :class="activeTabIndex === index
              ? 'bg-surface text-foreground font-semibold'
              : 'text-foreground-muted hover:text-foreground hover:bg-surface/60 font-medium'"
            @click="activeTabIndex = index"
          >
            {{ t(tabItem.name) }}
          </button>
        </nav>
      </div>

      <div class="flex flex-col flex-1 p-5 py-6">
        <div class="border-b border-border pb-3 mb-4">
          <h1 class="text-foreground text-sm font-semibold">
            {{ t(tabs[activeTabIndex].name) }}
          </h1>
        </div>
        <div class="flex flex-col space-y-3 pr-4 pb-4 flex-auto h-0 overflow-y-auto">
          <component :is="tabs[activeTabIndex].component" />
        </div>
      </div>
    </div>
  </div>
</template>
