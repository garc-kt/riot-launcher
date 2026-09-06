<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMatchesStore } from '@/stores/matches'
import { useSummonerStore } from '@/stores/summoner'
import { useGameDataStore } from '@/stores/gameData'
import ChampionIcon from '@/components/shared/ChampionIcon.vue'
import { matchResult, MATCH_RESULT_LABEL, MATCH_RESULT_COLOR } from '@riot/contracts'
import PatchFilter from './PatchFilter.vue'
import MatchScoreboard from './MatchScoreboard.vue'
import { ChevronDown, ChevronUp } from 'lucide-vue-next'

const matchesStore = useMatchesStore()
const summonerStore = useSummonerStore()
const gameData = useGameDataStore()

onMounted(() => gameData.ensureLoaded())

const resultOf = (match: any) => matchResult(getPlayerParticipant(match))
const expandedMatchId = ref<number | null>(null)

const toggleExpand = (gameId: number) => {
  expandedMatchId.value = expandedMatchId.value === gameId ? null : gameId
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

const getPlayerParticipant = (match: any) => {
  const puuid = summonerStore.currentSummoner?.puuid
  if (puuid && match.participants) {
    const found = match.participants.find((p: any) => p.puuid === puuid)
    if (found) return found
  }
  return match.participants?.[0] || {}
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header with Filter -->
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-[var(--hud-foreground)]">
        Recent Matches ({{ matchesStore.filteredMatches.length }})
      </h3>
      <PatchFilter />
    </div>

    <!-- Match List -->
    <div class="space-y-2">
      <div
        v-for="match in matchesStore.filteredMatches"
        :key="match.gameId"
        class="overflow-hidden rounded border border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)]"
      >
        <!-- Summary Row -->
        <div
          @click="toggleExpand(match.gameId)"
          class="flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
          :class="getPlayerParticipant(match).win ? 'border-l-4 border-l-[var(--hud-foreground)]' : 'border-l-4 border-l-destructive'"
        >
          <div class="flex items-center gap-3">
            <div class="text-left">
              <span
                class="text-xs font-bold"
                :style="{ color: MATCH_RESULT_COLOR[resultOf(match)] }"
              >
                {{ MATCH_RESULT_LABEL[resultOf(match)] }}
              </span>
              <div class="text-[11px] text-[var(--hud-foreground-muted)]">
                {{ formatDuration(match.gameDuration) }}
              </div>
            </div>

            <!-- Champion Info -->
            <ChampionIcon
              :champion-id="getPlayerParticipant(match).championId"
              :name="getPlayerParticipant(match).championName || gameData.championName(getPlayerParticipant(match).championId)"
              :size="32"
            />
            <div class="text-left">
              <div class="text-sm font-bold text-[var(--hud-foreground)]">
                {{ getPlayerParticipant(match).championName || gameData.championName(getPlayerParticipant(match).championId) }}
              </div>
              <div class="text-xs text-[var(--hud-foreground-muted)]">
                {{ match.gameMode }}
              </div>
            </div>
          </div>

          <!-- KDA & Gold -->
          <div class="flex items-center gap-6">
            <div class="text-right">
              <div class="text-sm font-semibold text-[var(--hud-foreground)]">
                {{ getPlayerParticipant(match).kills ?? 0 }} /
                <span class="text-[var(--hud-foreground-muted)]">{{ getPlayerParticipant(match).deaths ?? 0 }}</span> /
                {{ getPlayerParticipant(match).assists ?? 0 }}
              </div>
              <div class="text-[11px] text-[var(--hud-foreground-muted)]">
                {{ (getPlayerParticipant(match).totalDamageDealtToChampions || 0).toLocaleString() }} Dmg
              </div>
            </div>

            <button class="text-[var(--hud-foreground-muted)] hover:text-[var(--hud-foreground)]">
              <ChevronUp v-if="expandedMatchId === match.gameId" class="h-4 w-4" />
              <ChevronDown v-else class="h-4 w-4" />
            </button>
          </div>
        </div>

        <!-- Expanded Scoreboard -->
        <div v-if="expandedMatchId === match.gameId" class="border-t border-[var(--hud-border)] p-3">
          <MatchScoreboard :match="match" />
        </div>
      </div>
    </div>
  </div>
</template>
