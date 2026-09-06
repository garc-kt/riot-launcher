/**
 * Migrates a Snooze Manager user's settings out of the global, XOR-obscured
 * `window.DataStore` (one shared file, no backup, whole-file rewrite on
 * every write — see plan.md §4.3) into the shape the ported module host
 * expects to hand to `context.ext.store` (a per-plugin file, debounced).
 *
 * Ported from Snooze's own Store._load()/migrateLegacyKeys()
 * (generalUtils.js:2049) and index.js's LEGACY_MIGRATION_MAP (index.js:1909),
 * with one deliberate change: this never deletes anything from the legacy
 * store. Snooze's own migration removes each `sm:*` key as it migrates it;
 * doing that here, against a single unbacked-up file, turns any migration
 * bug into permanent data loss for the user. Deletion — if ever wanted —
 * is a separate, later, explicit step, not bundled into this one.
 */

export const LEGACY_MIGRATION_MAP: Record<string, { module: string; key: string }> = {
  'sm:aramNocd': { module: 'aramNocd', key: 'enabled' },
  'sm:arenaGod': { module: 'arenaGod', key: 'enabled' },
  'sm:arenaGodPos': { module: 'arenaGod', key: 'pos' },
  'sm:autoAccept': { module: 'autoAccept', key: 'enabled' },
  'sm:autoAcceptDelay': { module: 'autoAccept', key: 'delay' },
  'sm:autoAcceptExitOnDecline': { module: 'autoAccept', key: 'exitOnDecline' },
  'sm:exitOnDecline': { module: 'autoAccept', key: 'exitOnDecline' },
  'sm:autoHonor': { module: 'autoHonor', key: 'enabled' },
  'sm:autoHonorMode': { module: 'autoHonor', key: 'mode' },
  'sm:autoHonorSkip': { module: 'autoHonor', key: 'skip' },
  'sm:autoLockChampion': { module: 'autoLockChampion', key: 'enabled' },
  'sm:autoLockDelay': { module: 'autoLockChampion', key: 'delay' },
  'sm:autoLockInstant': { module: 'autoLockChampion', key: 'instant' },
  'sm:autoLockChampionPickIds': { module: 'autoLockChampion', key: 'pickIds' },
  'sm:autoLockChampionBanIds': { module: 'autoLockChampion', key: 'banIds' },
  'sm:autoLockChampionId': { module: 'autoLockChampion', key: 'legacyPickId' },
  'sm:SnoozeBalanceTooltip': { module: 'SnoozeBalanceTooltip', key: 'enabled' },
  'sm:betterFriendsStatus': { module: 'socialPanelTweaks', key: 'enabled' },
  'sm:betterFriendsStatusDebugEmber': { module: 'socialPanelTweaks', key: 'debugEmber' },
  'sm:champSelectQuitButton': { module: 'champSelectQuitButton', key: 'enabled' },
  'sm:customOnlineStatus': { module: 'customOnlineStatus', key: 'enabled' },
  'sm:customStatus': { module: 'customOnlineStatus', key: 'status' },
  'sm:customStatusMsg': { module: 'customOnlineStatus', key: 'statusMsg' },
  'sm:gameAnalysisPopup': { module: 'gameAnalysisPopup', key: 'enabled' },
  'sm:hotkey': { module: 'core', key: 'hotkey' },
  'sm:lowPrioWarningSuppress': { module: 'lowPrioWarningSuppress', key: 'enabled' },
  'sm:lowPrioWarningSuppressMode': { module: 'lowPrioWarningSuppress', key: 'mode' },
  'sm:whaleHelper': { module: 'whaleHelper', key: 'lootHelperEnabled' },
  'sm:skinTierDisplay': { module: 'whaleHelper', key: 'skinTierEnabled' },
}

export const SNOOZE_MODERN_KEY = 'Snooze-Store'
export const SNOOZE_LEGACY_TEMP_KEY = 'Snooze-Modules'

/** Abstracts over window.DataStore so this stays testable without a browser. */
export interface DataStoreReader {
  has(key: string): boolean
  get<T = any>(key: string, fallback?: T): T | undefined
}

export type ModuleSettingsMap = Record<string, Record<string, unknown>>

export interface MigratedStore {
  schemaVersion: 2
  migratedAt: number
  modules: ModuleSettingsMap
}

export interface MigrationResult {
  store: MigratedStore
  warnings: string[]
  /** How many individual module.key fields were populated, from any source. */
  migratedFieldCount: number
  /** How many came specifically from the legacy `sm:*` key scan. */
  legacyKeyCount: number
}

function coerceLegacyValue(raw: unknown): unknown {
  if (typeof raw === 'string' && (raw.startsWith('{') || raw.startsWith('['))) {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
  return raw
}

function countFields(modules: ModuleSettingsMap): number {
  let n = 0
  for (const mod of Object.values(modules)) n += Object.keys(mod).length
  return n
}

/**
 * Pure, idempotent: running this twice against the same reader produces
 * the same result (modulo `migratedAt`). Does not decide whether a
 * migration is needed — the caller checks the target store's own
 * schemaVersion first and skips calling this at all if it's already >= 2.
 */
export function migrateSnoozeStore(reader: DataStoreReader): MigrationResult {
  const warnings: string[] = []
  const modules: ModuleSettingsMap = {}

  // 1. Base: the deprecated temp key, if the modern key was never written
  //    (mirrors Store._load()'s Snooze-Modules -> Snooze-Store promotion).
  if (reader.has(SNOOZE_LEGACY_TEMP_KEY) && !reader.has(SNOOZE_MODERN_KEY)) {
    const legacy = reader.get<Record<string, unknown>>(SNOOZE_LEGACY_TEMP_KEY)
    if (legacy && typeof legacy === 'object') {
      for (const [moduleId, value] of Object.entries(legacy)) {
        if (moduleId === 'schemaVersion') continue
        if (value && typeof value === 'object') {
          modules[moduleId] = { ...(value as Record<string, unknown>) }
        }
      }
    } else {
      warnings.push(`${SNOOZE_LEGACY_TEMP_KEY} exists but is not an object — skipped.`)
    }
  }

  // 2. The modern key, wholesale, taking priority over the temp key above.
  if (reader.has(SNOOZE_MODERN_KEY)) {
    const modern = reader.get<Record<string, unknown>>(SNOOZE_MODERN_KEY)
    if (modern && typeof modern === 'object') {
      for (const [moduleId, value] of Object.entries(modern)) {
        if (moduleId === 'schemaVersion') continue
        if (value && typeof value === 'object') {
          modules[moduleId] = { ...(modules[moduleId] || {}), ...(value as Record<string, unknown>) }
        }
      }
    } else {
      warnings.push(`${SNOOZE_MODERN_KEY} exists but is not an object — skipped.`)
    }
  }

  // 3. Legacy sm:* keys fill in anything the modern/temp stores didn't
  //    already cover — for users who never made it past Snooze 1.0.x.
  let legacyKeyCount = 0
  for (const [oldKey, target] of Object.entries(LEGACY_MIGRATION_MAP)) {
    if (!reader.has(oldKey)) continue

    const already = modules[target.module]?.[target.key]
    if (already !== undefined) continue

    const value = coerceLegacyValue(reader.get(oldKey))
    if (!modules[target.module]) modules[target.module] = {}
    modules[target.module][target.key] = value
    legacyKeyCount++
  }

  const migratedFieldCount = countFields(modules)

  return {
    store: {
      schemaVersion: 2,
      migratedAt: Date.now(),
      modules,
    },
    warnings,
    migratedFieldCount,
    legacyKeyCount,
  }
}
