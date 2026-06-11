import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type Locale = 'zh' | 'en'

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref<Locale>((localStorage.getItem('admin_locale') as Locale) || 'zh')
  const messages = ref<Record<string, string>>({})
  const loaded = ref(false)

  async function loadLocale(lang: Locale): Promise<void> {
    try {
      const response = await fetch(`/admin/locales/${lang}.json`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      messages.value = await response.json()
      loaded.value = true
    } catch (err) {
      console.error('加载多语言包失败:', err)
      // 降级：使用空字典，t() 将返回 key 本身
      messages.value = {}
    }
  }

  function t(key: string): string {
    return messages.value[key] || key
  }

  async function setLocale(l: Locale) {
    locale.value = l
    localStorage.setItem('admin_locale', l)
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en'
    await loadLocale(l)
  }

  const isZh = computed(() => locale.value === 'zh')

  return { locale, messages, loaded, t, setLocale, isZh, loadLocale }
})
