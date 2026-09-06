<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { X, Minus, Sparkles } from 'lucide-vue-next'
import TabBar from './TabBar.vue'
import { useDraggable } from '@/composables/useDraggable'

defineProps<{
  title?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const isMinimized = ref(false)
const windowEl = ref<HTMLElement | null>(null)

const STORAGE_KEY = 'companion:window-position'

const { position, dragging, startDrag, clampIntoView, setPosition } = useDraggable({
  onEnd: (pos) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos))
    } catch {
      // Private mode or blocked site data — position just won't persist.
    }
  },
})

/**
 * Once dragged, the window is positioned absolutely and the bottom-right
 * anchor is dropped; until then it keeps its original resting place.
 */
const positionStyle = computed(() => {
  const size = {
    width: isMinimized.value ? '300px' : '620px',
    height: isMinimized.value ? 'auto' : '500px',
  }
  if (!position.value) return size
  return {
    ...size,
    left: `${position.value.x}px`,
    top: `${position.value.y}px`,
    right: 'auto',
    bottom: 'auto',
  }
})

const onResize = () => clampIntoView()

onMounted(() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
        setPosition(parsed)
        // A stored position can be off-screen if the client is now smaller.
        clampIntoView()
      }
    }
  } catch {
    // Ignore unreadable/corrupt stored positions.
  }
  window.addEventListener('resize', onResize)
})

onUnmounted(() => window.removeEventListener('resize', onResize))

const toggleMinimize = () => {
  isMinimized.value = !isMinimized.value
}
</script>

<template>
  <div
    ref="windowEl"
    class="hud-panel fixed bottom-6 right-6 z-[99999] flex flex-col overflow-hidden rounded-lg"
    :style="positionStyle"
  >
    <header
      class="flex items-center justify-between border-b border-[var(--hud-border)] px-4 py-2.5 select-none"
      :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
      @pointerdown="startDrag($event, windowEl)"
    >
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
