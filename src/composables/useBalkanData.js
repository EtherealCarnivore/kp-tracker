import { ref, onMounted, onUnmounted } from 'vue'

const balkanData = ref(null)
const balkanLoading = ref(false)
const balkanError = ref(null)

let balkanTimer = null

async function fetchBalkanData() {
  balkanLoading.value = true
  balkanError.value = null
  try {
    const base = import.meta.env.BASE_URL || '/'
    const res = await fetch(`${base}data/balkan-k.json?t=${Date.now()}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    balkanData.value = data
  } catch (e) {
    balkanError.value = e.message
    console.warn('Failed to fetch Balkan K data:', e)
  }
  balkanLoading.value = false
}

function getBalkanCurrent() {
  if (!balkanData.value?.current?.balkan_k) return null
  return {
    kp: balkanData.value.current.balkan_k,
    timeTag: balkanData.value.current.time_tag,
    type: 'balkan_k',
    activityLevel: balkanData.value.current.activity_level,
    stationCount: balkanData.value.current.station_count,
  }
}

function getBalkanHistory() {
  if (!balkanData.value?.windows_3h) return []
  return balkanData.value.windows_3h.map(w => ({
    timeTag: w.time_tag,
    kp: w.balkan_k,
  }))
}

function getBalkanStations() {
  return balkanData.value?.stations ?? []
}

export function useBalkanData(refreshSeconds = 120) {
  onMounted(() => {
    fetchBalkanData()
    balkanTimer = setInterval(fetchBalkanData, refreshSeconds * 1000)
  })

  onUnmounted(() => {
    if (balkanTimer) clearInterval(balkanTimer)
  })

  return {
    balkanData,
    balkanLoading,
    balkanError,
    fetchBalkanData,
    getBalkanCurrent,
    getBalkanHistory,
    getBalkanStations,
  }
}
