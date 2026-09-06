<script setup lang="ts">
import { ref } from 'vue'

const message = ref('')
const visible = ref(false)
const type = ref<'info' | 'success' | 'error'>('info')
let timeout: any = null

export function show(msg: string, toastType: 'info' | 'success' | 'error' = 'info', duration = 3000) {
  message.value = msg
  type.value = toastType
  visible.value = true
  clearTimeout(timeout)
  timeout = setTimeout(() => {
    visible.value = false
  }, duration)
}

defineExpose({ show })
</script>

<template>
  <div
    v-if="visible"
    class="hud-panel fixed bottom-4 left-1/2 z-[100000] -translate-x-1/2 rounded-md px-4 py-2 text-[12px] font-medium"
    :class="type === 'error' ? 'border-destructive/50 text-destructive' : ''"
  >
    {{ message }}
  </div>
</template>
