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
    :class="[
      'cp-fixed cp-bottom-4 cp-left-1/2 cp-z-[100000] -cp-translate-x-1/2 cp-rounded-md cp-px-4 cp-py-2 cp-text-sm cp-font-medium cp-shadow-lg cp-transition-all',
      type === 'success' ? 'cp-bg-emerald-800 cp-text-emerald-100' :
      type === 'error' ? 'cp-bg-rose-900 cp-text-rose-100' :
      'cp-bg-[#0e1e2d] cp-text-[#f0e6d2] cp-border cp-border-[#785a28]'
    ]"
  >
    {{ message }}
  </div>
</template>
