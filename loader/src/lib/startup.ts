import { invoke } from '@tauri-apps/api'

export const Startup = new class {

  async isEnabled() {
    return await invoke<boolean>('plugin:startup|is_enabled')
  }

  async setEnable(enable: boolean) {
    return await invoke<boolean>('plugin:startup|set_enable', {
      enable: enable
    })
  }

}