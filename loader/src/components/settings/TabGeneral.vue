<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { dialog } from '@tauri-apps/api'
import { Config, useConfig } from '../../lib/config'
import { LeagueClient } from '../../lib/league-client'
import { ActivationMode, CoreModule } from '../../lib/core-module'
import { Startup } from '../../lib/startup'

const { app } = useConfig()
const startup = ref(false)

const toggleStartup = async () => {
  const enable = !await Startup.isEnabled()
  await Startup.setEnable(enable)
  startup.value = enable
}

onMounted(async () => {
  try {
    startup.value = await Startup.isEnabled()
  } catch (err) {
    console.warn('Startup check error:', err)
  }
})

const changePluginsDir = async () => {
  const dir = await dialog.open({
    directory: true,
    defaultPath: Config.basePath(),
  })

  if (typeof dir === 'string') {
    await app.plugins_dir(dir)
  }
}

const setActivationMode = async (mode: ActivationMode) => {
  if (await CoreModule.isActivated()) {
    await dialog.message('Please deactivate Riot Loader before changing the activation mode.', { type: 'warning' })
  } else {
    await app.activation_mode(mode)
  }
}

const changeLeagueDir = async () => {
  const dir = await dialog.open({
    directory: true
  })

  if (typeof dir === 'string') {
    if (await LeagueClient.validateDir(dir)) {
      await app.league_dir(dir)
    } else {
      await dialog.message('Your selected path is not valid.', { type: 'warning' })
    }
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Launch Settings -->
    <div>
      <h3 class="font-semibold text-neutral-400 text-sm mb-2">Launch Settings</h3>
      <label class="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          :checked="startup"
          class="mt-1 size-4 rounded accent-purple-500 cursor-pointer"
          @change="toggleStartup"
        />
        <div class="flex flex-col">
          <span class="text-sm text-neutral-200">Run on startup</span>
          <p class="text-xs text-neutral-400">Automatically run Riot Loader when your computer starts.</p>
        </div>
      </label>
    </div>

    <!-- Plugins Folder -->
    <div>
      <h3 class="font-semibold text-neutral-400 text-sm mb-2">Plugins Folder</h3>
      <span
        class="block text-xs font-mono text-neutral-300 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-md cursor-pointer border border-white/5 transition-colors truncate"
        @click="changePluginsDir"
      >
        {{ app.plugins_dir() || './plugins' }}
      </span>
    </div>

    <!-- LoL Client Location -->
    <div :class="{ 'opacity-50 pointer-events-none': app.activation_mode() === ActivationMode.Universal }">
      <h3 class="font-semibold text-neutral-400 text-sm mb-2">LoL Client Location</h3>
      <span
        class="block text-xs font-mono text-neutral-300 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-md cursor-pointer border border-white/5 transition-colors truncate"
        @click="changeLeagueDir"
      >
        {{ app.league_dir() || '(not selected)' }}
      </span>
    </div>

    <!-- Activation Mode -->
    <div>
      <h3 class="font-semibold text-neutral-400 text-sm mb-2">Activation Mode</h3>
      <div class="space-y-3">
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="activation_mode"
            :checked="app.activation_mode() === ActivationMode.Universal"
            class="mt-1 size-4 accent-purple-500 cursor-pointer"
            @change="setActivationMode(ActivationMode.Universal)"
          />
          <div class="flex flex-col">
            <span class="text-sm text-neutral-200">Universal</span>
            <p class="text-xs text-neutral-400">Apply to all League Clients, including live and PBE.</p>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="activation_mode"
            :checked="app.activation_mode() === ActivationMode.Targeted"
            class="mt-1 size-4 accent-purple-500 cursor-pointer"
            @change="setActivationMode(ActivationMode.Targeted)"
          />
          <div class="flex flex-col">
            <span class="text-sm text-neutral-200">Targeted</span>
            <p class="text-xs text-neutral-400">Apply to a specific League Client that you choose. Use it if you get access denied in Universal mode.</p>
          </div>
        </label>
      </div>
    </div>
  </div>
</template>
