<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { CoreModule } from '../lib/core-module'
import { useI18n } from '../lib/i18n'
import { dialog } from '@tauri-apps/api'
import { BoltIcon, PowerIcon } from './Icons'

const { t } = useI18n()
const loading = ref(true)
const active = ref(false)

const activate = async () => {
  if (loading.value) return
  loading.value = true

  try {
    if (!await CoreModule.checkLeagueDir()) {
      await dialog.message(t('Please select a valid LoL Client folder in Settings.'), { type: 'warning' })
      return
    }

    if (!await CoreModule.exists()) {
      await dialog.message(t('Failed to perform activation, the core module is not found.'), { type: 'warning' })
      return
    }

    const nextActive = !active.value
    const { activated, error } = await CoreModule.doActivate(nextActive)

    if (error) {
      await dialog.message(t('Failed to perform activation, got error:\n{error}', { error }), { type: 'warning' })
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
  <!--
    The hero of the loader: the whole control inverts from outline to solid
    fill when armed, rather than gaining a glow — the one place the signal
    color appears as a background, because this is the one state it exists
    to represent.
  -->
  <div class="fixed bottom-5 right-6 z-20">
    <button
      class="flex items-center gap-3.5 pl-3.5 pr-4 py-2.5 rounded-sm border transition-colors duration-150 cursor-pointer"
      :class="[
        active
          ? 'bg-signal border-signal text-signal-foreground'
          : 'bg-surface/95 border-border text-foreground hover:border-border-strong backdrop-blur-md',
        { 'opacity-60 pointer-events-none': loading }
      ]"
      @click="activate"
    >
      <span
        class="size-2 rounded-full"
        :class="active ? 'bg-signal-foreground animate-pulse' : 'bg-foreground-subtle'"
      />

      <div class="flex items-center gap-2 text-[12px] font-semibold">
        <BoltIcon v-if="active" :size="14" :thickness="2.2" />
        <PowerIcon v-else :size="14" :thickness="2.2" />
        <span>{{ active ? t('Client Hooked') : t('Activate Hook') }}</span>
      </div>

      <span
        class="text-[9px] px-1.5 py-0.5 rounded-sm font-data font-bold tracking-wide"
        :class="active ? 'bg-signal-foreground/15 text-signal-foreground' : 'bg-surface-2 text-foreground-subtle border border-border'"
      >
        {{ active ? t('LIVE') : t('IDLE') }}
      </span>
    </button>
  </div>
</template>
