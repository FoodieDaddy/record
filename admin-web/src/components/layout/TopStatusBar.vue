<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useAppStore } from '@/stores/app'
import { useLocaleStore } from '@/stores/locale'
import { useThemeStore } from '@/stores/theme'
import Breadcrumb from './Breadcrumb.vue'

const auth = useAuthStore()
const router = useRouter()
const api = useApi()
const app = useAppStore()
const locale = useLocaleStore()
const theme = useThemeStore()
const showSettings = ref(false)

const currentTime = ref('')
const systemStatus = ref<'ok' | 'warn' | 'error'>('ok')
let timer: number

function updateTime() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  currentTime.value = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

async function checkSystemHealth() {
  try {
    const health: any = await api.get('/admin/system/health')
    if (Array.isArray(health)) {
      const hasError = health.some((s: any) => s.status === 'error')
      const hasWarn = health.some((s: any) => s.status === 'warn')
      systemStatus.value = hasError ? 'error' : hasWarn ? 'warn' : 'ok'
    }
  } catch {}
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    const input = document.querySelector('.top-bar__center input') as HTMLInputElement
    input?.focus()
  }
}

onMounted(() => {
  updateTime()
  timer = window.setInterval(updateTime, 1000)
  checkSystemHealth()
  document.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => {
  window.clearInterval(timer)
  document.removeEventListener('keydown', handleKeydown)
})

const searchQuery = ref('')
const searchResults = ref<Array<{ name: string; path: string }>>([])
const showSearchResults = ref(false)

const searchableItems = [
  { name: '基地总览', path: '/dashboard' },
  { name: '航船用户', path: '/users' },
  { name: '任务编队', path: '/formations' },
  { name: '航迹中心', path: '/traces' },
  { name: '指令日志', path: '/directives/logs' },
  { name: '镜像档案', path: '/mirrors' },
  { name: '系统监控', path: '/system/health' },
  { name: '管理员', path: '/admins' },
  { name: '审计日志', path: '/audit' },
]

function onSearchInput() {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) { searchResults.value = []; showSearchResults.value = false; return }
  searchResults.value = searchableItems.filter(item => item.name.toLowerCase().includes(q))
  showSearchResults.value = true
}

function navigateToResult(path: string) {
  router.push(path)
  searchQuery.value = ''
  showSearchResults.value = false
}

