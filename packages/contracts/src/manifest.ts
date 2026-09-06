import { parse as parseYaml } from '@std/yaml'
import { z } from 'zod'

const AuthorSchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    github: z.string().optional(),
    discord: z.string().optional(),
    url: z.string().optional(),
  }),
])

/**
 * pengu.yml schema. `.passthrough()` so fields added by a newer upstream
 * manifest spec survive round-tripping instead of being silently dropped.
 * Every field beyond `name` is optional — a manifest is a richer alternative
 * to JSDoc tags, not a stricter requirement.
 */
export const PluginManifestSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  version: z.string().optional(),
  description: z.string().optional(),
  author: AuthorSchema.optional(),
  repo: z.string().optional(),
  link: z.string().optional(),
  tags: z.array(z.string()).optional(),
  theme: z.boolean().optional(),
  // `main` is parsed and validated, but never used to change what gets
  // loaded — the entry-point convention (index.js / top-level *.js) is
  // fixed by the C++ core's own scanner (renderer.cc get_plugin_entries),
  // which has no knowledge of any manifest. A `main` that isn't index.js
  // just produces a warning so the mismatch is visible, not silently
  // ignored and not honored either.
  main: z.string().optional(),
  install: z.object({
    release: z.string().optional(),
  }).optional(),
  i18n: z.object({
    locales: z.array(z.string()).optional(),
    default: z.string().optional(),
  }).optional(),
  riot: z.object({
    activeDuringGame: z.boolean().optional(),
  }).optional(),
}).passthrough()

export type PluginManifest = z.infer<typeof PluginManifestSchema>

export interface ManifestParseResult {
  success: boolean
  data?: PluginManifest
  warnings: string[]
  error?: string
}

/**
 * Parse and validate a pengu.yml's raw text. Pure — no filesystem access,
 * so the file-resolution order (pengu.yml -> pengu.yaml -> manifest.yml)
 * and JSDoc fallback live in the caller (loader/src/lib/plugins.ts), which
 * has the Tauri fs APIs this can't use if it's to stay Node-testable.
 */
export function parseManifest(yamlText: string): ManifestParseResult {
  const warnings: string[] = []

  let raw: unknown
  try {
    raw = parseYaml(yamlText)
  } catch (err) {
    return {
      success: false,
      warnings,
      error: `Invalid YAML: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const result = PluginManifestSchema.safeParse(raw)
  if (!result.success) {
    return {
      success: false,
      warnings,
      error: result.error.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
    }
  }

  const data = result.data
  if (data.main && data.main !== 'index.js') {
    warnings.push(
      `manifest declares main: "${data.main}", but the entry-point convention is fixed at index.js — this is ignored.`
    )
  }

  return { success: true, data, warnings }
}

/** Normalize the author field to a display string, e.g. for a gallery card. */
export function formatManifestAuthor(author: PluginManifest['author']): string | undefined {
  if (!author) return undefined
  if (typeof author === 'string') return author
  return author.name
}
