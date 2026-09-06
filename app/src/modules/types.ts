import type { LcuClient } from '@riot/lcu'
import type { ScopedStore } from '@/types'
import type { GameflowPhase } from '@/types'

export interface ModuleToast {
  success(message: string): void
  error(message: string): void
  info(message: string): void
  warning(message: string): void
}

export interface ModulePanic {
  /** Register a cancel-fn for a pending auto-action. Returns an
   *  unregister fn. The host enforces (statically, via
   *  validateAutoActsRegisterPanic) that any module declaring
   *  capabilities.autoActs actually calls this. */
  register(cancel: () => void): () => void
}

/**
 * What a module's init(ctx)/load() receive. Replaces Snooze's Utils
 * god-object with a per-module context — no window.Utils, no window.LCU,
 * no window.SnoozeManager.
 */
export interface ModuleContext {
  lcu: LcuClient
  /** Scoped to this module: store.get('x') reads modules.<id>.x under the
   *  hood, so module code never needs to know its own id when touching
   *  its own settings. */
  store: ScopedStore
  toast: ModuleToast
  panic: ModulePanic
  ember?: any
  net?: any
  log: (...args: unknown[]) => void
  /** Current gameflow phase — a snapshot getter, not a subscription; a
   *  passive-dom/active module that needs to react to phase changes calls
   *  ctx.lcu.observe('/lol-gameflow/v1/gameflow-phase', ...) itself. */
  phase: () => GameflowPhase
}
