import { ref, computed, onMounted, onUnmounted } from 'vue'

const NOAA_BASE = 'https://services.swpc.noaa.gov'

// Shared reactive state
const currentKp = ref(null)       // 3-hourly observed/estimated Kp (the "official" value)
const liveEstimate = ref(null)    // 1-minute running estimate (secondary)
const kpHistory = ref([])
const kpForecast = ref([])
const solarWind = ref({ speed: null, bz: null, bt: null, density: null, temperature: null })
const lastUpdate = ref(null)
const loading = ref(true)
const error = ref(null)

let refreshTimer = null

function getKpColor(kp) {
  const v = parseFloat(kp)
  if (v < 2) return '#22c55e'
  if (v < 3) return '#4ade80'
  if (v < 4) return '#a3e635'
  if (v === 4 || (v >= 3.67 && v < 5)) return '#eab308'
  if (v < 6) return '#f97316'
  if (v < 7) return '#ea580c'
  if (v < 8) return '#ef4444'
  if (v < 9) return '#dc2626'
  return '#991b1b'
}

function getKpLevel(kp) {
  const v = parseFloat(kp)
  if (v < 4) return 'Quiet'
  if (v < 5) return 'Active'
  if (v < 6) return 'Minor Storm (G1)'
  if (v < 7) return 'Moderate Storm (G2)'
  if (v < 8) return 'Strong Storm (G3)'
  if (v < 9) return 'Severe Storm (G4)'
  return 'Extreme Storm (G5)'
}

function getNoaaScale(kp) {
  const v = parseFloat(kp)
  if (v >= 9) return 'G5'
  if (v >= 8) return 'G4'
  if (v >= 7) return 'G3'
  if (v >= 6) return 'G2'
  if (v >= 5) return 'G1'
  return null
}

/**
 * Convert NOAA global Kp to an approximate BAS Kpm equivalent.
 *
 * BAS uses their own Kpm methodology (MAK model) based on ACE satellite data
 * and the Panagyurishte observatory. The correlation with global Kp is r~0.84
 * but BAS values tend to be significantly lower, especially during storms.
 *
 * This is a rough linear approximation based on observed data:
 * - At quiet conditions (Kp 0-2): Kpm ≈ Kp (similar)
 * - At active conditions (Kp 3-5): Kpm ≈ 0.65 * Kp
 * - At storm conditions (Kp 5+): Kpm ≈ 0.45 * Kp + 0.5
 *
 * NOT scientifically precise — this is an approximation for reference only.
 */
function noaaToBAS(kp) {
  const v = parseFloat(kp)
  if (isNaN(v)) return null
  if (v <= 2) return Math.round(v * 0.9 * 100) / 100
  if (v <= 5) return Math.round((v * 0.65 + 0.3) * 100) / 100
  // Storm: aggressive reduction — BAS reads much lower in storms
  return Math.round((v * 0.45 + 0.8) * 100) / 100
}

