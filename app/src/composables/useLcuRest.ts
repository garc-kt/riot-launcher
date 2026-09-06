import { ref } from 'vue'
import { lcuClient } from '@/services/lcu/client'

export function useLcuRest<T>(fetcher: () => Promise<T>) {
  const data = ref<T | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const execute = async () => {
    loading.value = true
    error.value = null
    try {
      data.value = (await fetcher()) as any
    } catch (err: any) {
      error.value = err
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, execute }
}
