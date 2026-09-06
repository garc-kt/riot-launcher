<script setup lang="ts">
import type { ChampionSummary } from '@/types'
import ChampionIcon from '@/components/shared/ChampionIcon.vue'

defineProps<{
  champion: ChampionSummary
}>()
</script>

<template>
  <div class="hud-panel w-64 rounded p-3 text-xs">
    <div class="flex items-center gap-3">
      <ChampionIcon :champion-id="champion.id" :name="champion.name" :size="40" />
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

    <!-- Only rendered when a real value exists. These used to fall back to
         hardcoded 51.4% / 8.2%, which read as measured statistics; the client
         exposes no win/pick rates, so showing nothing is the honest option. -->
    <div
      v-if="champion.winRate !== undefined || champion.pickRate !== undefined"
      class="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--hud-border)] pt-2"
    >
      <div v-if="champion.winRate !== undefined">
        <span class="text-[10px] text-[var(--hud-foreground-muted)]">Win Rate:</span>
        <span class="ml-1 font-semibold text-[var(--hud-foreground)]">{{ champion.winRate }}%</span>
      </div>
      <div v-if="champion.pickRate !== undefined">
        <span class="text-[10px] text-[var(--hud-foreground-muted)]">Pick Rate:</span>
        <span class="ml-1 font-semibold text-[var(--hud-foreground)]">{{ champion.pickRate }}%</span>
      </div>
    </div>
  </div>
</template>
