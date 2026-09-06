<script setup lang="ts">
import { LoaderIcon } from '../components/Icons'
import icon from '../assets/icon.png'
</script>

<template>
  <div class="flex justify-center items-center h-screen bg-background text-foreground select-none">
    <div class="flex flex-col items-center gap-5">
      <div class="relative">
        <img class="size-24 rounded-2xl border border-border shadow-2xl shadow-cyan-500/10 pointer-events-none" :src="icon" alt="Riot Loader" />
        <div class="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none" />
      </div>
      <div class="text-center">
        <h2 class="text-xl font-bold tracking-[0.2em] uppercase text-foreground font-serif">Riot Loader</h2>
        <p class="text-[11px] text-muted-foreground mt-1 uppercase tracking-[0.18em] font-mono">League Client Companion</p>
      </div>
      <span class="animate-spin text-[var(--hextech-teal)] mt-2">
        <LoaderIcon :thickness="1.8" :size="26" />
      </span>
    </div>
  </div>
</template>
