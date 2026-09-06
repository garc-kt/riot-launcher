export type PluginEntryStatus = 'active' | 'disabled-on-disk' | 'invalid'

export interface ClassifyPluginEntryInput {
  /** Does the exact entry file (e.g. `index.js`) exist? */
  jsExists: boolean
  /** Does the `_`-suffixed disabled variant (e.g. `index.js_`) exist? */
  jsDisabledExists: boolean
}

/**
 * `foo.js_` is upstream's convention for a deliberately disabled entry —
 * the C++ core's scanner (renderer.cc get_plugin_entries) only ever looks
 * for the exact `.js` name, so a `.js_` file is invisible to it and never
 * loads. The loader's own discovery used to treat `.js_` as an equally
 * valid entry (folding it into the same "found a plugin" path as `.js`),
 * which showed a disabled-on-disk plugin as ACTIVE in the gallery — this
 * is the fix: a distinct status the UI can render correctly, with a
 * "rename to enable" affordance instead of a misleading toggle.
 */
export function classifyPluginEntry({ jsExists, jsDisabledExists }: ClassifyPluginEntryInput): PluginEntryStatus {
  if (jsExists) return 'active'
  if (jsDisabledExists) return 'disabled-on-disk'
  return 'invalid'
}
