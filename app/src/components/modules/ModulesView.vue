<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { SettingsSchemaRenderer } from '@riot/ui'
import { getModuleSources, type ModuleHostLike } from '@riot/contracts'
import { getModuleHost } from '@/modules'

interface ModuleGroup {
  sourceId: string
  label: string
  host: ModuleHostLike | null
  modules: any[]
}

/**
 * Sources register during their own plugin's init(), which may land after this
 * view mounts (Pengu gives no ordering guarantee between plugins). Poll briefly
 * so a late-registering plugin still appears without the user reopening the tab.
 */
const tick = ref(0)
let poll: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  poll = setInterval(() => { tick.value++ }, 1000)
})
onUnmounted(() => {
  if (poll) clearInterval(poll)
})

const groups = computed<ModuleGroup[]>(() => {
  void tick.value // re-evaluate as late sources arrive

  const out: ModuleGroup[] = []

  // The companion's own host first, when it has anything registered.
  const own = getModuleHost() as ModuleHostLike | null
  if (own && own.registry.length > 0) {
    out.push({ sourceId: 'companion', label: 'Companion', host: own, modules: own.registry })
  }

  for (const source of getModuleSources()) {
    const host = source.getHost()
    if (!host || host.registry.length === 0) continue
    out.push({ sourceId: source.id, label: source.label, host, modules: host.registry })
  }

  return out
})

const totalModules = computed(() => groups.value.reduce((n, g) => n + g.modules.length, 0))

// One reactive values-map per module, seeded from its own host's persisted
// settings and updated locally on every change event so the UI reflects the
// write immediately rather than waiting for a re-render trigger.
const valuesByModule = reactive<Record<string, Record<string, unknown>>>({})

/** Namespaced so two sources can't collide on a shared module id. */
const cacheKey = (sourceId: string, moduleId: string) => `${sourceId}:${moduleId}`

function valuesFor(group: ModuleGroup, moduleId: string, settings: { key: string; default?: unknown }[]) {
  const key = cacheKey(group.sourceId, moduleId)
  if (!valuesByModule[key]) {
    const seeded: Record<string, unknown> = {}
    for (const field of settings) {
      seeded[field.key] = group.host?.getModuleSetting?.(moduleId, field.key, (field as any).default)
    }
    valuesByModule[key] = seeded
  }
  return valuesByModule[key]
}

async function onChange(group: ModuleGroup, moduleId: string, key: string, value: unknown) {
  valuesByModule[cacheKey(group.sourceId, moduleId)][key] = value
  await group.host?.setModuleSetting?.(moduleId, key, value)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="totalModules === 0" class="text-xs" style="color: var(--hud-foreground-muted)">
      No modules installed.
    </div>

    <section v-for="group in groups" :key="group.sourceId" class="flex flex-col gap-3">
      <!-- Only worth labelling once more than one plugin contributes modules. -->
      <h2
        v-if="groups.length > 1"
        class="text-[11px] font-semibold uppercase tracking-wide"
        style="color: var(--hud-foreground-muted)"
      >
        {{ group.label }}
      </h2>

      <div
        v-for="mod in group.modules"
        :key="`${group.sourceId}:${mod.id}`"
        class="hud-panel rounded-lg p-3"
      >
        <h3 class="text-[13px] font-semibold mb-0.5">{{ mod.name() }}</h3>
        <p class="text-[11px] mb-2" style="color: var(--hud-foreground-muted)">{{ mod.description() }}</p>
        <SettingsSchemaRenderer
          :schema="mod.settings"
          :values="valuesFor(group, mod.id, mod.settings)"
          @change="(key, value) => onChange(group, mod.id, key, value)"
        />
      </div>
    </section>
  </div>
</template>
