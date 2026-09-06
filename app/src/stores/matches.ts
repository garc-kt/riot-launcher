import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { lcuClient } from '@/services/lcu/client'
import { useSummonerStore } from './summoner'
import type { MatchHistoryItem } from '@/types'

export const useMatchesStore = defineStore('matches', () => {
  const summonerStore = useSummonerStore()
  const matches = ref<MatchHistoryItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const selectedPatch = ref<string>('all')

  const fetchMatches = async (puuid?: string) => {
    loading.value = true
    error.value = null
    try {
      matches.value = await lcuClient.getMatchHistory(puuid)
    } catch (err: any) {
      error.value = err.message || 'Failed to load match history'
    } finally {
      loading.value = false
    }
  }

  const availablePatches = computed(() => {
    const patches = new Set<string>()
    for (const match of matches.value) {
      if (match.gameVersion) {
        const parts = match.gameVersion.split('.')
        if (parts.length >= 2) {
          patches.add(`${parts[0]}.${parts[1]}`)
        }
      }
    }
    return Array.from(patches)
  })

  const filteredMatches = computed(() => {
    if (selectedPatch.value === 'all') return matches.value
    return matches.value.filter((m) => m.gameVersion.startsWith(selectedPatch.value))
  })

  const statsSummary = computed(() => {
    let wins = 0
    let kills = 0
    let deaths = 0
    let assists = 0
    const list = filteredMatches.value
    const currentPuuid = summonerStore.currentSummoner?.puuid

    for (const m of list) {
      const p = (currentPuuid ? m.participants.find((part) => part.puuid === currentPuuid) : null) || m.participants[0]
      if (p) {
        if (p.win) wins++
        kills += p.kills
        deaths += p.deaths
        assists += p.assists
      }
    }

    const total = list.length
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0
    const kda = deaths > 0 ? ((kills + assists) / deaths).toFixed(2) : (kills + assists).toFixed(2)

    return {
      totalGames: total,
      wins,
      losses: total - wins,
      winRate,
      kda,
    }
  })

  return {
    matches,
    loading,
    error,
    selectedPatch,
    availablePatches,
    filteredMatches,
    statsSummary,
    fetchMatches,
  }
})
