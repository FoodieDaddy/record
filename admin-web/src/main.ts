import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/utilities.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { useLocaleStore } from './stores/locale'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// 在挂载前加载语言包，避免首屏闪烁显示翻译 key
const localeStore = useLocaleStore()
localeStore.loadLocale(localeStore.locale).then(() => {
  app.mount('#app')
}).catch(() => {
  // 加载失败也要挂载，降级显示 key
  app.mount('#app')
})
