<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '../lib/i18n'
import { useConfig } from '../lib/config'

const emit = defineEmits<{
  (e: 'done'): void
}>()

const i18n = useI18n()
const config = useConfig()
const accepted = ref(false)

const selectLang = async (e: Event) => {
  const target = e.target as HTMLSelectElement
  const langId = target.value
  i18n.switchTo(langId)
  await config.app.language(langId)
}
</script>

<template>
  <div class="flex flex-col justify-center items-center my-auto p-6 select-none">
    <div class="mb-6 text-center">
      <h2 class="text-xl font-semibold text-foreground">
        {{ i18n.t('Welcome') }}
      </h2>
      <p class="text-xs text-foreground-subtle mt-1 font-data">
        {{ i18n.t('Riot client companion') }}
      </p>
    </div>

    <div class="riot-card p-6 flex flex-col gap-5 max-w-sm w-full">
      <div class="space-y-1.5">
        <label class="text-[11px] font-medium text-foreground-muted pl-0.5">
          {{ i18n.t('Choose your language') }}
        </label>
        <select
          :value="config.app.language()"
          class="riot-input w-full px-3 py-2 text-xs cursor-pointer"
          @change="selectLang"
        >
          <option v-for="lang in i18n.languages" :key="lang.id" :value="lang.id">
            {{ lang.name }}
          </option>
        </select>
      </div>

      <label class="flex items-start gap-3 cursor-pointer">
        <input
          v-model="accepted"
          type="checkbox"
          class="mt-1 size-4 rounded-sm cursor-pointer accent-foreground"
        />
        <div class="flex flex-col">
          <span class="text-xs font-medium text-foreground">{{ i18n.t('Accept terms and conditions') }}</span>
          <p class="text-[11px] text-foreground-muted leading-relaxed mt-0.5">{{ i18n.t('Riot Loader is client-safe, but using exploit plugins could get you banned.') }}</p>
        </div>
      </label>

      <div class="mt-2">
        <button
          class="riot-btn-primary w-full py-2.5 px-4 text-xs disabled:opacity-40 disabled:pointer-events-none"
          :disabled="!accepted"
          @click="emit('done')"
        >
          {{ i18n.t('Get started') }}
        </button>
      </div>
    </div>
  </div>
</template>
