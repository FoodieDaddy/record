<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAppStore } from '@/stores/app'

const api = useApi()
const app = useAppStore()
const services = ref<any[]>([])
let timer: number

const fallbackServices = [
  { name: 'API 服务', status: 'ok', latency: '-' },
  { name: 'MySQL', status: 'ok', latency: '-' },
  { name: 'Redis', status: 'ok', latency: '-' },
  { name: 'WebSocket', status: 'ok', latency: '-' },
  { name: 'TTS 主引擎', status: 'ok', latency: '-' },
  { name: '导航主引擎', status: 'ok', latency: '-' },
]

async function loadHealth() {
  try {
    const data: any = await api.get('/admin/system/health')
    if (Array.isArray(data)) services.value = data
  } catch {}
}

onMounted(() => {
  loadHealth()
  timer = window.setInterval(loadHealth, 30000)
})

onUnmounted(() => clearInterval(timer))

const events = ref([
  { time: '14:32', desc: '张三 → 李四  脉冲 +50', color: 'cyan' },
  { time: '14:31', desc: '创建编队 ABC123', color: 'blue' },
  { time: '14:30', desc: '王五 接入编队', color: 'green' },
  { time: '14:29', desc: '封存航程 DEF456', color: 'green' },
])
</script>

<template>
  <aside class="right-monitor">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);letter-spacing:0.5px;">MONITOR</span>
      <button class="cmd-btn cmd-btn--ghost" style="height:24px;padding:0 6px;font-size:11px;" @click="app.toggleRightPanel()">收起</button>
    </div>
    <div class="monitor-section">
      <div class="monitor-section__title">系统健康</div>
      <div v-for="s in (services.length ? services : fallbackServices)" :key="s.name" class="monitor-row">
        <span class="monitor-dot" :class="`dot--${s.status}`" />
        <span class="monitor-name">{{ s.name }}</span>
        <span class="monitor-latency text-mono">{{ s.latency }}</span>
      </div>
    </div>
    <div class="monitor-section">
      <div class="monitor-section__title">实时事件</div>
      <div v-for="e in events" :key="e.time + e.desc" class="event-row">
        <span class="event-time text-mono">{{ e.time }}</span>
        <span class="event-dot" :class="`dot--${e.color}`" />
        <span class="event-desc">{{ e.desc }}</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.right-monitor {
  width: var(--right-panel-width);
  border-left: 1px solid var(--border-subtle);
  background: rgba(4,8,16,0.4);
  padding: 16px;
  display: flex; flex-direction: column; gap: 24px;
  overflow-y: auto; flex-shrink: 0;
}
.monitor-section__title {
  font-size: var(--text-sm); color: var(--text-muted);
  letter-spacing: 0.5px; margin-bottom: 12px;
  padding-bottom: 8px; border-bottom: 1px solid var(--border-subtle);
}
.monitor-row, .event-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 0; font-size: var(--text-sm);
}
.event-row {
  animation: slide-in-right .3s ease both;
}
.event-row:nth-child(1) { animation-delay: 0ms; }
.event-row:nth-child(2) { animation-delay: 50ms; }
.event-row:nth-child(3) { animation-delay: 100ms; }
.event-row:nth-child(4) { animation-delay: 150ms; }
.monitor-dot, .event-dot {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
}
.dot--ok, .dot--green { background: var(--color-green); }
.dot--warn { background: var(--color-orange); }
.dot--error { background: var(--color-red); }
.dot--blue { background: var(--color-primary); }
.dot--cyan { background: var(--color-cyan); }
.monitor-name { flex: 1; color: var(--text-secondary); }
.monitor-latency { color: var(--text-muted); font-size: var(--text-xs); }
.event-time { color: var(--text-muted); font-size: var(--text-xs); min-width: 40px; }
.event-desc { color: var(--text-secondary); font-size: var(--text-xs); }
</style>
