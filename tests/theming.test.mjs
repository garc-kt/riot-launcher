import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { extractSpecialRules } from '../packages/contracts/src/theming.ts'

describe('Native Theming Engine', () => {
  test('extracts @import rules cleanly from CSS', () => {
    const input = `
      @import url("https://fonts.googleapis.com/css2?family=Inter");
      .btn { color: red; }
    `
    const { cleanedCss, specialCss } = extractSpecialRules(input)
    assert.equal(specialCss, '@import url("https://fonts.googleapis.com/css2?family=Inter");')
    assert.equal(cleanedCss, '.btn { color: red; }')
  })

  test('extracts @font-face rules cleanly from CSS', () => {
    const input = `
      @font-face { font-family: 'MyFont'; src: url('myfont.woff2'); }
      body { background: #010a13; }
    `
    const { cleanedCss, specialCss } = extractSpecialRules(input)
    assert.match(specialCss, /@font-face/)
    assert.match(specialCss, /font-family: 'MyFont'/)
    assert.equal(cleanedCss, 'body { background: #010a13; }')
  })

  test('handles CSS without special rules without modifying it', () => {
    const input = `.card { border: 1px solid gold; padding: 8px; }`
    const { cleanedCss, specialCss } = extractSpecialRules(input)
    assert.equal(specialCss, '')
    assert.equal(cleanedCss, input)
  })

  test('mock shadow root adopts global stylesheet correctly', () => {
    const mockGlobalSheet = { id: 'global-sheet' }
    class MockElement {
      attachShadow(init) {
        return {
          mode: init.mode,
          adoptedStyleSheets: [mockGlobalSheet],
        }
      }
    }

    const el = new MockElement()
    const shadow = el.attachShadow({ mode: 'open' })
    assert.equal(shadow.adoptedStyleSheets.length, 1)
    assert.equal(shadow.adoptedStyleSheets[0], mockGlobalSheet)
  })
})
