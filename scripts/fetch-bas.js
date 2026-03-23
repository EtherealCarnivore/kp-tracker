/**
 * Fetches Kpm data from the Bulgarian Academy of Sciences (NIGGG-BAS).
 *
 * Data source: http://www.geophys.bas.bg/kp_for/kpYYMMDD.txt
 * Format: 15-minute interval Kpm estimates
 *
 * This script runs via GitHub Actions every 15 minutes and writes
 * the parsed data to public/data/bas-kpm.json for the frontend to consume.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = join(__dirname, '..', 'public', 'data', 'bas-kpm.json')

// BAS hosts (try multiple in case one is down)
const BAS_HOSTS = [
  'http://www.geophys.bas.bg',
  'http://data.niggg.bas.bg',
  'http://data.geophys.bas.bg',
]

function formatDateForBAS(date) {
  const yy = String(date.getUTCFullYear()).slice(2)
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

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

async function fetchBASFile(dateStr) {
  for (const host of BAS_HOSTS) {
    const url = `${host}/kp_for/kp${dateStr}.txt`
    try {
      console.log(`Trying: ${url}`)
      const res = await fetchWithTimeout(url)
      if (res.ok) {
        const text = await res.text()
        if (text.trim().length > 10) {
          console.log(`Success: ${url}`)
          return text
        }
      }
    } catch (e) {
      console.log(`Failed: ${url} (${e.message})`)
    }
  }
  return null
}

/**
 * Parse BAS text file format:
 * Header: "DD MM YYYY 15-minute Estimated Geomagnetic Activity Index"
 * Data: "HH:MM  value"
 */
function parseBASText(text, dateStr) {
  const lines = text.trim().split('\n')
  const entries = []

  // Always derive date from the filename (YYMMDD) — BAS header dates can be wrong
  // e.g., file kp260322.txt has header "26 03 2022" (wrong year)
  const year = 2000 + parseInt(dateStr.slice(0, 2))
  const month = parseInt(dateStr.slice(2, 4))
  const day = parseInt(dateStr.slice(4, 6))

  for (const line of lines.slice(1)) {
    const match = line.trim().match(/^(\d{1,2}):(\d{2})\s+([-\d.]+)/)
    if (match) {
      const hour = parseInt(match[1])
      const minute = parseInt(match[2])
      const kpm = parseFloat(match[3])

      // BAS uses -1 as "no data" sentinel — skip those
      if (kpm < 0) continue

      // Build UTC timestamp
      const dateISO = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const timeISO = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`

      entries.push({
        time_tag: `${dateISO} ${timeISO}`,
        kpm,
      })
    }
  }

  return entries
}

/**
 * Convert 15-minute Kpm entries into 3-hour windows
 * (average of the 12 readings in each 3-hour block)
 */
function to3HourWindows(entries) {
  const windows = []
  const groups = {}

  for (const entry of entries) {
    const d = new Date(entry.time_tag.replace(' ', 'T') + 'Z')
    const windowHour = Math.floor(d.getUTCHours() / 3) * 3
    const key = `${d.toISOString().split('T')[0]}T${String(windowHour).padStart(2, '0')}:00:00`

    if (!groups[key]) groups[key] = []
    groups[key].push(entry.kpm)
  }

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
  const today = formatDateForBAS(now)
  const yesterday = formatDateForBAS(new Date(now.getTime() - 86400000))

  console.log(`Fetching BAS data for ${yesterday} and ${today}...`)

  // Fetch today and yesterday
  const [yesterdayText, todayText] = await Promise.all([
    fetchBASFile(yesterday),
    fetchBASFile(today),
  ])

  let allEntries = []

  if (yesterdayText) {
    const parsed = parseBASText(yesterdayText, yesterday)
    console.log(`Yesterday: ${parsed.length} entries`)
    allEntries.push(...parsed)
  } else {
    console.log('Yesterday: no data available')
  }

  if (todayText) {
    const parsed = parseBASText(todayText, today)
    console.log(`Today: ${parsed.length} entries`)
    allEntries.push(...parsed)
  } else {
    console.log('Today: no data available')
  }

  // Load existing data to preserve it if BAS is down
  let existingData = { entries_15min: [], windows_3h: [], last_updated: null, status: 'unknown' }
  try {
    if (existsSync(OUTPUT_PATH)) {
      existingData = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'))
    }
  } catch {}

  if (allEntries.length === 0) {
    console.log('No new data from BAS. Keeping existing data.')
    // Update status but keep old data
    existingData.status = 'bas_unreachable'
    existingData.last_check = now.toISOString()
    writeFileSync(OUTPUT_PATH, JSON.stringify(existingData, null, 2))
    return
  }

  const windows = to3HourWindows(allEntries)

  // Determine current status
  const latestEntry = allEntries[allEntries.length - 1]
  let currentStatus = 'quiet'
  if (latestEntry) {
    if (latestEntry.kpm >= 5) currentStatus = 'storm'
    else if (latestEntry.kpm >= 4) currentStatus = 'active'
  }

  // Find max in last 24h
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
    // Last 48h of 15-minute readings
    entries_15min: allEntries.slice(-192), // 2 days * 96 per day
    // 3-hour windows (for chart compatibility)
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
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
