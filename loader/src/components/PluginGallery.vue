<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { type PluginInfo, PluginManager } from '../lib/plugins'
import { LoaderIcon, PluginIcon, ReloadIcon, SearchIcon, FolderIcon } from './Icons'
import { useConfig } from '../lib/config'
import { useRoot } from '../lib/root'

const config = useConfig()
const { searchQuery } = useRoot()

const loading = ref(false)
const plugins = ref<PluginInfo[]>([])
const enabledMap = ref<Record<number, boolean>>({})

const filteredPlugins = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return plugins.value
  return plugins.value.filter(p => {
    const name = (p.name || '').toLowerCase()
    const path = (p.path || '').toLowerCase()
    const hash = (p.hash >>> 0).toString(16).toLowerCase()
    return name.includes(q) || path.includes(q) || hash.includes(q)
  })
})

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
    <!-- League Client Section Header & Toolbar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
      <div class="flex items-center gap-3">
        <div class="size-8 rounded border border-border bg-card flex items-center justify-center text-primary shadow-sm">
          <PluginIcon :size="17" />
        </div>
        <div>
          <div class="flex items-center gap-2.5">
            <h2 class="text-sm font-bold tracking-[0.16em] uppercase text-foreground font-serif">
              Installed Plugins
            </h2>
            <span class="text-[11px] px-2 py-0.5 rounded border border-border bg-card text-muted-foreground font-mono">
              {{ plugins.length }}
            </span>
          </div>
          <p class="text-[11px] text-muted-foreground mt-0.5">
            Manage extensions and runtime scripts loaded into the client
          </p>
        </div>
      </div>

      <!-- Action & Search controls -->
      <div class="flex items-center gap-2.5">
        <!-- Search Bar -->
        <div class="relative w-48 sm:w-56">
          <SearchIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" :size="13" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search plugins..."
            class="riot-input w-full pl-8 pr-3 py-1.5 rounded text-xs"
          />
        </div>

        <button
          class="riot-btn-secondary flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
          @click="revealPlugins"
        >
          <FolderIcon :size="13" />
          <span>Folder</span>
        </button>

        <button
          class="riot-btn-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs"
          @click="reload"
        >
          <ReloadIcon :size="13" />
          <span>Reload</span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
      <LoaderIcon class="animate-spin text-primary" :size="30" />
      <span class="text-xs font-medium tracking-wider uppercase font-mono">Scanning plugins...</span>
    </div>

    <!-- Loaded State -->
    <template v-else>
      <!-- Empty State -->
      <div v-if="plugins.length === 0" class="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div class="size-16 rounded-xl border border-border bg-card flex items-center justify-center text-primary shadow-lg">
          <PluginIcon :size="32" />
        </div>
        <div>
          <h3 class="text-base font-bold text-foreground uppercase tracking-wider font-serif">No plugins installed</h3>
          <p class="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
            Drop JavaScript files or folders into your plugins directory to extend League Client functionality.
          </p>
        </div>
        <div class="pt-2">
          <button
            class="riot-btn-primary px-4 py-2 rounded text-xs flex items-center gap-2"
            @click="revealPlugins"
          >
            <FolderIcon :size="14" />
            <span>Open Plugins Folder</span>
          </button>
        </div>
      </div>

      <!-- Filtered Empty State -->
      <div v-else-if="filteredPlugins.length === 0" class="flex flex-col items-center justify-center py-16 text-center space-y-2 text-muted-foreground">
        <p class="text-xs font-mono">No plugins matching "{{ searchQuery }}"</p>
        <button
          class="text-xs text-primary underline cursor-pointer"
          @click="searchQuery = ''"
        >
          Clear search
        </button>
      </div>

      <!-- Plugin Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <div
          v-for="plugin in filteredPlugins"
          :key="plugin.hash"
          class="riot-card rounded-lg p-4 flex flex-col justify-between"
          :class="{ 'riot-card-active': enabledMap[plugin.hash] }"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="size-9 rounded-md border flex items-center justify-center shrink-0 transition-colors"
                :class="enabledMap[plugin.hash] ? 'border-[var(--border-teal)] bg-[#0ac8b9]/10 text-[var(--border-teal)]' : 'border-border bg-muted text-muted-foreground'"
              >
                <PluginIcon :size="17" />
              </div>
              <div class="min-w-0">
                <h3 class="font-bold text-sm text-foreground truncate">{{ plugin.name }}</h3>
                <p class="text-[11px] text-muted-foreground font-mono truncate">@{{ plugin.path }}</p>
              </div>
            </div>

            <!-- Custom Hextech Switch -->
            <button
              class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-border transition-colors duration-200 ease-in-out focus:outline-none"
              :class="enabledMap[plugin.hash] ? 'bg-[var(--border-teal)] shadow-[0_0_8px_rgba(10,200,185,0.4)]' : 'bg-black/30'"
              :aria-label="`Toggle ${plugin.name}`"
              @click="togglePlugin(plugin.hash)"
            >
              <span
                class="pointer-events-none inline-block size-3.5 mt-[2px] ml-[2px] transform rounded-full shadow transition-transform duration-200 ease-in-out"
                :class="enabledMap[plugin.hash] ? 'translate-x-4 bg-white' : 'translate-x-0 bg-neutral-400'"
              />
            </button>
          </div>

          <div class="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px]">
            <span class="text-muted-foreground font-mono text-[10px]">#{{ (plugin.hash >>> 0).toString(16).padStart(8, '0') }}</span>
            <span
              class="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase"
              :class="enabledMap[plugin.hash] ? 'bg-[#0ac8b9]/15 text-[var(--border-teal)] border border-[#0ac8b9]/30' : 'bg-muted text-muted-foreground border border-border'"
            >
              {{ enabledMap[plugin.hash] ? 'ACTIVE' : 'DISABLED' }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
