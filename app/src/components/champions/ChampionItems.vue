<script setup lang="ts">
import { computed, onMounted } from 'vue'
import ItemIcon from '@/components/shared/ItemIcon.vue'
import { useGameDataStore } from '@/stores/gameData'
import { useMatchesStore } from '@/stores/matches'
import { useSummonerStore } from '@/stores/summoner'
import { championItemUsage } from '@riot/contracts'

const props = defineProps<{
  championId: number | null
  championName?: string
}>()

const gameData = useGameDataStore()
const matchesStore = useMatchesStore()
const summonerStore = useSummonerStore()

onMounted(() => gameData.ensureLoaded())

/**
 * Built from the player's own match history rather than a recommendation.
 * The client ships no build data — `recommendedItemDefaults` is empty for
 * every champion — so this is the only item information that is actually true.
 */
const usage = computed(() =>
  championItemUsage(
    matchesStore.matches,
    props.championId ?? 0,
    summonerStore.currentSummoner?.puuid,
  ),
)

const gamesOnChampion = computed(() => {
  const puuid = summonerStore.currentSummoner?.puuid
  return matchesStore.matches.filter((m: any) =>
    m.participants?.some(
      (p: any) => p.championId === props.championId && (!puuid || p.puuid === puuid),
    ),
  ).length
})

const itemName = (id: number) => gameData.item(id)?.name ?? `Item ${id}`
</script>

<template>
  <div class="rounded-lg border border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)] p-4 space-y-3">
    <div>
      <h3 class="text-sm font-bold text-[var(--hud-foreground)]">Your Items</h3>
      <p class="text-[10px] text-[var(--hud-foreground-muted)]">
        <template v-if="usage.length">
          Most-built on {{ championName || 'this champion' }} across your last
          {{ gamesOnChampion }} game{{ gamesOnChampion === 1 ? '' : 's' }}.
        </template>
        <template v-else>
          From your own match history — the client publishes no recommended builds.
        </template>
      </p>
    </div>

    <div v-if="usage.length" class="space-y-1.5">
      <div v-for="entry in usage" :key="entry.itemId" class="flex items-center gap-2">
        <ItemIcon :item-id="entry.itemId" :size="26" />
        <span class="min-w-0 flex-1 truncate text-xs text-[var(--hud-foreground)]">
          {{ itemName(entry.itemId) }}
        </span>
        <span class="shrink-0 text-[10px] text-[var(--hud-foreground-muted)]">
          {{ entry.games }}/{{ gamesOnChampion }}
        </span>
      </div>
    </div>

    <div v-else class="text-xs text-[var(--hud-foreground-muted)]">
      No games on {{ championName || 'this champion' }} in your loaded match history.
    </div>
  </div>
</template>
