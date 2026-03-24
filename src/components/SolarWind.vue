<template>
  <div class="glass-panel p-5 sm:p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-text-primary">{{ t('sw.title') }}</h2>
      <span class="text-xs text-text-muted">{{ t('sw.source') }}</span>
    </div>

    <div class="grid grid-cols-2 gap-2 sm:gap-3">
      <!-- Speed -->
      <div class="sw-card">
        <div class="text-2xl font-bold leading-tight" :style="{ color: speedColor }">
          {{ sw.speed !== null ? Math.round(sw.speed) : '--' }}
        </div>
        <div class="text-xs text-text-muted mt-1">{{ t('sw.speed') }}</div>
        <div class="h-2 bg-[var(--color-bg-input)] rounded-full mt-2 overflow-hidden">
          <div class="h-full rounded-full transition-all duration-500" :style="{ width: speedPct + '%', background: speedColor }" />
        </div>
      </div>

      <!-- Bz -->
      <div class="sw-card" :class="{ 'border-kp-severe/30': sw.bz !== null && sw.bz < -10 }">
        <div class="text-2xl font-bold leading-tight" :style="{ color: bzColor }">
          {{ sw.bz !== null ? sw.bz.toFixed(1) : '--' }}
        </div>
        <div class="text-xs text-text-muted mt-1">
          {{ t('sw.bz') }}
          <span v-if="sw.bz !== null" class="font-semibold" :style="{ color: bzColor }">
            {{ sw.bz < 0 ? t('sw.bzSouth') : t('sw.bzNorth') }}
          </span>
        </div>
        <div class="h-2 bg-[var(--color-bg-input)] rounded-full mt-2 overflow-hidden relative">
          <div class="absolute left-1/2 top-0 w-px h-full" style="background: var(--color-border-hover)" />
          <div class="h-full rounded-full transition-all duration-500 absolute" :style="bzBarStyle" />
        </div>
      </div>

      <!-- Density -->
      <div class="sw-card">
        <div class="text-2xl font-bold leading-tight text-accent">
          {{ sw.density !== null ? sw.density.toFixed(1) : '--' }}
        </div>
        <div class="text-xs text-text-muted mt-1">{{ t('sw.density') }}</div>
        <div class="h-2 bg-[var(--color-bg-input)] rounded-full mt-2 overflow-hidden">
          <div class="h-full rounded-full transition-all duration-500 bg-accent" :style="{ width: densityPct + '%' }" />
        </div>
      </div>

      <!-- Bt -->
      <div class="sw-card">
        <div class="text-2xl font-bold leading-tight text-accent-hover">
          {{ sw.bt !== null ? sw.bt.toFixed(1) : '--' }}
        </div>
        <div class="text-xs text-text-muted mt-1">{{ t('sw.bt') }}</div>
        <div class="h-2 bg-[var(--color-bg-input)] rounded-full mt-2 overflow-hidden">
          <div class="h-full rounded-full transition-all duration-500 bg-accent-hover" :style="{ width: btPct + '%' }" />
        </div>
      </div>
    </div>

    <!-- Interpretation -->
    <div v-if="interpretation" class="mt-4 px-4 py-3 rounded-xl text-sm border-l-4" :class="interpretationClass">
      {{ interpretation }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../i18n/index.js'

const { t } = useI18n()

const props = defineProps({
  sw: {
    type: Object,
    default: () => ({ speed: null, bz: null, bt: null, density: null, temperature: null }),
  },
})

const speedColor = computed(() => {
  if (props.sw.speed === null) return 'var(--color-text-muted)'
  if (props.sw.speed > 700) return '#ef4444'
  if (props.sw.speed > 500) return '#f97316'
  if (props.sw.speed > 400) return '#eab308'
  return '#22c55e'
})

const speedPct = computed(() => props.sw.speed === null ? 0 : Math.min(100, (props.sw.speed / 900) * 100))

const bzColor = computed(() => {
  if (props.sw.bz === null) return 'var(--color-text-muted)'
  if (props.sw.bz < -10) return '#ef4444'
  if (props.sw.bz < -5) return '#f97316'
  if (props.sw.bz < 0) return '#eab308'
  return '#22c55e'
})

const bzBarStyle = computed(() => {
  if (props.sw.bz === null) return { width: '0%', left: '50%' }
  const pct = Math.min(50, Math.abs(props.sw.bz) / 30 * 50)
  if (props.sw.bz < 0) return { width: pct + '%', right: '50%', left: 'auto', background: bzColor.value }
  return { width: pct + '%', left: '50%', background: bzColor.value }
})

const densityPct = computed(() => props.sw.density === null ? 0 : Math.min(100, (props.sw.density / 50) * 100))
const btPct = computed(() => props.sw.bt === null ? 0 : Math.min(100, (props.sw.bt / 40) * 100))

const interpretation = computed(() => {
  const { speed, bz } = props.sw
  if (speed === null || bz === null) return null
  if (bz < -10 && speed > 500) return t('sw.stormLikely')
  if (bz < -5 && speed > 400) return t('sw.elevated')
  if (bz < 0 && speed > 500) return t('sw.moderate')
  if (speed > 600) return t('sw.fastWind')
  return null
})

const interpretationClass = computed(() => {
  const { speed, bz } = props.sw
  if (bz < -10 && speed > 500) return 'bg-kp-severe/10 text-kp-severe border-kp-severe'
  if (bz < -5) return 'bg-kp-storm/10 text-kp-storm border-kp-storm'
  return 'bg-kp-unsettled/10 text-kp-unsettled border-kp-unsettled'
})
</script>
