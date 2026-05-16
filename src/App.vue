<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useKpData } from './composables/useKpData.js'
import { useBASData } from './composables/useBASData.js'
import { useBalkanData } from './composables/useBalkanData.js'
import { useNews } from './composables/useNews.js'
import { useSettings } from './composables/useSettings.js'
import { useTheme } from './composables/useTheme.js'
import { useI18n } from './i18n/index.js'

import AlertBanner from './components/AlertBanner.vue'
import KpGauge from './components/KpGauge.vue'
import SolarWind from './components/SolarWind.vue'
import KpChart from './components/KpChart.vue'
import NewsFeed from './components/NewsFeed.vue'
import SettingsModal from './components/SettingsModal.vue'

const { t } = useI18n()
const { settings } = useSettings()
useTheme() // Initialize theme on load

const {
  currentKp, liveEstimate, kpHistory, kpForecast, solarWind, lastUpdate, loading,
  fetchAll, getKpColor, getKpLevel, getNoaaScale, formatTime, get3hWindow,
} = useKpData(settings.value.refreshInterval)

const { getBASCurrent, getBASHistory, getBASForecast, getBASLastUpdated } = useBASData(settings.value.refreshInterval)
const { getBalkanCurrent, getBalkanHistory, getBalkanLastUpdated } = useBalkanData(settings.value.refreshInterval)
const { newsData } = useNews()

const showSettings = ref(false)
const showInfo = ref(true)

const kpNum = computed(() => currentKp.value?.kp ?? null)
const kpTimeTag = computed(() => currentKp.value?.timeTag ?? '')
const liveKp = computed(() => liveEstimate.value?.kp ?? null)
const basKp = computed(() => {
  const bas = getBASCurrent()
  return bas?.kp ?? null
})
const balkanKp = computed(() => {
  const balkan = getBalkanCurrent()
  return balkan?.kp ?? null
})

// Returns true when data exists and is older than 6h. Empty history is NOT
// stale — it just means we haven't loaded yet.
function isDataStale(history) {
  if (!history || history.length === 0) return false
  const latest = history[history.length - 1]
  const latestTime = new Date(latest.timeTag.replace(' ', 'T') + 'Z').getTime()
  return Date.now() - latestTime > 6 * 3600000
}

// Returns true when we shouldn't trust this source (either stale OR empty).
// Drives the fallback-to-NOAA decision so the user always sees *some* data.
function shouldFallback(history) {
  if (!history || history.length === 0) return true
  return isDataStale(history)
}

// Stale badge: only shown when data is actually old, not during loading. This
// keeps the badge from flashing on first page load while BAS data is fetching.
const isSelectedSourceStale = computed(() => {
  if (settings.value.dataSource === 'bas') return isDataStale(getBASHistory())
  if (settings.value.dataSource === 'balkan') return isDataStale(getBalkanHistory())
  return false
})

// Effective source. Falls back to NOAA when selected source has stale OR
// missing data, so downstream components (gauge, chart, alert, log) always
// have something to render.
const activeSource = computed(() => {
  if (settings.value.dataSource === 'bas' && shouldFallback(getBASHistory())) return 'noaa'
  if (settings.value.dataSource === 'balkan' && shouldFallback(getBalkanHistory())) return 'noaa'
  return settings.value.dataSource
})

const activeKp = computed(() => {
  if (activeSource.value === 'bas') return basKp.value
  if (activeSource.value === 'balkan') return balkanKp.value
  return liveKp.value ?? kpNum.value
})

// Tracks the chart's selected range so we can force NOAA in 3d/7d views
// (BAS and Komshi don't keep multi-day history; NOAA's endpoint serves 30+ days).
const chartRange = ref('24h')
const chartIsLongView = computed(() => chartRange.value === '3d' || chartRange.value === '7d')
const chartForcedNoaa = computed(() => chartIsLongView.value && activeSource.value !== 'noaa')

