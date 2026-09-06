<script setup lang="ts">
import Activator from '../components/Activator.vue'
import SettingsModal from '../components/settings/SettingsModal.vue'
import PluginGallery from '../components/PluginGallery.vue'
</script>

<template>
  <div class="flex flex-col flex-1 overflow-hidden relative">
    <div class="flex-1 overflow-y-auto">
      <PluginGallery />
    </div>

    <!-- Floating Activator Pill -->
    <Activator />

    <!-- Settings Modal -->
    <SettingsModal />
  </div>
</template>
