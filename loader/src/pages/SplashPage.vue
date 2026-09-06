<script setup lang="ts">
import { useI18n } from '../lib/i18n'
import { LoaderIcon } from '../components/Icons'
import icon from '../assets/icon.png'

const { t } = useI18n()
</script>

<template>
  <div class="flex justify-center items-center h-screen bg-background text-foreground select-none">
    <div class="flex flex-col items-center gap-5">
      <img class="size-20 rounded-lg border border-border pointer-events-none" :src="icon" alt="Riot Loader" />
      <div class="text-center">
        <h2 class="text-lg font-semibold text-foreground">Riot Loader</h2>
        <p class="text-[11px] text-foreground-subtle mt-1 font-data">{{ t('League client companion') }}</p>
      </div>
      <span class="animate-spin text-foreground-muted mt-1">
        <LoaderIcon :thickness="1.8" :size="22" />
      </span>
    </div>
  </div>
</template>
