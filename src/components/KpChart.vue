<template>
  <div class="glass-panel p-5 sm:p-6">
    <div class="flex items-center justify-between mb-1">
      <h2 class="text-lg font-semibold text-text-primary">{{ t('chart.title') }}</h2>
      <div class="flex gap-1.5">
        <button
          v-for="r in ranges" :key="r.key"
          class="px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 min-h-[44px] flex items-center"
          :class="range === r.key ? 'bg-accent text-white shadow-[0_0_12px_var(--color-border-glow)]' : 'bg-[var(--color-card-bg)] text-text-secondary hover:bg-[var(--color-bg-input)]'"
          @click="switchRange(r.key)">{{ r.label }}</button>
      </div>
    </div>
    <div class="text-xs text-text-muted mb-4">{{ dateSubtitle }}</div>

    <!-- Chart -->
    <div class="flex">
      <!-- Y Axis -->
      <div class="flex flex-col justify-between pr-2 shrink-0" :style="{ height: chartHeight + 'px' }">
        <span v-for="i in 10" :key="i" class="text-[11px] text-text-muted text-right tabular-nums leading-none" style="min-width:14px">{{ 9-(i-1) }}</span>
      </div>

      <!-- Chart body -->
      <div class="flex-1 relative border-l border-b border-[var(--color-border)]" :style="{ height: chartHeight + 'px' }">
        <!-- Grid -->
        <div v-for="i in 9" :key="'g'+i" class="absolute left-0 right-0 pointer-events-none"
          :style="{ bottom: (i/9*100)+'%', borderTop: '1px solid '+([4,5,7].includes(i)?'var(--color-grid-major)':'var(--color-grid-minor)') }" />
        <!-- Threshold -->
        <div class="absolute left-0 right-0 pointer-events-none rounded-t-sm"
          :style="{ bottom: (threshold/9*100)+'%', height: ((9-threshold)/9*100)+'%', background: 'rgba(234,179,8,0.04)' }" />
        <div class="absolute left-0 right-0 z-10 pointer-events-none" :style="{ bottom: (threshold/9*100)+'%' }">
          <div class="w-full border-t-2 border-dashed border-kp-unsettled/30" />
        </div>

        <!-- Day band labels (top of chart) -->
        <div v-if="range !== '24h'" class="absolute inset-0 flex pointer-events-none z-10">
          <div v-for="(bar, idx) in displayBars" :key="'day'+idx" class="flex-1 relative">
            <div v-if="bar.isDayStart" class="absolute top-1 left-0 whitespace-nowrap">
              <span
                class="text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded"
                :class="bar.isToday
                  ? 'bg-accent/20 text-accent font-bold'
                  : 'text-text-muted'"
              >{{ bar.dayLabel }}</span>
            </div>
          </div>
        </div>

        <!-- Bars -->
        <div class="absolute inset-0 flex items-end">
          <div
            v-for="(bar, idx) in displayBars" :key="idx"
            class="flex-1 flex items-end justify-center h-full relative cursor-pointer"
            :class="[
              bar.type === 'predicted' ? 'forecast-zone' : '',
              bar.dayIndex % 2 === 1 && range !== '24h' ? 'day-band-alt' : '',
            ]"
            @click="selectedIdx = selectedIdx === idx ? null : idx"
          >
            <!-- Day boundary line -->
            <div v-if="bar.isDayStart && idx > 0 && range !== '24h'" class="absolute left-0 top-0 bottom-0 z-10 pointer-events-none">
              <div class="w-[1px] h-full border-l border-dashed border-text-muted/20" style="margin-left:-1px" />
            </div>

            <!-- Forecast divider -->
            <div v-if="bar.isForecastStart" class="absolute left-0 top-0 bottom-0 z-20 pointer-events-none">
              <div class="w-[1.5px] h-full bg-text-muted/40" style="margin-left:-1px" />
              <div class="absolute -top-5 left-0 text-[9px] font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">
                {{ locale === 'bg' ? 'Прогноза' : 'Forecast' }}
              </div>
            </div>

            <div
              class="w-full mx-px rounded-t-[3px] sm:rounded-t-md transition-all duration-500 relative"
              :class="{ 'forecast-style': bar.type === 'predicted', 'estimated-style': bar.type === 'estimated', 'selected-ring': selectedIdx === idx }"
              :style="{ height: bar.kp > 0 ? (bar.kp/9*100)+'%' : '0%', background: barBg(bar), transitionDelay: (idx*25)+'ms' }"
            >
              <div v-if="bar.kp > 0.5" class="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] sm:text-xs font-bold text-white/80 hidden sm:block"
                style="text-shadow:0 1px 3px rgba(0,0,0,0.5)">{{ bar.kp.toFixed(1) }}</div>
            </div>

            <!-- Now indicator INSIDE the current bar -->
            <div v-if="bar.isNowBar" class="absolute top-0 bottom-0 z-20 pointer-events-none" :style="{ left: bar.nowPct+'%' }">
              <div class="w-[2px] h-full bg-accent shadow-[0_0_6px_var(--color-accent)]" style="margin-left:-1px" />
              <div class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
                <div class="w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_6px_var(--color-accent)]" />
                <div class="absolute inset-0 w-2.5 h-2.5 rounded-full bg-accent animate-ping opacity-30" />
              </div>
              <div class="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-accent bg-[var(--color-bg-glass)] px-1.5 py-0.5 rounded whitespace-nowrap">
                {{ nowLabel }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- X-axis: window range labels -->
    <div class="flex ml-[22px] mt-1.5">
      <div v-for="(bar, idx) in displayBars" :key="'x'+idx" class="flex-1 text-center min-w-0">
        <div v-if="xAxisLabel(bar, idx)" class="text-[9px] sm:text-[10px] tabular-nums leading-tight truncate"
          :class="bar.type === 'predicted' ? 'text-accent/60' : bar.type === 'estimated' ? 'text-accent' : 'text-text-muted'">
          {{ xAxisLabel(bar, idx) }}
        </div>
      </div>
    </div>

    <!-- Tooltip -->
    <Transition name="tooltip">
      <div v-if="selectedBarInfo"
        class="mt-3 flex items-center justify-between gap-4 bg-[var(--color-bg-panel)] border border-[var(--color-border)] rounded-xl px-4 py-3 shadow-lg">
        <div class="flex items-center gap-3">
          <span class="text-2xl font-black tabular-nums" :style="{ color: getKpColor(selectedBarInfo.kp) }">Kp {{ selectedBarInfo.kp.toFixed(1) }}</span>
          <span v-if="selectedBarInfo.type !== 'observed'" class="text-[11px] px-2 py-0.5 rounded font-medium"
            :class="selectedBarInfo.type === 'predicted' ? 'bg-accent/15 text-accent' : 'bg-kp-unsettled/15 text-kp-unsettled'">
            {{ selectedBarInfo.type === 'predicted' ? t('chart.forecast') : (locale === 'bg' ? 'Оценка' : 'Estimate') }}
          </span>
        </div>
        <div class="text-right flex-1">
          <div class="text-sm font-medium text-text-primary">{{ selectedBarInfo.window }}</div>
          <div class="text-xs text-text-muted">{{ selectedBarInfo.date }}</div>
        </div>
        <button class="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary text-lg"
          @click.stop="selectedIdx = null">&times;</button>
      </div>
    </Transition>

    <!-- Legend -->
    <div class="flex gap-3 sm:gap-4 mt-3 flex-wrap">
      <span class="flex items-center gap-1.5 text-xs text-text-secondary"><span class="w-3 h-3 rounded-sm bg-kp-quiet" /> {{ t('chart.quiet') }}</span>
      <span class="flex items-center gap-1.5 text-xs text-text-secondary"><span class="w-3 h-3 rounded-sm bg-kp-unsettled" /> {{ t('chart.unsettled') }}</span>
      <span class="flex items-center gap-1.5 text-xs text-text-secondary"><span class="w-3 h-3 rounded-sm bg-kp-storm" /> {{ t('chart.storm') }}</span>
      <span class="flex items-center gap-1.5 text-xs text-text-secondary"><span class="w-3 h-3 rounded-sm bg-kp-severe" /> {{ t('chart.severe') }}</span>
      <span class="flex items-center gap-1.5 text-xs text-text-secondary"><span class="w-3 h-3 rounded-sm estimated-legend" /> {{ locale === 'bg' ? 'Оценка' : 'Estimate' }}</span>
      <span class="flex items-center gap-1.5 text-xs text-text-secondary"><span class="w-3 h-3 rounded-sm forecast-legend-swatch" /> {{ t('chart.forecast') }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from '../i18n/index.js'

const { t, locale } = useI18n()

const props = defineProps({
  history: { type: Array, default: () => [] },
  forecast: { type: Array, default: () => [] }, // Contains observed + estimated + predicted
  threshold: { type: Number, default: 4 },
  timezone: { type: String, default: 'Europe/Sofia' },
  getKpColor: { type: Function, required: true },
  formatTime: { type: Function, required: true },
})

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 800)
function onResize() { windowWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))

