<script setup lang="ts">
import { LoaderIcon } from '../components/Icons'
import icon from '../assets/icon.png'
</script>

<template>
  <div class="flex justify-center items-center h-screen bg-[#090a0f]">
    <div class="flex flex-col items-center gap-5">
      <img class="size-28 rounded-2xl shadow-2xl shadow-cyan-500/10 pointer-events-none" :src="icon" alt="Riot Loader" />
      <div class="text-center">
        <h2 class="text-2xl font-bold tracking-tight text-white">Riot Loader</h2>
        <p class="text-xs text-neutral-400 mt-1 uppercase tracking-widest font-mono">Companion Platform</p>
      </div>
      <span class="animate-spin text-sky-400 mt-2">
        <LoaderIcon :thickness="1.5" />
      </span>
    </div>
  </div>
</template>
