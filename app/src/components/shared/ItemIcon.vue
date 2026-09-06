<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameDataStore } from '@/stores/gameData'

const props = withDefaults(defineProps<{
  /** 0 means "empty slot" in match payloads — rendered as a placeholder. */
  itemId?: number | null
  size?: number
}>(), {
  size: 28,
})

const gameData = useGameDataStore()

const info = computed(() => gameData.item(props.itemId))
const isEmpty = computed(() => !props.itemId || props.itemId <= 0)

const broken = ref(false)
watch(() => info.value?.iconPath, () => { broken.value = false })

const label = computed(() => info.value?.name ?? (isEmpty.value ? 'Empty' : `Item ${props.itemId}`))
</script>

<template>
  <div
    class="shrink-0 overflow-hidden rounded border border-[var(--hud-border)]"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :title="label"
  >
    <img
      v-if="!isEmpty && info?.iconPath && !broken"
      :src="info.iconPath"
      :alt="label"
      :width="size"
      :height="size"
      class="h-full w-full object-cover"
      loading="lazy"
      decoding="async"
      @error="broken = true"
    />
    <div v-else class="h-full w-full bg-[color:var(--hud-border)] opacity-40" />
  </div>
</template>
