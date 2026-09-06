// The companion adopts packages/ui/src/tokens.css into a shadow root
// (app/src/main.ts). Inside a shadow tree `:root` matches nothing, so any token
// declared only under `:root` is undefined there — `background: var(--hud-scrim)`
// then resolves to nothing and the HUD renders fully transparent over the League
// client, while type and layout still look correct.
//
// It cannot be caught in dev: served standalone the app mounts into a normal
// document where `:root` matches, so this only ever breaks inside the client.
// Tailwind v4 emits its own @theme layer as `:root, :host` for this exact
// reason; these bare tokens must do the same.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const tokensPath = path.join(repoRoot, 'packages', 'ui', 'src', 'tokens.css')
const css = fs.readFileSync(tokensPath, 'utf8')

/** Strip comments so prose about selectors can't satisfy or break the checks. */
const code = css.replace(/\/\*[\s\S]*?\*\//g, '')

/** Rules as [selector, body] pairs. Flat file, no nesting beyond @theme. */
function rules(source) {
  const out = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(source)) !== null) {
    out.push([m[1].trim(), m[2]])
  }
  return out
}

/** Custom properties declared by a rule body. */
function declaredVars(body) {
  return [...body.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1])
}

describe('Design tokens survive shadow-root adoption', () => {
  test('every bare token is declared under a selector including :host', () => {
    const offenders = []

    for (const [selector, body] of rules(code)) {
      if (selector.startsWith('@')) continue

      const vars = declaredVars(body)
      if (vars.length === 0) continue

      const parts = selector.split(',').map(s => s.trim())
      // A rule reachable inside a shadow tree matches the host or an element
      // within it. `:root` alone never is.
      const shadowReachable = parts.some(p => p.includes(':host')) ||
        parts.every(p => !p.includes(':root'))

      if (!shadowReachable) {
        offenders.push(`${selector} declares ${vars.slice(0, 3).join(', ')}...`)
      }
    }

    assert.deepEqual(
      offenders,
      [],
      'These rules declare tokens that a shadow root cannot see. Add :host to ' +
      `the selector list:\n  ${offenders.join('\n  ')}`,
    )
  })

  test('the HUD material tokens the companion paints with are defined', () => {
    // The panel's background/border come from these; if any goes missing the
    // HUD silently loses its material and turns transparent.
    for (const token of ['--hud-scrim', '--hud-border', '--hud-foreground']) {
      const declaring = rules(code)
        .filter(([sel]) => !sel.startsWith('@'))
        .filter(([, body]) => declaredVars(body).includes(token))

      assert.ok(declaring.length > 0, `${token} is never declared`)
      assert.ok(
        declaring.some(([sel]) => sel.includes(':host')),
        `${token} is never declared under a :host-inclusive selector, so the ` +
        'companion HUD cannot resolve it inside its shadow root',
      )
    }
  })
})
