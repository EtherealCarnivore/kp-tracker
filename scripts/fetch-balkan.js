/**
 * Fetches magnetometer data from INTERMAGNET Balkan stations and computes
 * a regional K-index ("Balkan K").
 *
 * Stations:
 *   PAG - Panagjurishte, Bulgaria (42.5°N, 24.2°E)
 *   SUA - Surlari, Romania (44.7°N, 26.3°E)
 *   GCK - Grocka, Serbia (44.6°N, 20.8°E)
 *   PEG - Pedeli, Greece (38.1°N, 23.9°E)
 *
 * Method:
 *   1. Fetch 1-minute X,Y data for each station (today + yesterday for baseline)
 *   2. Compute horizontal disturbance H = sqrt(X² + Y²)
 *   3. Estimate quiet baseline via running median over prior day
 *   4. Compute max |ΔH| in each 3-hour window
 *   5. Map amplitude → K using mid-latitude scale
 *   6. Average K across available stations → Balkan K
 *
 * Runs via GitHub Actions alongside fetch-bas.js.
 * Outputs to public/data/balkan-k.json
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = join(__dirname, '..', 'public', 'data', 'balkan-k.json')

const INTERMAGNET_BASE = 'https://imag-data.bgs.ac.uk/GIN_V1/GINServices'

const STATIONS = [
  { code: 'PAG', name: 'Panagjurishte', country: 'Bulgaria', lat: 42.52, lon: 24.18 },
  { code: 'SUA', name: 'Surlari', country: 'Romania', lat: 44.68, lon: 26.25 },
  { code: 'GCK', name: 'Grocka', country: 'Serbia', lat: 44.63, lon: 20.77 },
  { code: 'PEG', name: 'Pedeli', country: 'Greece', lat: 38.10, lon: 23.90 },
]

// Mid-latitude K-index scale (nT thresholds for K=0..9)
// Based on standard NOAA/GFZ scale for ~40-45° geomagnetic latitude
const K_THRESHOLDS = [5, 10, 20, 40, 70, 120, 200, 330, 500]
// K=0: 0-5nT, K=1: 5-10, K=2: 10-20, K=3: 20-40, K=4: 40-70,
// K=5: 70-120, K=6: 120-200, K=7: 200-330, K=8: 330-500, K=9: >500

function amplitudeToK(amplitudeNt) {
  for (let k = 0; k < K_THRESHOLDS.length; k++) {
    if (amplitudeNt < K_THRESHOLDS[k]) return k
  }
  return 9
}

// Convert K back to a fractional value using linear interpolation within the bin
function amplitudeToKFractional(amplitudeNt) {
  if (amplitudeNt < K_THRESHOLDS[0]) {
    return amplitudeNt / K_THRESHOLDS[0]
  }
  for (let k = 1; k < K_THRESHOLDS.length; k++) {
    if (amplitudeNt < K_THRESHOLDS[k]) {
      const lower = K_THRESHOLDS[k - 1]
      const upper = K_THRESHOLDS[k]
      const fraction = (amplitudeNt - lower) / (upper - lower)
      return k + fraction
    }
  }
  return 9
}

async function fetchWithTimeout(url, timeoutMs = 30000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    return res
  } catch (e) {
    clearTimeout(timeout)
    throw e
  }
}

/**
 * Fetch 1-minute magnetometer data for a station from INTERMAGNET.
 * Returns { datetime: string[], X: number[], Y: number[] } or null on failure.
 */
