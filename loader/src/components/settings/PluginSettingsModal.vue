<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { SettingsSchemaRenderer } from '@riot/ui'
import { deserializeModuleSchema, type SerializedModuleSchema } from '@riot/contracts'
import { PluginManager, type PluginInfo } from '../../lib/plugins'
import { useI18n } from '../../lib/i18n'
import { SettingsIcon, LoaderIcon } from '../Icons'

const props = defineProps<{
  plugin: PluginInfo | null
  schema: SerializedModuleSchema | null
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()

const loading = ref(false)
const values = ref<Record<string, unknown>>({})
const savedStatus = ref(false)
let saveTimer: any = null

const deserializedSchema = computed(() => {
  if (!props.schema) return []
  return deserializeModuleSchema(props.schema)
})

const loadValues = async () => {
  if (!props.plugin) {
    values.value = {}
    return
  }
  loading.value = true
  try {
    values.value = await PluginManager.getPluginValues(props.plugin)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.visible,
  (isOpen) => {
    if (isOpen && props.plugin) {
      loadValues()
    }
  }
)

watch(
  () => props.plugin,
  (newPlugin) => {
    if (props.visible && newPlugin) {
      loadValues()
    }
  }
)

const onSettingChange = async (key: string, val: unknown) => {
  if (!props.plugin) return
  values.value[key] = val
  const success = await PluginManager.savePluginValues(props.plugin, values.value)
  if (success) {
    savedStatus.value = true
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      savedStatus.value = false
    }, 1500)
  }
}

const close = () => {
  emit('close')
}
</script>

<template>
  <div
    v-if="visible && plugin"
    class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center select-none"
    @click.self="close"
  >
    <div data-tauri-drag-region class="absolute top-0 w-full h-10" />

    <div class="border border-border rounded-sm relative flex flex-col w-[620px] max-h-[520px] shadow-2xl overflow-hidden bg-surface">
      <!-- Close Button -->
      <button
        class="absolute top-3 right-3 flex justify-center items-center size-7 text-foreground-muted hover:text-destructive-foreground hover:bg-destructive rounded-sm cursor-pointer transition-colors z-10"
        :title="t('Close')"
        @click="close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <polygon points="10.2,0.7 9.5,0 5.1,4.4 0.7,0 0,0.7 4.4,5.1 0,9.5 0.7,10.2 5.1,5.8 9.5,10.2 10.2,9.5 5.8,5.1" />
        </svg>
      </button>

      <!-- Header -->
      <div class="flex items-center gap-3 p-5 border-b border-border bg-surface-2/60">
        <div class="size-8 rounded-sm border border-border bg-surface flex items-center justify-center text-foreground-muted">
          <SettingsIcon :size="16" />
        </div>
        <div class="min-w-0 pr-8">
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-semibold text-foreground truncate">
              {{ schema?.name || plugin.name }}
            </h2>
            <span v-if="plugin.version" class="text-[10px] px-1.5 py-0.5 rounded-sm border border-border bg-surface text-foreground-subtle font-data shrink-0">
              v{{ plugin.version }}
            </span>
          </div>
          <p class="text-[11px] text-foreground-muted mt-0.5 truncate">
            {{ schema?.description || plugin.description || t('Plugin settings and configuration') }}
          </p>
        </div>
      </div>

      <!-- Body / Schema Settings -->
      <div class="p-5 flex-1 overflow-y-auto min-h-0 space-y-4">
        <div v-if="loading" class="flex flex-col items-center justify-center py-12 text-foreground-muted">
          <LoaderIcon class="animate-spin" :size="24" />
          <span class="text-xs font-data mt-2">{{ t('Loading settings...') }}</span>
        </div>

        <template v-else>
          <div v-if="deserializedSchema.length === 0" class="text-center py-8 text-foreground-muted text-xs">
            {{ t('No configurable settings available for this plugin.') }}
          </div>

          <div v-else class="space-y-3">
            <SettingsSchemaRenderer
              :schema="deserializedSchema"
              :values="values"
              @change="onSettingChange"
            />
          </div>
        </template>
      </div>

      <!-- Footer -->
      <div class="border-t border-border p-3 px-5 bg-surface-2/40 flex items-center justify-between">
        <div class="text-[11px] font-data text-foreground-subtle flex items-center gap-2">
          <span v-if="savedStatus" class="text-signal flex items-center gap-1">
            <span class="size-1.5 rounded-full bg-signal inline-block" />
            {{ t('Settings saved') }}
          </span>
          <span v-else class="text-foreground-subtle">
            {{ t('Changes are applied immediately') }}
          </span>
        </div>

        <button
          class="riot-btn-secondary px-3 py-1 text-xs"
          @click="close"
        >
          {{ t('Close') }}
        </button>
      </div>
    </div>
  </div>
</template>
