<script setup lang="ts">
import { useConfig } from '../../lib/config'

const { client } = useConfig()
</script>

<template>
  <div class="space-y-6">
    <p class="text-xs text-neutral-400">*These options work within the Client, restart it to take effect.</p>

    <!-- Hot Keys -->
    <div>
      <h3 class="font-semibold text-neutral-400 text-sm mb-2">Hot Keys</h3>
      <label class="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          :checked="client.use_hotkeys()"
          class="mt-1 size-4 rounded accent-purple-500 cursor-pointer"
          @change="client.use_hotkeys(!client.use_hotkeys())"
        />
        <div class="flex flex-col">
          <span class="text-sm text-neutral-200">Enable hot keys</span>
          <p class="text-xs text-neutral-400">Allow Riot Loader to catch these hot keys when pressed in the Client.</p>
        </div>
      </label>

      <div class="space-y-2 ml-7 mt-3" :class="{ 'opacity-50 pointer-events-none': !client.use_hotkeys() }">
        <div class="flex items-center space-x-2">
          <kbd class="px-2 py-0.5 rounded text-xs bg-white/10 font-mono">Ctrl Shift R</kbd>
          <p class="text-xs text-neutral-400">Reload the Client</p>
        </div>
        <div class="flex items-center space-x-2">
          <kbd class="px-2 py-0.5 rounded text-xs bg-white/10 font-mono">Ctrl Shift Enter</kbd>
          <p class="text-xs text-neutral-400">Restart the UX</p>
        </div>
        <div class="flex items-center space-x-2" :class="{ 'line-through opacity-50': !client.use_devtools() }">
          <kbd class="px-2 py-0.5 rounded text-xs bg-white/10 font-mono">Ctrl Shift I</kbd>
          <span class="text-neutral-500">/</span>
          <kbd class="px-2 py-0.5 rounded text-xs bg-white/10 font-mono">F12</kbd>
          <p class="text-xs text-neutral-400">Open Chrome DevTools</p>
        </div>
        <div class="flex items-center space-x-2">
          <kbd class="px-2 py-0.5 rounded text-xs bg-rose-500/20 text-rose-300 font-mono">Ctrl Shift Alt K</kbd>
          <p class="text-xs text-neutral-400">Emergency panic kill-switch (suspend all plugins)</p>
        </div>
      </div>
    </div>

    <!-- Tweaks -->
    <div>
      <h3 class="font-semibold text-neutral-400 text-sm mb-3">Tweaks</h3>
      <div class="space-y-3">
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.optimized_client()"
            class="mt-1 size-4 rounded accent-purple-500 cursor-pointer"
            @change="client.optimized_client(!client.optimized_client())"
          />
          <div class="flex flex-col">
            <span class="text-sm text-neutral-200">Optimized Client</span>
            <p class="text-xs text-neutral-400">Enable caching and disable unnecessary background processes in the client.</p>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.super_potato()"
            class="mt-1 size-4 rounded accent-purple-500 cursor-pointer"
            @change="client.super_potato(!client.super_potato())"
          />
          <div class="flex flex-col">
            <span class="text-sm text-neutral-200">Super Potato Mode</span>
            <p class="text-xs text-neutral-400">Disable all animations and transitions, reducing input lag.</p>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.silent_mode()"
            class="mt-1 size-4 rounded accent-purple-500 cursor-pointer"
            @change="client.silent_mode(!client.silent_mode())"
          />
          <div class="flex flex-col">
            <span class="text-sm text-neutral-200">Silent Mode</span>
            <p class="text-xs text-neutral-400">Suppress notifications and flashing foreground window on match found.</p>
          </div>
        </label>
      </div>
    </div>

    <!-- Developer -->
    <div>
      <h3 class="font-semibold text-neutral-400 text-sm mb-3">Developer</h3>
      <div class="space-y-3">
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.use_devtools()"
            class="mt-1 size-4 rounded accent-purple-500 cursor-pointer"
            @change="client.use_devtools(!client.use_devtools())"
          />
          <div class="flex flex-col">
            <span class="text-sm text-neutral-200">Developer Tools</span>
            <p class="text-xs text-neutral-400">Open Chrome DevTools to inspect and debug client UI and plugins.</p>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.insecure_mode()"
            class="mt-1 size-4 rounded accent-purple-500 cursor-pointer"
            @change="client.insecure_mode(!client.insecure_mode())"
          />
          <div class="flex flex-col">
            <span class="text-sm text-neutral-200">Insecure Mode</span>
            <p class="text-xs text-neutral-400">Disable web security features like CORS and CSP for development.</p>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.use_riotclient()"
            class="mt-1 size-4 rounded accent-purple-500 cursor-pointer"
            @change="client.use_riotclient(!client.use_riotclient())"
          />
          <div class="flex flex-col">
            <span class="text-sm text-neutral-200">RiotClient API</span>
            <p class="text-xs text-neutral-400">Allow plugins to access the RiotClient API domain directly.</p>
          </div>
        </label>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            :checked="client.use_proxy()"
            class="mt-1 size-4 rounded accent-purple-500 cursor-pointer"
            @change="client.use_proxy(!client.use_proxy())"
          />
          <div class="flex flex-col">
            <span class="text-sm text-neutral-200">Allow Proxy</span>
            <p class="text-xs text-neutral-400">Allow client requests to route through a local network proxy.</p>
          </div>
        </label>
      </div>
    </div>
  </div>
</template>
