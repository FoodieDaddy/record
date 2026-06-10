import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/utilities.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
