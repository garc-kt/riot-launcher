<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { type PluginInfo, PluginManager } from '../lib/plugins'
import { LoaderIcon, PluginIcon, ReloadIcon, SearchIcon, FolderIcon, LinkIcon, SettingsIcon } from './Icons'
import PluginSettingsModal from './settings/PluginSettingsModal.vue'
import type { SerializedModuleSchema } from '@riot/contracts'
import { useConfig } from '../lib/config'
import { useRoot } from '../lib/root'
import { useI18n } from '../lib/i18n'
import { Shell } from '../lib/shell'

const config = useConfig()
const { searchQuery } = useRoot()
const { t } = useI18n()

const loading = ref(false)
const plugins = ref<PluginInfo[]>([])
const enabledMap = ref<Record<number, boolean>>({})
const schemaMap = ref<Record<string, SerializedModuleSchema>>({})
const settingsModalOpen = ref(false)
const activePlugin = ref<PluginInfo | null>(null)
const activeSchema = ref<SerializedModuleSchema | null>(null)

const filteredPlugins = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return plugins.value
  return plugins.value.filter(p => {
    const name = (p.name || '').toLowerCase()
    const path = (p.path || '').toLowerCase()
    const author = (p.author || '').toLowerCase()
    const hash = (p.hash >>> 0).toString(16).toLowerCase()
    return name.includes(q) || path.includes(q) || author.includes(q) || hash.includes(q)
  })
})

const revealPlugins = () => {
  PluginManager.openFolder()
}

const togglePlugin = async (hash: number) => {
  const nextState = await PluginManager.toggleState(hash)
  enabledMap.value[hash] = nextState
}

const revealEntry = (plugin: PluginInfo) => {
  Shell.revealFile(plugin.entryPath)
}

const openSettings = (plugin: PluginInfo) => {
  activePlugin.value = plugin
  activeSchema.value = schemaMap.value[plugin.name] || schemaMap.value[plugin.path] || null
  settingsModalOpen.value = true
}