async function fetchStationData(stationCode, dateStr, days = 1) {
  const url = `${INTERMAGNET_BASE}?Request=GetData` +
    `&observatoryIagaCode=${stationCode}` +
    `&samplesPerDay=1440` +
    `&dataStartDate=${dateStr}` +
    `&dataDuration=${days}` +
    `&Format=json` +
    `&publicationState=best-avail`

  try {
    const res = await fetchWithTimeout(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    if (!data.datetime || !data.X || !data.Y) {
      console.warn(`${stationCode}: Missing data arrays`)
      return null
    }

    // Check if there's actual data (not all nulls)
    const hasData = data.X.some(v => v !== null)
    if (!hasData) {
      console.warn(`${stationCode}: All null values for ${dateStr}`)
      return null
    }

    return {
      datetime: data.datetime,
      X: data.X,
      Y: data.Y,
    }
  } catch (e) {
    console.warn(`${stationCode}: Failed to fetch - ${e.message}`)
    return null
  }
}

/**
 * Compute H (horizontal intensity) from X, Y components.
 * H = sqrt(X² + Y²)
 */
function computeH(X, Y) {
  return X.map((x, i) => {
    const y = Y[i]
    if (x === null || y === null) return null
    return Math.sqrt(x * x + y * y)
  })
}

/**
 * Compute a quiet baseline using a running median over a window.
 * For each minute, median of the surrounding ±windowMinutes values.
 * Falls back to a simple daily median for sparse data.
 */
function computeQuietBaseline(H, windowMinutes = 180) {
  const baseline = new Array(H.length)
  const validH = H.filter(v => v !== null)

  if (validH.length === 0) return baseline.fill(null)

  // Global median as ultimate fallback
  const sorted = [...validH].sort((a, b) => a - b)
  const globalMedian = sorted[Math.floor(sorted.length / 2)]

  for (let i = 0; i < H.length; i++) {
    // Gather values in the window
    const start = Math.max(0, i - windowMinutes)
    const end = Math.min(H.length, i + windowMinutes + 1)
    const windowVals = []
    for (let j = start; j < end; j++) {
      if (H[j] !== null) windowVals.push(H[j])
    }

    if (windowVals.length < 10) {
      baseline[i] = globalMedian
    } else {
      windowVals.sort((a, b) => a - b)
      // Use 25th percentile as quiet estimate (disturbances push values up)
      baseline[i] = windowVals[Math.floor(windowVals.length * 0.25)]
    }
  }

  return baseline
}

/**
 * Compute K-index for each 3-hour window from H and baseline arrays.
 * datetimes are ISO strings, H and baseline are arrays of same length.
 */
function computeKWindows(datetimes, H, baseline) {
  // Group by 3-hour window
  const windows = {}

  for (let i = 0; i < datetimes.length; i++) {
    if (H[i] === null || baseline[i] === null) continue

    const dt = new Date(datetimes[i])
    const windowHour = Math.floor(dt.getUTCHours() / 3) * 3
    const dateStr = dt.toISOString().split('T')[0]
    const key = `${dateStr} ${String(windowHour).padStart(2, '0')}:00:00`

    if (!windows[key]) windows[key] = []
    windows[key].push(Math.abs(H[i] - baseline[i]))
  }

  const result = []
  for (const [timeTag, disturbances] of Object.entries(windows).sort()) {
    if (disturbances.length < 30) continue // Need at least 30 min of data in window

    const maxDisturbance = Math.max(...disturbances)
    const k = amplitudeToK(maxDisturbance)
    const kFrac = Math.round(amplitudeToKFractional(maxDisturbance) * 100) / 100

    result.push({
      time_tag: timeTag,
      k_index: k,
      k_fractional: kFrac,
      max_disturbance_nt: Math.round(maxDisturbance * 10) / 10,
      data_points: disturbances.length,
    })
  }

  return result
}

/**
 * Average K-index across multiple stations for each 3-hour window.
 */
function averageStationK(allStationWindows) {
  // Collect all time tags
  const byTime = {}

  for (const { station, windows } of allStationWindows) {
    for (const w of windows) {
      if (!byTime[w.time_tag]) byTime[w.time_tag] = []
      byTime[w.time_tag].push({
        station,
        k_index: w.k_index,
        k_fractional: w.k_fractional,
        max_disturbance_nt: w.max_disturbance_nt,
      })
    }
  }

  const result = []
  for (const [timeTag, readings] of Object.entries(byTime).sort()) {
    const avgK = readings.reduce((s, r) => s + r.k_fractional, 0) / readings.length
    const maxK = Math.max(...readings.map(r => r.k_fractional))

    result.push({
      time_tag: timeTag,
      balkan_k: Math.round(avgK * 100) / 100,
      balkan_k_max: Math.round(maxK * 100) / 100,
      station_count: readings.length,
      stations: readings.map(r => ({
        code: r.station,
        k: r.k_fractional,
        disturbance_nt: r.max_disturbance_nt,
      })),
    })
  }

  return result
}

async function main() {
  const now = new Date()
  console.log(`Fetching Balkan magnetometer data...`)

  // Fetch 2 days: yesterday (for baseline) + today
  const today = now.toISOString().split('T')[0]
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0]

  // Fetch all stations in parallel
  const stationResults = await Promise.all(
    STATIONS.map(async (station) => {
      console.log(`Fetching ${station.code} (${station.name}, ${station.country})...`)
      const data = await fetchStationData(station.code, yesterday, 2)
      return { station, data }
    })
  )

  const allStationWindows = []
  const stationStatus = []

  for (const { station, data } of stationResults) {
    if (!data) {
      stationStatus.push({
        code: station.code,
        name: station.name,
        country: station.country,
        status: 'no_data',
      })
      continue
    }

    const validCount = data.X.filter(v => v !== null).length
    console.log(`${station.code}: ${validCount} valid readings`)

    const H = computeH(data.X, data.Y)
    const baseline = computeQuietBaseline(H)
    const windows = computeKWindows(data.datetime, H, baseline)

    // Only keep today's windows (yesterday was just for baseline)
    const todayWindows = windows.filter(w => w.time_tag.startsWith(today))
    // If today has no data yet, keep yesterday's latest windows
    const recentWindows = todayWindows.length > 0 ? todayWindows : windows.slice(-8)

    allStationWindows.push({ station: station.code, windows: recentWindows })

    stationStatus.push({
      code: station.code,
      name: station.name,
      country: station.country,
      status: 'ok',
      valid_readings: validCount,
      k_windows: recentWindows.length,
    })

    console.log(`${station.code}: ${recentWindows.length} K-windows computed`)
  }

  const averaged = averageStationK(allStationWindows)

  // Current = latest window
  const latest = averaged.length > 0 ? averaged[averaged.length - 1] : null

  let activityLevel = 'quiet'
  if (latest) {
    if (latest.balkan_k >= 5) activityLevel = 'storm'
    else if (latest.balkan_k >= 4) activityLevel = 'active'
    else if (latest.balkan_k >= 3) activityLevel = 'unsettled'
  }

  const max24h = averaged.length > 0
    ? Math.max(...averaged.map(w => w.balkan_k))
    : null

  const output = {
    source: 'INTERMAGNET Balkan Stations',
    methodology: 'Regional K-index from ground magnetometer H-component disturbance (PAG, SUA, GCK, PEG)',
    k_scale: 'Mid-latitude (K9 ≥ 500 nT)',
    last_updated: now.toISOString(),
    status: stationStatus.some(s => s.status === 'ok') ? 'ok' : 'no_data',
    current: latest ? {
      balkan_k: latest.balkan_k,
      time_tag: latest.time_tag,
      activity_level: activityLevel,
      station_count: latest.station_count,
    } : null,
    max_24h: max24h,
    windows_3h: averaged,
    stations: stationStatus,
  }

  // Ensure output directory exists
  const dir = dirname(OUTPUT_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log(`\nWritten to ${OUTPUT_PATH}`)
  if (latest) {
    console.log(`Current Balkan K: ${latest.balkan_k} (${activityLevel})`)
    console.log(`Stations reporting: ${latest.station_count}`)
  }
  console.log(`Max 24h: ${max24h}`)
  console.log(`3h windows: ${averaged.length}`)
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
