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

          <div class="p-4 sm:p-5 space-y-5 sm:space-y-6">
            <!-- Theme Selector -->
            <div>
              <label class="block text-sm font-medium mb-3">{{ t('settings.theme') }}</label>
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
                <div v-for="row in thresholdRows" :key="row.key">
                  <span class="text-xs text-text-muted">{{ row.label }}</span>
                  <div class="flex items-center gap-3 sm:gap-4">
                    <input
                      type="range"
                      :value="settings[row.key]"
                      @input="updateThreshold(row.key, $event.target.value)"
                      min="1" max="9" step="0.5" class="flex-1"
                    >
                    <input
                      type="number"
                      :value="settings[row.key]"
                      @input="updateThreshold(row.key, $event.target.value)"
                      @blur="clampThreshold(row.key)"
                      min="1" max="9" step="0.5"
                      class="threshold-num text-2xl font-black text-kp-unsettled w-16 text-center tabular-nums"
                    >
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

          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../i18n/index.js'
import { useTheme } from '../composables/useTheme.js'

const { t, locale, setLocale, supportedLocales } = useI18n()
const { currentTheme, themes, setTheme } = useTheme()

const themeList = computed(() => Object.values(themes))

const props = defineProps({
  show: { type: Boolean, default: false },
  settings: { type: Object, required: true },
})

const emit = defineEmits(['close', 'update'])

const thresholdRows = [
  { key: 'thresholdBas', label: 'BAS' },
  { key: 'thresholdNoaa', label: 'NOAA' },
  { key: 'thresholdBalkan', label: 'Komshi' },
]

// Threshold updates accept floats (e.g. 3.5). We snap to 0.5 steps and clamp
// to [1, 9]. Empty string while editing is allowed transiently — the blur
// handler enforces a valid value.
function updateThreshold(key, rawValue) {
  if (rawValue === '' || rawValue === '-') {
    emit('update', { ...props.settings, [key]: rawValue })
    return
  }
  const n = Number(rawValue)
  if (isNaN(n)) return
  const snapped = Math.round(n * 2) / 2
  emit('update', { ...props.settings, [key]: snapped })
}

function clampThreshold(key) {
  const v = Number(props.settings[key])
  if (isNaN(v) || v < 1) emit('update', { ...props.settings, [key]: 1 })
  else if (v > 9) emit('update', { ...props.settings, [key]: 9 })
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

/* Numeric threshold input — matches the size of the old read-only span but
   is now an actual editable field. Hide the browser's default spinner so the
   layout doesn't shift between focus states. */
.threshold-num {
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 6px 4px;
  appearance: textfield;
  -moz-appearance: textfield;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.threshold-num::-webkit-inner-spin-button,
.threshold-num::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.threshold-num:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-border-glow);
}
</style>
