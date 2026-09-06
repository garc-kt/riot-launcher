<script setup lang="ts">
import { useConfig } from '../../lib/config'

const { client } = useConfig()
</script>

<template>
  <div class="space-y-5">
    <p class="text-[11px] text-muted-foreground italic">*Client tweaks apply inside LeagueClientUx.exe upon launch or reload.</p>

    <!-- Hot Keys -->
    <div class="riot-card p-3.5 rounded-lg space-y-3">
      <h3 class="font-bold text-foreground text-xs uppercase tracking-[0.14em] font-serif">In-Client Hotkeys</h3>
      <label class="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          :checked="client.use_hotkeys()"
          class="mt-1 size-4 rounded cursor-pointer accent-[var(--hextech-gold)]"
          @change="client.use_hotkeys(!client.use_hotkeys())"
        />
        <div class="flex flex-col">
          <span class="text-xs font-bold text-foreground">Enable Global Hotkeys</span>
          <p class="text-[11px] text-muted-foreground mt-0.5">Intercept key combinations within the League client window.</p>
        </div>
      </label>

      <div class="space-y-2.5 pt-1 pl-7" :class="{ 'opacity-40 pointer-events-none': !client.use_hotkeys() }">
        <div class="flex items-center justify-between text-xs">
          <span class="text-muted-foreground text-[11px]">Reload Client Frontend</span>
          <span class="riot-kbd">Ctrl + Shift + R</span>
        </div>
        <div class="flex items-center justify-between text-xs">
          <span class="text-muted-foreground text-[11px]">Restart Client UX Process</span>
          <span class="riot-kbd">Ctrl + Shift + Enter</span>
        </div>
        <div class="flex items-center justify-between text-xs" :class="{ 'line-through opacity-40': !client.use_devtools() }">
          <span class="text-muted-foreground text-[11px]">Chrome DevTools Inspector</span>
          <div class="flex items-center gap-1">
            <span class="riot-kbd">Ctrl + Shift + I</span>
            <span class="text-muted-foreground text-[10px]">/</span>
            <span class="riot-kbd">F12</span>
          </div>
        </div>
        <div class="flex items-center justify-between text-xs">
          <span class="text-muted-foreground text-[11px]">Emergency Panic Kill-Switch</span>
          <span class="riot-kbd border-destructive/40 bg-destructive/15 text-destructive">Ctrl + Alt + Shift + K</span>
        </div>
      </div>
    </div>

    <!-- Tweaks -->
    <div class="riot-card p-3.5 rounded-lg space-y-3">
      <h3 class="font-bold text-foreground text-xs uppercase tracking-[0.14em] font-serif">Client Performance</h3>
      <div class="space-y-3">
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.optimized_client()"
            class="mt-1 size-4 rounded cursor-pointer accent-[var(--hextech-gold)]"
            @change="client.optimized_client(!client.optimized_client())"
          />
          <div class="flex flex-col">
            <span class="text-xs font-bold text-foreground">Client Optimization</span>
            <p class="text-[11px] text-muted-foreground mt-0.5">Enable disk asset caching and suppress background telemetry.</p>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.super_potato()"
            class="mt-1 size-4 rounded cursor-pointer accent-[var(--hextech-gold)]"
            @change="client.super_potato(!client.super_potato())"
          />
          <div class="flex flex-col">
            <span class="text-xs font-bold text-foreground">Super Potato Mode</span>
            <p class="text-[11px] text-muted-foreground mt-0.5">Disable transitions, animated backgrounds, and reduce draw overhead.</p>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.silent_mode()"
            class="mt-1 size-4 rounded cursor-pointer accent-[var(--hextech-gold)]"
            @change="client.silent_mode(!client.silent_mode())"
          />
          <div class="flex flex-col">
            <span class="text-xs font-bold text-foreground">Silent Mode</span>
            <p class="text-[11px] text-muted-foreground mt-0.5">Suppress taskbar window flashing on match found.</p>
          </div>
        </label>
      </div>
    </div>

    <!-- Developer Tools -->
    <div class="riot-card p-3.5 rounded-lg space-y-3">
      <h3 class="font-bold text-foreground text-xs uppercase tracking-[0.14em] font-serif">Developer & Security</h3>
      <div class="space-y-3">
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.use_devtools()"
            class="mt-1 size-4 rounded cursor-pointer accent-[var(--hextech-gold)]"
            @change="client.use_devtools(!client.use_devtools())"
          />
          <div class="flex flex-col">
            <span class="text-xs font-bold text-foreground">Enable DevTools</span>
            <p class="text-[11px] text-muted-foreground mt-0.5">Allow opening Chrome DevTools inside CEF renderer processes.</p>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.insecure_mode()"
            class="mt-1 size-4 rounded cursor-pointer accent-[var(--hextech-gold)]"
            @change="client.insecure_mode(!client.insecure_mode())"
          />
          <div class="flex flex-col">
            <span class="text-xs font-bold text-foreground">Insecure Mode (CORS / CSP Bypass)</span>
            <p class="text-[11px] text-muted-foreground mt-0.5">Bypasses web security policies for local plugin development.</p>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.use_riotclient()"
            class="mt-1 size-4 rounded cursor-pointer accent-[var(--hextech-gold)]"
            @change="client.use_riotclient(!client.use_riotclient())"
          />
          <div class="flex flex-col">
            <span class="text-xs font-bold text-foreground">RiotClient API Access</span>
            <p class="text-[11px] text-muted-foreground mt-0.5">Permits plugins to query RiotClient internal endpoints directly.</p>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.use_proxy()"
            class="mt-1 size-4 rounded cursor-pointer accent-[var(--hextech-gold)]"
            @change="client.use_proxy(!client.use_proxy())"
          />
          <div class="flex flex-col">
            <span class="text-xs font-bold text-foreground">Allow Proxy Routing</span>
            <p class="text-[11px] text-muted-foreground mt-0.5">Allows routing client HTTP traffic through local debugging proxies.</p>
          </div>
        </label>
      </div>
    </div>
  </div>
</template>
