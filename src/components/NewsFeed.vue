<template>
  <div class="glass-panel p-5 sm:p-6">
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <h2 class="text-lg font-semibold text-text-primary">{{ t('news.title') }}</h2>
      <span v-if="lastUpdatedStr" class="text-[11px] text-text-muted">{{ t('news.fetched') }} {{ lastUpdatedStr }}</span>
    </div>

    <div v-if="!items || items.length === 0" class="text-center py-8">
      <div class="text-4xl mb-3 opacity-30">&#128240;</div>
      <div class="text-sm text-text-secondary">{{ t('news.empty') }}</div>
    </div>

    <div v-else class="space-y-3">
      <a
        v-for="item in visibleItems"
        :key="item.url + item.published"
        :href="item.url"
        target="_blank"
        rel="noopener noreferrer"
        class="news-item block p-3 sm:p-4 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-input)] transition-all"
      >
        <div class="flex items-baseline gap-2 mb-1 flex-wrap">
          <span class="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-accent/15 text-accent">
            {{ item.source }}
          </span>
          <span
            v-if="item.lang"
            class="text-[10px] uppercase font-semibold text-text-muted"
          >{{ item.lang === 'bg' ? 'BG' : 'EN' }}</span>
          <span class="text-[11px] text-text-muted">{{ formatDate(item.published) }}</span>
        </div>
        <h3 class="text-sm sm:text-base font-medium text-text-primary mb-1 leading-snug">{{ item.title }}</h3>
        <p v-if="item.excerpt" class="text-xs text-text-secondary line-clamp-2">{{ item.excerpt }}</p>
      </a>

      <button
        v-if="items.length > showCount"
        class="w-full py-3 text-sm text-accent hover:text-accent-hover font-medium transition-colors"
        @click="showCount += 5"
      >
        {{ t('news.showMore', { count: items.length - showCount }) }}
      </button>
    </div>

    <!-- Footer: where else to look for Bulgarian-language coverage when the feed is thin -->
    <div class="mt-4 pt-3 border-t border-[var(--color-border)] text-[11px] text-text-muted leading-relaxed">
      {{ t('news.moreLinks') }}
      <a href="https://www.vesti.bg/search.html?q=%D0%BC%D0%B0%D0%B3%D0%BD%D0%B8%D1%82%D0%BD%D0%B0+%D0%B1%D1%83%D1%80%D1%8F" target="_blank" rel="noopener" class="text-accent hover:underline">vesti.bg</a> ·
      <a href="https://www.24chasa.bg/search?text=%D0%BC%D0%B0%D0%B3%D0%BD%D0%B8%D1%82%D0%BD%D0%B0+%D0%B1%D1%83%D1%80%D1%8F" target="_blank" rel="noopener" class="text-accent hover:underline">24chasa.bg</a> ·
      <a href="https://www.swpc.noaa.gov/products/alerts-watches-and-warnings" target="_blank" rel="noopener" class="text-accent hover:underline">NOAA SWPC</a> ·
      <a href="https://swe.ssa.esa.int/web/guest/current-space-weather" target="_blank" rel="noopener" class="text-accent hover:underline">ESA SWE</a>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from '../i18n/index.js'

const { t, locale } = useI18n()

const props = defineProps({
  newsData: { type: Object, default: null },
  timezone: { type: String, default: 'Europe/Sofia' },
})

const showCount = ref(5)

const items = computed(() => props.newsData?.items || [])
const visibleItems = computed(() => items.value.slice(0, showCount.value))

const lastUpdatedStr = computed(() => {
  if (!props.newsData?.last_updated) return null
  try {
    return formatDate(props.newsData.last_updated)
  } catch { return null }
})

function formatDate(iso) {
  try {
    const d = new Date(iso)
    const loc = locale.value === 'bg' ? 'bg-BG' : 'en-GB'
    return d.toLocaleString(loc, {
      timeZone: props.timezone,
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}
</script>

<style scoped>
.news-item:hover {
  transform: translateY(-1px);
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
