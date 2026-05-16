import { ref, onMounted, onUnmounted } from 'vue'

const newsData = ref(null)
const newsLoading = ref(false)
const newsError = ref(null)

let newsTimer = null

async function fetchNewsData() {
  newsLoading.value = true
  newsError.value = null
  try {
    const base = import.meta.env.BASE_URL || '/'
    const res = await fetch(`${base}data/news.json?t=${Date.now()}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    newsData.value = await res.json()
  } catch (e) {
    newsError.value = e.message
    console.warn('Failed to fetch news:', e)
  }
  newsLoading.value = false
}

export function useNews(refreshSeconds = 600) {
  onMounted(() => {
    fetchNewsData()
    newsTimer = setInterval(fetchNewsData, refreshSeconds * 1000)
  })

  onUnmounted(() => {
    if (newsTimer) clearInterval(newsTimer)
  })

  return {
    newsData,
    newsLoading,
    newsError,
    fetchNewsData,
  }
}
