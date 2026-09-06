import { reactive } from 'vue'
import translations from '../../translations.json'
import { useConfig } from './config'

const EN = translations.languages[0]
type TranslationKey = keyof typeof EN.translations
type TranslationMap = Record<TranslationKey, string>

const current = reactive<TranslationMap>({ ...EN.translations })

const languages = translations.languages.map((x) => ({
  id: x.id,
  name: x.name,
}))

const switchTo = (id: string) => {
  for (const lang of translations.languages) {
    if (lang.id === id) {
      Object.assign(current, lang.translations)
      break
    }
  }
}

const text = (key: TranslationKey): string => {
  if (key in current) {
    return current[key]
  }
  return `{{${key}}}`
}

const _i18n = {
  languages,
  switchTo,
  t: text,
}

export const useI18n = () => {
  _i18n.switchTo(useConfig().app.language())
  return _i18n
}