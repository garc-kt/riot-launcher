<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameDataStore } from '@/stores/gameData'

const props = defineProps<{
  championId: number | null
}>()

const gameData = useGameDataStore()
const loading = ref(false)

watch(() => props.championId, async (id) => {
  if (!id) return
  loading.value = true
  try {
    await gameData.loadChampionDetail(id)
  } finally {
    loading.value = false
  }
}, { immediate: true })

const detail = computed(() => gameData.championDetail(props.championId))

/** Q/W/E/R uppercased; the passive gets a word since it has no key. */
const slotLabel = (key: string) => (key === 'passive' ? 'P' : key.toUpperCase())

const playstyle = computed(() => Object.entries(detail.value?.playstyle ?? {}))

const prettyStat = (key: string) =>
  key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
</script>

<template>
  <div class="rounded-lg border border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)] p-4 space-y-4">
    <h3 class="text-sm font-bold text-[var(--hud-foreground)]">Abilities</h3>

    <div v-if="loading && !detail" class="text-xs text-[var(--hud-foreground-muted)]">
      Loading…
    </div>

    <div v-else-if="!detail" class="text-xs text-[var(--hud-foreground-muted)]">
      No ability data available for this champion.
    </div>

    <template v-else>
      <div v-if="detail.shortBio" class="text-[11px] leading-relaxed text-[var(--hud-foreground-muted)]">
        {{ detail.shortBio }}
      </div>

      <div class="space-y-2">
        <div
          v-for="ability in detail.abilities"
          :key="ability.key + ability.name"
          class="flex items-start gap-2"
        >
          <div class="relative shrink-0">
            <img
              v-if="ability.iconPath"
              :src="ability.iconPath"
              :alt="ability.name"
              class="h-8 w-8 rounded border border-[var(--hud-border)] object-cover"
              loading="lazy"
              decoding="async"
            />
            <span
              class="absolute -bottom-1 -right-1 rounded bg-[var(--hud-scrim)] px-1 text-[9px] font-bold text-[var(--hud-foreground)]"
            >
              {{ slotLabel(ability.key) }}
            </span>
          </div>
          <div class="min-w-0">
            <div class="text-xs font-semibold text-[var(--hud-foreground)]">{{ ability.name }}</div>
            <div v-if="ability.description" class="line-clamp-2 text-[10px] text-[var(--hud-foreground-muted)]">
              {{ ability.description }}
            </div>
          </div>
        </div>
      </div>

      <!-- Riot's own 0-3 ratings, shipped with the champion. -->
      <div v-if="playstyle.length" class="border-t border-[var(--hud-border)] pt-2">
        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
          <div v-for="[stat, value] in playstyle" :key="stat" class="flex items-center justify-between">
            <span class="text-[10px] text-[var(--hud-foreground-muted)]">{{ prettyStat(stat) }}</span>
            <span class="flex gap-0.5">
              <span
                v-for="n in 3"
                :key="n"
                class="h-1.5 w-3 rounded-sm"
                :class="n <= value ? 'bg-[var(--hud-foreground)]' : 'bg-[var(--hud-border)]'"
              />
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
