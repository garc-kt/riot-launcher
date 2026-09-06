<script setup lang="ts">
import { ref } from 'vue'
import { useMatchesStore } from '@/stores/matches'
import { useSummonerStore } from '@/stores/summoner'
import PatchFilter from './PatchFilter.vue'
import MatchScoreboard from './MatchScoreboard.vue'
import { ChevronDown, ChevronUp } from 'lucide-vue-next'

const matchesStore = useMatchesStore()
const summonerStore = useSummonerStore()
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
  <div class="cp-space-y-4">
    <!-- Header with Filter -->
    <div class="cp-flex cp-items-center cp-justify-between">
      <h3 class="cp-text-sm cp-font-semibold cp-text-[#f0e6d2]">
        Recent Matches ({{ matchesStore.filteredMatches.length }})
      </h3>
      <PatchFilter />
    </div>

    <!-- Match List -->
    <div class="cp-space-y-2">
      <div
        v-for="match in matchesStore.filteredMatches"
        :key="match.gameId"
        class="cp-overflow-hidden cp-rounded cp-border cp-border-[#1e282d] cp-bg-[#091428]"
      >
        <!-- Summary Row -->
        <div
          @click="toggleExpand(match.gameId)"
          class="cp-flex cp-cursor-pointer cp-items-center cp-justify-between cp-p-3 cp-transition-colors hover:cp-bg-[#0e1e2d]"
          :class="getPlayerParticipant(match).win ? 'cp-border-l-4 cp-border-l-[#0ac8b9]' : 'cp-border-l-4 cp-border-l-rose-500'"
        >
          <div class="cp-flex cp-items-center cp-gap-3">
            <div class="cp-text-left">
              <span
                class="cp-text-xs cp-font-bold"
                :class="getPlayerParticipant(match).win ? 'cp-text-[#0ac8b9]' : 'cp-text-rose-400'"
              >
                {{ getPlayerParticipant(match).win ? 'VICTORY' : 'DEFEAT' }}
              </span>
              <div class="cp-text-[11px] cp-text-[#a09b8c]">
                {{ formatDuration(match.gameDuration) }}
              </div>
            </div>

            <!-- Champion Info -->
            <div class="cp-text-left">
              <div class="cp-text-sm cp-font-bold cp-text-[#f0e6d2]">
                {{ getPlayerParticipant(match).championName || `Champ #${getPlayerParticipant(match).championId || '?'}` }}
              </div>
              <div class="cp-text-xs cp-text-[#a09b8c]">
                {{ match.gameMode }}
              </div>
            </div>
          </div>

          <!-- KDA & Gold -->
          <div class="cp-flex cp-items-center cp-gap-6">
            <div class="cp-text-right">
              <div class="cp-text-sm cp-font-semibold cp-text-[#f0e6d2]">
                {{ getPlayerParticipant(match).kills ?? 0 }} /
                <span class="cp-text-rose-400">{{ getPlayerParticipant(match).deaths ?? 0 }}</span> /
                {{ getPlayerParticipant(match).assists ?? 0 }}
              </div>
              <div class="cp-text-[11px] cp-text-[#a09b8c]">
                {{ (getPlayerParticipant(match).totalDamageDealtToChampions || 0).toLocaleString() }} Dmg
              </div>
            </div>

            <button class="cp-text-[#a09b8c] hover:cp-text-[#f0e6d2]">
              <ChevronUp v-if="expandedMatchId === match.gameId" class="cp-h-4 cp-w-4" />
              <ChevronDown v-else class="cp-h-4 cp-w-4" />
            </button>
          </div>
        </div>

        <!-- Expanded Scoreboard -->
        <div v-if="expandedMatchId === match.gameId" class="cp-border-t cp-border-[#1e282d] cp-p-3">
          <MatchScoreboard :match="match" />
        </div>
      </div>
    </div>
  </div>
</template>
