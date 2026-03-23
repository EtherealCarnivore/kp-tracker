import { ref, watch } from 'vue'

const STORAGE_KEY = 'kp-tracker-theme'

const themes = {
  dark: {
    key: 'dark',
    labelEn: 'Cosmic',
    labelBg: 'Космическа',
    preview: ['#0b0f19', '#818cf8'],
  },
  light: {
    key: 'light',
    labelEn: 'Light',
    labelBg: 'Светла',
    preview: ['#f8f9fc', '#6366f1'],
  },
  rose: {
    key: 'rose',
    labelEn: 'Rose',
    labelBg: 'Роза',
    preview: ['#1a1318', '#d4849b'],
  },
}

const currentTheme = ref(localStorage.getItem(STORAGE_KEY) || 'light')

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  // Brief transition class
  document.documentElement.classList.add('theme-transitioning')
  setTimeout(() => {
    document.documentElement.classList.remove('theme-transitioning')
  }, 450)
}

function setTheme(theme) {
  currentTheme.value = theme
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
}

// Apply on load
applyTheme(currentTheme.value)

export function useTheme() {
  return {
    currentTheme,
    themes,
    setTheme,
  }
}
