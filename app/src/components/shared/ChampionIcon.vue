<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameDataStore } from '@/stores/gameData'

const props = withDefaults(defineProps<{
  championId?: number | null
  /** Overrides the store lookup when the caller already has a name. */
  name?: string
  size?: number
}>(), {
  size: 32,
})

const gameData = useGameDataStore()

const src = computed(() => gameData.championIcon(props.championId))
const label = computed(() => props.name || gameData.championName(props.championId))

// An id can be valid while its asset 404s (new champion on an older patch, or
// data still loading). Fall back to initials rather than a broken-image icon.
const broken = ref(false)
watch(src, () => { broken.value = false })

const initials = computed(() => label.value.slice(0, 2).toUpperCase())
</script>

<template>
  <div
    class="shrink-0 overflow-hidden rounded"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :title="label"
  >
    <img
      v-if="src && !broken"
      :src="src"
      :alt="label"
      :width="size"
      :height="size"
      class="h-full w-full object-cover"
      loading="lazy"
      decoding="async"
      @error="broken = true"
    />
    <div
      v-else
      class="flex h-full w-full items-center justify-center bg-[var(--hud-border)] text-[10px] font-semibold text-[var(--hud-foreground-muted)]"
    >
      {{ initials }}
    </div>
  </div>
</template>
