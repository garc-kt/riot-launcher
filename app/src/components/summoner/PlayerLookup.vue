<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { sgpService, SGP_REGIONS } from '@/services/sgp'
import type { SgpPlayerSummary } from '@/types'
import { Search, Globe, Shield, Award } from 'lucide-vue-next'

const route = useRoute()
const query = ref('')
const selectedRegion = ref('NA1')
const loading = ref(false)
const error = ref<string | null>(null)
const result = ref<SgpPlayerSummary | null>(null)

const handleSearch = async () => {
  if (!query.value.trim()) return
  loading.value = true
  error.value = null
  try {
    result.value = await sgpService.lookupPlayer(query.value.trim(), selectedRegion.value)
  } catch (err: any) {
    error.value = err.message || 'Lookup failed'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (route.params.riotId) {
    query.value = String(route.params.riotId)
    handleSearch()
  }
})
</script>

<template>
  <div class="cp-space-y-4">
    <!-- Search Bar -->
    <div class="cp-flex cp-gap-2">
      <div class="cp-relative cp-flex-1">
        <Search class="cp-absolute cp-left-3 cp-top-1/2 cp-h-4 cp-w-4 -cp-translate-y-1/2 cp-text-[#a09b8c]" />
        <input
          v-model="query"
          type="text"
          placeholder="Enter PUUID or Riot ID..."
          @keydown.enter="handleSearch"
          class="cp-w-full cp-rounded cp-border cp-border-[#1e282d] cp-bg-[#091428] cp-py-2 cp-pl-9 cp-pr-3 cp-text-sm cp-text-[#f0e6d2] placeholder:cp-text-[#a09b8c] focus:cp-border-[#c89b3c] focus:cp-outline-none"
        />
      </div>

      <!-- Region Selector -->
      <div class="cp-relative">
        <select
          v-model="selectedRegion"
          class="cp-rounded cp-border cp-border-[#1e282d] cp-bg-[#091428] cp-px-3 cp-py-2 cp-text-sm cp-text-[#f0e6d2] focus:cp-border-[#c89b3c] focus:cp-outline-none"
        >
          <option v-for="reg in Object.keys(SGP_REGIONS)" :key="reg" :value="reg">
            {{ reg }}
          </option>
        </select>
      </div>

      <button
        @click="handleSearch"
        :disabled="loading"
        class="cp-rounded cp-bg-[#c89b3c] cp-px-4 cp-py-2 cp-text-sm cp-font-semibold cp-text-[#010a13] hover:cp-bg-[#f0e6d2] disabled:cp-opacity-50"
      >
        Lookup
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="cp-flex cp-items-center cp-justify-center cp-py-8">
      <div class="cp-h-6 cp-w-6 cp-animate-spin cp-rounded-full cp-border-2 cp-border-[#c89b3c] cp-border-t-transparent" />
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="cp-rounded cp-border cp-border-rose-900 cp-bg-rose-950/40 cp-p-3 cp-text-sm cp-text-rose-300">
      {{ error }}
    </div>

    <!-- Results Display -->
    <div v-else-if="result" class="cp-space-y-3">
      <div class="cp-rounded-lg cp-border cp-border-[#1e282d] cp-bg-[#091428] cp-p-4">
        <div class="cp-flex cp-items-center cp-justify-between">
          <div>
            <h3 class="cp-text-base cp-font-bold cp-text-[#f0e6d2]">{{ result.alias }}</h3>
            <span class="cp-text-xs cp-text-[#a09b8c]">Region: {{ result.region }}</span>
          </div>
          <div v-if="result.rankedTier" class="cp-flex cp-items-center cp-gap-2">
            <Award class="cp-h-5 cp-w-5 cp-text-[#c89b3c]" />
            <span class="cp-text-sm cp-font-semibold cp-text-[#f0e6d2]">
              {{ result.rankedTier }} {{ result.rankedDivision }} ({{ result.leaguePoints }} LP)
            </span>
          </div>
        </div>

        <div class="cp-mt-4 cp-flex cp-items-center cp-gap-4 cp-border-t cp-border-[#1e282d] cp-pt-3 cp-text-xs cp-text-[#a09b8c]">
          <div>
            <span class="cp-font-medium cp-text-[#f0e6d2]">{{ result.wins }}</span> Wins
          </div>
          <div>
            <span class="cp-font-medium cp-text-[#f0e6d2]">{{ result.losses }}</span> Losses
          </div>
          <div v-if="result.wins + result.losses > 0">
            <span class="cp-font-medium cp-text-[#f0e6d2]">
              {{ Math.round((result.wins / (result.wins + result.losses)) * 100) }}%
            </span> Win Rate
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
