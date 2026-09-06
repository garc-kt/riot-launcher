<script setup lang="ts">
import { useMatchesStore } from '@/stores/matches'
import { Filter } from 'lucide-vue-next'

const matchesStore = useMatchesStore()
</script>

<template>
  <div class="flex items-center gap-2">
    <Filter class="h-3.5 w-3.5 text-[var(--hud-foreground-muted)]" />
    <span class="text-xs text-[var(--hud-foreground-muted)]">Patch:</span>
    <select
      v-model="matchesStore.selectedPatch"
      class="rounded border border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-xs text-[var(--hud-foreground)] focus:border-[var(--hud-foreground-muted)] focus:outline-none"
    >
      <option value="all">All Patches</option>
      <option v-for="patch in matchesStore.availablePatches" :key="patch" :value="patch">
        Patch {{ patch }}
      </option>
    </select>
  </div>
</template>
