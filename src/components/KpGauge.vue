<template>
  <div class="glass-panel p-5 sm:p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-text-primary">{{ t('kp.current') }}</h2>
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

    <!-- Gauge + Scale: column on mobile, row on desktop -->
    <div class="flex flex-col sm:flex-row items-center gap-5 sm:gap-8 mb-5">
      <div
        class="kp-gauge-ring shrink-0"
        :class="{ active: kp !== null }"
        :style="gaugeGlow"
      >
        <div class="kp-gauge-inner">
          <div
            class="text-5xl font-black leading-none transition-colors duration-500"
            :class="{ 'kp-value-animate': animating }"
            :style="{ color: kp !== null ? getKpColor(kp) : 'var(--color-text-muted)' }"
          >
            {{ kp !== null ? kp.toFixed(1) : '--' }}
          </div>
          <div class="text-[10px] text-text-muted mt-1">NOAA Kp</div>
          <!-- Secondary readings -->
          <div class="flex gap-3 mt-1 text-[11px]">
            <div v-if="liveKp !== null" class="text-center">
              <span class="text-text-muted block text-[9px]">Live</span>
              <span class="font-bold" :style="{ color: getKpColor(liveKp) }">{{ liveKp.toFixed(1) }}</span>
            </div>
            <div v-if="showBas && basEstimate !== null" class="text-center">
              <span class="text-text-muted block text-[9px]">BAS~</span>
              <span class="font-bold" :style="{ color: getKpColor(basEstimate) }">{{ basEstimate.toFixed(1) }}</span>
            </div>
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
            :class="{ lit: kp !== null && kp >= i - 1 }"
            :style="{ background: getKpColor(i - 1) }"
          />
        </div>
        <div class="flex justify-between text-[11px] text-text-muted px-0.5">
          <span v-for="i in [0, 3, 5, 7, 9]" :key="i" class="sm:hidden">{{ i }}</span>
          <span v-for="i in 10" :key="'d'+i" class="hidden sm:inline">{{ i - 1 }}</span>
        </div>
        <div class="text-sm font-semibold mt-2" :style="{ color: kp !== null ? getKpColor(kp) : 'var(--color-text-muted)' }">
          {{ kp !== null ? kpLevelText : t('app.loading') }}
        </div>
      </div>
    </div>

    <!-- Details Row — grid on mobile for better layout -->
    <div class="grid grid-cols-3 gap-3 text-sm">
      <div>
        <div class="text-[11px] uppercase tracking-wider text-text-muted">{{ t('kp.window') }}</div>
        <div class="font-semibold text-text-primary">{{ windowStr }}</div>
      </div>
      <div>
        <div class="text-[11px] uppercase tracking-wider text-text-muted">{{ t('kp.localTime') }}</div>
        <div class="font-semibold text-text-primary">{{ localTime }}</div>
      </div>
      <div>
        <div class="text-[11px] uppercase tracking-wider text-text-muted">{{ t('kp.yourThreshold') }}</div>
        <div class="font-semibold" :class="kp >= threshold ? 'text-kp-severe' : 'text-kp-quiet'">
          Kp {{ threshold }}{{ kp >= threshold ? ' · ' + t('kp.active') : '' }}
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
  basEstimate: { type: Number, default: null },
  showBas: { type: Boolean, default: false },
  kpType: { type: String, default: 'observed' },
  timeTag: { type: String, default: '' },
  threshold: { type: Number, default: 4 },
  timezone: { type: String, default: 'Europe/Sofia' },
  getKpColor: { type: Function, required: true },
  getKpLevel: { type: Function, required: true },
  getNoaaScale: { type: Function, required: true },
  get3hWindow: { type: Function, required: true },
})

const animating = ref(false)

// Animate on Kp value change
watch(() => props.kp, (newVal, oldVal) => {
  if (newVal !== null && oldVal !== null && newVal !== oldVal) {
    animating.value = true
    setTimeout(() => { animating.value = false }, 500)
  }
})

const noaaScale = computed(() => props.kp !== null ? props.getNoaaScale(props.kp) : null)

const kpLevelText = computed(() => {
  if (props.kp === null) return ''
  const v = props.kp
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
  if (props.kp === null) return {}
  const color = props.getKpColor(props.kp)
  return {
    filter: props.kp >= 4 ? `drop-shadow(0 0 20px ${color}40)` : 'none',
  }
})
</script>
