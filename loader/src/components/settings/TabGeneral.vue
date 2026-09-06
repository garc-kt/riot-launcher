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
  <div class="space-y-6">
    <!-- Launch Settings -->
    <div class="riot-card p-3.5 rounded-lg">
      <h3 class="font-bold text-foreground text-xs uppercase tracking-[0.14em] font-serif mb-2">Launch Settings</h3>
      <label class="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          :checked="startup"
          class="mt-1 size-4 rounded cursor-pointer accent-[var(--hextech-gold)]"
          @change="toggleStartup"
        />
        <div class="flex flex-col">
          <span class="text-xs font-bold text-foreground">Run on Windows startup</span>
          <p class="text-[11px] text-muted-foreground mt-0.5">Automatically launch Riot Loader when your system starts.</p>
        </div>
      </label>
    </div>

    <!-- Plugins Folder -->
    <div class="riot-card p-3.5 rounded-lg">
      <h3 class="font-bold text-foreground text-xs uppercase tracking-[0.14em] font-serif mb-2">Plugins Folder</h3>
      <p class="text-[11px] text-muted-foreground mb-2">Directory where user plugins and custom scripts are discovered.</p>
      <div
        class="riot-input text-xs font-mono px-3 py-2 rounded cursor-pointer truncate flex items-center justify-between gap-2"
        @click="changePluginsDir"
      >
        <span class="truncate">{{ app.plugins_dir() || './plugins' }}</span>
        <span class="text-[10px] uppercase font-bold text-primary font-serif tracking-wider shrink-0">Browse</span>
      </div>
    </div>

    <!-- LoL Client Location -->
    <div class="riot-card p-3.5 rounded-lg" :class="{ 'opacity-40 pointer-events-none': app.activation_mode() === ActivationMode.Universal }">
      <h3 class="font-bold text-foreground text-xs uppercase tracking-[0.14em] font-serif mb-2">LoL Client Location</h3>
      <p class="text-[11px] text-muted-foreground mb-2">Path to your League of Legends installation directory.</p>
      <div
        class="riot-input text-xs font-mono px-3 py-2 rounded cursor-pointer truncate flex items-center justify-between gap-2"
        @click="changeLeagueDir"
      >
        <span class="truncate">{{ app.league_dir() || '(not selected)' }}</span>
        <span class="text-[10px] uppercase font-bold text-primary font-serif tracking-wider shrink-0">Browse</span>
      </div>
    </div>

    <!-- Activation Mode -->
    <div class="riot-card p-3.5 rounded-lg">
      <h3 class="font-bold text-foreground text-xs uppercase tracking-[0.14em] font-serif mb-3">Activation Mode</h3>
      <div class="space-y-3">
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="activation_mode"
            :checked="app.activation_mode() === ActivationMode.Universal"
            class="mt-1 size-4 cursor-pointer accent-[var(--hextech-gold)]"
            @change="setActivationMode(ActivationMode.Universal)"
          />
          <div class="flex flex-col">
            <span class="text-xs font-bold text-foreground">Universal Mode</span>
            <p class="text-[11px] text-muted-foreground mt-0.5">Automatically hook all League Clients on this machine (Live and PBE).</p>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="activation_mode"
            :checked="app.activation_mode() === ActivationMode.Targeted"
            class="mt-1 size-4 cursor-pointer accent-[var(--hextech-gold)]"
            @change="setActivationMode(ActivationMode.Targeted)"
          />
          <div class="flex flex-col">
            <span class="text-xs font-bold text-foreground">Targeted Mode</span>
            <p class="text-[11px] text-muted-foreground mt-0.5">Apply hook only to the selected League Client installation path.</p>
          </div>
        </label>
      </div>
    </div>
  </div>
</template>
