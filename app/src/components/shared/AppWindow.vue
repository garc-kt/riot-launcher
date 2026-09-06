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
    class="hud-panel fixed bottom-6 right-6 z-[99999] flex flex-col overflow-hidden rounded-lg"
    :style="{ width: isMinimized ? '300px' : '620px', height: isMinimized ? 'auto' : '500px' }"
  >
    <header class="flex items-center justify-between border-b border-[var(--hud-border)] px-4 py-2.5 select-none">
      <div class="flex items-center gap-2">
        <Sparkles class="h-4 w-4 text-[var(--hud-foreground-muted)]" />
        <span class="text-[13px] font-semibold">
          {{ title || 'Companion' }}
        </span>
      </div>
      <div class="flex items-center gap-1">
        <button class="hud-btn p-1" title="Minimize" @click="toggleMinimize">
          <Minus class="h-3.5 w-3.5" />
        </button>
        <button class="hud-btn p-1 hover:text-destructive" title="Close" @click="emit('close')">
          <X class="h-3.5 w-3.5" />
        </button>
      </div>
    </header>

    <TabBar v-if="!isMinimized" />

    <main v-if="!isMinimized" class="flex-1 overflow-y-auto p-4">
      <slot />
    </main>
  </div>
</template>
