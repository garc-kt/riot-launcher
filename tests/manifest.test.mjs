import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseManifest, formatManifestAuthor } from '../packages/contracts/src/manifest.ts'
import { classifyPluginEntry } from '../packages/contracts/src/plugin-entry.ts'

describe('pengu.yml manifest parsing', () => {
  test('parses Snooze Manager\'s real pengu.yml (object-form author)', () => {
    const yaml = `
id: snooze-manager
name: Snooze-Manager
description: Modular plugin manager
version: 1.1.0

repo: https://github.com/ReformedDoge/Snooze-Manager

author:
  name: SnoozeFest
  github: ReformedDoge

theme: false
tags: [plugin, manager, toolkit]

install:
  release: "Snooze-Manager-*.zip"
`
    const result = parseManifest(yaml)
    assert.equal(result.success, true)
    assert.equal(result.data.id, 'snooze-manager')
    assert.equal(result.data.name, 'Snooze-Manager')
    assert.equal(result.data.version, '1.1.0')
    assert.deepEqual(result.data.tags, ['plugin', 'manager', 'toolkit'])
    assert.equal(result.data.theme, false)
    assert.equal(result.data.install.release, 'Snooze-Manager-*.zip')
    assert.equal(formatManifestAuthor(result.data.author), 'SnoozeFest')
    assert.deepEqual(result.warnings, [])
  })

  test('parses the companion\'s manifest (string-form author)', () => {
    const yaml = `
name: Riot Companion
version: 1.0.3
author: Companion
description: First-party LoL Companion Platform client application
main: index.js
`
    const result = parseManifest(yaml)
    assert.equal(result.success, true)
    assert.equal(result.data.name, 'Riot Companion')
    assert.equal(formatManifestAuthor(result.data.author), 'Companion')
    // main: index.js matches the fixed convention — no warning
    assert.deepEqual(result.warnings, [])
  })

  test('warns (but still succeeds) when main is not index.js — advisory only, never honored', () => {
    const yaml = `
name: Weird Plugin
main: entrypoint.js
`
    const result = parseManifest(yaml)
    assert.equal(result.success, true)
    assert.equal(result.data.main, 'entrypoint.js')
    assert.equal(result.warnings.length, 1)
    assert.match(result.warnings[0], /entry-point convention is fixed at index\.js/)
  })

  test('unknown fields survive via passthrough (forward-compat with upstream manifest evolution)', () => {
    const yaml = `
name: Future Plugin
someBrandNewField: hello
`
    const result = parseManifest(yaml)
    assert.equal(result.success, true)
    assert.equal(result.data.someBrandNewField, 'hello')
  })

  test('rejects malformed YAML with a clear error, not a throw', () => {
    const malformed = `
name: Broken
  bad indent: [unclosed
`
    const result = parseManifest(malformed)
    assert.equal(result.success, false)
    assert.ok(result.error)
  })

  test('rejects a manifest missing the only required field (name)', () => {
    const yaml = `
description: No name here
`
    const result = parseManifest(yaml)
    assert.equal(result.success, false)
    assert.match(result.error, /name/)
  })

  test('i18n and riot metadata blocks parse when present', () => {
    const yaml = `
name: Locale Plugin
i18n:
  locales: [en, es, fr]
  default: en
riot:
  activeDuringGame: true
`
    const result = parseManifest(yaml)
    assert.equal(result.success, true)
    assert.deepEqual(result.data.i18n.locales, ['en', 'es', 'fr'])
    assert.equal(result.data.riot.activeDuringGame, true)
  })
})

describe('plugin entry classification (.js_ disabled-on-disk)', () => {
  test('active when the exact index.js exists', () => {
    const status = classifyPluginEntry({ jsExists: true, jsDisabledExists: false })
    assert.equal(status, 'active')
  })

  test('disabled-on-disk when only the _-suffixed variant exists', () => {
    const status = classifyPluginEntry({ jsExists: false, jsDisabledExists: true })
    assert.equal(status, 'disabled-on-disk')
  })

  test('invalid when neither variant exists', () => {
    const status = classifyPluginEntry({ jsExists: false, jsDisabledExists: false })
    assert.equal(status, 'invalid')
  })

  test('active takes priority if somehow both exist', () => {
    const status = classifyPluginEntry({ jsExists: true, jsDisabledExists: true })
    assert.equal(status, 'active')
  })
})
