import { useI18n as useVueI18n } from 'vue-i18n'
import { LOADER_LANGUAGES } from '@riot/i18n'
import { useConfig } from './config'

/**
 * Thin wrapper over vue-i18n's own composable: syncs the active locale from
 * the persisted `[app] language` config setting (so switching language on
 * the welcome screen actually sticks), and exposes the language list for
 * the picker. Must be called during a component's synchronous setup(), same
 * as vue-i18n's own useI18n() — the returned `t` is a stable reference safe
 * to call later from async handlers (e.g. a dialog.message() callback).
 */
export const useI18n = () => {
  const i18n = useVueI18n()
  const config = useConfig()

  const configLang = config.app.language()
  if (configLang && i18n.locale.value !== configLang) {
    i18n.locale.value = configLang
  }

  return {
    t: i18n.t,
    locale: i18n.locale,
    languages: LOADER_LANGUAGES,
    switchTo: (id: string) => {
      i18n.locale.value = id
    },
  }
}