const ranges = computed(() => [
  { key: '24h', label: t('chart.24h') },
  { key: '3d', label: t('chart.3d') },
  { key: '7d', label: t('chart.7d') },
])
const range = ref('24h')
const selectedIdx = ref(null)
function switchRange(key) { range.value = key; selectedIdx.value = null }

const chartHeight = computed(() => windowWidth.value < 640 ? 240 : 280)

function parseTime(utcStr) {
  return new Date(utcStr.replace(' ', 'T') + (utcStr.includes('Z') ? '' : 'Z'))
}

function windowLabel(date, tz) {
  const startH = date.toLocaleString('en-GB', { timeZone: tz, hour: '2-digit', hour12: false })
  const endH = new Date(date.getTime() + 3 * 3600000).toLocaleString('en-GB', { timeZone: tz, hour: '2-digit', hour12: false })
  return `${startH}-${endH}`
}

function xAxisLabel(bar, idx) {
  if (range.value === '24h') return bar.windowLabel
  if (range.value === '7d') {
    // 7-day: only show time on first bar of each day (00-03)
    if (bar.isDayStart) return windowLabel(bar.date, props.timezone)
    return null
  }
  // 3-day: show time every other bar to reduce clutter
  if (idx % 2 === 0) return windowLabel(bar.date, props.timezone)
  return null
}

