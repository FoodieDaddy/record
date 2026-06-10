<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

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
onUnmounted(() => clearInterval(timer))

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
</script>

<template>
  <header class="top-bar">
    <div class="top-bar__left">
      <div class="top-bar__module">基地总控台</div>
      <div class="top-bar__kicker">COMMAND BASE ONLINE</div>
    </div>

    <div class="top-bar__center">
      <input class="input-field" style="width:100%;" placeholder="全局搜索..." />
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
  border-bottom: 1px solid var(--border-accent);
  background: rgba(4,8,16,0.6);
  backdrop-filter: blur(8px);
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
}
.top-bar__dot { width: 6px; height: 6px; border-radius: 50%; }
.dot--ok { background: var(--color-green); }
.dot--info { background: var(--color-primary); }
.top-bar__status-label { color: var(--text-muted); }
.top-bar__status-value { color: var(--text-main); }
.top-bar__divider { width: 1px; height: 24px; background: var(--border-subtle); }
.top-bar__time { font-size: var(--text-sm); color: var(--text-muted); }
.top-bar__user { font-size: var(--text-sm); color: var(--text-secondary); }
</style>
