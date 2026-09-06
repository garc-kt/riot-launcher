import type { Directive } from 'vue'
import tippy, { type Instance as TippyInstance } from 'tippy.js'

export function isMac() {
  return false
}

// fnv1a 32-bit
export function getHash(str: string) {
  const data = new TextEncoder().encode(str)
  let hash = 0x811c9dc5

  for (const byte of data) {
    hash ^= byte
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }

  return hash >>> 0
}

export const vTippy: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    if (!binding.value) return
    const instance = tippy(el, {
      content: binding.value,
      arrow: false,
    })
    ;(el as any)._tippyInstance = instance
  },
  updated(el, binding) {
    const instance = (el as any)._tippyInstance as TippyInstance | undefined
    if (instance) {
      instance.setContent(binding.value || '')
    }
  },
  unmounted(el) {
    const instance = (el as any)._tippyInstance as TippyInstance | undefined
    instance?.destroy()
  }
}