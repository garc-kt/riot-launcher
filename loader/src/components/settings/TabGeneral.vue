<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { dialog } from '@tauri-apps/api'
import { Config, useConfig } from '../../lib/config'
import { LeagueClient } from '../../lib/league-client'
import { ActivationMode, CoreModule } from '../../lib/core-module'
import { Startup } from '../../lib/startup'
import { useI18n } from '../../lib/i18n'

const { app } = useConfig()
const { t } = useI18n()
const startup = ref(false)

const toggleStartup = async () => {
  const enable = !startup.value
  const ok = await Startup.setEnable(enable).catch(() => false)
  startup.value = ok ? enable : startup.value
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
    await dialog.message(t('Please deactivate Riot Loader before changing the activation mode.'), { type: 'warning' })
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
      await dialog.message(t('Your selected path is not valid.'), { type: 'warning' })
    }
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="riot-card p-3.5">
      <h3 class="font-semibold text-foreground text-xs mb-2">{{ t('Launch settings') }}</h3>
      <label class="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          :checked="startup"
          class="mt-1 size-4 rounded-sm cursor-pointer accent-foreground"
          @change="toggleStartup"
        />
        <div class="flex flex-col">
          <span class="text-xs font-medium text-foreground">{{ t('Run on Windows startup') }}</span>
          <p class="text-[11px] text-foreground-muted mt-0.5">{{ t('Automatically launch Riot Loader when your system starts.') }}</p>
        </div>
      </label>
    </div>

    <div class="riot-card p-3.5">
      <h3 class="font-semibold text-foreground text-xs mb-2">{{ t('Plugins folder') }}</h3>
      <p class="text-[11px] text-foreground-muted mb-2">{{ t('Directory where user plugins and custom scripts are discovered.') }}</p>
      <div
        class="riot-input text-xs font-data px-3 py-2 cursor-pointer truncate flex items-center justify-between gap-2"
        @click="changePluginsDir"
      >
        <span class="truncate">{{ app.plugins_dir() || './plugins' }}</span>
        <span class="text-[10px] font-semibold text-foreground-muted shrink-0">{{ t('Browse') }}</span>
      </div>
    </div>

    <div class="riot-card p-3.5" :class="{ 'opacity-40 pointer-events-none': Number(app.activation_mode()) === ActivationMode.Universal }">
      <h3 class="font-semibold text-foreground text-xs mb-2">{{ t('LoL client location') }}</h3>
      <p class="text-[11px] text-foreground-muted mb-2">{{ t('Path to your League of Legends installation directory.') }}</p>
      <div
        class="riot-input text-xs font-data px-3 py-2 cursor-pointer truncate flex items-center justify-between gap-2"
        @click="changeLeagueDir"
      >
        <span class="truncate">{{ app.league_dir() || t('(not selected)') }}</span>
        <span class="text-[10px] font-semibold text-foreground-muted shrink-0">{{ t('Browse') }}</span>
      </div>
    </div>

    <div class="riot-card p-3.5">
      <h3 class="font-semibold text-foreground text-xs mb-3">{{ t('Activation mode') }}</h3>
      <div class="space-y-3">
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="activation_mode"
            :checked="Number(app.activation_mode()) === ActivationMode.Universal"
            class="mt-1 size-4 cursor-pointer accent-foreground"
            @change="setActivationMode(ActivationMode.Universal)"
          />
          <div class="flex flex-col">
            <span class="text-xs font-medium text-foreground">{{ t('Universal mode') }}</span>
            <p class="text-[11px] text-foreground-muted mt-0.5">{{ t('Automatically hook all League Clients on this machine (Live and PBE).') }}</p>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="activation_mode"
            :checked="Number(app.activation_mode()) === ActivationMode.Targeted"
            class="mt-1 size-4 cursor-pointer accent-foreground"
            @change="setActivationMode(ActivationMode.Targeted)"
          />
          <div class="flex flex-col">
            <span class="text-xs font-medium text-foreground">{{ t('Targeted mode') }}</span>
            <p class="text-[11px] text-foreground-muted mt-0.5">{{ t('Apply hook only to the selected League Client installation path.') }}</p>
          </div>
        </label>
      </div>
    </div>
  </div>
</template>
