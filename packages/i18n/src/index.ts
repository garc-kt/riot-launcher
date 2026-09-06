import { createI18n } from 'vue-i18n'
import en from '../locales/loader/en.json' with { type: 'json' }
import vi from '../locales/loader/vi.json' with { type: 'json' }

// vue-i18n v9. Message-key = English source text (not a semantic id) — the
// scheme is picked for the volume this catalog is meant to grow to once
// Snooze Manager's ~4,000-string locale files are converted onto it (see
// the enhancement plan, Phase 5/7). A loader key is just its own English
// sentence; an unmapped key in another locale is exactly what should render
// if nobody has translated that sentence yet, so missing/fallback warnings
// are deliberately silenced rather than logged as errors.
//
// Compiler-syntax note for future content added here: vue-i18n's message
// compiler treats `|` (plural rules) and `@` (linked messages) as syntax.
// A literal `|` or `@` in a message must be escaped as `{'|'}` / `{'@'}`.
// None of the strings below need it; this note is for whoever adds the
// next locale (Snooze's converted catalogs will need a one-shot pass for
// exactly this).

export const LOADER_LANGUAGES = [
  { id: 'en', name: 'English' },
  { id: 'vi', name: 'Tiếng Việt' },
] as const

export type LoaderLocale = (typeof LOADER_LANGUAGES)[number]['id']

const messages = { en, vi }

export function createLoaderI18n(initialLocale: string = 'en') {
  return createI18n({
    legacy: false,
    locale: LOADER_LANGUAGES.some(l => l.id === initialLocale) ? initialLocale : 'en',
    fallbackLocale: 'en',
    messages,
    missingWarn: false,
    fallbackWarn: false,
  })
}

export type LoaderI18n = ReturnType<typeof createLoaderI18n>
