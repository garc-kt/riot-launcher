<script setup lang="ts">
import type { ChampionSummary } from '@/types'

defineProps<{
  champion: ChampionSummary
}>()
</script>

<template>
  <div class="hud-panel w-64 rounded p-3 text-xs">
    <div class="flex items-center gap-3">
      <div class="h-10 w-10 overflow-hidden rounded border border-[var(--hud-foreground-muted)]">
        <img
          :src="champion.squarePortraitPath"
          :alt="champion.name"
          class="h-full w-full object-cover"
          @error="($event.target as HTMLElement).style.display = 'none'"
        />
      </div>
      <div>
        <div class="font-bold text-[var(--hud-foreground)]">{{ champion.name }}</div>
        <div class="text-[10px] text-[var(--hud-foreground-muted)]">{{ champion.title }}</div>
      </div>
    </div>

    <div class="mt-2 flex flex-wrap gap-1">
      <span
        v-for="role in champion.roles"
        :key="role"
        class="rounded bg-[var(--hud-border)] px-1.5 py-0.5 text-[10px] text-[var(--hud-foreground)]"
      >
        {{ role }}
      </span>
    </div>

    <div class="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--hud-border)] pt-2">
      <div>
        <span class="text-[10px] text-[var(--hud-foreground-muted)]">Win Rate:</span>
        <span class="ml-1 font-semibold text-[var(--hud-foreground)]">{{ champion.winRate || 51.4 }}%</span>
      </div>
      <div>
        <span class="text-[10px] text-[var(--hud-foreground-muted)]">Pick Rate:</span>
        <span class="ml-1 font-semibold text-[var(--hud-foreground)]">{{ champion.pickRate || 8.2 }}%</span>
      </div>
    </div>
  </div>
</template>
