<script setup lang="ts">
import { useConfig } from '../../lib/config'
import { useI18n } from '../../lib/i18n'

const { client } = useConfig()
const { t } = useI18n()
</script>

<template>
  <div class="space-y-4">
    <p class="text-[11px] text-foreground-subtle italic">{{ t('Client tweaks apply inside LeagueClientUx.exe upon launch or reload.') }}</p>

    <div class="riot-card p-3.5 space-y-3">
      <h3 class="font-semibold text-foreground text-xs">{{ t('In-client hotkeys') }}</h3>
      <label class="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          :checked="client.use_hotkeys()"
          class="mt-1 size-4 rounded-sm cursor-pointer accent-foreground"
          @change="client.use_hotkeys(!client.use_hotkeys())"
        />
        <div class="flex flex-col">
          <span class="text-xs font-medium text-foreground">{{ t('Enable global hotkeys') }}</span>
          <p class="text-[11px] text-foreground-muted mt-0.5">{{ t('Intercept key combinations within the League client window.') }}</p>
        </div>
      </label>

      <div class="space-y-2.5 pt-1 pl-7" :class="{ 'opacity-40 pointer-events-none': !client.use_hotkeys() }">
        <div class="flex items-center justify-between text-xs">
          <span class="text-foreground-muted text-[11px]">{{ t('Reload client frontend') }}</span>
          <span class="riot-kbd">Ctrl + Shift + R</span>
        </div>
        <div class="flex items-center justify-between text-xs">
          <span class="text-foreground-muted text-[11px]">{{ t('Restart client UX process') }}</span>
          <span class="riot-kbd">Ctrl + Shift + Enter</span>
        </div>
        <div class="flex items-center justify-between text-xs" :class="{ 'line-through opacity-40': !client.use_devtools() }">
          <span class="text-foreground-muted text-[11px]">{{ t('Chrome DevTools inspector') }}</span>
          <div class="flex items-center gap-1">
            <span class="riot-kbd">Ctrl + Shift + I</span>
            <span class="text-foreground-subtle text-[10px]">/</span>
            <span class="riot-kbd">F12</span>
          </div>
        </div>
        <div class="flex items-center justify-between text-xs">
          <span class="text-foreground-muted text-[11px]">{{ t('Emergency panic kill-switch') }}</span>
          <span class="riot-kbd border-destructive/40 bg-destructive/10 text-destructive">Ctrl + Alt + Shift + K</span>
        </div>
      </div>
    </div>

    <div class="riot-card p-3.5 space-y-3">
      <h3 class="font-semibold text-foreground text-xs">{{ t('Client performance') }}</h3>
      <div class="space-y-3">
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.optimized_client()"
            class="mt-1 size-4 rounded-sm cursor-pointer accent-foreground"
            @change="client.optimized_client(!client.optimized_client())"
          />
          <div class="flex flex-col">
            <span class="text-xs font-medium text-foreground">{{ t('Client optimization') }}</span>
            <p class="text-[11px] text-foreground-muted mt-0.5">{{ t('Enable disk asset caching and suppress background telemetry.') }}</p>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.super_potato()"
            class="mt-1 size-4 rounded-sm cursor-pointer accent-foreground"
            @change="client.super_potato(!client.super_potato())"
          />
          <div class="flex flex-col">
            <span class="text-xs font-medium text-foreground">{{ t('Super potato mode') }}</span>
            <p class="text-[11px] text-foreground-muted mt-0.5">{{ t('Disable transitions, animated backgrounds, and reduce draw overhead.') }}</p>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.silent_mode()"
            class="mt-1 size-4 rounded-sm cursor-pointer accent-foreground"
            @change="client.silent_mode(!client.silent_mode())"
          />
          <div class="flex flex-col">
            <span class="text-xs font-medium text-foreground">{{ t('Silent mode') }}</span>
            <p class="text-[11px] text-foreground-muted mt-0.5">{{ t('Suppress taskbar window flashing on match found.') }}</p>
          </div>
        </label>
      </div>
    </div>

    <div class="riot-card p-3.5 space-y-3">
      <h3 class="font-semibold text-foreground text-xs">{{ t('Developer & security') }}</h3>
      <div class="space-y-3">
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.use_devtools()"
            class="mt-1 size-4 rounded-sm cursor-pointer accent-foreground"
            @change="client.use_devtools(!client.use_devtools())"
          />
          <div class="flex flex-col">
            <span class="text-xs font-medium text-foreground">{{ t('Enable DevTools') }}</span>
            <p class="text-[11px] text-foreground-muted mt-0.5">{{ t('Allow opening Chrome DevTools inside CEF renderer processes.') }}</p>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.insecure_mode()"
            class="mt-1 size-4 rounded-sm cursor-pointer accent-foreground"
            @change="client.insecure_mode(!client.insecure_mode())"
          />
          <div class="flex flex-col">
            <span class="text-xs font-medium text-foreground">{{ t('Insecure mode (CORS / CSP bypass)') }}</span>
            <p class="text-[11px] text-foreground-muted mt-0.5">{{ t('Bypasses web security policies for local plugin development.') }}</p>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.use_riotclient()"
            class="mt-1 size-4 rounded-sm cursor-pointer accent-foreground"
            @change="client.use_riotclient(!client.use_riotclient())"
          />
          <div class="flex flex-col">
            <span class="text-xs font-medium text-foreground">{{ t('RiotClient API access') }}</span>
            <p class="text-[11px] text-foreground-muted mt-0.5">{{ t('Permits plugins to query RiotClient internal endpoints directly.') }}</p>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.use_proxy()"
            class="mt-1 size-4 rounded-sm cursor-pointer accent-foreground"
            @change="client.use_proxy(!client.use_proxy())"
          />
          <div class="flex flex-col">
            <span class="text-xs font-medium text-foreground">{{ t('Allow proxy routing') }}</span>
            <p class="text-[11px] text-foreground-muted mt-0.5">{{ t('Allows routing client HTTP traffic through local debugging proxies.') }}</p>
          </div>
        </label>
      </div>
    </div>
  </div>
</template>
