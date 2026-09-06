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
  <div class="cp-space-y-4">
    <!-- Search -->
    <div class="cp-relative">
      <Search class="cp-absolute cp-left-3 cp-top-1/2 cp-h-4 cp-w-4 -cp-translate-y-1/2 cp-text-[#a09b8c]" />
      <input
        v-model="query"
        type="text"
        placeholder="Filter champions..."
        class="cp-w-full cp-rounded cp-border cp-border-[#1e282d] cp-bg-[#091428] cp-py-2 cp-pl-9 cp-pr-3 cp-text-sm cp-text-[#f0e6d2] placeholder:cp-text-[#a09b8c] focus:cp-border-[#c89b3c] focus:cp-outline-none"
      />
    </div>

    <!-- Champion Selector Badges -->
    <div class="cp-flex cp-gap-2 cp-overflow-x-auto cp-pb-1">
      <button
        v-for="champ in filteredChampions()"
        :key="champ.id"
        @click="selectedChampion = champ"
        :class="[
          'cp-flex cp-items-center cp-gap-2 cp-rounded cp-border cp-px-3 cp-py-1.5 cp-text-xs cp-font-semibold cp-transition-colors',
          selectedChampion.id === champ.id
            ? 'cp-border-[#c89b3c] cp-bg-[#1e282d] cp-text-[#f0e6d2]'
            : 'cp-border-[#1e282d] cp-bg-[#091428] cp-text-[#a09b8c] hover:cp-text-[#cdbe91]'
        ]"
      >
        <span>{{ champ.name }}</span>
        <span class="cp-text-[10px] cp-text-[#0ac8b9]">{{ champ.winRate }}%</span>
      </button>
    </div>

    <!-- Selected Champion Overview -->
    <div class="cp-grid cp-grid-cols-1 md:cp-grid-cols-2 cp-gap-4">
      <ChampionTooltip :champion="selectedChampion" />
      <BuildSuggestions :championName="selectedChampion.name" />
    </div>
  </div>
</template>
