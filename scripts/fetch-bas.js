/**
 * Fetches Kpm data from the Bulgarian Academy of Sciences (NIGGG-BAS).
 *
 * Data source: http://www.geophys.bas.bg/kp_for/kp_mod_en.php
 * The HTML page contains the real-time model output (15-min Kpm estimates
 * and 6-hour forecast) which differs from the static text files.
 *
 * This script runs via GitHub Actions every 15 minutes and writes
 * the parsed data to public/data/bas-kpm.json for the frontend to consume.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = join(__dirname, '..', 'public', 'data', 'bas-kpm.json')

const BAS_URL = 'http://www.geophys.bas.bg/kp_for/kp_mod_en.php'

async function fetchWithTimeout(url, timeoutMs = 15000) {
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
 * Parse the BAS HTML page.
 * The page contains two tables:
 *   1. Observed/estimated values (past ~30h)
 *   2. Forecast for next 6 hours (after "Forecast for next 6 hours" divider)
 *
 * Each cell: "HH:MM | value" or "HH:MM | n/a"
 */
function parseBASHtml(html) {
  const observed = []
  const forecast = []

  // Find the forecast divider to separate observed vs forecast
  const forecastDividerIdx = html.indexOf('Forecast for next 6 hours')
  if (forecastDividerIdx === -1) {
    // Try Bulgarian version
    const bgIdx = html.indexOf('6 часа')
    if (bgIdx === -1) {
      console.warn('Could not find forecast divider')
    }
  }

  // Extract all table cells with time|value pattern
  const cellRegex = /<td[^>]*>(\d{1,2}:\d{2})\s*\|\s*([\d.]+|n\/a)<\/td>/gi
  let match
  let isForecast = false

  // Track position to determine if we're past the forecast divider
  while ((match = cellRegex.exec(html)) !== null) {
    if (forecastDividerIdx > 0 && match.index > forecastDividerIdx) {
      isForecast = true
    }

    const time = match[1]
    const valueStr = match[2]

    if (valueStr === 'n/a') continue

    const kpm = parseFloat(valueStr)
    if (isNaN(kpm)) continue

    const entry = { time, kpm }

    if (isForecast) {
      forecast.push(entry)
    } else {
      observed.push(entry)
    }
  }

  return { observed, forecast }
}

/**
 * Convert time-only entries to full timestamps.
 * BAS shows times in UTC. We need to figure out dates from context:
 * - The page shows ~30h of past data + 6h forecast
 * - Times wrap around midnight, so we detect day boundaries
 */
function entriesToTimestamps(entries, referenceDate) {
  if (entries.length === 0) return []

  const result = []
  const now = referenceDate
  const todayStr = now.toISOString().split('T')[0]

  // Work backwards from now to assign dates
  // Start from the last observed entry and work backwards
  let currentDate = new Date(todayStr + 'T00:00:00Z')
  let prevHour = 99

  for (let i = entries.length - 1; i >= 0; i--) {
    const [hh, mm] = entries[i].time.split(':').map(Number)

    // If hour jumps up (going backwards means we crossed midnight backwards)
    if (hh > prevHour) {
      currentDate = new Date(currentDate.getTime() - 86400000)
    }
    prevHour = hh

    const dateStr = currentDate.toISOString().split('T')[0]
    const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`

    result[i] = {
      time_tag: `${dateStr} ${timeStr}`,
      kpm: entries[i].kpm,
    }
  }

  return result
}

function forecastToTimestamps(entries, referenceDate) {
  if (entries.length === 0) return []

  const result = []
  const now = referenceDate
  const todayStr = now.toISOString().split('T')[0]
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0]

  let prevHour = -1
  let currentDateStr = todayStr

  for (const entry of entries) {
    const [hh, mm] = entry.time.split(':').map(Number)

    // Detect midnight wrap in forecast
    if (hh < prevHour) {
      currentDateStr = tomorrowStr
    }
    prevHour = hh

    const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`

    result.push({
      time_tag: `${currentDateStr} ${timeStr}`,
      kpm: entry.kpm,
      type: 'forecast',
    })
  }

  return result
}

