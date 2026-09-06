export interface LifecycleCallbacks {
  bootstrap: () => void
  teardown: () => void
  isDocumentComplete?: () => boolean
}

export function createLifecycleManager({
  bootstrap,
  teardown,
  isDocumentComplete = () => typeof document !== 'undefined' && document.readyState === 'complete',
}: LifecycleCallbacks) {
  let isMounted = false
  let isKilled = false

  return {
    isMounted: () => isMounted,
    isKilled: () => isKilled,
    handlePhaseChange: (phase: string) => {
      if (isKilled) return
      if (phase === 'InProgress') {
        if (isMounted) {
          teardown()
          isMounted = false
          console.info?.('[Companion] Game in progress — entered passive mode (unmounted).')
        }
      } else if (!isMounted && isDocumentComplete()) {
        bootstrap()
        isMounted = true
        console.info?.('[Companion] Game ended or out of match — resumed companion overlay.')
      }
    },
    handleKeyDown: (e: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; code?: string }) => {
      if (e.ctrlKey && e.shiftKey && e.altKey && e.code === 'KeyK') {
        isKilled = true
        if (isMounted) {
          teardown()
          isMounted = false
        }
        console.warn?.('[Companion] Kill-switch activated: companion UI permanently unmounted.')
      }
    },
    handleToggle: () => {
      if (isKilled) {
        isKilled = false
        bootstrap()
        isMounted = true
        console.info?.('[Companion] Companion re-enabled after kill-switch.')
        return true
      }
      return false
    },
    load: () => {
      if (!isMounted && !isKilled) {
        bootstrap()
        isMounted = true
      }
    },
  }
}
