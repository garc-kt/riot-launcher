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
  <div class="cp-rounded-lg cp-border cp-border-[#1e282d] cp-bg-[#091428] cp-p-4 cp-space-y-4">
    <h3 class="cp-text-sm cp-font-bold cp-text-[#f0e6d2]">
      Recommended Build: {{ championName || 'Selected Champion' }}
    </h3>

    <!-- Starting Items -->
    <div>
      <div class="cp-text-xs cp-font-semibold cp-text-[#a09b8c] cp-mb-1.5">Starting Items</div>
      <div class="cp-flex cp-gap-2">
        <span
          v-for="item in mockBuild.starting"
          :key="item"
          class="cp-rounded cp-border cp-border-[#1e282d] cp-bg-[#010a13] cp-px-2.5 cp-py-1 cp-text-xs cp-text-[#cdbe91]"
        >
          {{ item }}
        </span>
      </div>
    </div>

    <!-- Core Items -->
    <div>
      <div class="cp-text-xs cp-font-semibold cp-text-[#a09b8c] cp-mb-1.5">Core Items</div>
      <div class="cp-flex cp-gap-2">
        <span
          v-for="item in mockBuild.core"
          :key="item"
          class="cp-rounded cp-border cp-border-[#785a28] cp-bg-[#0e1e2d] cp-px-2.5 cp-py-1 cp-text-xs cp-font-medium cp-text-[#f0e6d2]"
        >
          {{ item }}
        </span>
      </div>
    </div>

    <!-- Runes -->
    <div>
      <div class="cp-text-xs cp-font-semibold cp-text-[#a09b8c] cp-mb-1.5">Runes</div>
      <div class="cp-flex cp-flex-wrap cp-gap-1.5">
        <span
          v-for="rune in mockBuild.runes"
          :key="rune"
          class="cp-rounded cp-bg-[#010a13] cp-px-2 cp-py-0.5 cp-text-[11px] cp-text-[#0ac8b9]"
        >
          {{ rune }}
        </span>
      </div>
    </div>
  </div>
</template>
