<script setup>
import { computed, ref } from 'vue'
import { useKpData } from './composables/useKpData.js'
import { useSymptomLog } from './composables/useSymptomLog.js'
import { useSettings } from './composables/useSettings.js'
import { useTheme } from './composables/useTheme.js'
import { useI18n } from './i18n/index.js'

import AlertBanner from './components/AlertBanner.vue'
import KpGauge from './components/KpGauge.vue'
import SolarWind from './components/SolarWind.vue'
import KpChart from './components/KpChart.vue'
import SymptomTracker from './components/SymptomTracker.vue'
import CorrelationView from './components/CorrelationView.vue'
import SettingsModal from './components/SettingsModal.vue'

const { t } = useI18n()
const { settings } = useSettings()
useTheme() // Initialize theme on load

const {
  currentKp, liveEstimate, kpHistory, kpForecast, solarWind, lastUpdate, loading,
  fetchAll, getKpColor, getKpLevel, getNoaaScale, noaaToBAS, formatTime, get3hWindow,
} = useKpData(settings.value.refreshInterval)

const {
  recentLogs, stats, addLog, deleteLog, clearAllLogs, exportLogs, importLogs,
} = useSymptomLog()

const showSettings = ref(false)
const showInfo = ref(false)

const kpNum = computed(() => currentKp.value?.kp ?? null)
const kpTimeTag = computed(() => currentKp.value?.timeTag ?? '')
const liveKp = computed(() => liveEstimate.value?.kp ?? null)
const basEstimate = computed(() => kpNum.value !== null ? noaaToBAS(kpNum.value) : null)

const lastUpdateStr = computed(() => {
  if (!lastUpdate.value) return t('app.loading')
  const tz = settings.value.timezone === 'local'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : settings.value.timezone
  return t('app.updated') + ' ' + lastUpdate.value.toLocaleString('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
})

const effectiveTz = computed(() =>
  settings.value.timezone === 'local'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : settings.value.timezone
)

function handleSaveLog(entry) {
  addLog(entry)
}

async function handleImport(file) {
  try {
    const count = await importLogs(file)
    alert(`Imported ${count} new entries.`)
  } catch (e) {
    alert('Import failed: ' + e.message)
  }
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
          <span class="text-xs text-text-muted hidden sm:inline">{{ lastUpdateStr }}</span>
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
    <AlertBanner :kp="kpNum" :threshold="settings.threshold" />

    <!-- Main Content -->
    <main class="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
      <!-- Top Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <KpGauge
          class="panel-enter panel-delay-1"
          :kp="kpNum"
          :live-kp="liveKp"
          :bas-estimate="basEstimate"
          :show-bas="settings.showBASEstimate"
          :kp-type="currentKp?.type"
          :time-tag="kpTimeTag"
          :threshold="settings.threshold"
          :timezone="effectiveTz"
          :get-kp-color="getKpColor"
          :get-kp-level="getKpLevel"
          :get-noaa-scale="getNoaaScale"
          :get3h-window="get3hWindow"
        />
        <SolarWind
          class="panel-enter panel-delay-2"
          :sw="solarWind"
        />
      </div>

      <KpChart
        class="panel-enter panel-delay-3"
        :history="kpHistory"
        :forecast="kpForecast"
        :threshold="settings.threshold"
        :timezone="effectiveTz"
        :get-kp-color="getKpColor"
        :format-time="formatTime"
      />

      <SymptomTracker
        class="panel-enter panel-delay-4"
        :logs="recentLogs"
        :current-kp="kpNum"
        :timezone="effectiveTz"
        @save="handleSaveLog"
        @delete="deleteLog"
      />

      <CorrelationView
        class="panel-enter panel-delay-5"
        :stats="stats"
      />

      <!-- Info Section -->
      <div class="glass-panel p-5 sm:p-6 panel-enter panel-delay-6">
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
          <div v-if="showInfo" class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-text-secondary leading-relaxed">
            <div>
              <h3 class="text-accent font-semibold mb-2">{{ t('info.whatIsKp') }}</h3>
              <p class="mb-3">{{ t('info.whatIsKpText') }}</p>
              <div class="space-y-1.5 text-xs">
                <div class="flex gap-2"><span class="w-12 font-bold text-kp-quiet">0-3</span> {{ t('info.quiet') }}</div>
                <div class="flex gap-2"><span class="w-12 font-bold text-kp-unsettled">4</span> {{ t('info.active') }}</div>
                <div class="flex gap-2"><span class="w-12 font-bold text-kp-storm">5-6</span> {{ t('info.stormG1G2') }}</div>
                <div class="flex gap-2"><span class="w-12 font-bold text-kp-severe">7-9</span> {{ t('info.severeG3G5') }}</div>
              </div>
            </div>
            <div>
              <h3 class="text-accent font-semibold mb-2">{{ t('info.affectPeople') }}</h3>
              <p class="mb-3">{{ t('info.affectText') }}</p>
              <h3 class="text-accent font-semibold mb-2">{{ t('info.bulgaria') }}</h3>
              <p>{{ t('info.bulgariaText') }}</p>
            </div>
            <div class="md:col-span-2 pt-3 border-t border-[var(--color-border)] text-xs text-text-muted">
              Data: <a href="https://www.swpc.noaa.gov/" target="_blank" class="text-accent hover:underline">NOAA SWPC</a> &bull;
              <a href="http://www.geophys.bas.bg/kp_for/kp_mod_en.php" target="_blank" class="text-accent hover:underline">BAS Geophysical Institute</a> &bull;
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
      @export="exportLogs"
      @import="handleImport"
      @clear="clearAllLogs"
    />
  </div>
</template>

<style scoped>
.info-enter-active, .info-leave-active { transition: all 0.3s ease; overflow: hidden; }
.info-enter-from, .info-leave-to { opacity: 0; max-height: 0; }
.info-enter-to, .info-leave-from { opacity: 1; max-height: 600px; }
</style>
