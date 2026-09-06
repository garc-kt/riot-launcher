import { defineStore } from 'pinia'
import { ref } from 'vue'
import { lcuClient } from '@/services/lcu/client'
import type { SummonerData } from '@/types'

export const useSummonerStore = defineStore('summoner', () => {
  const currentSummoner = ref<SummonerData | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchCurrentSummoner = async () => {
    loading.value = true
    error.value = null
    try {
      currentSummoner.value = await lcuClient.getCurrentSummoner()
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch summoner'
    } finally {
      loading.value = false
    }
  }

  return {
    currentSummoner,
    loading,
    error,
    fetchCurrentSummoner,
  }
})
