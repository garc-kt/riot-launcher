<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { CoreModule } from '../lib/core-module'
import { dialog } from '@tauri-apps/api'
import { BoltIcon, PowerIcon } from './Icons'

const loading = ref(true)
const active = ref(false)

const activate = async () => {
  if (loading.value) return
  loading.value = true

  try {
    if (!await CoreModule.checkLeagueDir()) {
      await dialog.message('Please select a valid LoL Client folder in Settings.', { type: 'warning' })
      return
    }

    if (!await CoreModule.exists()) {
      await dialog.message('Failed to perform activation, the core module is not found.', { type: 'warning' })
      return
    }

    const nextActive = !active.value
    const { activated, error } = await CoreModule.doActivate(nextActive)

    if (error) {
      await dialog.message(`Failed to perform activation, got error:\n${error}`, { type: 'warning' })
    } else if (activated === nextActive) {
      active.value = activated
    }
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    active.value = await CoreModule.isActivated()
  } catch (err) {
    console.warn('Failed to check activation status:', err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="fixed bottom-5 right-6 z-20">
    <button
      class="flex items-center gap-3 px-4 py-2 rounded-full border shadow-lg backdrop-blur-md transition-all duration-200 group cursor-pointer"
      :class="[
        active
          ? 'bg-card/95 border-[var(--border-teal)] text-[var(--border-teal)] shadow-[0_0_18px_rgba(10,200,185,0.25)] hover:shadow-[0_0_24px_rgba(10,200,185,0.4)]'
          : 'bg-card/90 border-border text-foreground hover:border-primary/60 hover:text-primary',
        { 'opacity-60 pointer-events-none': loading }
      ]"
      @click="activate"
    >
      <!-- Crystal Jewel Indicator -->
      <span
        class="size-2.5 rounded-full transition-all duration-300"
        :class="active ? 'bg-[var(--border-teal)] shadow-[0_0_8px_var(--border-teal)] animate-pulse' : 'bg-muted-foreground/40'"
      />

      <div class="flex items-center gap-2 text-xs font-bold tracking-[0.14em] uppercase font-serif">
        <BoltIcon v-if="active" :size="14" :thickness="2.2" />
        <PowerIcon v-else :size="14" :thickness="2.2" />
        <span>{{ active ? 'Client Hooked' : 'Activate Hook' }}</span>
      </div>

      <span
        class="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold tracking-wider"
        :class="active ? 'bg-[#0ac8b9]/20 text-[var(--border-teal)] border border-[#0ac8b9]/30' : 'bg-muted text-muted-foreground border border-border'"
      >
        {{ active ? 'LIVE' : 'IDLE' }}
      </span>
    </button>
  </div>
</template>
