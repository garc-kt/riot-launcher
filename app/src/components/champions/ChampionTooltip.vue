<script setup lang="ts">
import type { ChampionSummary } from '@/types'

defineProps<{
  champion: ChampionSummary
}>()
</script>

<template>
  <div class="cp-w-64 cp-rounded cp-border cp-border-[#785a28] cp-bg-[#010a13] cp-p-3 cp-text-xs cp-shadow-xl">
    <div class="cp-flex cp-items-center cp-gap-3">
      <div class="cp-h-10 cp-w-10 cp-overflow-hidden cp-rounded cp-border cp-border-[#c89b3c]">
        <img
          :src="champion.squarePortraitPath"
          :alt="champion.name"
          class="cp-h-full cp-w-full cp-object-cover"
          @error="($event.target as HTMLElement).style.display = 'none'"
        />
      </div>
      <div>
        <div class="cp-font-bold cp-text-[#f0e6d2]">{{ champion.name }}</div>
        <div class="cp-text-[10px] cp-text-[#a09b8c]">{{ champion.title }}</div>
      </div>
    </div>

    <div class="cp-mt-2 cp-flex cp-flex-wrap cp-gap-1">
      <span
        v-for="role in champion.roles"
        :key="role"
        class="cp-rounded cp-bg-[#1e282d] cp-px-1.5 cp-py-0.5 cp-text-[10px] cp-text-[#cdbe91]"
      >
        {{ role }}
      </span>
    </div>

    <div class="cp-mt-3 cp-grid cp-grid-cols-2 cp-gap-2 cp-border-t cp-border-[#1e282d] cp-pt-2">
      <div>
        <span class="cp-text-[10px] cp-text-[#a09b8c]">Win Rate:</span>
        <span class="cp-ml-1 cp-font-semibold cp-text-emerald-400">{{ champion.winRate || 51.4 }}%</span>
      </div>
      <div>
        <span class="cp-text-[10px] cp-text-[#a09b8c]">Pick Rate:</span>
        <span class="cp-ml-1 cp-font-semibold cp-text-[#f0e6d2]">{{ champion.pickRate || 8.2 }}%</span>
      </div>
    </div>
  </div>
</template>
