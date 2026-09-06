<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { DataStore } from '../lib/datatstore'
import { PaletteIcon } from './Icons'

interface ThemePreset {
  id: string
  name: string
  description: string
  accent: string
  previewBg: string
  css: string
}

const PRESET_THEMES: ThemePreset[] = [
  {
    id: 'obsidian-plum',
    name: 'Obsidian Plum',
    description: 'Clean minimalist dark aesthetic tuned to the #23212C palette with soft violet accents.',
    accent: '#a78bfa',
    previewBg: '#23212C',
    css: `/* Riot Loader — Obsidian Plum Minimalist */
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
    description: 'Electric Hextech glow with deep indigo shadows and crisp cyan highlights.',
    accent: '#38bdf8',
    previewBg: '#0e1726',
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
    description: 'Ultra-minimalist zero-light black with crisp monochrome borders.',
    accent: '#ffffff',
    previewBg: '#000000',
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
    description: 'Warm sunset rose and dark ruby tones for a subtle, elegant client atmosphere.',
    accent: '#fb7185',
    previewBg: '#1f1318',
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

const activeThemeId = ref<string>('obsidian-plum')
const customCss = ref<string>(PRESET_THEMES[0].css)
const statusMessage = ref<string>('')
const isApplying = ref<boolean>(false)

onMounted(async () => {
  try {
    const savedThemeId = await DataStore.get<string>('companion_active_theme_name', 'obsidian-plum')
    const savedCss = await DataStore.get<string>('companion_active_theme_css', '')
    if (savedThemeId) activeThemeId.value = savedThemeId
    if (savedCss) {
      customCss.value = savedCss
    } else {
      const preset = PRESET_THEMES.find(p => p.id === savedThemeId) || PRESET_THEMES[0]
      customCss.value = preset.css
    }
  } catch (e) {
    console.warn('Failed to load active theme:', e)
  }
})

const selectPreset = (preset: ThemePreset) => {
  activeThemeId.value = preset.id
  customCss.value = preset.css
  statusMessage.value = `Selected ${preset.name}. Click "Apply to Client" to activate.`
}

const applyTheme = async () => {
  isApplying.value = true
  try {
    await DataStore.set('companion_active_theme_name', activeThemeId.value)
    await DataStore.set('companion_active_theme_css', customCss.value)
    statusMessage.value = '✓ Theme applied to League Client before first paint!'
    setTimeout(() => {
      statusMessage.value = ''
    }, 4000)
  } catch (err) {
    statusMessage.value = 'Error saving theme to datastore.'
  } finally {
    isApplying.value = false
  }
}

const clearTheme = async () => {
  isApplying.value = true
  try {
    await DataStore.set('companion_active_theme_name', 'none')
    await DataStore.set('companion_active_theme_css', '')
    activeThemeId.value = 'none'
    customCss.value = '/* Default Client Styling (No Custom Theme) */'
    statusMessage.value = 'Theme cleared. Client will use default styles.'
    setTimeout(() => {
      statusMessage.value = ''
    }, 4000)
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
      statusMessage.value = `Imported ${file.name}. Click "Apply to Client" to save.`
    }
  }
  reader.readAsText(file)
}
</script>

<template>
  <div class="h-full flex flex-col p-6 space-y-5 select-none overflow-y-auto">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-white/5 pb-4">
      <div>
        <h2 class="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
          <PaletteIcon :size="18" class="text-purple-400" />
          <span>Native Theme Manager</span>
        </h2>
        <p class="text-xs text-neutral-400 mt-0.5">
          Constructable stylesheets applied before first paint (§7.3)
        </p>
      </div>

      <div class="flex items-center gap-2">
        <label class="px-3 py-1.5 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white cursor-pointer transition-colors border border-white/5">
          Import .css
          <input type="file" accept=".css" class="hidden" @change="handleImport" />
        </label>
        <button
          class="px-3 py-1.5 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors border border-white/5 cursor-pointer"
          @click="handleExport"
        >
          Export .css
        </button>
        <button
          class="px-3 py-1.5 rounded-md text-xs font-medium text-neutral-400 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer"
          @click="clearTheme"
        >
          Reset
        </button>
        <button
          class="px-4 py-1.5 rounded-md text-xs font-semibold bg-purple-500 hover:bg-purple-400 text-[#23212C] transition-all shadow-sm cursor-pointer disabled:opacity-50"
          :disabled="isApplying"
          @click="applyTheme"
        >
          {{ isApplying ? 'Saving...' : 'Apply to Client' }}
        </button>
      </div>
    </div>

    <!-- Status banner -->
    <div v-if="statusMessage" class="px-3 py-2 rounded-md bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
      {{ statusMessage }}
    </div>

    <!-- Preset cards -->
    <div class="flex flex-col space-y-2">
      <span class="text-xs font-semibold uppercase tracking-wider text-neutral-400">Presets</span>
      <div class="grid grid-cols-4 gap-3">
        <button
          v-for="preset in PRESET_THEMES"
          :key="preset.id"
          class="flex flex-col p-3 rounded-lg border text-left transition-all relative overflow-hidden cursor-pointer"
          style="background-color: #2c2937"
          :class="activeThemeId === preset.id ? 'border-purple-400 ring-1 ring-purple-400/40' : 'border-white/5 hover:border-white/20'"
          @click="selectPreset(preset)"
        >
          <div class="flex items-center justify-between w-full mb-2">
            <span class="text-xs font-semibold text-white">{{ preset.name }}</span>
            <span
              class="size-3 rounded-full border border-white/20"
              :style="{ backgroundColor: preset.accent }"
            />
          </div>
          <p class="text-[11px] text-neutral-400 leading-snug line-clamp-2">{{ preset.description }}</p>
        </button>
      </div>
    </div>

    <!-- Live CSS Editor -->
    <div class="flex flex-col flex-1 space-y-2 min-h-[220px]">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Client Stylesheet Editor ({{ activeThemeId }})
        </span>
        <span class="text-[11px] text-neutral-500 font-mono">
          Synced via adoptedStyleSheets
        </span>
      </div>

      <div class="relative flex-1 rounded-lg border border-white/5 bg-[#1d1b24] p-2 flex flex-col font-mono text-xs">
        <textarea
          v-model="customCss"
          class="w-full flex-1 bg-transparent text-neutral-200 outline-none resize-none selection:bg-purple-500/30 font-mono text-xs leading-relaxed p-1"
          spellcheck="false"
          @input="activeThemeId = 'custom'"
        />
      </div>
    </div>
  </div>
</template>
