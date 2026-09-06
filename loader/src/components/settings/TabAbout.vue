<script setup lang="ts">
import { shell } from '@tauri-apps/api'
import { GitHubIcon, LinkIcon } from '../Icons'

const links = {
  riotRepo: 'https://github.com/garc-kt/riot-launcher',
  penguRepo: 'https://github.com/PenguLoader/PenguLoader/',
  penguHome: 'https://pengu.lol',
}

const appVersion = (typeof window !== 'undefined' ? (window as any).appVersion : '1.0.2') || '1.0.2'

const openUrl = (url: string) => {
  shell.open(url)
}
</script>

<template>
  <div class="space-y-6">
    <div class="riot-card p-4 rounded-lg flex flex-col space-y-2.5">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-bold text-foreground font-serif uppercase tracking-wider">
          Riot Loader
        </h3>
        <span class="text-[10px] px-2 py-0.5 rounded border border-border bg-muted text-muted-foreground font-mono font-bold">
          v{{ appVersion }}
        </span>
      </div>
      <p class="text-xs text-muted-foreground leading-relaxed">
        High-performance standalone Win32 League of Legends client companion platform with native constructable theming, runtime extensions, and match safety controls.
      </p>
      <div class="pt-2">
        <button
          class="riot-btn-primary inline-flex items-center gap-2 px-3.5 py-1.5 rounded text-xs"
          @click="openUrl(links.riotRepo)"
        >
          <GitHubIcon :size="15" />
          <span>GitHub Repository</span>
        </button>
      </div>
    </div>

    <div class="riot-card p-4 rounded-lg space-y-3">
      <h4 class="text-xs font-bold uppercase tracking-[0.14em] text-foreground font-serif">
        Attribution & Upstream
      </h4>
      <p class="text-xs text-muted-foreground leading-relaxed">
        Riot Loader is an enhanced fork of <span class="text-foreground font-semibold">Pengu Loader</span> (Copyright © 2024 Pengu Loader), licensed under the MIT License.
      </p>
      <div class="flex items-center space-x-3 pt-1">
        <button
          class="riot-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
          @click="openUrl(links.penguHome)"
        >
          <LinkIcon :size="14" />
          <span>pengu.lol</span>
        </button>
        <button
          class="riot-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
          @click="openUrl(links.penguRepo)"
        >
          <GitHubIcon :size="14" />
          <span>Upstream Source</span>
        </button>
      </div>
    </div>
  </div>
</template>
