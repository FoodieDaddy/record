<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import Breadcrumb from './Breadcrumb.vue'

const auth = useAuthStore()
const router = useRouter()
const currentTime = ref('')
let timer: number

function updateTime() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  currentTime.value = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

onMounted(() => {
  updateTime()
  timer = window.setInterval(updateTime, 1000)
})
onUnmounted(() => window.clearInterval(timer))

const statusItems = [
  { label: '系统', value: '正常', type: 'ok' },
  { label: '活跃编队', value: '18', type: 'info' },
  { label: '在线航船', value: '246', type: 'info' },
  { label: '今日脉冲', value: '12,408', type: 'info' },
]

function handleLogout() {
  auth.logout()
  router.push('/login')
}

const searchQuery = ref('')
const searchResults = ref<Array<{ name: string; path: string; icon: string }>>([])
const showSearchResults = ref(false)

const searchableItems = [
  { name: '基地总览', path: '/dashboard', icon: '📊' },
  { name: '航船用户', path: '/users', icon: '🚀' },
  { name: '任务编队', path: '/formations', icon: '🔗' },
  { name: '航迹中心', path: '/traces', icon: '📈' },
  { name: '指令日志', path: '/directives/logs', icon: '📋' },
  { name: '镜像档案', path: '/mirrors', icon: '🪞' },
  { name: '系统监控', path: '/system/health', icon: '🖥' },
  { name: '管理员', path: '/admins', icon: '👤' },
  { name: '审计日志', path: '/audit', icon: '📝' },
]

function onSearchInput() {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) {
    searchResults.value = []
    showSearchResults.value = false
    return
  }
  searchResults.value = searchableItems.filter(item =>
    item.name.toLowerCase().includes(q)
  )
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
</script>

<template>
  <header class="top-bar">
    <div class="top-bar__left">
      <div class="top-bar__module">基地总控台</div>
      <div class="top-bar__kicker">COMMAND BASE ONLINE</div>
      <Breadcrumb style="margin-top:4px;" />
    </div>

    <div class="top-bar__center" style="position:relative;">
      <input
        v-model="searchQuery"
        class="input-field"
        style="width:100%;"
        placeholder="搜索模块..."
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
          <span class="search-item__icon">{{ r.icon }}</span>
          <span>{{ r.name }}</span>
        </div>
      </div>
    </div>

    <div class="top-bar__right">
      <div v-for="item in statusItems" :key="item.label" class="top-bar__status">
        <span class="top-bar__dot" :class="`dot--${item.type}`" />
        <span class="top-bar__status-label">{{ item.label }}</span>
        <span class="top-bar__status-value text-mono">{{ item.value }}</span>
      </div>
      <div class="top-bar__divider" />
      <span class="top-bar__time text-mono">{{ currentTime }}</span>
      <div class="top-bar__divider" />
      <span class="top-bar__user">{{ auth.username || '管理员' }}</span>
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
.top-bar__left { display: flex; flex-direction: column; gap: 2px; }
.top-bar__module { font-size: 16px; font-weight: 600; }
.top-bar__kicker {
  font-size: 10px; font-family: var(--font-mono);
  color: var(--text-disabled); letter-spacing: 1px;
}
.top-bar__center { flex: 1; max-width: 400px; margin: 0 32px; }
.top-bar__right { display: flex; align-items: center; gap: 16px; }
.top-bar__status {
  display: flex; align-items: center; gap: 6px;
  font-size: var(--text-sm); color: var(--text-secondary);
  padding: 4px 10px;
  background: rgba(10,132,255,0.04);
  border: 1px solid rgba(10,132,255,0.08);
  border-radius: 3px;
}
.top-bar__dot { width: 6px; height: 6px; border-radius: 50%; }
.dot--ok { background: var(--color-green); }
.dot--info { background: var(--color-primary); }
.top-bar__status-label { color: var(--text-muted); }
.top-bar__status-value { color: var(--text-main); }
.top-bar__divider { width: 1px; height: 24px; background: var(--border-subtle); }
.top-bar__time { font-size: var(--text-sm); color: var(--text-muted); }
.top-bar__user { font-size: var(--text-sm); color: var(--text-secondary); }
.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-accent);
  border-radius: 6px;
  overflow: hidden;
  z-index: 200;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.search-item {
  display: flex;
  align-items: center;
  gap: 10px;
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
.search-item__icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
}
</style>
