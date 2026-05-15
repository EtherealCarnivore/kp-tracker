<template>
  <div class="glass-panel p-5 sm:p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-text-primary">{{ t('kp.current') }}</h2>
      <div class="flex items-center gap-2">
        <!-- Source toggle -->
        <div class="flex rounded-lg overflow-hidden border border-[var(--color-border)] text-xs sm:text-[11px] font-semibold">
          <button
            class="px-3 py-2 sm:px-2.5 sm:py-1 min-h-[40px] transition-colors"
            :class="dataSource === 'noaa'
              ? 'bg-accent text-white'
              : 'bg-[var(--color-card-bg)] text-text-muted hover:text-text-secondary'"
            @click="$emit('update:dataSource', 'noaa')"
          >NOAA</button>
          <button
            class="px-3 py-2 sm:px-2.5 sm:py-1 min-h-[40px] transition-colors"
            :class="dataSource === 'bas'
              ? 'bg-accent text-white'
              : 'bg-[var(--color-card-bg)] text-text-muted hover:text-text-secondary'"
            @click="$emit('update:dataSource', 'bas')"
          >BAS</button>
          <button
            class="px-3 py-2 sm:px-2.5 sm:py-1 min-h-[40px] transition-colors"
            :class="dataSource === 'balkan'
              ? 'bg-accent text-white'
              : 'bg-[var(--color-card-bg)] text-text-muted hover:text-text-secondary'"
            @click="$emit('update:dataSource', 'balkan')"
            :title="t('kp.komshiTooltip')"
          >Komshi</button>
        </div>
        <span
          v-if="noaaScale"
          class="px-3 py-1.5 rounded-full text-sm font-bold"
          :class="noaaScale === 'G5' ? 'bg-kp-extreme/20 text-kp-extreme' :
                  noaaScale === 'G4' ? 'bg-kp-severe/20 text-kp-severe' :
                  noaaScale === 'G3' ? 'bg-kp-storm/20 text-kp-storm' :
                  'bg-kp-unsettled/20 text-kp-unsettled'"
        >
          {{ noaaScale }}
        </span>
      </div>
    </div>

    <!-- Gauge + Scale: column on mobile, row on desktop -->
    <div class="flex flex-col sm:flex-row items-center gap-5 sm:gap-8 mb-5">
      <div
        class="kp-gauge-ring shrink-0"
        :class="{ active: displayKp !== null }"
        :style="gaugeGlow"
      >
        <div class="kp-gauge-inner">
          <div
            class="text-5xl font-black leading-none transition-colors duration-500"
            :class="{ 'kp-value-animate': animating }"
            :style="{ color: displayKp !== null ? getKpColor(displayKp) : 'var(--color-text-muted)' }"
          >
            {{ displayKp !== null ? displayKp.toFixed(1) : '--' }}
          </div>
          <div class="text-xs sm:text-[10px] text-text-muted mt-1">{{ sourceLabel }}</div>
          <!-- Stale-source fallback indicator: visible only when user's selected source went stale -->
          <div
            v-if="isStale"
            class="mt-1 px-1.5 py-0.5 rounded text-[9px] sm:text-[8px] font-bold uppercase tracking-wider bg-kp-unsettled/20 text-kp-unsettled"
            :title="t('kp.staleHint')"
          >
            {{ t('kp.staleBadge') }}
          </div>
          <!-- Secondary readings -->
          <div class="flex gap-3 mt-1 text-xs sm:text-[11px]">
            <template v-for="sec in secondaryReadings" :key="sec.label">
              <div class="text-center">
                <span class="text-text-muted block text-[10px] sm:text-[9px]">{{ sec.label }}</span>
                <span class="font-bold" :style="{ color: getKpColor(sec.value) }">{{ sec.value.toFixed(1) }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Scale Bar — full width on mobile -->
      <div class="w-full sm:flex-1 space-y-2">
        <div class="flex gap-0.5">
          <div
            v-for="i in 10"
            :key="i"
            class="scale-segment"
            :class="{ lit: displayKp !== null && displayKp >= i - 1 }"
            :style="{ background: getKpColor(i - 1) }"
          />
        </div>
        <div class="flex justify-between text-[11px] text-text-muted px-0.5">
          <span v-for="i in [0, 3, 5, 7, 9]" :key="i" class="sm:hidden">{{ i }}</span>
          <span v-for="i in 10" :key="'d'+i" class="hidden sm:inline">{{ i - 1 }}</span>
        </div>
        <div class="text-sm font-semibold mt-2" :style="{ color: displayKp !== null ? getKpColor(displayKp) : 'var(--color-text-muted)' }">
          {{ displayKp !== null ? kpLevelText : t('app.loading') }}
        </div>
      </div>
    </div>

    <!-- Personal alert threshold — its own row, visually a control, not metadata.
         Bell icon + action label + stepper + value make it impossible to miss
         on first load. -->
    <div class="threshold-control flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 mb-3 sm:mb-4">
      <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
        <span class="text-base sm:text-lg shrink-0" aria-hidden="true">🔔</span>
        <label class="text-xs sm:text-sm text-text-secondary font-medium">{{ t('kp.alertMeAt') }}</label>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="threshold-stepper"
            @click="bumpThreshold(-0.5)"
            :disabled="threshold <= 1"
            :aria-label="t('kp.thresholdDown')"
          >−</button>
          <input
            type="number"
            inputmode="decimal"
            :value="threshold"
            @input="onThresholdInput"
            @blur="onThresholdBlur"
            @focus="$event.target.select()"
            min="1" max="9" step="0.5"
            :aria-label="t('kp.yourThreshold')"
            class="threshold-value font-bold tabular-nums"
            :class="displayKp >= threshold ? 'text-kp-severe' : 'text-text-primary'"
          />
          <button
            type="button"
            class="threshold-stepper"
            @click="bumpThreshold(0.5)"
            :disabled="threshold >= 9"
            :aria-label="t('kp.thresholdUp')"
          >+</button>
        </div>
      </div>
      <span
        v-if="displayKp !== null && displayKp >= threshold"
        class="text-[10px] sm:text-xs font-semibold text-kp-severe shrink-0 uppercase tracking-wider"
      >· {{ t('kp.active') }}</span>
    </div>

    <!-- Details Row — secondary metadata only -->
    <div class="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
      <div>
        <div class="text-[10px] sm:text-[11px] uppercase tracking-wider text-text-muted">{{ t('kp.window') }}</div>
        <div class="font-semibold text-text-primary">{{ windowStr }}</div>
      </div>
      <div>
        <div class="text-[10px] sm:text-[11px] uppercase tracking-wider text-text-muted">{{ t('kp.localTime') }}</div>
        <div class="font-semibold text-text-primary">{{ localTime }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from '../i18n/index.js'

const { t, locale } = useI18n()

const props = defineProps({
  kp: { type: Number, default: null },
  liveKp: { type: Number, default: null },
  basKp: { type: Number, default: null },
  balkanKp: { type: Number, default: null },
  dataSource: { type: String, default: 'noaa' },
  activeSource: { type: String, default: 'noaa' },
  isStale: { type: Boolean, default: false },
  kpType: { type: String, default: 'observed' },
  timeTag: { type: String, default: '' },
  threshold: { type: Number, default: 4 },
  timezone: { type: String, default: 'Europe/Sofia' },
  getKpColor: { type: Function, required: true },
  getKpLevel: { type: Function, required: true },
  getNoaaScale: { type: Function, required: true },
  get3hWindow: { type: Function, required: true },
})

const emit = defineEmits(['update:dataSource', 'update:threshold'])

// Inline threshold editing: emits the raw user input to the parent, which
// routes it to the correct per-source settings key. Snapping/clamping happens
// in the parent so we don't double-snap during composition.
function onThresholdInput(event) {
  const raw = event.target.value
  if (raw === '' || raw === '-') return // allow transient empty state during typing
  const n = Number(raw)
  if (isNaN(n)) return
  emit('update:threshold', Math.round(n * 2) / 2)
}
function onThresholdBlur(event) {
  const n = Number(event.target.value)
  if (isNaN(n) || n < 1) emit('update:threshold', 1)
  else if (n > 9) emit('update:threshold', 9)
  else emit('update:threshold', Math.round(n * 2) / 2)
}
function bumpThreshold(delta) {
  const next = Math.max(1, Math.min(9, Math.round((props.threshold + delta) * 2) / 2))
  emit('update:threshold', next)
}

const animating = ref(false)

// displayKp follows the *effective* source (activeSource), which equals
// dataSource when fresh and falls back to 'noaa' when the selected source is
// stale. This keeps the gauge value consistent with the stale badge.
const displayKp = computed(() => {
  if (props.activeSource === 'bas') return props.basKp
  if (props.activeSource === 'balkan') return props.balkanKp
  return props.liveKp ?? props.kp
})

// Animate on value change
watch(displayKp, (newVal, oldVal) => {
  if (newVal !== null && oldVal !== null && newVal !== oldVal) {
    animating.value = true
    setTimeout(() => { animating.value = false }, 500)
  }
})

const sourceLabel = computed(() => {
  if (props.activeSource === 'bas') return t('source.label.bas')
  if (props.activeSource === 'balkan') return t('source.label.balkan')
  return props.liveKp !== null
    ? `${t('source.label.noaa')} (${t('kp.live')})`
    : t('source.label.noaa')
})

const secondaryReadings = computed(() => {
  const readings = []
  const src = props.activeSource

  if (src === 'noaa') {
    if (props.kp !== null && props.liveKp !== null) readings.push({ label: '3h', value: props.kp })
    if (props.basKp !== null) readings.push({ label: t('source.bas'), value: props.basKp })
    if (props.balkanKp !== null) readings.push({ label: t('source.balkan'), value: props.balkanKp })
  } else if (src === 'bas') {
    if (props.kp !== null) readings.push({ label: t('source.noaa'), value: props.liveKp ?? props.kp })
    if (props.balkanKp !== null) readings.push({ label: t('source.balkan'), value: props.balkanKp })
  } else if (src === 'balkan') {
    if (props.kp !== null) readings.push({ label: t('source.noaa'), value: props.liveKp ?? props.kp })
    if (props.basKp !== null) readings.push({ label: t('source.bas'), value: props.basKp })
  }

  return readings
})

const noaaScale = computed(() => displayKp.value !== null ? props.getNoaaScale(displayKp.value) : null)

const kpLevelText = computed(() => {
  if (displayKp.value === null) return ''
  const v = displayKp.value
  if (v < 4) return t('kp.quiet')
  if (v < 5) return t('kp.unsettled')
  if (v < 6) return t('kp.minorStorm')
  if (v < 7) return t('kp.moderateStorm')
  if (v < 8) return t('kp.strongStorm')
  if (v < 9) return t('kp.severeStorm')
  return t('kp.extremeStorm')
})

const windowStr = computed(() => props.timeTag ? props.get3hWindow(props.timeTag, props.timezone) : '--')

const localTime = computed(() => {
  try {
    return new Date().toLocaleString('en-GB', {
      timeZone: props.timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch { return '--' }
})

const gaugeGlow = computed(() => {
  if (displayKp.value === null) return {}
  const color = props.getKpColor(displayKp.value)
  return {
    filter: displayKp.value >= 4 ? `drop-shadow(0 0 20px ${color}40)` : 'none',
  }
})
</script>

<style scoped>
/* The threshold control sits in its own row so it doesn't read as passive
   metadata. Surface treatment + a subtle accent border at rest signal "this
   is interactive" before the user even hovers. */
.threshold-control {
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  transition: border-color 0.2s ease, background 0.2s ease;
}
.threshold-control:hover,
.threshold-control:focus-within {
  border-color: var(--color-accent);
  background: var(--color-card-bg);
}

.threshold-stepper {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.05s ease;
  user-select: none;
}
.threshold-stepper:hover:not(:disabled) {
  background: var(--color-bg-input);
  border-color: var(--color-accent);
}
.threshold-stepper:active:not(:disabled) {
  transform: scale(0.94);
}
.threshold-stepper:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.threshold-value {
  appearance: textfield;
  -moz-appearance: textfield;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 4px 6px;
  width: 3.5rem;
  height: 32px;
  font-size: 1rem;
  text-align: center;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.threshold-value:hover {
  border-color: var(--color-accent);
}
.threshold-value:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-border-glow);
}
.threshold-value::-webkit-inner-spin-button,
.threshold-value::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