function windowFull(date, tz) {
  const s = date.toLocaleString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
  const e = new Date(date.getTime() + 3 * 3600000).toLocaleString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
  return `${s} – ${e}`
}

function fmtDate(date, tz) {
  return date.toLocaleString(locale.value === 'bg' ? 'bg-BG' : 'en-GB', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' })
}

function barBg(bar) {
  if (!bar.kp) return 'transparent'
  const c = props.getKpColor(bar.kp)
  if (bar.type === 'predicted') return `linear-gradient(to top, ${c}30, ${c}55)`
  if (bar.type === 'estimated') return `linear-gradient(to top, ${c}99, ${c}cc)`
  return `linear-gradient(to top, ${c}dd, ${c})`
}

const nowLabel = computed(() => {
  const time = new Date().toLocaleString('en-GB', { timeZone: props.timezone, hour: '2-digit', minute: '2-digit' })
  return (locale.value === 'bg' ? 'Сега ' : 'Now ') + time
})

// ===== USE FORECAST ENDPOINT AS SINGLE SOURCE =====
// It contains ALL data: observed (past), estimated (current window), predicted (future)

const displayBars = computed(() => {
  const tz = props.timezone
  const now = Date.now()

  // The forecast endpoint has everything — use it as primary
  // Fall back to history endpoint if forecast is empty
  let allEntries = props.forecast.length > 0
    ? props.forecast.map(f => ({
        kp: f.kp,
        date: parseTime(f.timeTag),
        type: f.type, // 'observed', 'estimated', 'predicted'
      }))
    : props.history.map(h => ({
        kp: h.kp,
        date: parseTime(h.timeTag),
        type: 'observed',
      }))

  allEntries = allEntries.filter(e => !isNaN(e.kp)).sort((a, b) => a.date - b.date)

  // Filter based on range
  let items = []
  if (range.value === '24h') {
    // Show: last 8 observed/estimated + all predicted (up to 8)
    const observed = allEntries.filter(e => e.type === 'observed' || e.type === 'estimated')
    const predicted = allEntries.filter(e => e.type === 'predicted')
    items = [...observed.slice(-8), ...predicted.slice(0, 8)]
  } else {
    const hours = range.value === '3d' ? 72 : 168
    const cutoff = now - hours * 3600000
    const past = allEntries.filter(e => (e.type === 'observed' || e.type === 'estimated') && e.date.getTime() >= cutoff)
    const predicted = range.value === '3d' ? allEntries.filter(e => e.type === 'predicted').slice(0, 8) : []
    items = [...past, ...predicted]
  }

  // Build display bars with now marker + forecast start flag + day grouping
  let forecastStartMarked = false
  const todayStr = new Date().toLocaleString('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
  const seenDays = []

  return items.map(item => {
    const barStart = item.date.getTime()
    const barEnd = barStart + 3 * 3600000
    const isNowBar = now >= barStart && now < barEnd
    const nowPct = isNowBar ? ((now - barStart) / (barEnd - barStart)) * 100 : 0
    const isForecastStart = item.type === 'predicted' && !forecastStartMarked
    if (isForecastStart) forecastStartMarked = true

    // Day grouping for alternating bands
    const dayStr = item.date.toLocaleString('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    if (!seenDays.includes(dayStr)) seenDays.push(dayStr)
    const dayIndex = seenDays.indexOf(dayStr)
    const isToday = dayStr === todayStr
    const loc = locale.value === 'bg' ? 'bg-BG' : 'en-GB'
    const dayLabel = isToday
      ? (locale.value === 'bg' ? 'Днес' : 'Today')
      : item.date.toLocaleString(loc, { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' })
    const isDayStart = seenDays.indexOf(dayStr) === dayIndex && items.indexOf(item) === items.findIndex(i =>
      i.date.toLocaleString('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }) === dayStr
    )

    return {
      kp: item.kp,
      date: item.date,
      type: item.type,
      isNowBar,
      nowPct,
      isForecastStart,
      dayIndex,
      dayLabel,
      isDayStart,
      isToday,
      windowLabel: range.value === '7d'
        ? item.date.toLocaleString('en-GB', { timeZone: tz, day: 'numeric', month: 'short' })
        : windowLabel(item.date, tz),
    }
  })
})

const selectedBarInfo = computed(() => {
  if (selectedIdx.value === null) return null
  const bar = displayBars.value[selectedIdx.value]
  if (!bar?.date) return null
  return {
    kp: bar.kp,
    type: bar.type,
    window: windowFull(bar.date, props.timezone),
    date: fmtDate(bar.date, props.timezone),
  }
})

const dateSubtitle = computed(() => {
  const tz = props.timezone
  const now = new Date()
  const loc = locale.value === 'bg' ? 'bg-BG' : 'en-GB'
  if (range.value === '24h') return now.toLocaleString(loc, { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const days = range.value === '3d' ? 2 : 6
  const start = new Date(now.getTime() - days * 86400000)
  return start.toLocaleString(loc, { timeZone: tz, month: 'short', day: 'numeric' }) + ' – ' + now.toLocaleString(loc, { timeZone: tz, month: 'short', day: 'numeric' })
})
</script>

<style scoped>
.tabular-nums { font-variant-numeric: tabular-nums; }
.tooltip-enter-active, .tooltip-leave-active { transition: all 0.25s ease; }
.tooltip-enter-from, .tooltip-leave-to { opacity: 0; transform: translateY(8px); }

.day-band-alt {
  background: rgba(128, 128, 128, 0.06);
}

.forecast-zone {
  background: rgba(255, 255, 255, 0.02);
}

.forecast-style { position: relative; }
.forecast-style::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit;
  background: repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.05) 4px, rgba(255,255,255,0.05) 8px);
  pointer-events: none;
}

.estimated-style {
  border: 1px dashed rgba(255,255,255,0.2);
  border-bottom: none;
}

.selected-ring { outline: 2px solid rgba(255,255,255,0.3); outline-offset: 1px; filter: brightness(1.2); }

.forecast-legend-swatch {
  background: linear-gradient(135deg, var(--color-accent) 40%, transparent 40%);
  opacity: 0.4;
  border: 1px dashed var(--color-text-muted);
}

.estimated-legend {
  background: var(--color-accent);
  opacity: 0.6;
  border: 1px dashed rgba(255,255,255,0.3);
}
</style>
