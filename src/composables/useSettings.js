import { ref, watch } from 'vue'

const STORAGE_KEY = 'kp-tracker-settings'

const defaults = {
  thresholdBas: 4,
  thresholdNoaa: 4,
  thresholdBalkan: 4,
  timezone: 'Europe/Sofia',
  refreshInterval: 120,
  dataSource: 'noaa', // 'noaa' or 'bas'
}

const settings = ref({ ...defaults })

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Migrate old single threshold to split thresholds
      if (parsed.threshold != null && parsed.thresholdBas == null) {
        parsed.thresholdBas = parsed.threshold
        parsed.thresholdNoaa = parsed.threshold
        delete parsed.threshold
      }
      settings.value = { ...defaults, ...parsed }
    }
  } catch {
    settings.value = { ...defaults }
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
}

export function useSettings() {
  load()

  watch(settings, save, { deep: true })

  return { settings }
}
