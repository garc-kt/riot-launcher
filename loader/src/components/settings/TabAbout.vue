<script setup lang="ts">
import { shell } from '@tauri-apps/api'
import { GitHubIcon, LinkIcon } from '../Icons'
import { useI18n } from '../../lib/i18n'

const { t } = useI18n()

const links = {
  riotRepo: 'https://github.com/garc-kt/riot-launcher',
  penguRepo: 'https://github.com/PenguLoader/PenguLoader/',
  penguHome: 'https://pengu.lol',
}

const appVersion = (typeof window !== 'undefined' ? (window as any).appVersion : '1.0.5') || '1.0.5'

const openUrl = (url: string) => {
  shell.open(url)
}
</script>

<template>
  <div class="space-y-4">
    <div class="riot-card p-4 flex flex-col space-y-2.5">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-foreground">
          Riot Loader
        </h3>
        <span class="text-[10px] px-1.5 py-0.5 rounded-sm border border-border bg-surface-2 text-foreground-subtle font-data font-semibold">
          v{{ appVersion }}
        </span>
      </div>
      <p class="text-xs text-foreground-muted leading-relaxed">
        {{ t('Standalone Win32 League of Legends client companion platform with native constructable theming, runtime extensions, and match safety controls.') }}
      </p>
      <div class="pt-2">
        <button
          class="riot-btn-primary inline-flex items-center gap-2 px-3.5 py-1.5 text-xs"
          @click="openUrl(links.riotRepo)"
        >
          <GitHubIcon :size="15" />
          <span>{{ t('GitHub repository') }}</span>
        </button>
      </div>
    </div>

    <div class="riot-card p-4 space-y-3">
      <h4 class="text-xs font-semibold text-foreground">
        {{ t('Attribution & upstream') }}
      </h4>
      <p class="text-xs text-foreground-muted leading-relaxed">
        {{ t('Riot Loader is an enhanced fork of Pengu Loader (Copyright © 2024 Pengu Loader), licensed under the MIT License.') }}
      </p>
      <div class="flex items-center space-x-3 pt-1">
        <button
          class="riot-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
          @click="openUrl(links.penguHome)"
        >
          <LinkIcon :size="14" />
          <span>pengu.lol</span>
        </button>
        <button
          class="riot-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
          @click="openUrl(links.penguRepo)"
        >
          <GitHubIcon :size="14" />
          <span>{{ t('Upstream source') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
