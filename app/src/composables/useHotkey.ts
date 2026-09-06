import { onMounted, onUnmounted } from 'vue'
import { matchesHotkey } from '@riot/contracts'

/**
 * Bind a bare global hotkey for as long as the calling component is mounted.
 *
 * Listens on the document in the capture phase so the client's own view code
 * can't swallow the key first, and calls preventDefault/stopPropagation once we
 * decide the press is ours. Match rules (modifiers, auto-repeat, typing in a
 * text field, shadow-DOM retargeting) live in @riot/contracts/hotkey so they
 * can be tested without a DOM — see tests/hotkey.test.mjs.
 */
export function useHotkey(key: string, handler: () => void) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (!matchesHotkey(event, key)) return
    event.preventDefault()
    event.stopPropagation()
    handler()
  }

  onMounted(() => document.addEventListener('keydown', onKeyDown, true))
  onUnmounted(() => document.removeEventListener('keydown', onKeyDown, true))
}