/**
 * Convert 15-minute Kpm entries into 3-hour windows
 */
function to3HourWindows(entries) {
  const groups = {}

  for (const entry of entries) {
    const d = new Date(entry.time_tag.replace(' ', 'T') + 'Z')
    const windowHour = Math.floor(d.getUTCHours() / 3) * 3
    const key = `${d.toISOString().split('T')[0]}T${String(windowHour).padStart(2, '0')}:00:00`

    if (!groups[key]) groups[key] = []
    groups[key].push(entry.kpm)
  }

  const windows = []
  for (const [timeTag, values] of Object.entries(groups).sort()) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const max = Math.max(...values)
    windows.push({
      time_tag: timeTag.replace('T', ' '),
      kpm_avg: Math.round(avg * 100) / 100,
      kpm_max: max,
      kpm_latest: values[values.length - 1],
      readings: values.length,
    })
  }

  return windows
}

async function main() {
  const now = new Date()

  console.log(`Fetching BAS data from HTML page...`)

  let html
  try {
    const res = await fetchWithTimeout(BAS_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    html = await res.text()
    console.log(`Fetched HTML: ${html.length} bytes`)
  } catch (e) {
    console.error(`Failed to fetch BAS page: ${e.message}`)

    // Preserve existing data
    let existingData = { status: 'unknown' }
    try {
      if (existsSync(OUTPUT_PATH)) {
        existingData = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'))
      }
    } catch {}

    existingData.status = 'bas_unreachable'
    existingData.last_check = now.toISOString()
    writeFileSync(OUTPUT_PATH, JSON.stringify(existingData, null, 2))
    return
  }

  const { observed, forecast } = parseBASHtml(html)
  console.log(`Parsed: ${observed.length} observed, ${forecast.length} forecast entries`)

  if (observed.length === 0) {
    console.error('No observed data parsed from BAS page')
    return
  }

  const observedEntries = entriesToTimestamps(observed, now)
  const forecastEntries = forecastToTimestamps(forecast, now)

  const allEntries = [...observedEntries]
  const windows = to3HourWindows(allEntries)

  // Current = last observed entry
  const latestEntry = observedEntries[observedEntries.length - 1]
  let currentStatus = 'quiet'
  if (latestEntry) {
    if (latestEntry.kpm >= 5) currentStatus = 'storm'
    else if (latestEntry.kpm >= 4) currentStatus = 'active'
  }

  const max24h = allEntries.length > 0
    ? Math.max(...allEntries.map(e => e.kpm))
    : null

  const output = {
    source: 'NIGGG-BAS (Bulgarian Academy of Sciences)',
    methodology: 'Kpm - estimated Kp from ACE satellite data using MAK model',
    confidence_interval: '±0.63 at 50% probability',
    last_updated: now.toISOString(),
    last_check: now.toISOString(),
    status: 'ok',
    current: {
      kpm: latestEntry?.kpm ?? null,
      time_tag: latestEntry?.time_tag ?? null,
      activity_level: currentStatus,
    },
    max_24h: max24h,
    entries_15min: observedEntries,
    forecast_15min: forecastEntries,
    windows_3h: windows,
  }

  // Ensure output directory exists
  const dir = dirname(OUTPUT_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log(`Written to ${OUTPUT_PATH}`)
  console.log(`Current Kpm: ${output.current.kpm} (${output.current.activity_level})`)
  console.log(`Max 24h: ${output.max_24h}`)
  console.log(`3h windows: ${windows.length}`)
  if (forecastEntries.length > 0) {
    console.log(`Forecast: ${forecastEntries.length} entries, next=${forecastEntries[0].kpm}`)
  }
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
