<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { type PluginInfo, PluginManager } from '../lib/plugins'
import { LoaderIcon, PluginIcon, ReloadIcon, StoreIcon } from './Icons'
import { useConfig } from '../lib/config'
import { useRoot } from '../lib/root'

const config = useConfig()
const { setStore } = useRoot()

const loading = ref(false)
const plugins = ref<PluginInfo[]>([])
const enabledMap = ref<Record<number, boolean>>({})

const revealPlugins = () => {
  PluginManager.openFolder()
}

const togglePlugin = async (hash: number) => {
  const nextState = await PluginManager.toggleState(hash)
  enabledMap.value[hash] = nextState
}

const reload = async () => {
  plugins.value = []
  loading.value = true

  try {
    const list = await PluginManager.getPlugins().catch(() => [])
    const map: Record<string, boolean> = {}
    for (const p of list) {
      map[p.hash] = PluginManager.isEnabled(p.hash)
    }
    enabledMap.value = map
    plugins.value = list
  } finally {
    setTimeout(() => {
      loading.value = false
    }, 250)
  }
}

onMounted(reload)

watch(() => config.app.plugins_dir(), () => {
  reload()
})
</script>

<template>
  <div class="h-full flex flex-col p-6 space-y-5 select-none overflow-y-auto">
    <!-- Header bar -->
    <div class="flex items-center justify-between border-b border-white/5 pb-4">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
          <PluginIcon :size="18" class="text-purple-400" />
          <span>Installed Plugins</span>
        </h2>
        <span class="text-xs px-2 py-0.5 rounded-full bg-white/5 text-neutral-400 font-mono">
          {{ plugins.length }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors border border-white/5 cursor-pointer"
          @click="reload"
        >
          <ReloadIcon :size="13" />
          <span>Reload</span>
        </button>
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors border border-white/5 cursor-pointer"
          @click="revealPlugins"
        >
          <span>Open Folder</span>
        </button>
        <button
          class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-purple-500 hover:bg-purple-400 text-[#23212C] transition-all shadow-sm cursor-pointer"
          @click="setStore(true)"
        >
          <StoreIcon :size="13" />
          <span>Browse Store</span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center gap-3 py-20 text-neutral-400">
      <LoaderIcon class="animate-spin text-purple-400" :size="28" />
      <span class="text-xs tracking-wide">Scanning plugins directory...</span>
    </div>

    <!-- Loaded State -->
    <template v-else>
      <!-- Empty State -->
      <div v-if="plugins.length === 0" class="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <div class="size-12 rounded-full bg-white/5 flex items-center justify-center text-neutral-400">
          <PluginIcon :size="24" />
        </div>
        <h3 class="text-sm font-semibold text-white">No plugins installed</h3>
        <p class="text-xs text-neutral-400 max-w-sm">
          Add JavaScript plugin files into your plugins directory or browse community plugins in the Store.
        </p>
        <div class="flex gap-2 pt-2">
          <button
            class="px-3.5 py-1.5 rounded-md text-xs font-medium bg-purple-500 hover:bg-purple-400 text-[#23212C] transition-colors font-semibold cursor-pointer"
            @click="setStore(true)"
          >
            Open Store
          </button>
          <button
            class="px-3.5 py-1.5 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors border border-white/5 cursor-pointer"
            @click="revealPlugins"
          >
            Open Folder
          </button>
        </div>
      </div>

      <!-- Plugin Grid -->
      <div v-else class="grid grid-cols-3 gap-3">
        <div
          v-for="plugin in plugins"
          :key="plugin.hash"
          class="flex flex-col justify-between p-3.5 rounded-lg border transition-all duration-200"
          style="background-color: #2c2937"
          :class="enabledMap[plugin.hash] ? 'border-white/10 hover:border-purple-400/50 shadow-sm' : 'border-white/5 opacity-65 hover:opacity-90'"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="size-7 rounded-md bg-white/5 flex items-center justify-center shrink-0 text-neutral-300">
                <PluginIcon :size="15" />
              </div>
              <div class="min-w-0">
                <h3 class="font-medium text-sm text-white truncate">{{ plugin.name }}</h3>
                <p class="text-[11px] text-neutral-400 font-mono truncate">@{{ plugin.path }}</p>
              </div>
            </div>

            <button
              class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
              :class="enabledMap[plugin.hash] ? 'bg-purple-500' : 'bg-white/15'"
              :aria-label="`Toggle ${plugin.name}`"
              @click="togglePlugin(plugin.hash)"
            >
              <span
                class="pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                :class="enabledMap[plugin.hash] ? 'translate-x-4' : 'translate-x-0'"
              />
            </button>
          </div>

          <div class="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px]">
            <span class="text-neutral-500 font-mono">#{{ (plugin.hash >>> 0).toString(16).padStart(8, '0') }}</span>
            <span
              class="px-1.5 py-0.5 rounded text-[10px] font-medium"
              :class="enabledMap[plugin.hash] ? 'bg-purple-500/15 text-purple-300' : 'bg-white/5 text-neutral-400'"
            >
              {{ enabledMap[plugin.hash] ? 'ACTIVE' : 'DISABLED' }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
