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
      :style="{ backgroundColor: active ? 'rgba(34, 197, 94, 0.12)' : 'rgba(44, 41, 55, 0.85)' }"
      :class="[
        active ? 'border-emerald-500/40 text-emerald-300 hover:border-emerald-400' : 'border-white/10 text-neutral-300 hover:border-white/25 hover:text-white',
        { 'opacity-60 pointer-events-none': loading }
      ]"
      @click="activate"
    >
      <span
        class="size-2 rounded-full transition-all duration-300"
        :class="active ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-neutral-500'"
      />

      <div class="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
        <BoltIcon v-if="active" :size="14" :thickness="2.2" />
        <PowerIcon v-else :size="14" :thickness="2.2" />
        <span>{{ active ? 'Client Hooked' : 'Activate Loader' }}</span>
      </div>

      <span
        class="text-[10px] px-2 py-0.5 rounded-full font-mono font-normal"
        :class="active ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-neutral-400'"
      >
        {{ active ? 'LIVE' : 'IDLE' }}
      </span>
    </button>
  </div>
</template>
