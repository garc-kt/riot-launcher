<script setup lang="ts">
import { onMounted } from 'vue'
import { useSummonerStore } from '@/stores/summoner'
import { useMatchesStore } from '@/stores/matches'
import { Trophy, Flame, Target } from 'lucide-vue-next'

const summonerStore = useSummonerStore()
const matchesStore = useMatchesStore()

onMounted(async () => {
  if (!summonerStore.currentSummoner) {
    await summonerStore.fetchCurrentSummoner()
  }
  if (matchesStore.matches.length === 0) {
    await matchesStore.fetchMatches()
  }
})
</script>

<template>
  <div class="cp-space-y-4">
    <!-- Loading State -->
    <div v-if="summonerStore.loading" class="cp-flex cp-items-center cp-justify-center cp-py-12">
      <div class="cp-h-8 cp-w-8 cp-animate-spin cp-rounded-full cp-border-2 cp-border-[#c89b3c] cp-border-t-transparent" />
    </div>

    <!-- Error State -->
    <div v-else-if="summonerStore.error" class="cp-rounded cp-border cp-border-rose-900 cp-bg-rose-950/40 cp-p-4 cp-text-rose-300">
      {{ summonerStore.error }}
    </div>

    <!-- Profile Card -->
    <div v-else-if="summonerStore.currentSummoner" class="cp-space-y-4">
      <div class="cp-flex cp-items-center cp-gap-4 cp-rounded-lg cp-border cp-border-[#1e282d] cp-bg-[#091428] cp-p-4">
        <!-- Icon -->
        <div class="cp-relative cp-h-16 cp-w-16 cp-overflow-hidden cp-rounded-full cp-border-2 cp-border-[#c89b3c]">
          <img
            :src="`/lol-game-data/assets/v1/profile-icons/${summonerStore.currentSummoner.profileIconId}.jpg`"
            :alt="summonerStore.currentSummoner.displayName"
            class="cp-h-full cp-w-full cp-object-cover"
            @error="($event.target as HTMLElement).style.display = 'none'"
          />
          <div class="cp-absolute cp-bottom-0 cp-inset-x-0 cp-flex cp-items-center cp-justify-center cp-bg-[#010a13]/85 cp-py-0.5 cp-text-[10px] cp-font-bold cp-text-[#f0e6d2]">
            {{ summonerStore.currentSummoner.summonerLevel }}
          </div>
        </div>

        <!-- Info -->
        <div class="cp-flex-1">
          <div class="cp-flex cp-items-center cp-gap-2">
            <h2 class="cp-text-lg cp-font-bold cp-text-[#f0e6d2]">
              {{ summonerStore.currentSummoner.gameName || summonerStore.currentSummoner.displayName }}
            </h2>
            <span v-if="summonerStore.currentSummoner.tagLine" class="cp-text-xs cp-text-[#a09b8c]">
              #{{ summonerStore.currentSummoner.tagLine }}
            </span>
          </div>

          <!-- Level Progress -->
          <div class="cp-mt-2 cp-flex cp-items-center cp-gap-2">
            <div class="cp-h-2 cp-flex-1 cp-overflow-hidden cp-rounded-full cp-bg-[#010a13]">
              <div
                class="cp-h-full cp-bg-gradient-to-r cp-from-[#785a28] cp-to-[#c89b3c]"
                :style="{ width: `${summonerStore.currentSummoner.percentCompleteForNextLevel}%` }"
              />
            </div>
            <span class="cp-text-xs cp-text-[#a09b8c]">
              Level {{ summonerStore.currentSummoner.summonerLevel }}
            </span>
          </div>
        </div>
      </div>

      <!-- Quick Stats Grid -->
      <div class="cp-grid cp-grid-cols-3 cp-gap-3">
        <div class="cp-rounded-lg cp-border cp-border-[#1e282d] cp-bg-[#091428] cp-p-3 cp-text-center">
          <div class="cp-flex cp-items-center cp-justify-center cp-gap-1 cp-text-[#a09b8c] cp-text-xs">
            <Trophy class="cp-h-3.5 cp-w-3.5 cp-text-[#c89b3c]" />
            <span>Win Rate</span>
          </div>
          <div class="cp-mt-1 cp-text-lg cp-font-bold cp-text-[#f0e6d2]">
            {{ matchesStore.statsSummary.winRate }}%
          </div>
          <div class="cp-text-xs cp-text-[#a09b8c]">
            {{ matchesStore.statsSummary.wins }}W / {{ matchesStore.statsSummary.losses }}L
          </div>
        </div>

        <div class="cp-rounded-lg cp-border cp-border-[#1e282d] cp-bg-[#091428] cp-p-3 cp-text-center">
          <div class="cp-flex cp-items-center cp-justify-center cp-gap-1 cp-text-[#a09b8c] cp-text-xs">
            <Flame class="cp-h-3.5 cp-w-3.5 cp-text-rose-400" />
            <span>Avg KDA</span>
          </div>
          <div class="cp-mt-1 cp-text-lg cp-font-bold cp-text-[#f0e6d2]">
            {{ matchesStore.statsSummary.kda }}
          </div>
          <div class="cp-text-xs cp-text-[#a09b8c]">
            {{ matchesStore.statsSummary.totalGames }} Games Analyzed
          </div>
        </div>

        <div class="cp-rounded-lg cp-border cp-border-[#1e282d] cp-bg-[#091428] cp-p-3 cp-text-center">
          <div class="cp-flex cp-items-center cp-justify-center cp-gap-1 cp-text-[#a09b8c] cp-text-xs">
            <Target class="cp-h-3.5 cp-w-3.5 cp-text-[#0ac8b9]" />
            <span>Status</span>
          </div>
          <div class="cp-mt-1 cp-text-lg cp-font-bold cp-text-emerald-400">
            Active
          </div>
          <div class="cp-text-xs cp-text-[#a09b8c]">
            LCU Connected
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
