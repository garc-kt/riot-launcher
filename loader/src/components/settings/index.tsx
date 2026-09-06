import { Component, createMemo, createSignal, For } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { useRoot } from '~/lib/root'

import { TabClient } from './Tab.Client'
import { TabPengu } from './Tab.Pengu'
import { TabAbout } from './Tab.About'

const Tabs: Array<[string, any]> = [
  ['General', TabPengu],
  ['League Client', TabClient],
  ['About', TabAbout],
]

export const Settings: Component = () => {

  const { settings } = useRoot()
  const [tabIndex, setTabIndex] = createSignal(0)

  const currenTab = createMemo(() => Tabs[tabIndex()][1])
  const currenTabName = createMemo(() => Tabs[tabIndex()][0])

  return (
    <div
      class="h-screen fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center aria-hidden:hidden"
      aria-hidden={!settings.visible()}
    >
      <div data-tauri-drag-region class="absolute top-0 w-full h-10" />
      <div
        class="border border-white/10 rounded-xl relative flex w-[800px] h-[480px] shadow-2xl overflow-hidden"
        style={{ 'background-color': '#23212C' }}
      >

        <span class="absolute top-3 right-3 flex justify-center items-center size-7 text-neutral-400 hover:text-white hover:bg-white/10 rounded-md cursor-pointer transition-colors" onClick={settings.hide}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <polygon points="10.2,0.7 9.5,0 5.1,4.4 0.7,0 0,0.7 4.4,5.1 0,9.5 0.7,10.2 5.1,5.8 9.5,10.2 10.2,9.5 5.8,5.1" />
          </svg>
        </span>

        <div class="flex flex-col border-r border-white/5 p-4 w-[210px] py-6" style={{ 'background-color': '#1d1b24' }}>
          <h1 class="text-neutral-400 text-xs font-semibold uppercase tracking-wider mx-3 mb-2">Settings</h1>
          <nav class="flex flex-col space-y-1">
            <For each={Tabs}>
              {([name], index) => (
                <button
                  class="px-3 py-2 rounded-md text-xs font-medium text-left transition-colors cursor-pointer"
                  classList={{
                    'bg-white/10 text-white': tabIndex() === index(),
                    'text-neutral-400 hover:text-white hover:bg-white/5': tabIndex() !== index()
                  }}
                  onClick={() => setTabIndex(index)}
                >{name}</button>
              )}
            </For>
          </nav>
        </div>

        <div class="flex flex-col flex-1 p-4 py-8 pr-1 pb-2">
          <h1 class="text-white text-lg font-bold mx-4">{currenTabName()}</h1>
          <div class="flex flex-col mt-5 space-y-2 pl-4 pr-8 pb-4 flex-auto h-0 overflow-y-auto">
            <Dynamic component={currenTab()} />
          </div>
        </div>

      </div>
    </div>
  )
}