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
  <div class="space-y-4">
    <!-- Search Bar -->
    <div class="flex gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--hud-foreground-muted)]" />
        <input
          v-model="query"
          type="text"
          placeholder="Enter PUUID or Riot ID..."
          @keydown.enter="handleSearch"
          class="w-full rounded border border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)] py-2 pl-9 pr-3 text-sm text-[var(--hud-foreground)] placeholder:text-[var(--hud-foreground-muted)] focus:border-[var(--hud-foreground-muted)] focus:outline-none"
        />
      </div>

      <!-- Region Selector -->
      <div class="relative">
        <select
          v-model="selectedRegion"
          class="rounded border border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-sm text-[var(--hud-foreground)] focus:border-[var(--hud-foreground-muted)] focus:outline-none"
        >
          <option v-for="reg in Object.keys(SGP_REGIONS)" :key="reg" :value="reg">
            {{ reg }}
          </option>
        </select>
      </div>

      <button
        @click="handleSearch"
        :disabled="loading"
        class="hud-btn-primary px-4 py-2 text-sm"
      >
        Lookup
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-[var(--hud-foreground-muted)] border-t-transparent" />
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      {{ error }}
    </div>

    <!-- Results Display -->
    <div v-else-if="result" class="space-y-3">
      <div class="rounded-lg border border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)] p-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-bold text-[var(--hud-foreground)]">{{ result.alias }}</h3>
            <span class="text-xs text-[var(--hud-foreground-muted)]">Region: {{ result.region }}</span>
          </div>
          <div v-if="result.rankedTier" class="flex items-center gap-2">
            <Award class="h-5 w-5 text-[var(--hud-foreground-muted)]" />
            <span class="text-sm font-semibold text-[var(--hud-foreground)]">
              {{ result.rankedTier }} {{ result.rankedDivision }} ({{ result.leaguePoints }} LP)
            </span>
          </div>
        </div>

        <div class="mt-4 flex items-center gap-4 border-t border-[var(--hud-border)] pt-3 text-xs text-[var(--hud-foreground-muted)]">
          <div>
            <span class="font-medium text-[var(--hud-foreground)]">{{ result.wins }}</span> Wins
          </div>
          <div>
            <span class="font-medium text-[var(--hud-foreground)]">{{ result.losses }}</span> Losses
          </div>
          <div v-if="result.wins + result.losses > 0">
            <span class="font-medium text-[var(--hud-foreground)]">
              {{ Math.round((result.wins / (result.wins + result.losses)) * 100) }}%
            </span> Win Rate
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
