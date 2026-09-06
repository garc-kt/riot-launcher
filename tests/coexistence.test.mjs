import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { detectUpstreamConflict } from '../packages/contracts/src/conflict.ts'

describe('Upstream Coexistence Conflict Detection (§9.1)', () => {
  test('refuses to activate when Pengu Loader directory exists', () => {
    const err = detectUpstreamConflict({
      dirExists: (path) => path.includes('Pengu Loader'),
    })
    assert.match(err, /Detected existing upstream PenguLoader installation/)
  })

  test('refuses to activate when IFEO debugger points to upstream PenguLoader', () => {
    const err = detectUpstreamConflict({
      ifeoDebugger: 'rundll32 "C:\\Program Files\\Pengu Loader\\core.dll", #6000',
    })
    assert.match(err, /conflicting IFEO debugger entry/)
  })

  test('refuses to activate when proxy DLL in League folder points to upstream loader', () => {
    const err = detectUpstreamConflict({
      leagueProxyDllTarget: 'C:\\Program Files\\Pengu Loader\\core.dll',
      ourCorePath: 'C:\\Companion\\core.dll',
    })
    assert.match(err, /Detected conflicting proxy DLL/)
  })

  test('allows activation when no conflicting upstream installation exists', () => {
    const err = detectUpstreamConflict({
      dirExists: () => false,
      ifeoDebugger: '',
      leagueProxyDllTarget: '',
    })
    assert.equal(err, null)
  })

  test('allows activation when IFEO debugger points to previous version of Riot Loader', () => {
    const err = detectUpstreamConflict({
      ifeoDebugger: 'rundll32 "C:\\Users\\Perseus\\Downloads\\riot-loader-v1.0.0-windows-x64\\core.dll", #6000',
      ourCorePath: 'C:\\Users\\Perseus\\Downloads\\riot-loader-v1.0.3-windows-x64\\core.dll',
    })
    assert.equal(err, null)
  })

  test('allows activation when proxy DLL points to previous version of Riot Loader', () => {
    const err = detectUpstreamConflict({
      leagueProxyDllTarget: 'C:\\Users\\Perseus\\Downloads\\riot-loader-v1.0.0-windows-x64\\core.dll',
      ourCorePath: 'C:\\Users\\Perseus\\Downloads\\riot-loader-v1.0.3-windows-x64\\core.dll',
    })
    assert.equal(err, null)
  })
})
