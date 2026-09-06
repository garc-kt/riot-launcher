<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Config } from './lib/config'
import Appbar from './components/Appbar.vue'
import MainPage from './pages/MainPage.vue'
import WelcomePage from './pages/WelcomePage.vue'
import SplashPage from './pages/SplashPage.vue'

const ready = ref(false)
const welcome = ref(true)

onMounted(async () => {
  try {
    const hasConfig = await Config.load()
    welcome.value = !hasConfig
  } catch (err) {
    console.warn('Failed to load configuration:', err)
  } finally {
    ready.value = true
  }
})
</script>

<template>
  <div class="h-screen flex flex-col bg-[#090a0f] text-slate-100 selection:bg-sky-500/30">
    <template v-if="ready">
      <Appbar :is-home="!welcome" />
      <WelcomePage v-if="welcome" @done="welcome = false" />
      <MainPage v-else />
    </template>
    <SplashPage v-else />
  </div>
</template>
