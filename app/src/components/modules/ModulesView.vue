<script setup lang="ts">
import { computed, reactive } from 'vue'
import { SettingsSchemaRenderer } from '@riot/ui'
import { getModuleHost } from '@/modules'

const host = getModuleHost()
const modules = computed(() => host?.registry ?? [])

// One reactive values-map per module, seeded from the host's persisted
// settings and updated locally on every change event so the UI reflects
// the write immediately rather than waiting for a re-render trigger.
const valuesByModule = reactive<Record<string, Record<string, unknown>>>({})

function valuesFor(moduleId: string, settings: { key: string; default?: unknown }[]) {
  if (!valuesByModule[moduleId]) {
    const seeded: Record<string, unknown> = {}
    for (const field of settings) {
      seeded[field.key] = host?.getModuleSetting(moduleId, field.key, (field as any).default)
    }
    valuesByModule[moduleId] = seeded
  }
  return valuesByModule[moduleId]
}

async function onChange(moduleId: string, key: string, value: unknown) {
  valuesByModule[moduleId][key] = value
  await host?.setModuleSetting(moduleId, key, value)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="modules.length === 0" class="text-xs" style="color: var(--hud-foreground-muted)">
      No modules installed.
    </div>

    <div
      v-for="mod in modules"
      :key="mod.id"
      class="hud-panel rounded-lg p-3"
    >
      <h3 class="text-[13px] font-semibold mb-0.5">{{ mod.name() }}</h3>
      <p class="text-[11px] mb-2" style="color: var(--hud-foreground-muted)">{{ mod.description() }}</p>
      <SettingsSchemaRenderer
        :schema="mod.settings"
        :values="valuesFor(mod.id, mod.settings)"
        @change="(key, value) => onChange(mod.id, key, value)"
      />
    </div>
  </div>
</template>