function onSearchBlur() {
  window.setTimeout(() => { showSearchResults.value = false }, 200)
}

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <header class="top-bar">
    <div class="top-bar__left">
      <Breadcrumb />
    </div>

    <div class="top-bar__center" style="position:relative;">
      <input
        v-model="searchQuery"
        class="input-field"
        style="width:100%;"
        placeholder="搜索用户、编队、指令... (⌘K)"
        @input="onSearchInput"
        @focus="onSearchInput"
        @blur="onSearchBlur"
      />
      <div v-if="showSearchResults && searchResults.length" class="search-dropdown">
        <div
          v-for="r in searchResults"
          :key="r.path"
          class="search-item"
          @mousedown="navigateToResult(r.path)"
        >
          <span>{{ r.name }}</span>
        </div>
      </div>
    </div>

    <div class="top-bar__right">
      <button
        class="cmd-btn cmd-btn--ghost"
        style="height:24px;padding:0 6px;font-size:11px;"
        @click="app.toggleRightPanel()"
      >{{ app.rightPanelOpen ? '收起监控' : '展开监控' }}</button>
      <div class="top-bar__divider" />
      <div class="top-bar__health" @click="router.push('/system/health')">
        <span class="top-bar__health-dot" :class="`dot--${systemStatus}`" />
        <span style="font-size:11px;color:var(--text-muted);">系统{{ systemStatus === 'ok' ? '正常' : systemStatus === 'warn' ? '注意' : '异常' }}</span>
      </div>
      <div class="top-bar__divider" />
      <span class="top-bar__role hud-label">{{ auth.role || 'ADMIN' }}</span>
      <span class="top-bar__user">{{ auth.username || '管理员' }}</span>
      <span class="top-bar__time text-mono">{{ currentTime }}</span>
      <div style="position:relative;">
        <button class="cmd-btn cmd-btn--ghost" style="height:28px;font-size:12px;padding:0 8px;" @click="showSettings = !showSettings">
          设置
        </button>
        <div v-if="showSettings" class="settings-dropdown" @click.self="showSettings = false">
          <div class="settings-panel">
            <div class="settings-row">
              <span class="settings-label">{{ locale.t('settings.language') }}</span>
              <div class="settings-toggle">
                <button
                  class="settings-btn"
                  :class="{ active: locale.isZh }"
                  @click="locale.setLocale('zh')"
                >中文</button>
                <button
                  class="settings-btn"
                  :class="{ active: !locale.isZh }"
                  @click="locale.setLocale('en')"
                >EN</button>
              </div>
            </div>
            <div class="settings-row">
              <span class="settings-label">{{ locale.t('settings.theme') }}</span>
              <div class="settings-toggle">
                <button
                  class="settings-btn"
                  :class="{ active: theme.theme === 'dark' }"
                  @click="theme.setTheme('dark')"
                >{{ locale.t('settings.dark') }}</button>
                <button
                  class="settings-btn"
                  :class="{ active: theme.theme === 'light' }"
                  @click="theme.setTheme('light')"
                >{{ locale.t('settings.light') }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button class="cmd-btn cmd-btn--ghost" style="height:28px;font-size:12px;" @click="handleLogout">退出</button>
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  height: var(--topbar-height);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid rgba(10,132,255,0.12);
  background: linear-gradient(90deg, rgba(4,8,16,0.9), rgba(4,8,16,0.7));
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 20px rgba(0,0,0,0.3);
  position: sticky; top: 0; z-index: 90;
}
.top-bar__left { display: flex; align-items: center; }
.top-bar__center { flex: 1; max-width: 400px; margin: 0 32px; }
.top-bar__right { display: flex; align-items: center; gap: 12px; }

.top-bar__health {
  display: flex; align-items: center; gap: 6px;
  cursor: pointer; padding: 4px 8px; border-radius: 3px;
  transition: background .15s;
}
.top-bar__health:hover { background: rgba(255,255,255,0.03); }
.top-bar__health-dot { width: 6px; height: 6px; border-radius: 50%; }
.dot--ok { background: var(--color-green); box-shadow: 0 0 6px rgba(48,209,88,0.4); }
.dot--warn { background: var(--color-orange); box-shadow: 0 0 6px rgba(255,159,10,0.4); }
.dot--error { background: var(--color-red); box-shadow: 0 0 6px rgba(255,69,58,0.4); }

.top-bar__role {
  font-size: 10px;
  padding: 2px 6px;
}
.top-bar__user { font-size: var(--text-sm); color: var(--text-secondary); }
.top-bar__time { font-size: var(--text-xs); color: var(--text-muted); }
.top-bar__divider { width: 1px; height: 20px; background: var(--border-subtle); }

.search-dropdown {
  position: absolute;
  top: 100%; left: 0; right: 0;
  margin-top: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-accent);
  border-radius: 4px;
  overflow: hidden;
  z-index: 200;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.search-item {
  padding: 10px 14px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background .15s;
}
.search-item:hover {
  background: rgba(10,132,255,0.08);
  color: var(--text-main);
}

.settings-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  z-index: 300;
}
.settings-panel {
  background: var(--bg-elevated);
  border: 1px solid var(--border-accent);
  border-radius: 6px;
  padding: 12px;
  min-width: 200px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}
.settings-row + .settings-row {
  border-top: 1px solid var(--border-subtle);
}
.settings-label {
  font-size: 12px;
  color: var(--text-secondary);
}
.settings-toggle {
  display: flex;
  gap: 4px;
}
.settings-btn {
  padding: 4px 10px;
  font-size: 11px;
  border: 1px solid var(--border-subtle);
  border-radius: 3px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all .15s;
}
.settings-btn.active {
  background: rgba(10,132,255,0.12);
  border-color: rgba(10,132,255,0.25);
  color: var(--color-primary);
}
.settings-btn:hover:not(.active) {
  background: rgba(255,255,255,0.04);
}
</style>
