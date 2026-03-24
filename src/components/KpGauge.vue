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
            :title="'Ground stations: Bulgaria, Romania, Serbia, Greece'"
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

    <!-- Details Row — grid on mobile for better layout -->
    <div class="grid grid-cols-3 gap-2 sm:gap-3 text-xs sm:text-sm">
      <div>
        <div class="text-[10px] sm:text-[11px] uppercase tracking-wider text-text-muted">{{ t('kp.window') }}</div>
        <div class="font-semibold text-text-primary">{{ windowStr }}</div>
      </div>
      <div>
        <div class="text-[10px] sm:text-[11px] uppercase tracking-wider text-text-muted">{{ t('kp.localTime') }}</div>
        <div class="font-semibold text-text-primary">{{ localTime }}</div>
      </div>
      <div>
        <div class="text-[10px] sm:text-[11px] uppercase tracking-wider text-text-muted">{{ t('kp.yourThreshold') }}</div>
        <div class="font-semibold" :class="displayKp >= threshold ? 'text-kp-severe' : 'text-kp-quiet'">
          Kp {{ threshold }}{{ displayKp >= threshold ? ' · ' + t('kp.active') : '' }}
        </div>
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
  kpType: { type: String, default: 'observed' },
  timeTag: { type: String, default: '' },
  threshold: { type: Number, default: 4 },
  timezone: { type: String, default: 'Europe/Sofia' },
  getKpColor: { type: Function, required: true },
  getKpLevel: { type: Function, required: true },
  getNoaaScale: { type: Function, required: true },
  get3hWindow: { type: Function, required: true },
})

defineEmits(['update:dataSource'])

const animating = ref(false)

const displayKp = computed(() => {
  if (props.dataSource === 'bas') return props.basKp
  if (props.dataSource === 'balkan') return props.balkanKp
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
  if (props.dataSource === 'bas') return 'BAS Kpm'
  if (props.dataSource === 'balkan') return 'Komshi K'
  return props.liveKp !== null ? 'NOAA Kp (Live)' : 'NOAA Kp'
})

const secondaryReadings = computed(() => {
  const readings = []
  const src = props.dataSource

  if (src === 'noaa') {
    if (props.kp !== null && props.liveKp !== null) readings.push({ label: '3h', value: props.kp })
    if (props.basKp !== null) readings.push({ label: 'BAS', value: props.basKp })
    if (props.balkanKp !== null) readings.push({ label: 'Komshi', value: props.balkanKp })
  } else if (src === 'bas') {
    if (props.kp !== null) readings.push({ label: 'NOAA', value: props.liveKp ?? props.kp })
    if (props.balkanKp !== null) readings.push({ label: 'Komshi', value: props.balkanKp })
  } else if (src === 'balkan') {
    if (props.kp !== null) readings.push({ label: 'NOAA', value: props.liveKp ?? props.kp })
    if (props.basKp !== null) readings.push({ label: 'BAS', value: props.basKp })
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