function formatTime(utcStr, tz = 'Europe/Sofia') {
  try {
    const d = new Date(utcStr.replace(' ', 'T') + (utcStr.includes('Z') ? '' : 'Z'))
    return d.toLocaleString('en-GB', {
      timeZone: tz,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return utcStr
  }
}

function formatTimeShort(utcStr, tz = 'Europe/Sofia') {
  try {
    const d = new Date(utcStr.replace(' ', 'T') + (utcStr.includes('Z') ? '' : 'Z'))
    return d.toLocaleString('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return utcStr
  }
}

function get3hWindow(utcStr, tz = 'Europe/Sofia') {
  try {
    const d = new Date(utcStr.replace(' ', 'T') + (utcStr.includes('Z') ? '' : 'Z'))
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
    const start = formatter.format(d)
    const end = formatter.format(new Date(d.getTime() + 3 * 60 * 60 * 1000))
    return `${start} - ${end}`
  } catch {
    return '--'
  }
}

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.json()
}

async function fetchCurrentKp() {
  // Use the history endpoint for the main value (most reliable)
  try {
    const data = await fetchJSON(`${NOAA_BASE}/products/noaa-planetary-k-index.json`)
    if (data && data.length > 1) {
      const latest = data[data.length - 1]
      const kp = parseFloat(latest.Kp ?? latest.kp ?? 0)
      if (!isNaN(kp)) {
        currentKp.value = {
          kp,
          timeTag: latest.time_tag,
          type: 'observed',
        }
      }
    }
  } catch (e) {
    console.error('Failed to fetch current Kp:', e)
    error.value = 'Failed to fetch Kp data'
  }

  // 1-minute running estimate (secondary)
  try {
    const data = await fetchJSON(`${NOAA_BASE}/json/planetary_k_index_1m.json`)
    if (data && data.length > 0) {
      const latest = data[data.length - 1]
      const kp = parseFloat(latest.estimated_kp ?? latest.kp_index ?? 0)
      if (!isNaN(kp)) {
        liveEstimate.value = {
          kp,
          timeTag: latest.time_tag,
          kpStr: latest.kp || '--',
        }
      }
    }
  } catch (e) {
    console.warn('Failed to fetch 1-min Kp estimate', e)
  }
}

async function fetchKpHistory() {
  try {
    const data = await fetchJSON(`${NOAA_BASE}/products/noaa-planetary-k-index.json`)
    if (data && data.length > 1) {
      // Skip header row if present
      const rows = typeof data[0] === 'object' && !Array.isArray(data[0])
        ? data
        : data.slice(1)
      kpHistory.value = rows.map(row => {
        if (Array.isArray(row)) {
          return { timeTag: row[0], kp: parseFloat(row[1]) }
        }
        return {
          timeTag: row.time_tag,
          kp: parseFloat(row.Kp || row.kp || 0),
        }
      }).filter(r => !isNaN(r.kp))
    }
  } catch (e) {
    console.error('Failed to fetch Kp history', e)
  }
}

async function fetchKpForecast() {
  try {
    const data = await fetchJSON(`${NOAA_BASE}/products/noaa-planetary-k-index-forecast.json`)
    if (data && data.length > 0) {
      const items = data
        .map(row => ({
          timeTag: row.time_tag,
          kp: parseFloat(row.kp),
          type: row.observed, // 'observed', 'estimated', or 'predicted'
          noaaScale: row.noaa_scale,
        }))
        .filter(r => !isNaN(r.kp))
      kpForecast.value = items
    }
  } catch (e) {
    console.error('Failed to fetch Kp forecast', e)
  }
}

async function fetchSolarWind() {
  try {
    const [plasma, mag] = await Promise.all([
      fetchJSON(`${NOAA_BASE}/products/solar-wind/plasma-5-minute.json`),
      fetchJSON(`${NOAA_BASE}/products/solar-wind/mag-5-minute.json`),
    ])

    // Find latest valid entries (skip header row)
    if (plasma && plasma.length > 1) {
      for (let i = plasma.length - 1; i >= 1; i--) {
        const row = plasma[i]
        const speed = parseFloat(Array.isArray(row) ? row[2] : row.speed)
        const density = parseFloat(Array.isArray(row) ? row[1] : row.density)
        const temp = parseFloat(Array.isArray(row) ? row[3] : row.temperature)
        if (!isNaN(speed)) {
          solarWind.value.speed = speed
          solarWind.value.density = isNaN(density) ? null : density
          solarWind.value.temperature = isNaN(temp) ? null : temp
          break
        }
      }
    }

    if (mag && mag.length > 1) {
      for (let i = mag.length - 1; i >= 1; i--) {
        const row = mag[i]
        const bz = parseFloat(Array.isArray(row) ? row[3] : row.bz_gsm)
        const bt = parseFloat(Array.isArray(row) ? row[6] : row.bt)
        if (!isNaN(bz)) {
          solarWind.value.bz = bz
          solarWind.value.bt = isNaN(bt) ? null : bt
          break
        }
      }
    }
  } catch (e) {
    console.error('Failed to fetch solar wind', e)
  }
}

async function fetchAll() {
  loading.value = true
  error.value = null
  await Promise.all([
    fetchCurrentKp(),
    fetchKpHistory(),
    fetchKpForecast(),
    fetchSolarWind(),
  ])
  lastUpdate.value = new Date()
  loading.value = false
}

export function useKpData(refreshSeconds = 120) {
  onMounted(() => {
    fetchAll()
    refreshTimer = setInterval(fetchAll, refreshSeconds * 1000)
  })

  onUnmounted(() => {
    if (refreshTimer) clearInterval(refreshTimer)
  })

  return {
    currentKp,
    liveEstimate,
    kpHistory,
    kpForecast,
    solarWind,
    lastUpdate,
    loading,
    error,
    fetchAll,
    getKpColor,
    getKpLevel,
    getNoaaScale,
    noaaToBAS,
    formatTime,
    formatTimeShort,
    get3hWindow,
  }
}
