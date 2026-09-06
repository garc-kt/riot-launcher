export function useNative() {
  const isAvailable = typeof window !== 'undefined' && ('DataStore' in window || 'Effect' in window)

  const openDevTools = () => {
    if (typeof window !== 'undefined' && typeof window.openDevTools === 'function') {
      window.openDevTools()
    }
  }

  const reloadClient = () => {
    if (typeof window !== 'undefined' && typeof window.reloadClient === 'function') {
      window.reloadClient()
    }
  }

  const restartClient = () => {
    if (typeof window !== 'undefined' && typeof window.restartClient === 'function') {
      window.restartClient()
    }
  }

  const applyBackdrop = (type: 'mica' | 'acrylic' | 'blurbehind' | 'transparent', options?: any) => {
    if (typeof window !== 'undefined' && window.Effect && typeof window.Effect.apply === 'function') {
      window.Effect.apply(type, options)
    }
  }

  const applyTheme = (css: string) => {
    const theme = (window as any).CompanionTheme
    if (theme && typeof theme.apply === 'function') {
      theme.apply(css)
    }
  }

  return {
    isAvailable,
    openDevTools,
    reloadClient,
    restartClient,
    applyBackdrop,
    applyTheme,
  }
}
