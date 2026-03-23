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

            <!-- BAS Estimate Toggle -->
            <div class="border-t border-[var(--color-border)] pt-5">
              <label class="flex items-center gap-3 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  :checked="settings.showBASEstimate"
                  @change="$emit('update', { ...settings, showBASEstimate: $event.target.checked })"
                  class="w-5 h-5 rounded accent-[var(--color-accent)]"
                >
                <div>
                  <div class="text-sm font-medium">
                    {{ locale === 'bg' ? 'Показвай БАН оценка (Kpm~)' : 'Show BAS estimate (Kpm~)' }}
                  </div>
                  <div class="text-xs text-text-muted mt-0.5">
                    {{ locale === 'bg'
                      ? 'Показва приблизителна конверсия на NOAA Kp към стойностите на БАН в индикатора.'
                      : 'Shows an approximate NOAA Kp → BAS conversion in the gauge.' }}
                  </div>
                </div>
              </label>
            </div>

            <!-- Data Sources Legend (always visible) -->
            <div class="border-t border-[var(--color-border)] pt-5">
              <div class="text-sm font-medium mb-3">
                {{ locale === 'bg' ? 'Как работят данните' : 'How the data works' }}
              </div>

              <!-- NOAA -->
              <div class="p-3 rounded-xl bg-[var(--color-card-bg)] text-xs text-text-secondary space-y-2 mb-3">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-accent shrink-0" />
                  <span class="font-semibold text-text-primary text-sm">NOAA Kp ({{ locale === 'bg' ? 'Глобален' : 'Global' }})</span>
                </div>
                <div>{{ locale === 'bg'
                  ? 'Планетарен Kp индекс от NOAA Space Weather Prediction Center. Изчислява се от данни на 13 магнитометрични станции по света (44-60° геомагнитна ширина). Обновява се на всеки 3 часа.'
                  : 'Planetary Kp index from NOAA Space Weather Prediction Center. Calculated from 13 magnetometer stations worldwide (44-60° geomagnetic latitude). Updated every 3 hours.' }}</div>
                <div class="text-text-muted">
                  {{ locale === 'bg'
                    ? 'Формула: K = max(ΔH) за 3-часов прозорец, стандартизиран и осреднен глобално. Скала 0-9 (квази-логаритмична).'
                    : 'Formula: K = max(ΔH) over 3h window, standardized and globally averaged. Scale 0-9 (quasi-logarithmic).' }}
                </div>
              </div>

              <!-- BAS -->
              <div class="p-3 rounded-xl bg-[var(--color-card-bg)] text-xs text-text-secondary space-y-2 mb-3">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-kp-unsettled shrink-0" />
                  <span class="font-semibold text-text-primary text-sm">БАН Kpm ({{ locale === 'bg' ? 'България' : 'Bulgaria' }})</span>
                </div>
                <div>{{ locale === 'bg'
                  ? 'Kpm оценка от НИГГ-БАН (Национален институт по геофизика, геодезия и география). Използва MAK модел (Andonov et al., 2004) базиран на данни от сателита ACE на всеки 15 минути.'
                  : 'Kpm estimate from NIGGG-BAS (National Institute of Geophysics, Geodesy and Geography). Uses the MAK model (Andonov et al., 2004) based on ACE satellite data every 15 minutes.' }}</div>
                <div class="text-text-muted">
                  {{ locale === 'bg'
                    ? 'Формула: Kpm = f(V, B, Bz) — функция от скоростта на слънчевия вятър, магнитното поле и Bz компонентата. Доверителен интервал: ±0.63 при 50% вероятност.'
                    : 'Formula: Kpm = f(V, B, Bz) — function of solar wind speed, magnetic field, and Bz component. Confidence interval: ±0.63 at 50% probability.' }}
                </div>
              </div>

              <!-- Comparison -->
              <div class="p-3 rounded-xl bg-[var(--color-card-bg)] text-xs text-text-secondary space-y-2">
                <div class="font-semibold text-text-primary text-sm">
                  {{ locale === 'bg' ? 'Защо стойностите се различават?' : 'Why do the values differ?' }}
                </div>
                <div>{{ locale === 'bg'
                  ? 'NOAA използва данни от 13 станции и дава глобална средна стойност. БАН използва данни от сателита ACE и обсерваторията в Панагюрище (42.5°N). При бури NOAA обикновено показва по-високи стойности.'
                  : 'NOAA uses 13 stations for a global average. BAS uses ACE satellite data and the Panagyurishte observatory (42.5°N). During storms, NOAA typically shows higher values.' }}</div>
                <div>
                  {{ locale === 'bg' ? 'Корелация' : 'Correlation' }}: r ≈ 0.84
                </div>
                <div class="mt-2 font-medium text-text-primary">
                  {{ locale === 'bg' ? 'Примерно съответствие:' : 'Approximate mapping:' }}
                </div>
                <div class="grid grid-cols-4 gap-1 text-[11px] mt-1">
                  <div class="text-text-muted">NOAA</div>
                  <div class="text-text-muted">BAS~</div>
                  <div class="text-text-muted">NOAA</div>
                  <div class="text-text-muted">BAS~</div>
                  <div class="font-mono">1.0</div><div class="font-mono text-kp-quiet">0.9</div>
                  <div class="font-mono">5.0</div><div class="font-mono text-kp-unsettled">3.6</div>
                  <div class="font-mono">2.0</div><div class="font-mono text-kp-quiet">1.8</div>
                  <div class="font-mono">6.0</div><div class="font-mono text-kp-storm">3.5</div>
                  <div class="font-mono">3.0</div><div class="font-mono text-kp-quiet">2.3</div>
                  <div class="font-mono">7.0</div><div class="font-mono text-kp-severe">3.9</div>
                  <div class="font-mono">4.0</div><div class="font-mono text-kp-unsettled">2.9</div>
                  <div class="font-mono">8.0</div><div class="font-mono text-kp-severe">4.4</div>
                </div>
                <div class="text-[10px] text-text-muted italic mt-1">
                  {{ locale === 'bg'
                    ? '* Приблизително. Реалната разлика зависи от типа буря и локалните условия.'
                    : '* Approximate. Actual difference depends on storm type and local conditions.' }}
                </div>
              </div>
            </div>

            <!-- Threshold -->
            <div class="border-t border-[var(--color-border)] pt-5">
              <label class="block text-sm font-medium mb-2">{{ t('settings.threshold') }}</label>
              <div class="flex items-center gap-4">
                <input
                  type="range"
                  :value="settings.threshold"
                  @input="$emit('update', { ...settings, threshold: Number($event.target.value) })"
                  min="1" max="9" class="flex-1"
                >
                <span class="text-2xl font-black text-kp-unsettled w-10 text-center">{{ settings.threshold }}</span>
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
