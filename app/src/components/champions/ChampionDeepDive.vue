<script setup lang="ts">
import { ref } from 'vue'
import BuildSuggestions from './BuildSuggestions.vue'
import ChampionTooltip from './ChampionTooltip.vue'
import type { ChampionSummary } from '@/types'
import { Search } from 'lucide-vue-next'

const query = ref('')

const sampleChampions: ChampionSummary[] = [
  {
    id: 103,
    name: 'Ahri',
    alias: 'Ahri',
    title: 'the Nine-Tailed Fox',
    roles: ['Mage', 'Assassin'],
    squarePortraitPath: '/lol-game-data/assets/v1/champion-icons/103.png',
    winRate: 51.8,
    pickRate: 9.4,
    banRate: 3.2,
  },
  {
    id: 238,
    name: 'Zed',
    alias: 'Zed',
    title: 'the Master of Shadows',
    roles: ['Assassin'],
    squarePortraitPath: '/lol-game-data/assets/v1/champion-icons/238.png',
    winRate: 49.6,
    pickRate: 11.2,
    banRate: 14.5,
  },
  {
    id: 81,
    name: 'Ezreal',
    alias: 'Ezreal',
    title: 'the Prodigal Explorer',
    roles: ['Marksman', 'Mage'],
    squarePortraitPath: '/lol-game-data/assets/v1/champion-icons/81.png',
    winRate: 50.2,
    pickRate: 18.5,
    banRate: 2.1,
  },
]

const selectedChampion = ref<ChampionSummary>(sampleChampions[0])

const filteredChampions = () => {
  if (!query.value.trim()) return sampleChampions
  const q = query.value.toLowerCase()
  return sampleChampions.filter((c) => c.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
}
</script>

<template>
  <div class="space-y-4">
    <!-- Search -->
    <div class="relative">
      <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--hud-foreground-muted)]" />
      <input
        v-model="query"
        type="text"
        placeholder="Filter champions..."
        class="w-full rounded border border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)] py-2 pl-9 pr-3 text-sm text-[var(--hud-foreground)] placeholder:text-[var(--hud-foreground-muted)] focus:border-[var(--hud-foreground-muted)] focus:outline-none"
      />
    </div>

    <!-- Champion Selector Badges -->
    <div class="flex gap-2 overflow-x-auto pb-1">
      <button
        v-for="champ in filteredChampions()"
        :key="champ.id"
        @click="selectedChampion = champ"
        :class="[
          'flex items-center gap-2 rounded border px-3 py-1.5 text-xs font-semibold transition-colors',
          selectedChampion.id === champ.id
            ? 'border-[var(--hud-foreground-muted)] bg-[var(--hud-border)] text-[var(--hud-foreground)]'
            : 'border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)] text-[var(--hud-foreground-muted)] hover:text-[var(--hud-foreground)]'
        ]"
      >
        <span>{{ champ.name }}</span>
        <span class="text-[10px] text-[var(--hud-foreground-muted)]">{{ champ.winRate }}%</span>
      </button>
    </div>

    <!-- Selected Champion Overview -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ChampionTooltip :champion="selectedChampion" />
      <BuildSuggestions :championName="selectedChampion.name" />
    </div>
  </div>
</template>
