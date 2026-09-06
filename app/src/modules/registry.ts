import type { ModuleDescriptor } from '@riot/contracts'

/**
 * Static registration for the core companion app.
 *
 * Licensing policy: The core application ships with an empty module registry.
 * All Snooze Manager ported modules reside strictly within the personal/
 * workspace (@personal/snooze) and are excluded from public distribution releases.
 */
export const MODULE_REGISTRY: ModuleDescriptor[] = []
