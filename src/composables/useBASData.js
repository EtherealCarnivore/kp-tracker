import { ref, onMounted, onUnmounted } from 'vue'

const basData = ref(null)
const basLoading = ref(false)
const basError = ref(null)

let basTimer = null

async function fetchBASData() {
  basLoading.value = true
  basError.value = null
  try {
    // Fetch the JSON file that GitHub Actions maintains
    const base = import.meta.env.BASE_URL || '/'
    const res = await fetch(`${base}data/bas-kpm.json?t=${Date.now()}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    basData.value = data
  } catch (e) {
    basError.value = e.message
    console.warn('Failed to fetch BAS data:', e)
  }
  basLoading.value = false
}

/**
 * Convert BAS 3h windows to the same format as NOAA history
 * so components can use them interchangeably
 */
function getBASHistory() {
  if (!basData.value?.windows_3h) return []
  return basData.value.windows_3h.map(w => ({
    timeTag: w.time_tag,
    kp: w.kpm_latest, // Use the latest reading in the window (closest to what BAS displays)
  }))
}

function getBASCurrent() {
  if (!basData.value?.current?.kpm) return null
  return {
    kp: basData.value.current.kpm,
    timeTag: basData.value.current.time_tag,
    type: 'bas_kpm',
    activityLevel: basData.value.current.activity_level,
  }
}

function getBASStatus() {
  if (!basData.value) return null
  return {
    status: basData.value.status,
    lastUpdated: basData.value.last_updated,
    max24h: basData.value.max_24h,
    source: basData.value.source,
    methodology: basData.value.methodology,
  }
}

export function useBASData(refreshSeconds = 120) {
  onMounted(() => {
    fetchBASData()
    basTimer = setInterval(fetchBASData, refreshSeconds * 1000)
  })

  onUnmounted(() => {
    if (basTimer) clearInterval(basTimer)
  })

  return {
    basData,
    basLoading,
    basError,
    fetchBASData,
    getBASHistory,
    getBASCurrent,
    getBASStatus,
  }
}