const activeHistory = computed(() => {
  if (chartForcedNoaa.value) return kpHistory.value
  if (activeSource.value === 'bas') return getBASHistory()
  if (activeSource.value === 'balkan') return getBalkanHistory()
  return kpHistory.value
})

// Source-aware forecast: each item tagged with its origin source so the chart
// can label which provider's prediction the user is seeing.
//   - NOAA selected: NOAA's own observed+estimated+predicted, all tagged 'noaa'
//   - BAS fresh: BAS observed + BAS 6h forecast + NOAA forecast for windows
//                beyond BAS's reach (so 3d/7d views still have far-future bars)
//   - Balkan fresh: Balkan observed + NOAA forecast (Komshi can't forecast —
//                   ground magnetometers only observe)
//   - Any stale: fall through to NOAA entirely
const activeForecast = computed(() => {
  if (chartForcedNoaa.value || isSelectedSourceStale.value || settings.value.dataSource === 'noaa') {
    return kpForecast.value.map(f => ({ ...f, source: 'noaa' }))
  }

  if (settings.value.dataSource === 'bas') {
    const observed = getBASHistory().map(h => ({ ...h, type: 'observed', source: 'bas' }))
    const observedKeys = new Set(observed.map(o => o.timeTag))
    // BAS history's latest window and BAS forecast's first window are the same
    // 3h window — observed wins (it's a real measurement). Same dedup against
    // the NOAA continuation tail.
    const basPred = getBASForecast().filter(p => !observedKeys.has(p.timeTag))
    const basPredKeys = new Set(basPred.map(p => p.timeTag))
    const basPredEnd = basPred.length > 0
      ? new Date(basPred[basPred.length - 1].timeTag.replace(' ', 'T') + 'Z').getTime()
      : Date.now()
    const noaaContinuation = kpForecast.value
      .filter(f => f.type === 'predicted')
      .filter(f => new Date(f.timeTag.replace(' ', 'T') + 'Z').getTime() > basPredEnd)
      .filter(f => !observedKeys.has(f.timeTag) && !basPredKeys.has(f.timeTag))
      .map(f => ({ ...f, source: 'noaa' }))
    return [...observed, ...basPred, ...noaaContinuation]
  }

  // balkan: ground magnetometers can't forecast, so we use NOAA's predicted
  // bars. Dedup against Balkan history just in case there's a window overlap.
  const observed = getBalkanHistory().map(h => ({ ...h, type: 'observed', source: 'balkan' }))
  const observedKeys = new Set(observed.map(o => o.timeTag))
  const noaaPredicted = kpForecast.value
    .filter(f => f.type === 'predicted')
    .filter(f => !observedKeys.has(f.timeTag))
    .map(f => ({ ...f, source: 'noaa' }))
  return [...observed, ...noaaPredicted]
})

const activeThreshold = computed(() => {
  if (activeSource.value === 'bas') return settings.value.thresholdBas
  if (activeSource.value === 'balkan') return settings.value.thresholdBalkan
  return settings.value.thresholdNoaa
})

// Ticks every 30s so the staleness badge updates without a full refetch.
const nowTick = ref(Date.now())
let nowTimer = null
onMounted(() => { nowTimer = setInterval(() => { nowTick.value = Date.now() }, 30000) })
onUnmounted(() => { if (nowTimer) clearInterval(nowTimer) })

// How old is the data the user is currently looking at, in minutes? Reflects
// activeSource — NOAA is client-fetched (always fresh), BAS/Komshi depend on
// the GitHub Actions cron (often 1-2h behind because of free-tier throttling).
const dataAgeMinutes = computed(() => {
  // touch nowTick so this recomputes on the timer
  const now = nowTick.value
  let lastUpdatedTime
  if (activeSource.value === 'bas') {
    const ts = getBASLastUpdated()
    lastUpdatedTime = ts ? new Date(ts).getTime() : null
  } else if (activeSource.value === 'balkan') {
    const ts = getBalkanLastUpdated()
    lastUpdatedTime = ts ? new Date(ts).getTime() : null
  } else {
    lastUpdatedTime = lastUpdate.value?.getTime() ?? null
  }
  if (!lastUpdatedTime) return null
  return Math.max(0, Math.round((now - lastUpdatedTime) / 60000))
})

