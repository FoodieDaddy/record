import { defineStore } from 'pinia'
import { ref } from 'vue'

export type Theme = 'dark' | 'light'

export const useThemeStore = defineStore('theme', () => {
  const stored = (localStorage.getItem('admin_theme') as Theme) || 'light'
  const theme = ref<Theme>(stored)

  function setTheme(t: Theme) {
    theme.value = t
    localStorage.setItem('admin_theme', t)
    applyTheme(t)
  }

  function applyTheme(t: Theme) {
    document.documentElement.setAttribute('data-theme', t)
  }

  applyTheme(theme.value)

  return { theme, setTheme }
})
