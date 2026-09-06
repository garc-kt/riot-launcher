/**
 * TEST-ONLY MIRROR — this file does not ship. The Rust implementation at
 * `loader/src-tauri/src/windows/utils.rs::detect_upstream_conflict()` is what
 * actually runs (invoked via `plugin:windows|core_check_upstream_conflict`);
 * this TS copy exists only so `tests/coexistence.test.mjs` can exercise the
 * decision logic without a Windows build. Any change to the Rust function's
 * conditions (directory list, IFEO substring checks, proxy-DLL comparison)
 * MUST be mirrored here in the same commit, or the test suite silently stops
 * proving anything about what ships.
 */
export interface ConflictCheckOptions {
  checkDirs?: string[]
  dirExists?: (path: string) => boolean
  ifeoDebugger?: string
  leagueProxyDllTarget?: string
  ourCorePath?: string
}

/**
 * Detect existing upstream PenguLoader installation to prevent conflicts (§9.1)
 */
export function detectUpstreamConflict(options: ConflictCheckOptions = {}): string | null {
  const {
    checkDirs = [
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      'C:\\Users\\Default\\AppData\\Local',
    ],
    dirExists = () => false,
    ifeoDebugger = '',
    leagueProxyDllTarget = '',
    ourCorePath = 'C:\\Companion\\core.dll',
  } = options

  // 1. Check known directories
  for (const base of checkDirs) {
    if (!base) continue
    const cleanBase = base.replace(/[\\/]+$/, '')
    const penguPath = `${cleanBase}\\Pengu Loader`
    if (dirExists(penguPath)) {
      return `Detected existing upstream PenguLoader installation at "${penguPath}". Both proxy system DLLs and cannot coexist. Please remove upstream PenguLoader before installing Riot Loader.`
    }
  }

  // 2. Check IFEO debugger entry
  if (ifeoDebugger) {
    const lower = ifeoDebugger.toLowerCase()
    const ourCoreLower = ourCorePath.toLowerCase()
    const isRiotLoader = lower.includes('riot-loader') || lower.includes('riot loader') || lower.includes('riot_loader')
    if (lower.includes('pengu') || (lower.startsWith('rundll32') && !lower.includes(ourCoreLower) && !isRiotLoader)) {
      return `Detected conflicting IFEO debugger entry: "${ifeoDebugger}". Please uninstall existing loader before activating Riot Loader.`
    }
  }

  // 3. Check proxy DLL target in League directory
  if (leagueProxyDllTarget) {
    const targetNorm = leagueProxyDllTarget.toLowerCase().replace(/\//g, '\\')
    const ourNorm = ourCorePath.toLowerCase().replace(/\//g, '\\')
    const isRiotLoader = targetNorm.includes('riot-loader') || targetNorm.includes('riot loader') || targetNorm.includes('riot_loader')
    if (targetNorm !== ourNorm && !isRiotLoader) {
      return `Detected conflicting proxy DLL pointing to "${leagueProxyDllTarget}". Please remove it before proceeding.`
    }
  }

  return null
}
