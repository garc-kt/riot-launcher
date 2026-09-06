import { Component } from 'solid-js'
import { Button } from '../ui/Button'
import { GitHubIcon, LinkIcon } from '../Icons'
import { shell } from '@tauri-apps/api'

const links = {
  riotRepo: 'https://github.com/garc-kt/riot-launcher',
  penguRepo: 'https://github.com/PenguLoader/PenguLoader/',
  penguHome: 'https://pengu.lol',
}

export const TabAbout: Component = () => {
  return (
    <div class="space-y-6">
      <div class="flex flex-col space-y-2">
        <h3 class="text-lg font-bold text-white tracking-tight">Riot Loader v{window.appVersion}</h3>
        <p class="text-xs text-neutral-400 leading-relaxed">
          A high-performance standalone Win32 client companion platform with native constructable theming, runtime extensions, and match safety controls.
        </p>
        <div class="pt-2">
          <Button variant="outline" size="sm" class="flex items-center gap-x-2 border-white/15 hover:bg-white/10 text-white" onClick={() => shell.open(links.riotRepo)}>
            <GitHubIcon size={16} /> GitHub Repository
          </Button>
        </div>
      </div>

      <div class="border-t border-white/10 pt-4 space-y-2">
        <h4 class="text-xs font-semibold uppercase tracking-wider text-neutral-400">Upstream Attribution & License</h4>
        <p class="text-xs text-neutral-400 leading-relaxed">
          Riot Loader is an enhanced fork of <span class="text-neutral-300 font-medium">Pengu Loader</span> (Copyright © 2024 Pengu Loader), licensed under the MIT License.
        </p>
        <div class="flex items-center space-x-3 pt-1">
          <Button variant="outline" size="sm" class="flex items-center gap-x-1.5 text-xs text-neutral-300 border-white/10 hover:bg-white/5" onClick={() => shell.open(links.penguHome)}>
            <LinkIcon size={14} /> pengu.lol
          </Button>
          <Button variant="outline" size="sm" class="flex items-center gap-x-1.5 text-xs text-neutral-300 border-white/10 hover:bg-white/5" onClick={() => shell.open(links.penguRepo)}>
            <GitHubIcon size={14} /> Upstream Source
          </Button>
        </div>
      </div>
    </div>
  )
}