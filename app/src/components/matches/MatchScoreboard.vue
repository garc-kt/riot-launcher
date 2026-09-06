<script setup lang="ts">
import { onMounted } from 'vue'
import type { MatchHistoryItem } from '@/types'
import { useGameDataStore } from '@/stores/gameData'
import ChampionIcon from '@/components/shared/ChampionIcon.vue'
import ItemIcon from '@/components/shared/ItemIcon.vue'

defineProps<{
  match: MatchHistoryItem
}>()

const gameData = useGameDataStore()
onMounted(() => gameData.ensureLoaded())

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}
</script>

<template>
  <div class="rounded-lg border border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)] p-4 space-y-3">
    <div class="flex items-center justify-between text-xs text-[var(--hud-foreground-muted)]">
      <span>Game Mode: {{ match.gameMode }}</span>
      <span>Duration: {{ formatDuration(match.gameDuration) }}</span>
      <span>Version: {{ match.gameVersion }}</span>
    </div>

    <!-- Participants Table -->
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead class="border-b border-[var(--hud-border)] text-[var(--hud-foreground-muted)]">
          <tr>
            <th class="pb-2">Player</th>
            <th class="pb-2">KDA</th>
            <th class="pb-2">Damage</th>
            <th class="pb-2">CS</th>
            <th class="pb-2">Gold</th>
            <th class="pb-2">Items</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--hud-border)]/50">
          <tr
            v-for="p in match.participants"
            :key="p.puuid"
            :class="p.win ? 'hover:bg-[rgba(255,255,255,0.06)]' : 'hover:bg-destructive/10'"
          >
            <td class="py-2 flex items-center gap-2">
              <ChampionIcon
                :champion-id="p.championId"
                :name="p.championName || gameData.championName(p.championId)"
                :size="24"
              />
              <span class="font-medium text-[var(--hud-foreground)]">
                {{ p.championName || gameData.championName(p.championId) }}
              </span>
              <span class="text-[10px] text-[var(--hud-foreground-muted)]">
                ({{ p.summonerName }})
              </span>
            </td>
            <td class="py-2 text-[var(--hud-foreground)]">
              {{ p.kills }} / {{ p.deaths }} / {{ p.assists }}
            </td>
            <td class="py-2 text-[var(--hud-foreground)]">
              {{ p.totalDamageDealtToChampions.toLocaleString() }}
            </td>
            <td class="py-2 text-[var(--hud-foreground)]">
              {{ p.totalMinionsKilled + p.neutralMinionsKilled }}
            </td>
            <td class="py-2 text-[var(--hud-foreground)]">
              {{ p.goldEarned.toLocaleString() }}
            </td>
            <td class="py-2">
              <div class="flex items-center gap-1">
                <ItemIcon v-for="(itemId, idx) in (p.items || [])" :key="idx" :item-id="itemId" :size="22" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
