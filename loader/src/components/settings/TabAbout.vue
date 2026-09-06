<script setup lang="ts">
import { shell } from '@tauri-apps/api'
import { GitHubIcon, LinkIcon } from '../Icons'

const links = {
  riotRepo: 'https://github.com/garc-kt/riot-launcher',
  penguRepo: 'https://github.com/PenguLoader/PenguLoader/',
  penguHome: 'https://pengu.lol',
}

const appVersion = (typeof window !== 'undefined' ? (window as any).appVersion : '1.0.1') || '1.0.1'

const openUrl = (url: string) => {
  shell.open(url)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col space-y-2">
      <h3 class="text-lg font-bold text-white tracking-tight">Riot Loader v{{ appVersion }}</h3>
      <p class="text-xs text-neutral-400 leading-relaxed">
        A high-performance standalone Win32 client companion platform with native constructable theming, runtime extensions, and match safety controls.
      </p>
      <div class="pt-2">
        <button
          class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border border-white/15 hover:bg-white/10 text-white transition-colors cursor-pointer"
          @click="openUrl(links.riotRepo)"
        >
          <GitHubIcon :size="16" />
          <span>GitHub Repository</span>
        </button>
      </div>
    </div>

    <div class="border-t border-white/10 pt-4 space-y-2">
      <h4 class="text-xs font-semibold uppercase tracking-wider text-neutral-400">Upstream Attribution & License</h4>
      <p class="text-xs text-neutral-400 leading-relaxed">
        Riot Loader is an enhanced fork of <span class="text-neutral-300 font-medium">Pengu Loader</span> (Copyright © 2024 Pengu Loader), licensed under the MIT License.
      </p>
      <div class="flex items-center space-x-3 pt-1">
        <button
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-neutral-300 border border-white/10 hover:bg-white/5 transition-colors cursor-pointer"
          @click="openUrl(links.penguHome)"
        >
          <LinkIcon :size="14" />
          <span>pengu.lol</span>
        </button>
        <button
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-neutral-300 border border-white/10 hover:bg-white/5 transition-colors cursor-pointer"
          @click="openUrl(links.penguRepo)"
        >
          <GitHubIcon :size="14" />
          <span>Upstream Source</span>
        </button>
      </div>
    </div>
  </div>
</template>
