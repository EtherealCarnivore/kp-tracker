<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50"
        @click.self="$emit('close')"
      >
        <div class="bg-bg-panel border border-[var(--color-border)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto safe-bottom">
          <!-- Header -->
          <div class="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
            <h2 class="text-lg font-semibold">{{ t('settings.title') }}</h2>
            <button
              class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary text-xl transition-colors"
              @click="$emit('close')"
            >
              &times;
            </button>
          </div>

          <div class="p-5 space-y-6">
            <!-- Theme Selector -->
            <div>
              <label class="block text-sm font-medium mb-3">{{ locale === 'bg' ? 'Тема' : 'Theme' }}</label>
              <div class="flex gap-4 justify-center">
                <button
                  v-for="tm in themeList"
                  :key="tm.key"
                  class="flex flex-col items-center gap-2 group"
                  @click="setTheme(tm.key)"
                >
                  <div
                    class="w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all duration-300"
                    :class="currentTheme === tm.key
                      ? 'border-accent ring-2 ring-accent/30 ring-offset-2 ring-offset-bg-primary scale-110'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)]'"
                    :style="{ background: `linear-gradient(135deg, ${tm.preview[0]}, ${tm.preview[1]})` }"
                  >
                    <span v-if="currentTheme === tm.key" class="text-white text-sm">&#10003;</span>
                  </div>
                  <span class="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
                    {{ locale === 'bg' ? tm.labelBg : tm.labelEn }}
                  </span>
                </button>
              </div>
            </div>

            <!-- Language -->
            <div class="border-t border-[var(--color-border)] pt-5">
              <label class="block text-sm font-medium mb-2">{{ t('settings.language') }}</label>
              <div class="flex gap-2">
                <button
                  v-for="loc in supportedLocales"
                  :key="loc.code"
                  class="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px]"
                  :class="locale === loc.code
                    ? 'bg-accent text-white'
                    : 'bg-[var(--color-card-bg)] border border-[var(--color-border)] text-text-secondary hover:bg-[var(--color-bg-input)]'"
                  @click="setLocale(loc.code)"
                >
                  {{ loc.label }}
                </button>
              </div>
            </div>

            <!-- Thresholds -->
            <div class="border-t border-[var(--color-border)] pt-5">
              <label class="block text-sm font-medium mb-2">{{ t('settings.threshold') }}</label>

              <div class="space-y-3">
                <div>
                  <span class="text-xs text-text-muted">BAS</span>
                  <div class="flex items-center gap-4">
                    <input
                      type="range"
                      :value="settings.thresholdBas"
                      @input="$emit('update', { ...settings, thresholdBas: Number($event.target.value) })"
                      min="1" max="9" class="flex-1"
                    >
                    <span class="text-2xl font-black text-kp-unsettled w-10 text-center">{{ settings.thresholdBas }}</span>
                  </div>
                </div>

                <div>
                  <span class="text-xs text-text-muted">NOAA</span>
                  <div class="flex items-center gap-4">
                    <input
                      type="range"
                      :value="settings.thresholdNoaa"
                      @input="$emit('update', { ...settings, thresholdNoaa: Number($event.target.value) })"
                      min="1" max="9" class="flex-1"
                    >
                    <span class="text-2xl font-black text-kp-unsettled w-10 text-center">{{ settings.thresholdNoaa }}</span>
                  </div>
                </div>

                <div>
                  <span class="text-xs text-text-muted">Komshi</span>
                  <div class="flex items-center gap-4">
                    <input
                      type="range"
                      :value="settings.thresholdBalkan"
                      @input="$emit('update', { ...settings, thresholdBalkan: Number($event.target.value) })"
                      min="1" max="9" class="flex-1"
                    >
                    <span class="text-2xl font-black text-kp-unsettled w-10 text-center">{{ settings.thresholdBalkan }}</span>
                  </div>
                </div>
              </div>

              <p class="text-xs text-text-muted mt-2">{{ t('settings.thresholdHint') }}</p>
            </div>

            <!-- Timezone -->
            <div class="border-t border-[var(--color-border)] pt-5">
              <label class="block text-sm font-medium mb-2">{{ t('settings.timezone') }}</label>
              <select
                :value="settings.timezone"
                @change="$emit('update', { ...settings, timezone: $event.target.value })"
              >
                <option value="Europe/Sofia">{{ t('settings.tzBulgaria') }}</option>
                <option value="local">{{ t('settings.tzLocal') }}</option>
                <option value="UTC">UTC</option>
                <option value="Europe/London">{{ t('settings.tzLondon') }}</option>
                <option value="Europe/Berlin">{{ t('settings.tzBerlin') }}</option>
                <option value="America/New_York">{{ t('settings.tzNewYork') }}</option>
              </select>
            </div>

            <!-- Refresh -->
            <div class="border-t border-[var(--color-border)] pt-5">
              <label class="block text-sm font-medium mb-2">{{ t('settings.refresh') }}</label>
              <select
                :value="settings.refreshInterval"
                @change="$emit('update', { ...settings, refreshInterval: Number($event.target.value) })"
              >
                <option :value="60">{{ t('settings.every1m') }}</option>
                <option :value="120">{{ t('settings.every2m') }}</option>
                <option :value="300">{{ t('settings.every5m') }}</option>
              </select>
            </div>

            <!-- Export/Import -->
            <div class="border-t border-[var(--color-border)] pt-5">
              <label class="block text-sm font-medium mb-2">{{ t('settings.data') }}</label>
              <div class="flex gap-2 flex-wrap">
                <button
                  class="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-border)] text-sm text-text-secondary hover:bg-[var(--color-bg-input)] transition-colors min-h-[44px]"
                  @click="$emit('export')"
                >{{ t('settings.export') }}</button>
                <button
                  class="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-border)] text-sm text-text-secondary hover:bg-[var(--color-bg-input)] transition-colors min-h-[44px]"
                  @click="triggerImport"
                >{{ t('settings.import') }}</button>
                <input ref="fileInput" type="file" accept=".json" class="hidden" @change="handleImport">
              </div>
            </div>

            <!-- Danger -->
            <div class="border-t border-[var(--color-border)] pt-5">
              <label class="block text-sm font-medium mb-2 text-kp-severe">{{ t('settings.danger') }}</label>
              <button
                v-if="!confirmingClear"
                class="px-4 py-2.5 rounded-xl border border-kp-severe/30 text-sm text-kp-severe hover:bg-kp-severe/10 transition-colors min-h-[44px]"
                @click="confirmingClear = true"
              >{{ t('settings.clear') }}</button>
              <button
                v-else
                class="px-4 py-2.5 rounded-xl bg-kp-severe text-white text-sm font-semibold min-h-[44px] transition-colors"
                @click="handleClear"
              >
                {{ t('settings.clearConfirm') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useI18n } from '../i18n/index.js'
import { useTheme } from '../composables/useTheme.js'

const { t, locale, setLocale, supportedLocales } = useI18n()
const { currentTheme, themes, setTheme } = useTheme()

const themeList = computed(() => Object.values(themes))

const props = defineProps({
  show: { type: Boolean, default: false },
  settings: { type: Object, required: true },
})

const emit = defineEmits(['close', 'update', 'export', 'import', 'clear'])
const fileInput = ref(null)
const confirmingClear = ref(false)

// Auto-reset confirm after 3 seconds
let clearTimer = null
watch(confirmingClear, (val) => {
  if (val) {
    clearTimer = setTimeout(() => { confirmingClear.value = false }, 3000)
  } else if (clearTimer) {
    clearTimeout(clearTimer)
  }
})

function triggerImport() { fileInput.value?.click() }

function handleImport(e) {
  const file = e.target.files?.[0]
  if (file) emit('import', file)
  e.target.value = ''
}

function handleClear() {
  emit('clear')
  confirmingClear.value = false
}
</script>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: all 0.3s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from > div { transform: translateY(100px); }
.modal-leave-to > div { transform: translateY(40px); }
@media (min-width: 640px) {
  .modal-enter-from > div { transform: scale(0.96) translateY(0); }
  .modal-leave-to > div { transform: scale(0.98) translateY(0); }
}
</style>
