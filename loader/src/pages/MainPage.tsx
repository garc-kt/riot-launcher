import { Component, Match, Show, Switch } from 'solid-js'
import { Activator } from '../components/Activator'
import { Settings } from '../components/settings'
import { PluginGallery } from '../components/PluginGallery'
import { PluginStore } from '../components/PluginStore'
import { ThemeManager } from '../components/ThemeManager'
import { useRoot } from '~/lib/root'

export const MainPage: Component = () => {

  const { tab } = useRoot()

  return (
    <div class="flex flex-col flex-1 overflow-hidden relative">
      <div class="flex-1 overflow-y-auto">
        <Switch>
          <Match when={tab() === 'plugins'}>
            <div class="container h-full">
              <PluginGallery />
            </div>
          </Match>
          <Match when={tab() === 'themes'}>
            <div class="container h-full">
              <ThemeManager />
            </div>
          </Match>
          <Match when={tab() === 'store'}>
            <div class="container h-full">
              <PluginStore />
            </div>
          </Match>
        </Switch>
      </div>
      <Show when={tab() !== 'store'}>
        <Activator />
      </Show>
      <Settings />
    </div>
  )
}