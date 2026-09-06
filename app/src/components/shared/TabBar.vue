<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { User, Swords, Shield, Search, Puzzle, Settings } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const tabs = [
  { name: 'Stats', path: '/', icon: User },
  { name: 'Matches', path: '/matches', icon: Swords },
  { name: 'Champions', path: '/champions', icon: Shield },
  { name: 'Lookup', path: '/lookup', icon: Search },
  { name: 'Modules', path: '/modules', icon: Puzzle },
  { name: 'Settings', path: '/settings', icon: Settings },
]

const navigate = (path: string) => {
  router.push(path)
}
</script>

<template>
  <nav class="flex items-center gap-1 border-b border-[var(--hud-border)] px-3 py-2">
    <button
      v-for="tab in tabs"
      :key="tab.path"
      class="hud-tab flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium"
      :class="{ 'hud-tab-active': route.path === tab.path }"
      @click="navigate(tab.path)"
    >
      <component :is="tab.icon" class="h-3.5 w-3.5" />
      <span>{{ tab.name }}</span>
    </button>
  </nav>
</template>
