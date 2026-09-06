<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { DataStore } from '../../lib/datatstore'
import { Shell } from '../../lib/shell'
import { useI18n } from '../../lib/i18n'

const { t } = useI18n()

interface ThemePreset {
  id: string
  name: string
  description: string
  accent: string
  css: string
}

const PRESET_THEMES: ThemePreset[] = [
  {
    id: 'obsidian-plum',
    name: 'Obsidian Plum',
    description: 'Minimalist dark aesthetic tuned to a plum-grey palette.',
    accent: '#a78bfa',
    css: `/* Riot Loader — Obsidian Plum */
:root {
  --riot-bg-base: #23212C;
  --riot-card-base: #2c2937;
  --riot-accent: #a78bfa;
}

body, .rcp-fe-viewport-root {
  background-color: #23212C !important;
  color: #f4f3f7 !important;
}

.parties-view-v2, .clash-root-component, .loot-backdrop {
  background: #23212C !important;
}

.style-profile-backdrop-container, .rcp-fe-lol-navigation-bar {
  background: rgba(35, 33, 44, 0.95) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
}
`
  },
  {
    id: 'hextech-cyan',
    name: 'Hextech Cyan',
    description: 'Electric glow with deep indigo shadows and cyan highlights.',
    accent: '#38bdf8',
    css: `/* Riot Loader — Hextech Cyan */
:root {
  --riot-bg-base: #0b1120;
  --riot-accent: #38bdf8;
}

body, .rcp-fe-viewport-root {
  background-color: #0b1120 !important;
  color: #f8fafc !important;
}

.rcp-fe-lol-navigation-bar {
  background: #0f172a !important;
  border-bottom: 1px solid rgba(56, 189, 248, 0.2) !important;
}
`
  },
  {
    id: 'oled-black',
    name: 'OLED Pure Black',
    description: 'Zero-light black with crisp monochrome borders.',
    accent: '#ffffff',
    css: `/* Riot Loader — OLED Pure Black */
:root {
  --riot-bg-base: #000000;
  --riot-accent: #ffffff;
}

body, .rcp-fe-viewport-root, .rcp-fe-lol-navigation-bar {
  background: #000000 !important;
  color: #ffffff !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}
`
  },
  {
    id: 'rose-quartz',
    name: 'Rose Quartz',
    description: 'Warm sunset rose and dark ruby tones.',
    accent: '#fb7185',
    css: `/* Riot Loader — Rose Quartz */
:root {
  --riot-bg-base: #1f1318;
  --riot-accent: #fb7185;
}

body, .rcp-fe-viewport-root {
  background: #1f1318 !important;
  color: #fff1f2 !important;
}

.rcp-fe-lol-navigation-bar {
  background: #27161f !important;
  border-bottom: 1px solid rgba(251, 113, 133, 0.2) !important;
}
`
  }
]

const activeThemeId = ref<string>('none')
const customCss = ref<string>('')
const statusMessage = ref<string>('')
const isApplying = ref<boolean>(false)
const clientRunning = ref<boolean>(false)

onMounted(async () => {
  try {
    const savedThemeId = await DataStore.get<string>('companion_active_theme_name', 'none')
    const savedCss = await DataStore.get<string>('companion_active_theme_css', '')
    activeThemeId.value = savedThemeId || 'none'
    customCss.value = savedCss || ''
  } catch (e) {
    console.warn('Failed to load active theme:', e)
  }
  try {
    clientRunning.value = await Shell.isLeagueClientRunning()
  } catch {
    // Assume not running if we can't tell — this is a race-avoidance
    // safeguard, not a security boundary.
  }
})

const selectPreset = (preset: ThemePreset) => {
  activeThemeId.value = preset.id
  customCss.value = preset.css
  statusMessage.value = t('Selected {name}. Apply to save.', { name: t(preset.name) })
}

