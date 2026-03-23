<template>
  <div class="glass-panel p-5 sm:p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-text-primary">{{ t('tracker.title') }}</h2>
      <button
        class="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors min-h-[44px]"
        @click="toggleForm"
      >
        {{ showForm ? t('tracker.cancel') : t('tracker.logEntry') }}
      </button>
    </div>

    <!-- Log Form -->
    <Transition name="slide">
      <div v-if="showForm" ref="formRef" class="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-5 mb-4 space-y-5">
        <!-- Severity -->
        <div>
          <label class="block text-sm font-medium text-text-secondary mb-2">{{ t('tracker.severity') }}</label>
          <div class="flex items-center gap-4">
            <input type="range" v-model.number="form.severity" min="0" max="10" class="flex-1">
            <div class="text-center min-w-[56px]">
              <span class="text-3xl font-black block leading-none" :style="{ color: severityColor }">{{ form.severity }}</span>
              <span class="text-[11px] text-text-muted">{{ severityLabel }}</span>
            </div>
          </div>
        </div>

        <!-- Symptoms -->
        <div>
          <label class="block text-sm font-medium text-text-secondary mb-2">{{ t('tracker.symptoms') }}</label>
          <div class="flex flex-wrap gap-2.5">
            <button
              v-for="s in symptomOptions"
              :key="s.value"
              class="symptom-chip"
              :class="{ selected: form.symptoms.includes(s.value) }"
              @click="toggleSymptom(s.value)"
            >
              {{ t('symptom.' + s.value) }}
            </button>
          </div>
        </div>

        <!-- Grid fields -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label class="block text-xs text-text-muted mb-1.5">{{ t('tracker.sleep') }}</label>
            <select v-model="form.sleep">
              <option value="">{{ t('general.select') }}</option>
              <option value="great">{{ t('sleep.great') }}</option>
              <option value="good">{{ t('sleep.good') }}</option>
              <option value="fair">{{ t('sleep.fair') }}</option>
              <option value="poor">{{ t('sleep.poor') }}</option>
              <option value="terrible">{{ t('sleep.terrible') }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-text-muted mb-1.5">{{ t('tracker.hydration') }}</label>
            <select v-model="form.hydration">
              <option value="">{{ t('general.select') }}</option>
              <option value="well">{{ t('hydration.well') }}</option>
              <option value="moderate">{{ t('hydration.moderate') }}</option>
              <option value="poor">{{ t('hydration.poor') }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-text-muted mb-1.5">{{ t('tracker.caffeine') }}</label>
            <select v-model="form.caffeine">
              <option value="">{{ t('general.select') }}</option>
              <option value="none">{{ t('caffeine.none') }}</option>
              <option value="light">{{ t('caffeine.light') }}</option>
              <option value="moderate">{{ t('caffeine.moderate') }}</option>
              <option value="heavy">{{ t('caffeine.heavy') }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-text-muted mb-1.5">{{ t('tracker.stress') }}</label>
            <select v-model="form.stress">
              <option value="">{{ t('general.select') }}</option>
              <option value="low">{{ t('stress.low') }}</option>
              <option value="moderate">{{ t('stress.moderate') }}</option>
              <option value="high">{{ t('stress.high') }}</option>
              <option value="extreme">{{ t('stress.extreme') }}</option>
            </select>
          </div>
        </div>

        <!-- Weather -->
        <div>
          <label class="block text-xs text-text-muted mb-1.5">{{ t('tracker.weather') }}</label>
          <input type="text" v-model="form.weather" :placeholder="t('tracker.weatherPlaceholder')">
        </div>

        <!-- Notes -->
        <div>
          <label class="block text-xs text-text-muted mb-1.5">{{ t('tracker.notes') }}</label>
          <textarea v-model="form.notes" rows="2" :placeholder="t('tracker.notesPlaceholder')"></textarea>
        </div>

        <!-- Current Kp info -->
        <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--color-card-bg)] text-xs text-text-muted">
          <span>{{ t('tracker.currentKp') }}: <strong class="text-text-primary">{{ currentKp !== null ? currentKp.toFixed(1) : '--' }}</strong></span>
          <span>{{ t('tracker.savedWith') }}</span>
        </div>

        <!-- Save -->
        <button
          class="w-full py-3.5 rounded-xl bg-accent text-white font-semibold hover:bg-accent-hover transition-colors min-h-[48px]"
          @click="save"
        >
          {{ t('tracker.save') }}
        </button>
      </div>
    </Transition>

    <!-- Log History — no nested scroll, show limited + expand -->
    <div class="space-y-2">
      <div v-if="logs.length === 0" class="text-center py-10">
        <div class="text-4xl mb-3 opacity-30">&#128203;</div>
        <div class="text-sm font-medium text-text-secondary">{{ t('tracker.empty') }}</div>
      </div>

      <div
        v-for="log in visibleLogs"
        :key="log.id"
        class="flex gap-3 sm:gap-4 p-3.5 rounded-xl bg-[var(--color-card-bg)] border-l-4 group transition-colors"
        :style="{ borderLeftColor: getSeverityColor(log.severity) }"
      >
        <div class="text-2xl font-black w-9 text-center shrink-0" :style="{ color: getSeverityColor(log.severity) }">
          {{ log.severity }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex gap-2 sm:gap-3 text-xs text-text-muted mb-1.5 flex-wrap">
            <span>{{ formatLogTime(log.timestamp) }}</span>
            <span v-if="log.kpAtTime !== undefined">Kp {{ log.kpAtTime.toFixed(1) }}</span>
            <span v-if="log.sleep">{{ t('tracker.sleep') }}: {{ t('sleep.' + log.sleep) }}</span>
            <span v-if="log.stress">{{ t('tracker.stress') }}: {{ t('stress.' + log.stress) }}</span>
          </div>
          <div class="flex flex-wrap gap-1 mb-1">
            <span
              v-for="s in log.symptoms"
              :key="s"
              class="px-2 py-0.5 rounded-full text-[11px] bg-[var(--color-bg-input)] text-text-secondary"
            >
              {{ t('symptom.' + s) }}
            </span>
          </div>
          <div v-if="log.notes" class="text-xs text-text-secondary mt-1">{{ log.notes }}</div>
          <div v-if="log.weather" class="text-xs text-text-muted mt-0.5">{{ t('tracker.weather') }}: {{ log.weather }}</div>
        </div>
        <!-- Delete — always visible on mobile -->
        <button
          class="text-text-muted sm:opacity-0 sm:group-hover:opacity-100 hover:text-kp-severe transition-all text-lg shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          @click="$emit('delete', log.id)"
          :title="t('tracker.deleteTitle')"
        >
          &times;
        </button>
      </div>

      <!-- Show more button -->
      <button
        v-if="logs.length > showCount"
        class="w-full py-3 text-sm text-accent hover:text-accent-hover font-medium transition-colors"
        @click="showCount += 10"
      >
        {{ locale === 'bg' ? `Покажи още (${logs.length - showCount} оставащи)` : `Show more (${logs.length - showCount} remaining)` }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { useI18n } from '../i18n/index.js'

const { t, locale } = useI18n()

const props = defineProps({
  logs: { type: Array, default: () => [] },
  currentKp: { type: Number, default: null },
  timezone: { type: String, default: 'Europe/Sofia' },
})

const emit = defineEmits(['save', 'delete'])
const showForm = ref(false)
const showCount = ref(5)
const formRef = ref(null)

const symptomOptions = [
  { value: 'headache' }, { value: 'fatigue' }, { value: 'dizziness' },
  { value: 'nausea' }, { value: 'anxiety' }, { value: 'brain_fog' },
  { value: 'palpitations' }, { value: 'insomnia' }, { value: 'irritability' },
  { value: 'joint_pain' }, { value: 'malaise' },
]

const defaultForm = () => ({
  severity: 0, symptoms: [], sleep: '', hydration: '', caffeine: '', stress: '', weather: '', notes: '',
})

const form = ref(defaultForm())

const visibleLogs = computed(() => props.logs.slice(0, showCount.value))

const severityColor = computed(() => getSeverityColor(form.value.severity))

const severityLabel = computed(() => {
  const v = form.value.severity
  if (locale.value === 'bg') {
    if (v <= 2) return 'Минимално'
    if (v <= 4) return 'Леко'
    if (v <= 6) return 'Умерено'
    if (v <= 8) return 'Тежко'
    return 'Екстремно'
  }
  if (v <= 2) return 'Minimal'
  if (v <= 4) return 'Mild'
  if (v <= 6) return 'Moderate'
  if (v <= 8) return 'Severe'
  return 'Extreme'
})

function getSeverityColor(v) {
  if (v <= 2) return '#22c55e'
  if (v <= 4) return '#eab308'
  if (v <= 6) return '#f97316'
  if (v <= 8) return '#ef4444'
  return '#dc2626'
}

function toggleSymptom(val) {
  const idx = form.value.symptoms.indexOf(val)
  if (idx >= 0) form.value.symptoms.splice(idx, 1)
  else form.value.symptoms.push(val)
}

function toggleForm() {
  showForm.value = !showForm.value
  if (showForm.value) {
    nextTick(() => {
      setTimeout(() => {
        formRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    })
  }
}

function save() {
  emit('save', { ...form.value, kpAtTime: props.currentKp })
  form.value = defaultForm()
  showForm.value = false
}

function formatLogTime(iso) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      timeZone: props.timezone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}
</script>

<style scoped>
.slide-enter-active, .slide-leave-active { transition: all 0.35s ease; overflow: hidden; }
.slide-enter-from, .slide-leave-to { opacity: 0; max-height: 0; }
.slide-enter-to, .slide-leave-from { opacity: 1; max-height: 900px; }
</style>
