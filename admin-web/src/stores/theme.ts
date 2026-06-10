import { defineStore } from 'pinia'
import { ref } from 'vue'

export type Theme = 'dark' | 'light'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>((localStorage.getItem('admin_theme') as Theme) || 'dark')

  function setTheme(t: Theme) {
    theme.value = t
    localStorage.setItem('admin_theme', t)
    applyTheme(t)
  }

  function applyTheme(t: Theme) {
    const root = document.documentElement
    if (t === 'light') {
      root.classList.add('theme-light')
      root.classList.remove('theme-dark')
    } else {
      root.classList.add('theme-dark')
      root.classList.remove('theme-light')
    }
  }

  // 初始化时应用主题
  applyTheme(theme.value)

  return { theme, setTheme }
})