// fresh < 15 min, stale 15–60, very stale ≥ 60
const stalenessLevel = computed(() => {
  if (dataAgeMinutes.value == null) return 'loading'
  if (dataAgeMinutes.value < 15) return 'fresh'
  if (dataAgeMinutes.value < 60) return 'stale'
  return 'veryStale'
})

const dataAgeLabel = computed(() => {
  if (dataAgeMinutes.value == null) return t('app.loading')
  if (dataAgeMinutes.value === 0) return t('app.dataAgeNow')
  if (dataAgeMinutes.value < 60) return t('app.dataAgeMin', { min: dataAgeMinutes.value })
  const h = Math.floor(dataAgeMinutes.value / 60)
  const m = dataAgeMinutes.value % 60
  return t('app.dataAgeHours', { hours: h, min: m })
})

const effectiveTz = computed(() =>
  settings.value.timezone === 'local'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : settings.value.timezone
)

// Inline threshold edits in the gauge edit *what the user is currently seeing*,
// so we route to the effective source's key — not settings.dataSource — which
// keeps WYSIWYG honest when a stale source is falling back to NOAA.
function updateActiveThreshold(newValue) {
  if (activeSource.value === 'bas') settings.value.thresholdBas = newValue
  else if (activeSource.value === 'balkan') settings.value.thresholdBalkan = newValue
  else settings.value.thresholdNoaa = newValue
}

</script>

