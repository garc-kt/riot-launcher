import { createSignal, onMount, Show } from 'solid-js'
import { Config } from './lib/config'
import { WelcomePage } from './pages/WelcomePage'
import { Appbar } from './components/Appbar'
import { MainPage } from './pages/MainPage'

import './App.css'
import 'tippy.js/dist/tippy.css'

function App() {
  const [ready, setReady] = createSignal(false)
  const [welcome, setWelcome] = createSignal(true)

  onMount(async () => {
    setWelcome(!await Config.load())
    setReady(true)
  })

  return (
    <div class="h-screen flex flex-col bg-[#090a0f] text-slate-100 selection:bg-sky-500/30">
      <Show when={ready()}>
        <Appbar isHome={!welcome()} />
        <Show
          when={!welcome()}
          fallback={<WelcomePage onDone={() => setWelcome(false)} />}
        >
          <MainPage />
        </Show>
      </Show>
    </div>
  )
}

export default App