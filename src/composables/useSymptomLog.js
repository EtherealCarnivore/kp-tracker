import { ref, computed, watch } from 'vue'

const STORAGE_KEY = 'kp-tracker-logs'

const logs = ref([])

// Load from localStorage
function loadLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) logs.value = JSON.parse(raw)
  } catch {
    logs.value = []
  }
}

function saveLogs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.value))
}

function addLog(entry) {
  logs.value.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    ...entry,
  })
  saveLogs()
}

function deleteLog(id) {
  logs.value = logs.value.filter(l => l.id !== id)
  saveLogs()
}

function clearAllLogs() {
  logs.value = []
  saveLogs()
}

function exportLogs() {
  const blob = new Blob([JSON.stringify(logs.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `kp-tracker-logs-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importLogs(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result)
        if (Array.isArray(imported)) {
          // Merge, avoiding duplicates by id
          const existingIds = new Set(logs.value.map(l => l.id))
          const newEntries = imported.filter(l => !existingIds.has(l.id))
          logs.value = [...newEntries, ...logs.value].sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
          )
          saveLogs()
          resolve(newEntries.length)
        } else {
          reject(new Error('Invalid format'))
        }
      } catch {
        reject(new Error('Failed to parse file'))
      }
    }
    reader.readAsText(file)
  })
}

export function useSymptomLog() {
  loadLogs()

  const recentLogs = computed(() => logs.value.slice(0, 50))

  const stats = computed(() => {
    if (logs.value.length < 3) return null

    const entries = logs.value.map(l => ({
      severity: l.severity,
      kp: l.kpAtTime,
      symptoms: l.symptoms || [],
    }))

    // Average severity when Kp >= 4 vs < 4
    const highKp = entries.filter(e => e.kp >= 4)
    const lowKp = entries.filter(e => e.kp < 4)

    const avgHigh = highKp.length > 0
      ? highKp.reduce((sum, e) => sum + e.severity, 0) / highKp.length
      : 0
    const avgLow = lowKp.length > 0
      ? lowKp.reduce((sum, e) => sum + e.severity, 0) / lowKp.length
      : 0

    // Most common symptoms during high Kp
    const symptomCounts = {}
    highKp.forEach(e => {
      e.symptoms.forEach(s => {
        symptomCounts[s] = (symptomCounts[s] || 0) + 1
      })
    })
    const topSymptoms = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count, pct: Math.round(count / highKp.length * 100) }))

    // Entries count
    return {
      totalEntries: logs.value.length,
      highKpEntries: highKp.length,
      lowKpEntries: lowKp.length,
      avgSeverityHighKp: avgHigh.toFixed(1),
      avgSeverityLowKp: avgLow.toFixed(1),
      severityDiff: (avgHigh - avgLow).toFixed(1),
      topSymptoms,
    }
  })

  return {
    logs,
    recentLogs,
    stats,
    addLog,
    deleteLog,
    clearAllLogs,
    exportLogs,
    importLogs,
  }
}
