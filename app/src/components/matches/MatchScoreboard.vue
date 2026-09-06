<script setup lang="ts">
import type { MatchHistoryItem } from '@/types'

defineProps<{
  match: MatchHistoryItem
}>()

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}
</script>

<template>
  <div class="cp-rounded-lg cp-border cp-border-[#1e282d] cp-bg-[#091428] cp-p-4 cp-space-y-3">
    <div class="cp-flex cp-items-center cp-justify-between cp-text-xs cp-text-[#a09b8c]">
      <span>Game Mode: {{ match.gameMode }}</span>
      <span>Duration: {{ formatDuration(match.gameDuration) }}</span>
      <span>Version: {{ match.gameVersion }}</span>
    </div>

    <!-- Participants Table -->
    <div class="cp-overflow-x-auto">
      <table class="cp-w-full cp-text-left cp-text-xs">
        <thead class="cp-border-b cp-border-[#1e282d] cp-text-[#a09b8c]">
          <tr>
            <th class="cp-pb-2">Player</th>
            <th class="cp-pb-2">KDA</th>
            <th class="cp-pb-2">Damage</th>
            <th class="cp-pb-2">CS</th>
            <th class="cp-pb-2">Gold</th>
          </tr>
        </thead>
        <tbody class="cp-divide-y cp-divide-[#1e282d]/50">
          <tr
            v-for="p in match.participants"
            :key="p.puuid"
            :class="p.win ? 'hover:cp-bg-emerald-950/20' : 'hover:cp-bg-rose-950/20'"
          >
            <td class="cp-py-2 cp-flex cp-items-center cp-gap-2">
              <span class="cp-font-medium cp-text-[#f0e6d2]">
                {{ p.championName || `Champ #${p.championId}` }}
              </span>
              <span class="cp-text-[10px] cp-text-[#a09b8c]">
                ({{ p.summonerName }})
              </span>
            </td>
            <td class="cp-py-2 cp-text-[#f0e6d2]">
              {{ p.kills }} / {{ p.deaths }} / {{ p.assists }}
            </td>
            <td class="cp-py-2 cp-text-[#f0e6d2]">
              {{ p.totalDamageDealtToChampions.toLocaleString() }}
            </td>
            <td class="cp-py-2 cp-text-[#f0e6d2]">
              {{ p.totalMinionsKilled + p.neutralMinionsKilled }}
            </td>
            <td class="cp-py-2 cp-text-[#f0e6d2]">
              {{ p.goldEarned.toLocaleString() }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
