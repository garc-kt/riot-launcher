import { ref, onMounted, onUnmounted } from 'vue'
import { lcuClient } from '@/services/lcu/client'

type SocketCallback<T> = (data: T) => void

export function useLcuEvent<T = any>(endpoint: string, callback?: SocketCallback<T>) {
  const data = ref<T | null>(null)
  let unsubscribe: (() => void) | null = null

  onMounted(() => {
    unsubscribe = lcuClient.observe<T>(endpoint, (value) => {
      data.value = value
      callback?.(value)
    })
  })

  onUnmounted(() => {
    unsubscribe?.()
    unsubscribe = null
  })

  return data
}
