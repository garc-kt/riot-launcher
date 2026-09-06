import { Component, createSignal, onMount } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { CoreModule } from '../lib/core-module'
import { dialog } from '@tauri-apps/api'
import { BoltIcon, PowerIcon } from './Icons'

export const Activator: Component = () => {

  const [loading, setLoading] = createSignal(true)
  const [active, setActive] = createSignal(false)

  const activate = async () => {
    if (!loading()) {
      setLoading(true)

      try {
        if (!await CoreModule.checkLeagueDir()) {
          await dialog.message('Please select a valid LoL Client folder in Settings.', { type: 'warning' })
          return
        }

        if (!await CoreModule.exists()) {
          await dialog.message('Failed to perform activation, the core module is not found.', { type: 'warning' })
          return
        }

        const nextActive = !active()
        const { activated, error } = await CoreModule.doActivate(nextActive)

        if (error) {
          await dialog.message(`Failed to perform activation, got error:\n${error}`, { type: 'warning' })
        } else if (activated === nextActive) {
          setActive(activated)
        }
      }
      finally {
        setLoading(false)
      }
    }
  }

  onMount(async () => {
    setActive(await CoreModule.isActivated())
    setLoading(false)
  })

  return (
    <div class="fixed bottom-5 right-6 z-20">
      <button
        class="flex items-center gap-3 px-4 py-2 rounded-full border shadow-lg backdrop-blur-md transition-all duration-200 group cursor-pointer"
        style={{ 'background-color': active() ? 'rgba(34, 197, 94, 0.12)' : 'rgba(44, 41, 55, 0.85)' }}
        classList={{
          'border-emerald-500/40 text-emerald-300 hover:border-emerald-400': active(),
          'border-white/10 text-neutral-300 hover:border-white/25 hover:text-white': !active(),
          'opacity-60 pointer-events-none': loading()
        }}
        onClick={activate}
      >
        <span
          class="size-2 rounded-full transition-all duration-300"
          classList={{
            'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse': active(),
            'bg-neutral-500': !active()
          }}
        />

        <div class="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
          <Dynamic component={active() ? BoltIcon : PowerIcon} size={14} thickness={2.2} />
          <span>{active() ? 'Client Hooked' : 'Activate Loader'}</span>
        </div>

        <span class="text-[10px] px-2 py-0.5 rounded-full font-mono font-normal"
          classList={{
            'bg-emerald-500/20 text-emerald-200': active(),
            'bg-white/5 text-neutral-400': !active()
          }}
        >
          {active() ? 'LIVE' : 'IDLE'}
        </span>
      </button>
    </div>
  )
}