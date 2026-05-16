/**
 * Fetches geomagnetic / space-weather news from multiple sources and
 * filters for items that mention storms / Kp / aurora / geomagnetic activity.
 *
 * Sources:
 *   - NOAA SWPC alerts.json (official, English) — operational space-weather
 *     warnings/alerts/summaries
 *   - dnes.bg RSS (Bulgarian general news, filtered for magnetic-storm keywords)
 *
 * Output: public/data/news.json with a merged, deduped, date-sorted feed.
 * Runs via GitHub Actions cron alongside fetch-bas / fetch-balkan.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = join(__dirname, '..', 'public', 'data', 'news.json')

// Bulgarian and English keywords. A match in title OR description includes the
// article. Cyrillic check is intentionally fuzzy ("геомагнитн" matches both
// "геомагнитна" and "геомагнитни" without regex acrobatics).
const KEYWORDS = [
  // Bulgarian
  'магнитна буря', 'магнитни бури', 'геомагнитн', 'слънчев изблик',
  'слънчева буря', 'слънчева активност', 'космическо време',
  'северно сияние', 'kp индекс', 'kp-индекс',
  // English
  'geomagnetic', 'solar storm', 'kp index', 'magnetic storm',
  'solar flare', 'aurora', 'coronal mass ejection', 'cme', 'space weather',
]

async function fetchWithTimeout(url, timeoutMs = 15000, opts = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal })
    clearTimeout(timeout)
    return res
  } catch (e) {
    clearTimeout(timeout)
    throw e
  }
}

function matchesKeyword(text) {
  if (!text) return false
  const lower = text.toLowerCase()
  return KEYWORDS.some(k => lower.includes(k.toLowerCase()))
}

// ===== NOAA SWPC alerts =====

function extractAlertTitle(message) {
  const lines = message.split('\n').map(l => l.trim()).filter(Boolean)
  for (const line of lines) {
    if (/^(WARNING|ALERT|SUMMARY|EXTENDED WARNING|WATCH):/i.test(line)) {
      return line.substring(0, 140)
    }
  }
  return (lines[0] || message).substring(0, 140)
}

// NOAA SWPC's `issue_datetime` is "YYYY-MM-DD HH:MM:SS.ms" — turn it into
// an ISO timestamp by swapping the space for T and treating as UTC.
function parseNoaaDate(s) {
  if (!s) return NaN
  return Date.parse(s.replace(' ', 'T') + 'Z')
}

async function fetchNoaaAlerts() {
  try {
    const res = await fetchWithTimeout('https://services.swpc.noaa.gov/products/alerts.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (!Array.isArray(data)) throw new Error('Unexpected NOAA payload shape')

    const cutoff = Date.now() - 7 * 86400000
    return data
      .filter(a => a && a.message)
      .filter(a => /K[_-]?INDEX|GEOMAG|STORM|\bKP\b|AURORA/i.test(a.message))
      .map(a => ({ a, ts: parseNoaaDate(a.issue_datetime) }))
      .filter(({ ts }) => !isNaN(ts) && ts > cutoff)
      .slice(0, 30)
      .map(({ a, ts }) => ({
        title: extractAlertTitle(a.message),
        excerpt: a.message.replace(/\s+/g, ' ').trim().substring(0, 280),
        published: new Date(ts).toISOString(),
        source: 'NOAA SWPC',
        source_id: 'noaa-swpc',
        url: 'https://www.swpc.noaa.gov/products/alerts-watches-and-warnings',
        lang: 'en',
        product_id: a.product_id || null,
      }))
  } catch (e) {
    console.warn(`NOAA SWPC fetch failed: ${e.message}`)
    return []
  }
}

// ===== Dnes.bg RSS =====

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function extractTag(content, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const match = regex.exec(content)
  if (!match) return ''
  let value = match[1]
  // Strip CDATA wrapper if present
  value = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  return decodeEntities(value.trim())
}

function parseRssItems(xml) {
  const items = []
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const content = match[1]
    const title = extractTag(content, 'title')
    const link = extractTag(content, 'link')
    const description = extractTag(content, 'description')
    const pubDate = extractTag(content, 'pubDate')
    if (title && link) items.push({ title, link, description, pubDate })
  }
  return items
}

// Bulgarian news sources with confirmed working RSS feeds. We filter their
// general firehose for geomagnetic-storm keywords. Dnes.bg dropped their
// public RSS — using these two instead.
const BG_RSS_SOURCES = [
  { id: 'vesti-bg',   name: 'Vesti.bg',   url: 'https://www.vesti.bg/rss' },
  { id: '24chasa-bg', name: '24 часа',    url: 'https://www.24chasa.bg/rss' },
]

async function fetchBgRssSource(source) {
  try {
    const res = await fetchWithTimeout(source.url, 15000, {
      headers: { 'User-Agent': 'Mozilla/5.0 (kp-tracker news aggregator)' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const xml = await res.text()
    const items = parseRssItems(xml)

    const cutoff = Date.now() - 14 * 86400000
    return items
      .filter(i => {
        const cleanDesc = stripHtml(i.description)
        return matchesKeyword(i.title) || matchesKeyword(cleanDesc)
      })
      .filter(i => {
        const ts = i.pubDate ? Date.parse(i.pubDate) : NaN
        return isNaN(ts) || ts > cutoff
      })
      .slice(0, 10)
      .map(i => {
        const ts = i.pubDate ? Date.parse(i.pubDate) : NaN
        const cleanDesc = stripHtml(i.description)
        return {
          title: i.title,
          excerpt: cleanDesc.substring(0, 280),
          published: isNaN(ts) ? new Date().toISOString() : new Date(ts).toISOString(),
          source: source.name,
          source_id: source.id,
          url: i.link,
          lang: 'bg',
        }
      })
  } catch (e) {
    console.warn(`${source.name} fetch failed: ${e.message}`)
    return []
  }
}

async function fetchBgSources() {
  const results = await Promise.all(BG_RSS_SOURCES.map(fetchBgRssSource))
  return results.flat()
}

// ===== Main =====

async function main() {
  const now = new Date()
  console.log('Fetching news from all sources...')

  const [noaa, bg] = await Promise.all([
    fetchNoaaAlerts(),
    fetchBgSources(),
  ])

  console.log(`NOAA: ${noaa.length}, BG: ${bg.length}`)

  // Merge, dedup by (title + published) — NOAA alerts share one landing URL
  // so we can't use URL as the dedup key. Title+date is unique enough.
  const seen = new Set()
  const merged = [...noaa, ...bg]
    .filter(item => item.title && item.published)
    .filter(item => {
      const key = `${item.title}|${item.published}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => new Date(b.published) - new Date(a.published))
    .slice(0, 25)

  // Preserve existing data if both sources errored
  if (merged.length === 0 && existsSync(OUTPUT_PATH)) {
    try {
      const existing = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'))
      existing.last_check = now.toISOString()
      existing.last_check_status = 'all_sources_failed'
      writeFileSync(OUTPUT_PATH, JSON.stringify(existing, null, 2))
      console.log('All sources failed — kept previous data')
      return
    } catch {}
  }

  const output = {
    last_updated: now.toISOString(),
    last_check: now.toISOString(),
    count: merged.length,
    sources: ['noaa-swpc', ...BG_RSS_SOURCES.map(s => s.id)],
    items: merged,
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log(`Written ${merged.length} items to ${OUTPUT_PATH}`)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
