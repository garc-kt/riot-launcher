<script setup lang="ts">
/**
 * Renders a declarative SettingsSchema (packages/contracts/src/module.ts).
 * Deliberately shared between the loader and the companion (plan.md Phase
 * 13) — the loader can't call into the injected client, so it reads a
 * module's schema + current values from plugins_data/<name>.schema.json
 * and renders the SAME component. That only works if this file uses
 * nothing but the token vocabulary both apps already import — no
 * .riot-* or .hud-* component classes, which are workspace-specific.
 */
import type { SettingsSchema, SettingField } from '@riot/contracts'

const props = defineProps<{
  schema: SettingsSchema
  /** Current value per field key. */
  values: Record<string, unknown>
  /** Optional: resolves a 'custom' field's component by name. Fields with
   *  no match here are skipped — no render(el) DOM callback ever runs. */
  customComponents?: Record<string, any>
}>()

const emit = defineEmits<{
  (e: 'change', key: string, value: unknown): void
}>()

function valueOf(field: SettingField) {
  const v = props.values[field.key]
  return v !== undefined ? v : (field as any).default
}

function onToggle(field: SettingField, e: Event) {
  emit('change', field.key, (e.target as HTMLInputElement).checked)
}

function onSelect(field: SettingField, e: Event) {
  emit('change', field.key, (e.target as HTMLSelectElement).value)
}

function onNumber(field: SettingField, e: Event) {
  const n = Number((e.target as HTMLInputElement).value)
  if (!Number.isNaN(n)) emit('change', field.key, n)
}

function onText(field: SettingField, e: Event) {
  emit('change', field.key, (e.target as HTMLInputElement | HTMLTextAreaElement).value)
}

function onHotkey(field: SettingField, e: KeyboardEvent) {
  e.preventDefault()
  emit('change', field.key, {
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey,
    altKey: e.altKey,
    metaKey: e.metaKey,
    code: e.code,
    display: e.code,
  })
}
</script>

<template>
  <div class="ssr-root">
    <div v-for="field in schema" :key="field.key" class="ssr-row">
      <template v-if="field.type === 'toggle'">
        <label class="ssr-label-row">
          <input type="checkbox" class="ssr-checkbox" :checked="Boolean(valueOf(field))" @change="onToggle(field, $event)" />
          <div class="ssr-label-text">
            <span class="ssr-label">{{ field.label() }}</span>
            <p v-if="field.description" class="ssr-description">{{ field.description() }}</p>
          </div>
        </label>
      </template>

      <template v-else-if="field.type === 'select'">
        <div class="ssr-field">
          <span class="ssr-label">{{ field.label() }}</span>
          <select class="ssr-input" :value="valueOf(field)" @change="onSelect(field, $event)">
            <option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label() }}</option>
          </select>
        </div>
      </template>

      <template v-else-if="field.type === 'number'">
        <div class="ssr-field">
          <span class="ssr-label">{{ field.label() }}</span>
          <input
            type="number"
            class="ssr-input"
            :value="valueOf(field)"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            @change="onNumber(field, $event)"
          />
        </div>
      </template>

      <template v-else-if="field.type === 'text'">
        <div class="ssr-field">
          <span class="ssr-label">{{ field.label() }}</span>
          <input
            type="text"
            class="ssr-input"
            :value="valueOf(field)"
            :placeholder="field.placeholder?.()"
            @change="onText(field, $event)"
          />
        </div>
      </template>

      <template v-else-if="field.type === 'textarea'">
        <div class="ssr-field">
          <span class="ssr-label">{{ field.label() }}</span>
          <textarea
            class="ssr-input ssr-textarea"
            :value="valueOf(field) as string"
            :placeholder="field.placeholder?.()"
            @change="onText(field, $event)"
          />
        </div>
      </template>

      <template v-else-if="field.type === 'hotkey'">
        <div class="ssr-field">
          <span class="ssr-label">{{ field.label() }}</span>
          <input
            type="text"
            class="ssr-input"
            readonly
            :value="(valueOf(field) as any)?.display || ''"
            placeholder="Click and press a key"
            @keydown="onHotkey(field, $event)"
          />
        </div>
      </template>

      <template v-else-if="field.type === 'info'">
        <p class="ssr-info">{{ field.label() }}</p>
      </template>

      <template v-else-if="field.type === 'custom'">
        <component
          :is="customComponents?.[field.component]"
          v-if="customComponents?.[field.component]"
          :field="field"
          :value="valueOf(field)"
          @change="(v: unknown) => emit('change', field.key, v)"
        />
      </template>
    </div>
  </div>
</template>