<template>
  <div class="min-h-screen">
    <!-- Header -->
    <header class="sticky top-0 z-40 backdrop-blur-md bg-bg-primary/80 border-b border-[var(--color-border)] safe-top">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div class="flex items-baseline gap-3">
          <h1 class="text-xl font-bold text-text-primary tracking-tight">{{ t('app.title') }}</h1>
          <span class="text-xs text-text-muted hidden sm:inline">{{ t('app.subtitle') }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="data-age-badge text-[10px] sm:text-xs font-semibold px-2 py-1 rounded-md whitespace-nowrap"
            :class="`level-${stalenessLevel}`"
            :title="t('app.cronHint', { refresh: settings.refreshInterval })"
          >
            {{ dataAgeLabel }}
          </span>
          <button
            class="min-w-[44px] min-h-[44px] rounded-xl bg-[var(--color-card-bg)] hover:bg-[var(--color-bg-input)] flex items-center justify-center text-text-secondary transition-colors"
            @click="fetchAll"
          >
            <span :class="{ spin: loading }">&#8635;</span>
          </button>
          <button
            class="min-w-[44px] min-h-[44px] rounded-xl bg-[var(--color-card-bg)] hover:bg-[var(--color-bg-input)] flex items-center justify-center text-text-secondary transition-colors"
            @click="showSettings = true"
          >
            &#9881;
          </button>
        </div>
      </div>
    </header>

    <!-- Alert -->
    <AlertBanner :kp="activeKp" :threshold="activeThreshold" :source="activeSource" />

    <!-- Main Content -->
    <main class="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
      <!-- Top Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <KpGauge
          class="panel-enter panel-delay-1"
          :kp="kpNum"
          :live-kp="liveKp"
          :bas-kp="basKp"
          :balkan-kp="balkanKp"
          :data-source="settings.dataSource"
          :active-source="activeSource"
          :is-stale="isSelectedSourceStale"
          :kp-type="currentKp?.type"
          :time-tag="kpTimeTag"
          :threshold="activeThreshold"
          :timezone="effectiveTz"
          :get-kp-color="getKpColor"
          :get-kp-level="getKpLevel"
          :get-noaa-scale="getNoaaScale"
          :get3h-window="get3hWindow"
          @update:data-source="(v) => settings.dataSource = v"
          @update:threshold="updateActiveThreshold"
        />
        <SolarWind
          class="panel-enter panel-delay-2"
          :sw="solarWind"
        />
      </div>

      <KpChart
        class="panel-enter panel-delay-3"
        :history="activeHistory"
        :forecast="activeForecast"
        :threshold="activeThreshold"
        :timezone="effectiveTz"
        :active-source="activeSource"
        :forced-noaa="chartForcedNoaa"
        :get-kp-color="getKpColor"
        :format-time="formatTime"
        @update:range="(r) => chartRange = r"
      />

      <NewsFeed
        class="panel-enter panel-delay-4"
        :news-data="newsData"
        :timezone="effectiveTz"
      />

      <!-- Info Section -->
      <div class="glass-panel p-5 sm:p-6 panel-enter panel-delay-5">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-text-primary">{{ t('info.title') }}</h2>
          <button
            class="px-4 py-2 rounded-xl text-xs bg-[var(--color-card-bg)] text-text-secondary hover:bg-[var(--color-bg-input)] transition-colors min-h-[44px] flex items-center"
            @click="showInfo = !showInfo"
          >
            {{ showInfo ? t('info.hide') : t('info.show') }}
          </button>
        </div>

        <Transition name="info">
          <div v-if="showInfo" class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-text-secondary leading-relaxed">
            <div>
              <h3 class="text-accent font-semibold mb-2 flex items-center gap-2">
                {{ t('info.noaaTitle') }}
                <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-kp-quiet/15 text-kp-quiet border border-kp-quiet/30">
                  {{ t('source.kind.measured') }}
                </span>
              </h3>
              <p class="mb-3">{{ t('info.noaaText') }}</p>
              <div class="bg-[var(--color-card-bg)] rounded-lg px-3 py-2 mb-3 text-xs text-text-muted font-mono">{{ t('info.noaaMath') }}</div>
              <div class="space-y-1.5 text-xs">
                <div class="flex gap-2"><span class="w-12 font-bold text-kp-quiet">0-3</span> {{ t('info.quiet') }}</div>
                <div class="flex gap-2"><span class="w-12 font-bold text-kp-unsettled">4</span> {{ t('info.active') }}</div>
                <div class="flex gap-2"><span class="w-12 font-bold text-kp-storm">5-6</span> {{ t('info.stormG1G2') }}</div>
                <div class="flex gap-2"><span class="w-12 font-bold text-kp-severe">7-9</span> {{ t('info.severeG3G5') }}</div>
              </div>
            </div>
            <div>
              <h3 class="text-accent font-semibold mb-2 flex items-center gap-2">
                {{ t('info.basTitle') }}
                <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-kp-unsettled/15 text-kp-unsettled border border-kp-unsettled/30">
                  {{ t('source.kind.model') }}
                </span>
              </h3>
              <p class="mb-3">{{ t('info.basText') }}</p>
              <div class="bg-kp-unsettled/8 border border-kp-unsettled/25 rounded-lg px-3 py-2.5 mb-3 text-xs text-text-secondary flex gap-2 items-start">
                <span class="text-base shrink-0 leading-none" aria-hidden="true">⚠️</span>
                <span>{{ t('info.basWarning') }}</span>
              </div>
              <div class="bg-[var(--color-card-bg)] rounded-lg px-3 py-2 mb-3 text-xs text-text-muted font-mono">{{ t('info.basMath') }}</div>
              <div class="space-y-1.5 text-xs">
                <div class="flex gap-2"><span class="w-12 font-bold text-kp-quiet">0-3</span> {{ t('info.quiet') }}</div>
                <div class="flex gap-2"><span class="w-12 font-bold text-kp-unsettled">4</span> {{ t('info.active') }}</div>
                <div class="flex gap-2"><span class="w-12 font-bold text-kp-storm">5-6</span> {{ t('info.stormG1G2') }}</div>
                <div class="flex gap-2"><span class="w-12 font-bold text-kp-severe">7-9</span> {{ t('info.severeG3G5') }}</div>
              </div>
            </div>
            <div>
              <h3 class="text-accent font-semibold mb-2 flex items-center gap-2 flex-wrap">
                {{ t('info.komshiTitle') }}
                <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-kp-quiet/15 text-kp-quiet border border-kp-quiet/30">
                  {{ t('source.kind.measured') }} · {{ t('source.kind.iaga') }}
                </span>
              </h3>
              <p class="mb-3">{{ t('info.komshiText') }}</p>
              <p class="mb-3 text-xs text-text-muted italic">{{ t('source.balkan.iagaTooltip') }}</p>
              <div class="bg-[var(--color-card-bg)] rounded-lg px-3 py-2 mb-3 text-xs text-text-muted font-mono">{{ t('info.komshiMath') }}</div>
              <div class="space-y-1.5 text-xs">
                <div class="flex gap-2"><span class="w-12 font-bold text-kp-quiet">0-3</span> {{ t('info.quiet') }}</div>
                <div class="flex gap-2"><span class="w-12 font-bold text-kp-unsettled">4</span> {{ t('info.active') }}</div>
                <div class="flex gap-2"><span class="w-12 font-bold text-kp-storm">5-6</span> {{ t('info.stormG1G2') }}</div>
                <div class="flex gap-2"><span class="w-12 font-bold text-kp-severe">7-9</span> {{ t('info.severeG3G5') }}</div>
              </div>
            </div>
            <div class="md:col-span-3 pt-3 border-t border-[var(--color-border)] text-xs text-text-muted">
              Data: <a href="https://www.swpc.noaa.gov/" target="_blank" class="text-accent hover:underline">NOAA SWPC</a> &bull;
              <a href="http://www.geophys.bas.bg/kp_for/kp_mod_en.php" target="_blank" class="text-accent hover:underline">BAS Geophysical Institute</a> &bull;
              <a href="https://imag-data.bgs.ac.uk/GIN_V1/GINServices" target="_blank" class="text-accent hover:underline">INTERMAGNET</a> &bull;
              <a href="https://kp.gfz-potsdam.de/" target="_blank" class="text-accent hover:underline">GFZ Potsdam</a>
            </div>
          </div>
        </Transition>
      </div>

    </main>

    <!-- Footer -->
    <footer class="text-center py-5 text-xs text-text-muted border-t border-[var(--color-border)] mt-4 safe-bottom">
      <p>{{ t('footer.dataFrom') }} <a href="https://www.swpc.noaa.gov/" target="_blank" class="text-accent hover:underline">NOAA SWPC</a>. {{ t('footer.autoRefresh', { seconds: settings.refreshInterval }) }}</p>
      <p class="mt-1">{{ t('footer.disclaimer') }}</p>
    </footer>

    <!-- Settings Modal -->
    <SettingsModal
      :show="showSettings"
      :settings="settings"
      @close="showSettings = false"
      @update="(v) => Object.assign(settings, v)"
    />
  </div>
</template>

<style scoped>
.info-enter-active, .info-leave-active { transition: all 0.3s ease; overflow: hidden; }
.info-enter-from, .info-leave-to { opacity: 0; max-height: 0; }
.info-enter-to, .info-leave-from { opacity: 1; max-height: 600px; }

/* Staleness badge: green when fresh, amber 15-60m, red ≥1h. Tooltip
   explains the GitHub Actions cron throttle so users don't think the
   app is broken when data lags. */
.data-age-badge {
  border: 1px solid transparent;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  cursor: help;
}
.data-age-badge.level-fresh {
  background: rgba(34, 197, 94, 0.12);
  color: var(--color-kp-quiet);
  border-color: rgba(34, 197, 94, 0.25);
}
.data-age-badge.level-stale {
  background: rgba(234, 179, 8, 0.12);
  color: var(--color-kp-unsettled);
  border-color: rgba(234, 179, 8, 0.3);
}
.data-age-badge.level-veryStale {
  background: rgba(239, 68, 68, 0.12);
  color: var(--color-kp-severe);
  border-color: rgba(239, 68, 68, 0.3);
}
.data-age-badge.level-loading {
  background: var(--color-card-bg);
  color: var(--color-text-muted);
}
</style>
