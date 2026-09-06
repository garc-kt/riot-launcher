import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createLoaderI18n, LOADER_LANGUAGES } from '../packages/i18n/src/index.ts'
import en from '../packages/i18n/locales/loader/en.json' with { type: 'json' }
import vi from '../packages/i18n/locales/loader/vi.json' with { type: 'json' }

const CATALOGS = { en, vi }

describe('Loader i18n catalogs', () => {
  test('every locale is declared in LOADER_LANGUAGES and vice versa', () => {
    const declaredIds = LOADER_LANGUAGES.map(l => l.id).sort()
    const catalogIds = Object.keys(CATALOGS).sort()
    assert.deepEqual(declaredIds, catalogIds)
  })

  test('no message contains legacy {{handlebars}} interpolation syntax', () => {
    for (const [locale, messages] of Object.entries(CATALOGS)) {
      for (const [key, value] of Object.entries(messages)) {
        assert.doesNotMatch(
          value,
          /\{\{/,
          `${locale}.json key "${key}" still uses {{...}} — vue-i18n uses single-brace {param}`
        )
      }
    }
  })

  test('every non-English locale key exists in en.json (no orphaned/stale keys)', () => {
    const enKeys = new Set(Object.keys(en))
    for (const [locale, messages] of Object.entries(CATALOGS)) {
      if (locale === 'en') continue
      for (const key of Object.keys(messages)) {
        assert.ok(
          enKeys.has(key),
          `${locale}.json has key "${key}" that does not exist in en.json — likely stale after an English string was reworded`
        )
      }
    }
  })

  test('every message in every locale compiles under vue-i18n (no unescaped | or @ syntax errors)', () => {
    for (const locale of Object.keys(CATALOGS)) {
      const i18n = createLoaderI18n(locale)
      i18n.global.locale.value = locale
      for (const key of Object.keys(CATALOGS[locale])) {
        assert.doesNotThrow(() => {
          const result = i18n.global.t(key)
          assert.equal(typeof result, 'string')
        }, `${locale}.json key "${key}" failed to compile/render under vue-i18n`)
      }
    }
  })

  test('falls back to English for a locale missing a key', () => {
    const i18n = createLoaderI18n('vi')
    i18n.global.locale.value = 'vi'
    // "Settings" is not translated in vi.json — should fall back to en.json's value.
    assert.equal(i18n.global.t('Settings'), en['Settings'])
  })

  test('unknown locale falls back to en at creation time', () => {
    const i18n = createLoaderI18n('xx-not-a-real-locale')
    assert.equal(i18n.global.locale.value, 'en')
  })
})
