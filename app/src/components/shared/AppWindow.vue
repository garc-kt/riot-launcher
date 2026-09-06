<script setup lang="ts">
import { ref } from 'vue'
import { X, Minus, Sparkles } from 'lucide-vue-next'
import TabBar from './TabBar.vue'

defineProps<{
  title?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const isMinimized = ref(false)

const toggleMinimize = () => {
  isMinimized.value = !isMinimized.value
}
</script>

<template>
  <div
    class="cp-fixed cp-bottom-6 cp-right-6 cp-z-[99999] cp-flex cp-flex-col cp-overflow-hidden cp-rounded-lg cp-border cp-border-[#785a28] cp-bg-[#010a13] cp-text-[#cdbe91] cp-shadow-2xl"
    :style="{ width: isMinimized ? '320px' : '640px', height: isMinimized ? 'auto' : '520px' }"
  >
    <!-- Window Header -->
    <header class="cp-flex cp-items-center cp-justify-between cp-border-b cp-border-[#1e282d] cp-bg-[#091428] cp-px-4 cp-py-2.5 cp-select-none">
      <div class="cp-flex cp-items-center cp-gap-2">
        <Sparkles class="cp-h-4 cp-w-4 cp-text-[#c89b3c]" />
        <span class="cp-text-sm cp-font-semibold cp-tracking-wide cp-text-[#f0e6d2]">
          {{ title || 'LoL Companion' }}
        </span>
      </div>
      <div class="cp-flex cp-items-center cp-gap-1">
        <button
          @click="toggleMinimize"
          class="cp-rounded cp-p-1 cp-text-[#a09b8c] hover:cp-bg-[#1e282d] hover:cp-text-[#f0e6d2]"
          title="Minimize"
        >
          <Minus class="cp-h-3.5 cp-w-3.5" />
        </button>
        <button
          @click="emit('close')"
          class="cp-rounded cp-p-1 cp-text-[#a09b8c] hover:cp-bg-red-900/50 hover:cp-text-red-300"
          title="Close"
        >
          <X class="cp-h-3.5 cp-w-3.5" />
        </button>
      </div>
    </header>

    <!-- Tab Bar -->
    <TabBar v-if="!isMinimized" />

    <!-- Main Content Area -->
    <main v-if="!isMinimized" class="cp-flex-1 cp-overflow-y-auto cp-p-4 cp-bg-[#010a13]/95">
      <slot />
    </main>
  </div>
</template>
