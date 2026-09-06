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
  <div class="flex flex-col justify-center items-center my-auto">
    <div class="mb-8">
      <h2 class="text-4xl font-semibold text-center text-white">{{ i18n.t('welcome') }}</h2>
    </div>

    <div class="flex flex-col gap-6 max-w-xs w-full">
      <div class="space-y-1.5">
        <label class="text-xs text-neutral-400 pl-1">{{ i18n.t('choose_lang') }}</label>
        <select
          :value="config.app.language()"
          class="w-full bg-[#1d1b24] border border-white/10 rounded-md px-3 py-2 text-xs text-white outline-none cursor-pointer"
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
          class="mt-1 size-4 rounded accent-purple-500 cursor-pointer"
        />
        <div class="flex flex-col">
          <span class="text-xs font-medium text-neutral-200">{{ i18n.t('accept_tos') }}</span>
          <p class="text-[11px] text-neutral-400 leading-relaxed">{{ i18n.t('tos_content') }}</p>
        </div>
      </label>

      <div class="mt-2">
        <button
          class="w-full py-2 px-4 rounded-md text-xs font-semibold bg-purple-500 hover:bg-purple-400 text-[#23212C] transition-colors disabled:opacity-50 cursor-pointer"
          :disabled="!accepted"
          @click="emit('done')"
        >
          {{ i18n.t('get_started') }}
        </button>
      </div>
    </div>
  </div>
</template>
