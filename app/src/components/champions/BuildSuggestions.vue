<script setup lang="ts">
defineProps<{
  championName?: string
}>()

const mockBuild = {
  starting: ['Doran\'s Ring', 'Health Potion', 'Stealth Ward'],
  core: ['Luden\'s Companion', 'Shadowflame', 'Zhonya\'s Hourglass'],
  situational: ['Rabadon\'s Deathcap', 'Void Staff', 'Banshee\'s Veil'],
  runes: ['Electrocute', 'Taste of Blood', 'Eyeball Collection', 'Ultimate Hunter', 'Manaflow Band', 'Transcendence'],
}
</script>

<template>
  <div class="rounded-lg border border-[var(--hud-border)] bg-[rgba(255,255,255,0.04)] p-4 space-y-4">
    <h3 class="text-sm font-bold text-[var(--hud-foreground)]">
      Recommended Build: {{ championName || 'Selected Champion' }}
    </h3>

    <!-- Starting Items -->
    <div>
      <div class="text-xs font-semibold text-[var(--hud-foreground-muted)] mb-1.5">Starting Items</div>
      <div class="flex gap-2">
        <span
          v-for="item in mockBuild.starting"
          :key="item"
          class="rounded border border-[var(--hud-border)] bg-[rgba(255,255,255,0.05)] px-2.5 py-1 text-xs text-[var(--hud-foreground)]"
        >
          {{ item }}
        </span>
      </div>
    </div>

    <!-- Core Items -->
    <div>
      <div class="text-xs font-semibold text-[var(--hud-foreground-muted)] mb-1.5">Core Items</div>
      <div class="flex gap-2">
        <span
          v-for="item in mockBuild.core"
          :key="item"
          class="rounded border border-[var(--hud-foreground-muted)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-xs font-medium text-[var(--hud-foreground)]"
        >
          {{ item }}
        </span>
      </div>
    </div>

    <!-- Runes -->
    <div>
      <div class="text-xs font-semibold text-[var(--hud-foreground-muted)] mb-1.5">Runes</div>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="rune in mockBuild.runes"
          :key="rune"
          class="rounded bg-[rgba(255,255,255,0.05)] px-2 py-0.5 text-[11px] text-[var(--hud-foreground-muted)]"
        >
          {{ rune }}
        </span>
      </div>
    </div>
  </div>
</template>
