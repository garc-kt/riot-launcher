import { Component, createSignal, JSX, onMount, Show, splitProps } from 'solid-js'
import { appWindow } from '@tauri-apps/api/window'
import { twMerge } from 'tailwind-merge'
import { MoonIcon, PaletteIcon, PluginIcon, SettingsIcon, StoreIcon, SunIcon } from './Icons'
import { useRoot } from '../lib/root'
import { useTippy } from '../lib/utils'
import icon from '../assets/icon-sm.png'

const Command: Component<JSX.HTMLAttributes<HTMLSpanElement>> = (props) => {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <span
      class={twMerge("flex justify-center items-center px-3 h-full hover:bg-white/10 transition-colors cursor-pointer text-neutral-400 hover:text-white", local.class)}
      {...rest}
    />
  )
}

export const Appbar: Component<{
  isHome: boolean
}> = (props) => {

  const { settings, tab, setTab, themeMode, toggleThemeMode } = useRoot()
  const [focus, setFocus] = createSignal(true)

  const minimize = () => appWindow.minimize()
  const close = () => appWindow.close()

  onMount(async () => {
    setFocus(await appWindow.isFocused())
    appWindow.onFocusChanged(e => setFocus(e.payload))
  })

  return (
    <div
      data-tauri-drag-region
      class="flex items-center justify-between h-11 border-b border-white/5 bg-[#23212C] select-none aria-busy:opacity-80 transition-opacity"
      aria-busy={!focus()}
    >

      {/* Brand */}
      <div class="flex items-center px-3 h-full pointer-events-none gap-2">
        <img src={icon} class="size-5 rounded-md" alt="Riot Loader" />
        <span class="text-sm font-semibold tracking-tight text-white">Riot Loader</span>
        <span class="text-[11px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-400 font-mono">v{window.appVersion}</span>
      </div>

      {/* Navigation tabs */}
      <Show when={props.isHome}>
        <div class="flex items-center h-full gap-1">
          <button
            class="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all"
            classList={{
              'bg-white/10 text-white shadow-sm': tab() === 'plugins',
              'text-neutral-400 hover:text-neutral-200 hover:bg-white/5': tab() !== 'plugins'
            }}
            onClick={() => setTab('plugins')}
          >
            <PluginIcon size={14} />
            <span>Plugins</span>
          </button>

          <button
            class="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all"
            classList={{
              'bg-white/10 text-white shadow-sm': tab() === 'themes',
              'text-neutral-400 hover:text-neutral-200 hover:bg-white/5': tab() !== 'themes'
            }}
            onClick={() => setTab('themes')}
          >
            <PaletteIcon size={14} />
            <span>Themes</span>
          </button>

          <button
            class="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all"
            classList={{
              'bg-white/10 text-white shadow-sm': tab() === 'store',
              'text-neutral-400 hover:text-neutral-200 hover:bg-white/5': tab() !== 'store'
            }}
            onClick={() => setTab('store')}
          >
            <StoreIcon size={14} />
            <span>Store</span>
          </button>
        </div>
      </Show>

      {/* Action / Window Controls */}
      <div class="flex items-center h-full">
        <Show when={props.isHome}>
          <Command
            onClick={toggleThemeMode}
            ref={useTippy(themeMode() === 'cosmic' ? 'Switch to Vanilla (Light)' : 'Switch to Cosmic (Dark)')}
          >
            {themeMode() === 'cosmic' ? <SunIcon size={15} /> : <MoonIcon size={15} />}
          </Command>
          <Command onClick={settings.show} ref={useTippy('Settings')}>
            <SettingsIcon size={15} />
          </Command>
        </Show>
        <Command onClick={minimize} ref={useTippy('Minimize')}>
          <svg width="10" height="10" viewBox="0 0 10.2 1" fill="currentColor">
            <rect x="0" y="50%" width="10.2" height="1" />
          </svg>
        </Command>
        <Command onClick={close} class="hover:text-white hover:bg-rose-600/90" ref={useTippy('Close')}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <polygon points="10.2,0.7 9.5,0 5.1,4.4 0.7,0 0,0.7 4.4,5.1 0,9.5 0.7,10.2 5.1,5.8 9.5,10.2 10.2,9.5 5.8,5.1" />
          </svg>
        </Command>
      </div>

    </div>
  )
}