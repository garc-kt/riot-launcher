<script setup lang="ts">
import { useRoot } from '../lib/root'

const { setStore } = useRoot()
</script>

<template>
  <div class="h-full flex flex-col p-6">
    <div class="flex-1 flex flex-col items-center justify-center">
      <div class="m-auto text-center space-y-4">
        <h3 class="text-xl font-semibold text-white">Plugin Store</h3>
        <p class="text-sm text-neutral-400">Discover and install community plugins directly from the repository. Coming soon!</p>
        <div class="pt-2">
          <button
            class="inline-flex gap-1 items-center text-xs font-medium border border-white/10 rounded-md px-4 py-2 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            @click="setStore(false)"
          >
            ← Go back to Plugins
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