const applyTheme = async () => {
  if (clientRunning.value) {
    statusMessage.value = t('Close the League Client before applying a theme — both write the same file.')
    return
  }
  isApplying.value = true
  try {
    await DataStore.set('companion_active_theme_name', activeThemeId.value)
    await DataStore.set('companion_active_theme_css', customCss.value)
    statusMessage.value = t('Theme saved. It will apply on the client\'s next launch.')
    setTimeout(() => { statusMessage.value = '' }, 4000)
  } catch {
    statusMessage.value = t('Failed to save theme.')
  } finally {
    isApplying.value = false
  }
}

const clearTheme = async () => {
  if (clientRunning.value) {
    statusMessage.value = t('Close the League Client before changing themes.')
    return
  }
  isApplying.value = true
  try {
    await DataStore.set('companion_active_theme_name', 'none')
    await DataStore.set('companion_active_theme_css', '')
    activeThemeId.value = 'none'
    customCss.value = ''
    statusMessage.value = t('Theme cleared.')
    setTimeout(() => { statusMessage.value = '' }, 4000)
  } finally {
    isApplying.value = false
  }
}

const handleExport = () => {
  const blob = new Blob([customCss.value], { type: 'text/css' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${activeThemeId.value || 'theme'}.css`
  a.click()
  URL.revokeObjectURL(url)
}

const handleImport = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      customCss.value = reader.result
      activeThemeId.value = 'custom'
      statusMessage.value = t('Imported {filename}. Apply to save.', { filename: file.name })
    }
  }
  reader.readAsText(file)
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="clientRunning" class="riot-card p-3 text-[11px] text-foreground-muted border-destructive/40">
      {{ t('League Client is running. Close it before applying theme changes — the loader and the client write the same settings file with no locking.') }}
    </div>

    <div class="riot-card p-3.5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-foreground text-xs">{{ t('Presets') }}</h3>
        <div class="flex items-center gap-2">
          <label class="riot-btn-secondary px-2.5 py-1 text-[11px] font-medium cursor-pointer">
            {{ t('Import') }}
            <input type="file" accept=".css" class="hidden" @change="handleImport" />
          </label>
          <button class="riot-btn-secondary px-2.5 py-1 text-[11px] font-medium" @click="handleExport">
            {{ t('Export') }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <button
          v-for="preset in PRESET_THEMES"
          :key="preset.id"
          class="riot-card p-3 text-left"
          :class="{ 'riot-card-active': activeThemeId === preset.id }"
          @click="selectPreset(preset)"
        >
          <div class="flex items-center justify-between w-full mb-1.5">
            <span class="text-xs font-semibold text-foreground">{{ t(preset.name) }}</span>
            <span class="size-2.5 rounded-full border border-border" :style="{ backgroundColor: preset.accent }" />
          </div>
          <p class="text-[11px] text-foreground-muted leading-snug line-clamp-2">{{ t(preset.description) }}</p>
        </button>
      </div>
    </div>

    <div class="riot-card p-3.5 flex flex-col" style="min-height: 180px;">
      <div class="flex items-center justify-between mb-2">
        <h3 class="font-semibold text-foreground text-xs">{{ t('Stylesheet editor') }}</h3>
        <span class="text-[10px] text-foreground-subtle font-data">{{ activeThemeId }}</span>
      </div>
      <textarea
        v-model="customCss"
        class="riot-input flex-1 font-data text-[11px] leading-relaxed p-2.5 resize-none"
        spellcheck="false"
        :placeholder="`/* ${t('No theme applied — client uses default styling')} */`"
        @input="activeThemeId = 'custom'"
      />
    </div>

    <div v-if="statusMessage" class="text-[11px] text-foreground-muted">
      {{ statusMessage }}
    </div>

    <div class="flex items-center gap-2">
      <button class="riot-btn-primary px-4 py-2 text-xs disabled:opacity-40" :disabled="isApplying" @click="applyTheme">
        {{ isApplying ? t('Saving…') : t('Apply') }}
      </button>
      <button class="riot-btn-secondary px-3 py-2 text-xs font-medium disabled:opacity-40" :disabled="isApplying" @click="clearTheme">
        {{ t('Reset') }}
      </button>
    </div>
  </div>
</template>
