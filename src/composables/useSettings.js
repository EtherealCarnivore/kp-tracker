import { ref, watch } from 'vue'

const STORAGE_KEY = 'kp-tracker-settings'

const defaults = {
  threshold: 4,
  timezone: 'Europe/Sofia',
  refreshInterval: 120,
  dataSource: 'noaa', // 'noaa' or 'bas'
}

const settings = ref({ ...defaults })

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      settings.value = { ...defaults, ...JSON.parse(raw) }
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
