import { ref, onMounted, onUnmounted } from 'vue'

type SocketCallback<T> = (data: T) => void

export function useLcuEvent<T = any>(endpoint: string, callback?: SocketCallback<T>) {
  const data = ref<T | null>(null)
  let sub: { disconnect(): void } | null = null

  onMounted(() => {
    // Check if plugin context socket or global socket exists
    const socket = (window as any).__companion_context?.socket
    if (socket && typeof socket.observe === 'function') {
      sub = socket.observe(endpoint, (e: any) => {
        data.value = e.data
        if (callback) {
          callback(e.data)
        }
      })
    }
  })

  onUnmounted(() => {
    if (sub) {
      sub.disconnect()
      sub = null
    }
  })

  return data
}
