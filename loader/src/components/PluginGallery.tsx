import { Component, For, createSignal, onMount, Switch, Match, Show, createEffect } from 'solid-js'
import { type PluginInfo, PluginManager } from '../lib/plugins'
import { LoaderIcon, PluginIcon, ReloadIcon, StoreIcon } from './Icons'
import { Checkbox } from './ui'
import { useConfig } from '~/lib/config'
import { useRoot } from '~/lib/root'

const PluginCard: Component<PluginInfo> = (props) => {
  const [enabled, setEnabled] = createSignal(PluginManager.isEnabled(props.hash))
  const toggle = () => {
    PluginManager.toggleState(props.hash).then(setEnabled)
  }
  return (
    <div
      class="flex flex-col justify-between p-3.5 rounded-lg border transition-all duration-200"
      style={{ 'background-color': '#2c2937' }}
      classList={{
        'border-white/10 hover:border-purple-400/50 shadow-sm': enabled(),
        'border-white/5 opacity-65 hover:opacity-90': !enabled()
      }}
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="size-7 rounded-md bg-white/5 flex items-center justify-center shrink-0 text-neutral-300">
            <PluginIcon size={15} />
          </div>
          <div class="min-w-0">
            <h3 class="font-medium text-sm text-white truncate">{props.name}</h3>
            <p class="text-[11px] text-neutral-400 font-mono truncate">@{props.path}</p>
          </div>
        </div>

        <button
          class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
          classList={{
            'bg-purple-500': enabled(),
            'bg-white/15': !enabled()
          }}
          onClick={toggle}
          aria-label={`Toggle ${props.name}`}
        >
          <span
            class="pointer-events-none inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            classList={{
              'translate-x-4': enabled(),
              'translate-x-0': !enabled()
            }}
          />
        </button>
      </div>

      <div class="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px]">
        <span class="text-neutral-500 font-mono">#{props.hash.substring(0, 8)}</span>
        <span
          class="px-1.5 py-0.5 rounded text-[10px] font-medium"
          classList={{
            'bg-purple-500/15 text-purple-300': enabled(),
            'bg-white/5 text-neutral-400': !enabled()
          }}
        >
          {enabled() ? 'ACTIVE' : 'DISABLED'}
        </span>
      </div>
    </div>
  )
}

export const PluginGallery: Component = () => {

  const config = useConfig()
  const { setStore } = useRoot()

  const [loading, setLoading] = createSignal(false)
  const [plugins, setPlugins] = createSignal(Array<PluginInfo>(), { equals: false })

  const revealPlugins = () => {
    PluginManager.openFolder()
  }

  const reload = () => {
    setPlugins([])
    setLoading(true)

    Promise.all([
      PluginManager.getPlugins()
        .then(setPlugins)
        .catch(() => { }),
      new Promise((r) => setTimeout(r, 400))
    ])
      .finally(() => setLoading(false))
  }

  onMount(reload)
  createEffect(() => {
    config.app.plugins_dir()
    reload()
  })

  return (
    <div class="h-full flex flex-col p-6 space-y-5 select-none overflow-y-auto">
      {/* Header bar */}
      <div class="flex items-center justify-between border-b border-white/5 pb-4">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
            <PluginIcon size={18} class="text-purple-400" />
            <span>Installed Plugins</span>
          </h2>
          <span class="text-xs px-2 py-0.5 rounded-full bg-white/5 text-neutral-400 font-mono">
            {plugins().length}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors border border-white/5"
            onClick={reload}
          >
            <ReloadIcon size={13} />
            <span>Reload</span>
          </button>
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors border border-white/5"
            onClick={revealPlugins}
          >
            <span>Open Folder</span>
          </button>
          <button
            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-purple-500 hover:bg-purple-400 text-[#23212C] transition-all shadow-sm"
            onClick={() => setStore(true)}
          >
            <StoreIcon size={13} />
            <span>Browse Store</span>
          </button>
        </div>
      </div>

      {/* Plugin Grid */}
      <Switch>
        <Match when={loading()}>
          <div class="flex flex-col items-center justify-center gap-3 py-20 text-neutral-400">
            <LoaderIcon class="animate-spin text-purple-400" size={28} />
            <span class="text-xs tracking-wide">Scanning plugins directory...</span>
          </div>
        </Match>

        <Match when={!loading()}>
          <Show
            when={plugins().length > 0}
            fallback={
              <div class="flex flex-col items-center justify-center py-20 text-center space-y-3">
                <div class="size-12 rounded-full bg-white/5 flex items-center justify-center text-neutral-400">
                  <PluginIcon size={24} />
                </div>
                <h3 class="text-sm font-semibold text-white">No plugins installed</h3>
                <p class="text-xs text-neutral-400 max-w-sm">
                  Add JavaScript plugin files into your plugins directory or browse community plugins in the Store.
                </p>
                <div class="flex gap-2 pt-2">
                  <button
                    class="px-3.5 py-1.5 rounded-md text-xs font-medium bg-purple-500 hover:bg-purple-400 text-[#23212C] transition-colors font-semibold"
                    onClick={() => setStore(true)}
                  >
                    Open Store
                  </button>
                  <button
                    class="px-3.5 py-1.5 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors border border-white/5"
                    onClick={revealPlugins}
                  >
                    Open Folder
                  </button>
                </div>
              </div>
            }
          >
            <div class="grid grid-cols-3 gap-3">
              <For each={plugins()}>
                {plugin => <PluginCard {...plugin} />}
              </For>
            </div>
          </Show>
        </Match>
      </Switch>
    </div>
  )
}