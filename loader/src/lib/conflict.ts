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
      return `Detected existing upstream PenguLoader installation at "${penguPath}". Both proxy system DLLs and cannot coexist. Please remove upstream PenguLoader before installing Companion Loader.`
    }
  }

  // 2. Check IFEO debugger entry
  if (ifeoDebugger) {
    const lower = ifeoDebugger.toLowerCase()
    const ourCoreLower = ourCorePath.toLowerCase()
    if (lower.includes('pengu') || (lower.startsWith('rundll32') && !lower.includes(ourCoreLower))) {
      return `Detected conflicting IFEO debugger entry: "${ifeoDebugger}". Please uninstall existing loader before activating Companion Loader.`
    }
  }

  // 3. Check proxy DLL target in League directory
  if (leagueProxyDllTarget) {
    const targetNorm = leagueProxyDllTarget.toLowerCase().replace(/\//g, '\\')
    const ourNorm = ourCorePath.toLowerCase().replace(/\//g, '\\')
    if (targetNorm !== ourNorm) {
      return `Detected conflicting proxy DLL pointing to "${leagueProxyDllTarget}". Please remove it before proceeding.`
    }
  }

  return null
}
