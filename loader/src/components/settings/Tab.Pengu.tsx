import { Component, createSignal, onMount } from 'solid-js'
import { dialog } from '@tauri-apps/api'
import { Config, useConfig } from '~/lib/config'
import { LeagueClient } from '~/lib/league-client'
import { CheckOption, OptionSet, RadioOption } from './templates'
import { ActivationMode, CoreModule } from '~/lib/core-module'
import { Startup } from '~/lib/startup'

const LaunchSettings: Component = () => {
  const [startup, setStartup] = createSignal(false)

  const toggleStartup = async () => {
    let enable = !await Startup.isEnabled()
    await Startup.setEnable(enable)
    setStartup(enable)
  }

  onMount(async () => {
    setStartup(await Startup.isEnabled())
  })

  return (
    <OptionSet name="Launch Settings">
      <CheckOption
        caption="Run on startup"
        message="Automatically run Riot Loader when your computer starts."
        checked={startup()}
        onClick={toggleStartup}
      />
    </OptionSet>
  )
}

export const TabLoader: Component = () => {

  const { app } = useConfig()

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

  return (
    <div class="space-y-4">

      <LaunchSettings />

      <OptionSet name="Plugins Folder">
        <span
          class="block text-sm text-neutral-200 px-3 py-1.5 hover:bg-white/5 rounded-md cursor-pointer border border-white/5 transition-colors"
          onClick={changePluginsDir}>
          {app.plugins_dir() || './plugins'}
        </span>
      </OptionSet>

      <OptionSet name="LoL Client Location" disabled={app.activation_mode() === ActivationMode.Universal}>
        <span
          class="block text-sm text-neutral-200 px-3 py-1.5 hover:bg-white/5 rounded-md cursor-pointer border border-white/5 transition-colors"
          onClick={changeLeagueDir}>
          {app.league_dir() || '(not selected)'}
        </span>
      </OptionSet>

      <OptionSet name="Activation Mode">
        <RadioOption
          caption="Universal"
          message="Apply to all League Clients, including live and PBE."
          checked={app.activation_mode() === ActivationMode.Universal}
          onClick={() => setActivationMode(ActivationMode.Universal)}
        />
        <RadioOption
          caption="Targeted"
          message="Apply to a specific League Client that you choose. Use it if you get access denied in Universal mode, except the Tencent server."
          checked={app.activation_mode() === ActivationMode.Targeted}
          onClick={() => setActivationMode(ActivationMode.Targeted)}
        />
      </OptionSet>

    </div>
  )
}

export const TabPengu = TabLoader