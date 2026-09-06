<script setup lang="ts">
import { useRoot } from '../lib/root'
import Activator from '../components/Activator.vue'
import SettingsModal from '../components/settings/SettingsModal.vue'
import PluginGallery from '../components/PluginGallery.vue'
import PluginStore from '../components/PluginStore.vue'
import ThemeManager from '../components/ThemeManager.vue'

const { tab } = useRoot()
</script>

<template>
  <div class="flex flex-col flex-1 overflow-hidden relative">
    <div class="flex-1 overflow-y-auto">
      <div v-if="tab === 'plugins'" class="h-full">
        <PluginGallery />
      </div>
      <div v-else-if="tab === 'themes'" class="h-full">
        <ThemeManager />
      </div>
      <div v-else-if="tab === 'store'" class="h-full">
        <PluginStore />
      </div>
    </div>

    <!-- Floating Activator Pill -->
    <Activator v-if="tab !== 'store'" />

    <!-- Settings Modal -->
    <SettingsModal />
  </div>
</template>
