<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
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

const systemStatus = ref<'ok' | 'warn' | 'error'>('ok')

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
    const input = document.querySelector('.top-bar__search input') as HTMLInputElement
    input?.focus()
  }
}

onMounted(() => {
  checkSystemHealth()
  document.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

const searchQuery = ref('')
const searchResults = ref<Array<{ name: string; path: string }>>([])
const showSearchResults = ref(false)

const searchableItems = computed(() => [
  { name: locale.t('nav.overview'), path: '/dashboard' },
  { name: locale.t('nav.users'), path: '/users' },
  { name: locale.t('nav.formations'), path: '/formations' },
  { name: locale.t('nav.traces'), path: '/traces' },
  { name: locale.t('nav.directives'), path: '/directives/logs' },
  { name: locale.t('nav.mirrors'), path: '/mirrors' },
  { name: locale.t('nav.system'), path: '/system/health' },
  { name: locale.t('nav.admins'), path: '/admins' },
  { name: locale.t('nav.audit'), path: '/audit' },
])

function onSearchInput() {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) { searchResults.value = []; showSearchResults.value = false; return }
  searchResults.value = searchableItems.value.filter(item => item.name.toLowerCase().includes(q))
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

function mapRoleName(role: string): string {
  if (role === 'SUPER_ADMIN') return locale.t('role.superAdmin')
  if (role === 'OPERATOR') return locale.t('role.operator')
  if (role === 'VIEWER') return locale.t('role.viewer')
  return role || 'ADMIN'
}

const systemStatusText = computed(() => {
  if (systemStatus.value === 'error') return locale.t('system.abnormal')
  if (systemStatus.value === 'warn') return locale.t('system.attention')
  return locale.t('system.normal')
})
</script>

<template>
  <header class="top-bar">
    <div class="top-bar__left">
      <Breadcrumb />
    </div>

    <div class="top-bar__search" style="position:relative;">
      <div class="search-box">
        <svg class="search-box__icon" viewBox="0 0 16 16" fill="none" width="14" height="14">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2" />
          <line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        </svg>
        <input
          v-model="searchQuery"
          class="search-box__input"
          :placeholder="locale.t('common.searchPlaceholder') + ' (⌘K)'"
          @input="onSearchInput"
          @focus="onSearchInput"
          @blur="onSearchBlur"
        />
      </div>
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
      <div class="top-bar__health" @click="router.push('/system/health')">
        <span class="top-bar__health-dot" :class="`dot--${systemStatus}`" />
        <span class="top-bar__health-text">{{ systemStatusText }}</span>
      </div>
      <div class="top-bar__divider" />
      <span class="top-bar__role hud-label">{{ mapRoleName(auth.role || '') }}</span>
      <span class="top-bar__user">{{ auth.username || locale.t('nav.admins') }}</span>
      <div style="position:relative;">
        <button class="cmd-btn cmd-btn--ghost" style="height:30px;font-size:12px;padding:0 10px;" @click="showSettings = !showSettings">
          <svg viewBox="0 0 20 20" fill="none" width="16" height="16" stroke="currentColor" stroke-width="1.5">
            <path d="M10 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM10 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM10 14a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
          </svg>
        </button>
        <div v-if="showSettings" class="settings-overlay" @click.self="showSettings = false">
          <div class="settings-panel">
            <div class="settings-row">
              <span class="settings-label">{{ locale.t('settings.language') }}</span>
              <div class="settings-toggle">
                <button
                  class="settings-btn"
                  :class="{ active: locale.isZh }"
                  @click="locale.setLocale('zh')"
                >{{ locale.t('settings.chinese') }}</button>
                <button
                  class="settings-btn"
                  :class="{ active: !locale.isZh }"
                  @click="locale.setLocale('en')"
                >{{ locale.t('settings.english') }}</button>
              </div>
            </div>
            <div class="settings-row">
              <span class="settings-label">{{ locale.t('settings.theme') }}</span>
              <div class="settings-toggle">
                <button
                  class="settings-btn"
                  :class="{ active: theme.theme === 'light' }"
                  @click="theme.setTheme('light')"
                >{{ locale.t('settings.light') }}</button>
                <button
                  class="settings-btn"
                  :class="{ active: theme.theme === 'dark' }"
                  @click="theme.setTheme('dark')"
                >{{ locale.t('settings.dark') }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button class="cmd-btn cmd-btn--ghost" style="height:30px;font-size:12px;" @click="handleLogout">{{ locale.t('common.logout') }}</button>
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  height: var(--topbar-height);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.30);
  background: rgba(255, 255, 255, 0.58);
  box-shadow: 0 1px 4px rgba(31, 52, 88, 0.04);
  position: sticky; top: 0; z-index: 90;
  transition: var(--theme-transition);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}
.top-bar__left { display: flex; align-items: center; }
.top-bar__search { width: 360px; margin: 0 24px; flex-shrink: 0; }
.top-bar__right { display: flex; align-items: center; gap: 10px; }

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 16px;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.46);
  border-radius: 14px;
  transition: border-color .15s, box-shadow .15s;
  backdrop-filter: blur(12px);
}
.search-box:focus-within {
  border-color: var(--input-focus-border);
  box-shadow: var(--input-focus-shadow);
}
.search-box__icon {
  color: var(--text-disabled);
  flex-shrink: 0;
}
.search-box__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-main);
  font-size: var(--text-base);
}
.search-box__input::placeholder {
  color: var(--text-disabled);
}

.top-bar__health {
  display: flex; align-items: center; gap: 6px;
  cursor: pointer; padding: 4px 10px; border-radius: var(--radius-xs);
  transition: background .12s;
}
.top-bar__health:hover { background: var(--btn-ghost-hover-bg); }
.top-bar__health-dot { width: 6px; height: 6px; border-radius: 50%; }
.top-bar__health-text { font-size: 11px; color: var(--text-muted); }
.dot--ok { background: var(--color-green); }
.dot--warn { background: var(--color-orange); }
.dot--error { background: var(--color-red); }

.top-bar__role {
  font-size: 10px;
  padding: 3px 8px;
}
.top-bar__user { font-size: var(--text-sm); color: var(--text-secondary); }
.top-bar__divider { width: 1px; height: 18px; background: var(--border-subtle); }

.search-dropdown {
  position: absolute;
  top: 100%; left: 0; right: 0;
  margin-top: 6px;
  background: var(--settings-bg);
  border: 1px solid var(--settings-border);
  border-radius: 16px;
  overflow: hidden;
  z-index: 200;
  box-shadow: var(--search-shadow);
}
.search-item {
  padding: 10px 14px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background .12s, color .12s;
}
.search-item:hover {
  background: var(--nav-item-active-bg);
  color: var(--text-main);
}

.settings-overlay {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  z-index: 300;
}
.settings-panel {
  background: var(--settings-bg);
  border: 1px solid var(--settings-border);
  border-radius: 16px;
  padding: 14px;
  min-width: 240px;
  box-shadow: var(--settings-shadow);
  transition: var(--theme-transition);
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
  padding: 5px 12px;
  font-size: 11px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color .12s, border-color .12s, color .12s;
}
.settings-btn.active {
  background: var(--btn-primary-bg);
  border-color: var(--btn-primary-border);
  color: var(--color-primary);
}
.settings-btn:hover:not(.active):not(:disabled) {
  background: var(--btn-ghost-hover-bg);
}
.settings-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