const reload = async () => {
  plugins.value = []
  loading.value = true

  try {
    const list = await PluginManager.getPlugins().catch(() => [])
    const map: Record<string, boolean> = {}
    const schemas: Record<string, SerializedModuleSchema> = {}
    for (const p of list) {
      map[p.hash] = PluginManager.isEnabled(p.hash)
    }
    enabledMap.value = map
    plugins.value = list

    await Promise.all(
      list.map(async (p) => {
        const s = await PluginManager.getPluginSchema(p)
        if (s) {
          schemas[p.name] = s
          schemas[p.path] = s
        }
      })
    )
    schemaMap.value = schemas
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
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
      <div class="flex items-center gap-3">
        <div class="size-8 rounded-sm border border-border bg-surface flex items-center justify-center text-foreground-muted">
          <PluginIcon :size="17" />
        </div>
        <div>
          <div class="flex items-center gap-2.5">
            <h2 class="text-[13px] font-semibold text-foreground">
              {{ t('Installed plugins') }}
            </h2>
            <span class="text-[11px] px-1.5 py-0.5 rounded-sm border border-border bg-surface text-foreground-subtle font-data">
              {{ plugins.length }}
            </span>
          </div>
          <p class="text-[11px] text-foreground-muted mt-0.5">
            {{ t('Extensions and runtime scripts loaded into the client') }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2.5">
        <div class="relative w-48 sm:w-56">
          <SearchIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-subtle pointer-events-none" :size="13" />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('Search plugins')"
            class="riot-input w-full pl-8 pr-3 py-1.5 text-xs"
          />
        </div>

        <button
          class="riot-btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
          @click="revealPlugins"
        >
          <FolderIcon :size="13" />
          <span>{{ t('Folder') }}</span>
        </button>

        <button
          class="riot-btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
          @click="reload"
        >
          <ReloadIcon :size="13" />
          <span>{{ t('Reload') }}</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex flex-col items-center justify-center gap-3 py-20 text-foreground-muted">
      <LoaderIcon class="animate-spin" :size="26" />
      <span class="text-xs font-data">{{ t('Scanning plugins') }}</span>
    </div>

    <template v-else>
      <div v-if="plugins.length === 0" class="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div class="size-14 rounded-sm border border-border bg-surface flex items-center justify-center text-foreground-muted">
          <PluginIcon :size="28" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-foreground">{{ t('No plugins installed') }}</h3>
          <p class="text-xs text-foreground-muted max-w-sm mt-1 leading-relaxed">
            {{ t('Drop JavaScript files or folders into your plugins directory to extend League Client functionality.') }}
          </p>
        </div>
        <div class="pt-2">
          <button
            class="riot-btn-primary px-4 py-2 text-xs flex items-center gap-2"
            @click="revealPlugins"
          >
            <FolderIcon :size="14" />
            <span>{{ t('Open plugins folder') }}</span>
          </button>
        </div>
      </div>

      <div v-else-if="filteredPlugins.length === 0" class="flex flex-col items-center justify-center py-16 text-center space-y-2 text-foreground-muted">
        <p class="text-xs font-data">{{ t('No plugins matching "{query}"', { query: searchQuery }) }}</p>
        <button
          class="text-xs text-foreground underline decoration-border-strong underline-offset-2 cursor-pointer"
          @click="searchQuery = ''"
        >
          {{ t('Clear search') }}
        </button>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="plugin in filteredPlugins"
          :key="plugin.hash"
          class="riot-card p-4 flex flex-col justify-between"
          :class="{
            'riot-card-active': plugin.status === 'active' && enabledMap[plugin.hash],
            'opacity-70': plugin.status === 'disabled-on-disk',
          }"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 min-w-0">
                <h3 class="font-semibold text-[13px] text-foreground truncate">{{ plugin.name }}</h3>
                <span v-if="plugin.version" class="text-[10px] text-foreground-subtle font-data shrink-0">v{{ plugin.version }}</span>
              </div>
              <p class="text-[11px] text-foreground-subtle font-data truncate">{{ plugin.path }}</p>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <button
                v-if="schemaMap[plugin.name] || schemaMap[plugin.path]"
                class="size-6 flex items-center justify-center rounded-sm text-foreground-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
                :title="t('Settings')"
                @click.stop="openSettings(plugin)"
              >
                <SettingsIcon :size="13" />
              </button>

              <button
                v-if="plugin.status === 'active'"
                class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-border transition-colors duration-150 ease-in-out focus:outline-none"
                :class="enabledMap[plugin.hash] ? 'bg-signal border-signal' : 'bg-surface-2'"
                :aria-label="`Toggle ${plugin.name}`"
                @click="togglePlugin(plugin.hash)"
              >
                <span
                  class="pointer-events-none inline-block size-3.5 mt-[2px] ml-[2px] transform rounded-full shadow transition-transform duration-150 ease-in-out"
                  :class="enabledMap[plugin.hash] ? 'translate-x-4 bg-signal-foreground' : 'translate-x-0 bg-foreground-subtle'"
                />
              </button>
            </div>
          </div>

          <p v-if="plugin.description" class="text-[11px] text-foreground-muted mt-2 leading-relaxed line-clamp-2">
            {{ plugin.description }}
          </p>

          <div v-if="plugin.tags?.length" class="flex flex-wrap gap-1 mt-2">
            <span
              v-for="tag in plugin.tags"
              :key="tag"
              class="px-1.5 py-0.5 rounded-sm text-[9px] font-medium bg-surface-2 text-foreground-subtle border border-border"
            >
              {{ tag }}
            </span>
          </div>

          <p v-if="plugin.status === 'disabled-on-disk'" class="text-[11px] text-foreground-subtle mt-2 leading-relaxed">
            {{ t('Disabled on disk (entry file ends in _). Rename it to enable.') }}
            <button class="text-foreground underline decoration-border-strong underline-offset-2 cursor-pointer" @click="revealEntry(plugin)">
              {{ t('Show file') }}
            </button>
          </p>

          <div class="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] gap-2">
            <div class="flex items-center gap-2 min-w-0 text-foreground-subtle">
              <span class="font-data shrink-0">#{{ (plugin.hash >>> 0).toString(16).padStart(8, '0') }}</span>
              <template v-if="plugin.author">
                <span class="shrink-0">·</span>
                <span class="truncate">{{ plugin.author }}</span>
              </template>
              <a
                v-if="plugin.link"
                :href="plugin.link"
                target="_blank"
                rel="noreferrer"
                class="shrink-0 hover:text-foreground transition-colors"
                @click.stop
              >
                <LinkIcon :size="11" />
              </a>
            </div>
            <span
              v-if="plugin.status === 'disabled-on-disk'"
              class="shrink-0 px-1.5 py-0.5 rounded-sm text-[9px] font-semibold tracking-wide font-data bg-surface-2 text-foreground-subtle border border-border"
            >
              {{ t('DISABLED ON DISK') }}
            </span>
            <span
              v-else
              class="shrink-0 px-1.5 py-0.5 rounded-sm text-[9px] font-semibold tracking-wide font-data"
              :class="enabledMap[plugin.hash] ? 'bg-signal/15 text-signal' : 'bg-surface-2 text-foreground-subtle border border-border'"
            >
              {{ enabledMap[plugin.hash] ? t('ACTIVE') : t('DISABLED') }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <PluginSettingsModal
      :visible="settingsModalOpen"
      :plugin="activePlugin"
      :schema="activeSchema"
      @close="settingsModalOpen = false"
    />
  </div>
</template>
