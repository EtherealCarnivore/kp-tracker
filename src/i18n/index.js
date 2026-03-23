import { ref, computed } from 'vue'
import bg from './bg.js'
import en from './en.js'

const STORAGE_KEY = 'kp-tracker-lang'

const messages = { bg, en }
const supportedLocales = [
  { code: 'bg', label: 'Български' },
  { code: 'en', label: 'English' },
]

// Default to Bulgarian, load from localStorage
const currentLocale = ref(localStorage.getItem(STORAGE_KEY) || 'bg')

function setLocale(code) {
  currentLocale.value = code
  localStorage.setItem(STORAGE_KEY, code)
  document.documentElement.lang = code
}

function t(key, params = {}) {
  let str = messages[currentLocale.value]?.[key] || messages.bg[key] || key
  // Replace {param} placeholders
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
  }
  return str
}

export function useI18n() {
  return {
    t,
    locale: currentLocale,
    setLocale,
    supportedLocales,
  }
}
