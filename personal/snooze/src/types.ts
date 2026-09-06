import type { LcuClient } from '@riot/lcu'
import type { ScopedStore } from '@/types'

export interface ModuleToast {
  success(message: string): void
  error(message: string): void
  info(message: string): void
  warning(message: string): void
}

export interface ModulePanic {
  register(cancel: () => void): () => void
}

export interface ModuleContext {
  lcu: LcuClient
  store: ScopedStore
  toast: ModuleToast
  panic: ModulePanic
  ember?: any
  net?: any
  log: (...args: unknown[]) => void
  phase: () => string
}
