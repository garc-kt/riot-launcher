import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GameflowPhase } from '@/types'

export const useUiStore = defineStore('ui', () => {
  const isOpen = ref(true)
  const currentPhase = ref<GameflowPhase>('None')
  const isMatchActive = computed(() => currentPhase.value === 'InProgress')

  const toggleOpen = () => {
    isOpen.value = !isOpen.value
  }

  const setPhase = (phase: GameflowPhase) => {
    currentPhase.value = phase
  }

  return {
    isOpen,
    currentPhase,
    isMatchActive,
    toggleOpen,
    setPhase,
  }
})
