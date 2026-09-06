<script setup lang="ts">
import { useMatchesStore } from '@/stores/matches'
import { Filter } from 'lucide-vue-next'

const matchesStore = useMatchesStore()
</script>

<template>
  <div class="cp-flex cp-items-center cp-gap-2">
    <Filter class="cp-h-3.5 cp-w-3.5 cp-text-[#a09b8c]" />
    <span class="cp-text-xs cp-text-[#a09b8c]">Patch:</span>
    <select
      v-model="matchesStore.selectedPatch"
      class="cp-rounded cp-border cp-border-[#1e282d] cp-bg-[#091428] cp-px-2.5 cp-py-1 cp-text-xs cp-text-[#f0e6d2] focus:cp-border-[#c89b3c] focus:cp-outline-none"
    >
      <option value="all">All Patches</option>
      <option v-for="patch in matchesStore.availablePatches" :key="patch" :value="patch">
        Patch {{ patch }}
      </option>
    </select>
  </div>
</template>
