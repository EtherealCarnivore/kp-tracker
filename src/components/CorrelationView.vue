<template>
  <div class="glass-panel p-5 sm:p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-text-primary">{{ t('corr.title') }}</h2>
    </div>

    <div v-if="!stats" class="text-center py-10">
      <div class="text-4xl mb-3 opacity-30">&#128200;</div>
      <div class="text-sm font-medium text-text-secondary">{{ t('corr.empty') }}</div>
    </div>

    <div v-else class="space-y-4">
      <!-- Stats Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div class="bg-[var(--color-card-bg)] rounded-xl p-4 text-center">
          <div class="text-3xl font-black text-text-primary">{{ stats.totalEntries }}</div>
          <div class="text-xs text-text-muted mt-1">{{ t('corr.totalEntries') }}</div>
        </div>
        <div class="bg-[var(--color-card-bg)] rounded-xl p-4 text-center">
          <div
            class="text-3xl font-black inline-block px-2 py-0.5 rounded-lg"
            :style="{ color: diffColor, background: diffColor + '15' }"
          >
            {{ stats.severityDiff > 0 ? '+' : '' }}{{ stats.severityDiff }}
          </div>
          <div class="text-xs text-text-muted mt-1">{{ t('corr.severityDiff') }}</div>
        </div>
        <div class="bg-[var(--color-card-bg)] rounded-xl p-4 text-center">
          <div class="text-3xl font-black text-kp-storm">{{ stats.avgSeverityHighKp }}</div>
          <div class="text-xs text-text-muted mt-1">{{ t('corr.avgHigh') }}</div>
          <div class="text-[11px] text-text-muted">{{ stats.highKpEntries }} {{ t('corr.entries') }}</div>
        </div>
        <div class="bg-[var(--color-card-bg)] rounded-xl p-4 text-center">
          <div class="text-3xl font-black text-kp-quiet">{{ stats.avgSeverityLowKp }}</div>
          <div class="text-xs text-text-muted mt-1">{{ t('corr.avgLow') }}</div>
          <div class="text-[11px] text-text-muted">{{ stats.lowKpEntries }} {{ t('corr.entries') }}</div>
        </div>
      </div>

      <!-- Top Symptoms -->
      <div v-if="stats.topSymptoms.length > 0">
        <h3 class="text-sm font-medium text-text-secondary mb-3">{{ t('corr.topSymptoms') }}</h3>
        <div class="space-y-2.5">
          <div v-for="s in stats.topSymptoms" :key="s.name" class="flex items-center gap-3">
            <span class="text-xs text-text-secondary w-28 shrink-0 capitalize">{{ t('symptom.' + s.name) }}</span>
            <div class="flex-1 h-2.5 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
              <div class="h-full rounded-full bg-accent transition-all duration-700" :style="{ width: s.pct + '%' }" />
            </div>
            <span class="text-xs text-text-muted w-12 text-right tabular-nums">{{ s.pct }}%</span>
          </div>
        </div>
      </div>

      <!-- Interpretation -->
      <div class="px-4 py-3 rounded-xl bg-[var(--color-card-bg)] text-sm text-text-secondary flex gap-3 items-start">
        <span class="text-lg shrink-0 opacity-60">&#128161;</span>
        <div>
          <template v-if="parseFloat(stats.severityDiff) > 1.5">
            {{ t('corr.notable', { high: stats.avgSeverityHighKp, low: stats.avgSeverityLowKp }) }}
          </template>
          <template v-else-if="parseFloat(stats.severityDiff) > 0.5">
            {{ t('corr.mild') }}
          </template>
          <template v-else>
            {{ t('corr.none') }}
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../i18n/index.js'

const { t } = useI18n()

const props = defineProps({
  stats: { type: Object, default: null },
})

const diffColor = computed(() => {
  if (!props.stats) return '#64748b'
  const d = parseFloat(props.stats.severityDiff)
  if (d > 2) return '#ef4444'
  if (d > 1) return '#f97316'
  if (d > 0) return '#eab308'
  return '#22c55e'
})
</script>

<style scoped>
.tabular-nums { font-variant-numeric: tabular-nums; }
</style>
