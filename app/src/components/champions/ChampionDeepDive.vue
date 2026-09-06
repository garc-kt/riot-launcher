<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ChampionAbilities from './ChampionAbilities.vue'
import ChampionItems from './ChampionItems.vue'
import ChampionTooltip from './ChampionTooltip.vue'
import ChampionIcon from '@/components/shared/ChampionIcon.vue'
import { useGameDataStore } from '@/stores/gameData'
import type { ChampionSummary } from '@/types'
import { Search } from 'lucide-vue-next'

const gameData = useGameDataStore()
const query = ref('')
const selectedId = ref<number | null>(null)

onMounted(() => gameData.ensureLoaded())

/**
 * The client's champion-summary.json carries identity only — no win/pick/ban
 * rates, which come from third-party aggregators the loader deliberately does
 * not call. Those fields stay undefined and the UI omits them rather than
 * showing invented numbers.
 */
const champions = computed<ChampionSummary[]>(() =>
  gameData.championList().map((c) => ({
    id: c.id,
    name: c.name,
    alias: c.alias,
    title: gameData.championDetail(c.id)?.title || c.roles.join(' / '),
    roles: c.roles,
    squarePortraitPath: c.squarePortraitPath,
  })),
)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return champions.value
  return champions.value.filter(
    (c) => c.name.toLowerCase().includes(q) || c.alias.toLowerCase().includes(q),
  )
})

// Keep a valid selection as data arrives and as the filter narrows.
watch(filtered, (list) => {
  if (list.length === 0) return
  if (selectedId.value === null || !list.some((c) => c.id === selectedId.value)) {
    selectedId.value = list[0].id
  }
}, { immediate: true })

const selectedChampion = computed<ChampionSummary | null>(
  () => champions.value.find((c) => c.id === selectedId.value) ?? null,
)
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
        v-for="champ in filtered"
        :key="champ.id"
        @click="selectedId = champ.id"
        :class="[
          'flex items-center gap-2 rounded border px-2 py-1.5 text-xs font-semibold transition-colors',
          selectedId === champ.id
            ? 'border-[var(--hud-foreground-muted)] bg-[var(--hud-border)] text-[var(--hud-foreground)]'
            : 'border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)] text-[var(--hud-foreground-muted)] hover:text-[var(--hud-foreground)]'
        ]"
      >
        <ChampionIcon :champion-id="champ.id" :name="champ.name" :size="20" />
        <span>{{ champ.name }}</span>
      </button>
    </div>

    <!-- Selected Champion Overview -->
    <div v-if="selectedChampion" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="space-y-4">
        <ChampionTooltip :champion="selectedChampion" />
        <ChampionItems :champion-id="selectedChampion.id" :champion-name="selectedChampion.name" />
      </div>
      <ChampionAbilities :champion-id="selectedChampion.id" />
    </div>
    <div v-else class="py-6 text-center text-xs text-[var(--hud-foreground-muted)]">
      {{ gameData.loaded ? 'No champions match that filter.' : 'Loading champion data…' }}
    </div>
  </div>
</template>
