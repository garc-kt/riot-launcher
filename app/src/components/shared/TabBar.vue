<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { User, Swords, Shield, Search, Settings } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const tabs = [
  { name: 'Stats', path: '/', icon: User },
  { name: 'Matches', path: '/matches', icon: Swords },
  { name: 'Champions', path: '/champions', icon: Shield },
  { name: 'Lookup', path: '/lookup', icon: Search },
  { name: 'Settings', path: '/settings', icon: Settings },
]

const navigate = (path: string) => {
  router.push(path)
}
</script>

<template>
  <nav class="cp-flex cp-items-center cp-gap-2 cp-border-b cp-border-[#1e282d] cp-bg-[#091428] cp-px-4 cp-py-2">
    <button
      v-for="tab in tabs"
      :key="tab.path"
      @click="navigate(tab.path)"
      :class="[
        'cp-flex cp-items-center cp-gap-2 cp-rounded cp-px-3 cp-py-1.5 cp-text-sm cp-font-medium cp-transition-colors',
        route.path === tab.path
          ? 'cp-bg-[#1e282d] cp-text-[#f0e6d2]'
          : 'cp-text-[#a09b8c] hover:cp-bg-[#0e1e2d] hover:cp-text-[#cdbe91]'
      ]"
    >
      <component :is="tab.icon" class="cp-h-4 cp-w-4" />
      <span>{{ tab.name }}</span>
    </button>
  </nav>
</template>
