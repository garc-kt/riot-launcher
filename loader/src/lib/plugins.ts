import { join } from '@tauri-apps/api/path'
import { exists, readTextFile, writeTextFile, readDir, createDir } from '@tauri-apps/api/fs'
import { Shell } from './shell'
import { Config } from './config'
import { getHash } from './utils'
import {
  parseManifest,
  formatManifestAuthor,
  classifyPluginEntry,
  type PluginEntryStatus,
  type SerializedModuleSchema,
} from '@riot/contracts'

export interface PluginInfo {
  name: string
  version?: string
  description?: string
  author?: string
  link?: string
  tags?: string[]

  path: string
  entryPath: string
  hash: number

  status: PluginEntryStatus
  manifestSource: 'manifest' | 'jsdoc' | 'none'
  warnings: string[]
}

const MANIFEST_FILENAMES = ['pengu.yml', 'pengu.yaml', 'manifest.yml']

export const PluginManager = new class {

  private disabledSet = new Set<number>()

  private getDir() {
    let path = Config.get('app', 'plugins_dir', '')
    if (!path || path.startsWith('.')) {
      path = Config.basePath('plugins')
    }
    return path
  }

  async openFolder() {
    const dir = this.getDir()
    if (!await exists(dir)) {
      await createDir(dir, {
        recursive: true
      })
    }
    await Shell.expandFolder(dir)
  }

  /**
   * Get all plugins.
   */
  async getPlugins() {
    const dir = this.getDir()
    const plugins = Array<PluginInfo>()

    this.disabledSet = this.fetchDisabledSet()

    function push(name: string, dirPath: string | null, entry: string, status: PluginEntryStatus) {
      const dir2 = dir.replace(/\\/g, '/')
      const url = entry.replace(/\\/g, '/')

      const shortPath = url.replace(dir2, '').substring(1)
      const hash = getHash(shortPath.toLowerCase())

      plugins.push({
        name,
        path: shortPath,
        entryPath: entry,
        hash,
        status,
        manifestSource: 'none',
        warnings: [],
      })

      return { dirPath, plugin: plugins[plugins.length - 1] }
    }

    const pending: Array<{ dirPath: string | null; plugin: PluginInfo }> = []

    if (await exists(dir)) {
      const ref = { entry: '', status: 'invalid' as PluginEntryStatus }
      for (const file of await readDir(dir)) {
        if (file.children) {
          // scan @author folder
          if (file.name!.startsWith('@')) {
            for (let subdir of await readDir(file.path)) {
              // subfolder plugin that contains index.js
              if (subdir.children
                && this.allowedName(subdir.name)
                && await this.hasIndex(subdir.path, ref)) {
                const name = `${file.name}/${subdir.name}`
                pending.push(push(name, subdir.path, ref.entry, ref.status))
              }
            }
          }
          // subfolder plugin that contains index.js
          else if (this.allowedName(file.name) && await this.hasIndex(file.path, ref)) {
            pending.push(push(file.name!, file.path, ref.entry, ref.status))
          }
        }
        // top-level file plugin — no directory, so no manifest is possible
        else if (this.allowedName(file.name) && await this.isTopLevelIndex(file.path, ref)) {
          const name = file.name!.substring(0, file.name!.lastIndexOf('.'))
          pending.push(push(name, null, file.path, ref.status))
        }
      }

      // resolve metadata: manifest first, JSDoc fallback, skip the entry
      // file read entirely when a manifest already answered everything
      for (const { dirPath, plugin } of pending) {
        const gotManifest = dirPath ? await this.applyManifest(dirPath, plugin) : false
        if (!gotManifest) {
          await this.applyJsdocFallback(plugin)
        }
      }
    }

    return plugins
  }

  isEnabled(hash: number) {
    return !this.disabledSet.has(hash)
  }

  async toggleState(hash: number) {
    if (this.disabledSet.has(hash)) {
      this.disabledSet.delete(hash)
    } else {
      this.disabledSet.add(hash)
    }

    const value = [...this.disabledSet].map(x => x.toString(16)).join()
    Config.set('app', 'disabled_plugins', value)
    await Config.save()

    return this.isEnabled(hash)
  }

  private allowedName(name?: string) {
    return typeof name === 'string'
      && !name.startsWith('_')
      && !name.startsWith('.')
  }

  /**
   * Check both the exact entry path and its `_`-disabled variant so the
   * caller can classify the result (active / disabled-on-disk / invalid)
   * instead of the old short-circuiting isIndex(), which only ever learned
   * "some variant exists" and could never tell the two apart.
   */
  private async classifyEntry(path: string, ref: { entry: string; status: PluginEntryStatus }) {
    const jsExists = path.endsWith('.js') && await exists(path)
    const jsDisabledExists = await exists(path + '_')
    const status = classifyPluginEntry({ jsExists, jsDisabledExists })

    if (status !== 'invalid') {
      ref.entry = jsExists ? path : path + '_'
      ref.status = status
      return true
    }
    return false
  }

  private async hasIndex(dir: string, ref: { entry: string; status: PluginEntryStatus }) {
    const path = await join(dir, 'index.js')
    return await this.classifyEntry(path, ref)
  }

  private async isTopLevelIndex(path: string, ref: { entry: string; status: PluginEntryStatus }) {
    return await this.classifyEntry(path, ref)
  }

  /**
   * Try pengu.yml -> pengu.yaml -> manifest.yml in the plugin's own
   * directory. Returns true if a valid manifest was found and applied
   * (in which case the caller skips the JSDoc fallback + entry file read).
   */
  private async applyManifest(dirPath: string, plugin: PluginInfo): Promise<boolean> {
    for (const filename of MANIFEST_FILENAMES) {
      const manifestPath = await join(dirPath, filename)
      if (!await exists(manifestPath)) continue

      let text: string
      try {
        text = await readTextFile(manifestPath)
      } catch {
        continue
      }

      const result = parseManifest(text)
      plugin.warnings.push(...result.warnings)

      if (!result.success || !result.data) {
        plugin.warnings.push(`${filename}: ${result.error}`)
        return false
      }

      const data = result.data
      plugin.name = data.name || plugin.name
      if (data.version) plugin.version = data.version
      if (data.description) plugin.description = data.description
      const author = formatManifestAuthor(data.author)
      if (author) plugin.author = author
      if (data.link) plugin.link = data.link
      else if (data.repo) plugin.link = data.repo
      if (data.tags) plugin.tags = data.tags
      plugin.manifestSource = 'manifest'
      return true
    }
    return false
  }

  private async applyJsdocFallback(plugin: PluginInfo) {
    if (!await exists(plugin.entryPath)) return

    const content = await readTextFile(plugin.entryPath)
    const name = this.getTagValue(content, 'name')
    const version = this.getTagValue(content, 'version')
    const description = this.getTagValue(content, 'description')
    const author = this.getTagValue(content, 'author')
    const link = this.getTagValue(content, 'link')

    let found = false

    if (name) { plugin.name = name; found = true }
    if (version) { plugin.version = version; found = true }
    if (description) { plugin.description = description; found = true }
    if (author) {
      plugin.author = author.includes('#') ? author : '@' + author
      found = true
    }
    if (link.startsWith('https://')) { plugin.link = link; found = true }

    plugin.manifestSource = found ? 'jsdoc' : 'none'
  }

  // Parse @tag in jsdoc
  private getTagValue(jsdoc: string, tag: string) {
    const regex = new RegExp(`@${tag}\\s+(.+)`)
    const match = regex.exec(jsdoc)
    if (match) {
      return match[1].trim()
    }
    return ''
  }

  private fetchDisabledSet() {
    const set = new Set<number>()
    const rawSet = <string>Config.get('app', 'disabled_plugins', '')
    const hashes = rawSet.split(',')

    for (const hash of hashes) {
      const num = parseInt(hash.trim(), 16)
      if (num) set.add(num)
    }

    return set
  }

  /**
   * Load schema.json for a plugin from plugins_data/<id>.schema.json or plugins_data/<dir>/
   */
  async getPluginSchema(plugin: PluginInfo): Promise<SerializedModuleSchema | null> {
    try {
      const unscoped = plugin.name.replace(/^@.*?\//, '')
      const candidates = [
        Config.basePath(`plugins_data/${plugin.name}.schema.json`),
        Config.basePath(`plugins_data/${plugin.path}.schema.json`),
        Config.basePath(`plugins_data/${unscoped}.schema.json`),
        Config.basePath(`plugins_data/${plugin.name}/schema.json`),
        Config.basePath(`plugins_data/${plugin.path}/schema.json`),
        Config.basePath(`plugins_data/${unscoped}/schema.json`),
      ]
      for (const p of candidates) {
        if (await exists(p)) {
          const raw = await readTextFile(p)
          return JSON.parse(raw) as SerializedModuleSchema
        }
      }

      // Check directory for individual module schemas (e.g. plugins_data/<plugin>/*.schema.json)
      const dirCandidates = [
        Config.basePath(`plugins_data/${plugin.name}`),
        Config.basePath(`plugins_data/${plugin.path}`),
        Config.basePath(`plugins_data/${unscoped}`),
      ]
      for (const dir of dirCandidates) {
        if (await exists(dir)) {
          const entries = await readDir(dir).catch(() => [])
          const schemaFiles = entries.filter((e) => e.name?.endsWith('.schema.json') && !e.children)
          if (schemaFiles.length > 0) {
            const combinedSettings: any[] = []
            for (const file of schemaFiles) {
              if (!file.path) continue
              try {
                const content = await readTextFile(file.path)
                const modSchema = JSON.parse(content) as SerializedModuleSchema
                if (modSchema.settings?.length) {
                  if (schemaFiles.length > 1) {
                    combinedSettings.push({
                      key: `__info_${modSchema.id}`,
                      type: 'info',
                      label: modSchema.name || modSchema.id,
                    })
                  }
                  for (const s of modSchema.settings) {
                    const key = s.key.startsWith('modules:') ? s.key : `modules:${modSchema.id}:${s.key}`
                    combinedSettings.push({ ...s, key })
                  }
                }
              } catch {}
            }
            if (combinedSettings.length > 0) {
              return {
                id: plugin.name,
                name: plugin.name,
                description: plugin.description || '',
                settings: combinedSettings,
              }
            }
          }
        }
      }
    } catch {}
    return null
  }

  /**
   * Load stored settings from plugins_data/<id>.json if available.
   */
  async getPluginValues(plugin: PluginInfo): Promise<Record<string, unknown>> {
    try {
      const unscoped = plugin.name.replace(/^@.*?\//, '')
      const candidates = [
        Config.basePath(`plugins_data/${plugin.name}.json`),
        Config.basePath(`plugins_data/${plugin.path}.json`),
        Config.basePath(`plugins_data/${unscoped}.json`),
      ]
      for (const p of candidates) {
        if (await exists(p)) {
          const raw = await readTextFile(p)
          return JSON.parse(raw) as Record<string, unknown>
        }
      }
    } catch {}
    return {}
  }

  /**
   * Save settings to plugins_data/<id>.json.
   */
  async savePluginValues(plugin: PluginInfo, values: Record<string, unknown>): Promise<boolean> {
    try {
      const dir = Config.basePath('plugins_data')
      if (!await exists(dir)) {
        await createDir(dir, { recursive: true })
      }
      const unscoped = plugin.name.replace(/^@.*?\//, '')
      const candidates = [
        Config.basePath(`plugins_data/${plugin.name}.json`),
        Config.basePath(`plugins_data/${plugin.path}.json`),
        Config.basePath(`plugins_data/${unscoped}.json`),
      ]
      let targetPath = candidates[2]
      for (const p of candidates) {
        if (await exists(p)) {
          targetPath = p
          break
        }
      }
      const raw = JSON.stringify(values, null, 2)
      await writeTextFile(targetPath, raw)
      return true
    } catch {
      return false
    }
  }
}
