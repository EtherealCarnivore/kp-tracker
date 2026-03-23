<template>
  <Transition name="alert">
    <div
      v-if="show && !dismissed"
      class="flex items-center gap-3 px-5 py-4 border-b-2"
      :class="severe ? 'alert-bg-severe border-kp-severe alert-pulse' : 'alert-bg-warn border-kp-unsettled'"
    >
      <span class="text-xl shrink-0">&#9888;</span>
      <span class="flex-1 font-semibold text-sm">{{ message }}</span>
      <button
        class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-xl opacity-70 hover:opacity-100 transition-opacity shrink-0"
        @click="dismissed = true"
      >
        &times;
      </button>
    </div>
  </Transition>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useI18n } from '../i18n/index.js'

const { t } = useI18n()

const props = defineProps({
  kp: { type: Number, default: null },
  threshold: { type: Number, default: 4 },
})

const dismissed = ref(false)

watch(() => props.kp, (newKp, oldKp) => {
  if (oldKp !== null && newKp !== null && Math.floor(newKp) !== Math.floor(oldKp)) {
    dismissed.value = false
  }
})

// Haptic feedback on alert appearance
watch(() => props.kp, (kp) => {
  if (kp !== null && kp >= props.threshold && !dismissed.value && navigator.vibrate) {
    if (kp >= 7) navigator.vibrate([100, 50, 100])
    else navigator.vibrate(100)
  }
})

const show = computed(() => props.kp !== null && props.kp >= props.threshold)
const severe = computed(() => props.kp !== null && props.kp >= 7)

const message = computed(() => {
  if (props.kp === null) return ''
  const kpStr = props.kp.toFixed(1)
  if (props.kp >= 8) return t('alert.extreme', { kp: kpStr })
  if (props.kp >= 7) return t('alert.strong', { kp: kpStr })
  if (props.kp >= 6) return t('alert.moderate', { kp: kpStr })
  if (props.kp >= 5) return t('alert.minor', { kp: kpStr })
  return t('alert.threshold', { kp: kpStr, threshold: props.threshold })
})
</script>

<style scoped>
.alert-enter-active, .alert-leave-active { transition: all 0.4s ease; }
.alert-enter-from, .alert-leave-to { opacity: 0; transform: translateY(-100%); }
</style>
