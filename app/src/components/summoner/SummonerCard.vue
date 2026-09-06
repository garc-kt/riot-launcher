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
  <div class="space-y-4">
    <!-- Loading State -->
    <div v-if="summonerStore.loading" class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-[var(--hud-foreground-muted)] border-t-transparent" />
    </div>

    <!-- Error State -->
    <div v-else-if="summonerStore.error" class="rounded border border-destructive/40 bg-destructive/10 p-4 text-destructive">
      {{ summonerStore.error }}
    </div>

    <!-- Profile Card -->
    <div v-else-if="summonerStore.currentSummoner" class="space-y-4">
      <div class="flex items-center gap-4 rounded-lg border border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)] p-4">
        <!-- Icon -->
        <div class="relative h-16 w-16 overflow-hidden rounded-full border-2 border-[var(--hud-foreground-muted)]">
          <img
            :src="`/lol-game-data/assets/v1/profile-icons/${summonerStore.currentSummoner.profileIconId}.jpg`"
            :alt="summonerStore.currentSummoner.displayName"
            class="h-full w-full object-cover"
            @error="($event.target as HTMLElement).style.display = 'none'"
          />
          <div class="absolute bottom-0 inset-x-0 flex items-center justify-center bg-black/70 py-0.5 text-[10px] font-bold text-[var(--hud-foreground)]">
            {{ summonerStore.currentSummoner.summonerLevel }}
          </div>
        </div>

        <!-- Info -->
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-bold text-[var(--hud-foreground)]">
              {{ summonerStore.currentSummoner.gameName || summonerStore.currentSummoner.displayName }}
            </h2>
            <span v-if="summonerStore.currentSummoner.tagLine" class="text-xs text-[var(--hud-foreground-muted)]">
              #{{ summonerStore.currentSummoner.tagLine }}
            </span>
          </div>

          <!-- Level Progress -->
          <div class="mt-2 flex items-center gap-2">
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
              <div
                class="h-full bg-[var(--hud-foreground)]"
                :style="{ width: `${summonerStore.currentSummoner.percentCompleteForNextLevel}%` }"
              />
            </div>
            <span class="text-xs text-[var(--hud-foreground-muted)]">
              Level {{ summonerStore.currentSummoner.summonerLevel }}
            </span>
          </div>
        </div>
      </div>

      <!-- Quick Stats Grid -->
      <div class="grid grid-cols-3 gap-3">
        <div class="rounded-lg border border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)] p-3 text-center">
          <div class="flex items-center justify-center gap-1 text-[var(--hud-foreground-muted)] text-xs">
            <Trophy class="h-3.5 w-3.5 text-[var(--hud-foreground-muted)]" />
            <span>Win Rate</span>
          </div>
          <div class="mt-1 text-lg font-bold text-[var(--hud-foreground)]">
            {{ matchesStore.statsSummary.winRate }}%
          </div>
          <div class="text-xs text-[var(--hud-foreground-muted)]">
            {{ matchesStore.statsSummary.wins }}W / {{ matchesStore.statsSummary.losses }}L
          </div>
        </div>

        <div class="rounded-lg border border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)] p-3 text-center">
          <div class="flex items-center justify-center gap-1 text-[var(--hud-foreground-muted)] text-xs">
            <Flame class="h-3.5 w-3.5 text-[var(--hud-foreground-muted)]" />
            <span>Avg KDA</span>
          </div>
          <div class="mt-1 text-lg font-bold text-[var(--hud-foreground)]">
            {{ matchesStore.statsSummary.kda }}
          </div>
          <div class="text-xs text-[var(--hud-foreground-muted)]">
            {{ matchesStore.statsSummary.totalGames }} Games Analyzed
          </div>
        </div>

        <div class="rounded-lg border border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)] p-3 text-center">
          <div class="flex items-center justify-center gap-1 text-[var(--hud-foreground-muted)] text-xs">
            <Target class="h-3.5 w-3.5 text-[var(--hud-foreground-muted)]" />
            <span>Status</span>
          </div>
          <div class="mt-1 text-lg font-bold text-[var(--hud-foreground)]">
            Active
          </div>
          <div class="text-xs text-[var(--hud-foreground-muted)]">
            LCU Connected
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
