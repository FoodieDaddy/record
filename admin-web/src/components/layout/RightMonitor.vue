<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAppStore } from '@/stores/app'
import { useLocaleStore } from '@/stores/locale'

const api = useApi()
const app = useAppStore()
const locale = useLocaleStore()
const services = ref<any[]>([])
const events = ref<any[]>([])
let timer: number

async function loadData() {
  try {
    const [health, eventData] = await Promise.all([
      api.get('/admin/system/health'),
      api.get('/admin/dashboard/events'),
    ])
    if (Array.isArray(health)) services.value = health.slice(0, 6)
    if (Array.isArray(eventData)) events.value = eventData.slice(0, 5)
  } catch {}
}

onMounted(() => {
  loadData()
  timer = window.setInterval(loadData, 30000)
})
onUnmounted(() => window.clearInterval(timer))
</script>

<template>
  <aside class="right-monitor">
    <div class="monitor-header">
      <span class="monitor-header__title">MONITOR</span>
      <button class="cmd-btn cmd-btn--ghost" style="height:22px;padding:0 6px;font-size:10px;" @click="app.toggleRightPanel()">
        {{ locale.isZh ? '收起' : 'Collapse' }}
      </button>
    </div>

    <div class="monitor-section">
      <div class="monitor-section__title">{{ locale.t('dashboard.health') }}</div>
      <div v-for="s in services" :key="s.name" class="monitor-row">
        <span class="monitor-dot" :class="`dot--${s.status}`" />
        <span class="monitor-name">{{ s.name }}</span>
        <span class="monitor-latency text-mono">{{ s.latency }}</span>
      </div>
      <div v-if="services.length === 0" class="monitor-empty">{{ locale.t('common.loading') }}</div>
    </div>

    <div class="monitor-section">
      <div class="monitor-section__title">{{ locale.t('dashboard.events') }}</div>
      <div v-for="(e, i) in events" :key="i" class="event-row">
        <span class="event-time text-mono">{{ e.time }}</span>
        <span class="event-dot" :class="`dot--${e.color}`" />
        <span class="event-desc">{{ e.desc }}</span>
      </div>
      <div v-if="events.length === 0" class="monitor-empty">{{ locale.t('dashboard.noEvents') }}</div>
    </div>
  </aside>
</template>

<style scoped>
.right-monitor {
  width: var(--right-panel-width);
  border-left: 1px solid var(--border-subtle);
  background: rgba(4,8,16,0.3);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
}
.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
}
.monitor-header__title {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-disabled);
  letter-spacing: 1px;
}
.monitor-section {
  padding: 12px 16px;
}
.monitor-section + .monitor-section {
  border-top: 1px solid rgba(255,255,255,0.03);
}
.monitor-section__title {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}
.monitor-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  font-size: 12px;
}
.monitor-dot, .event-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot--ok, .dot--green { background: var(--color-green); }
.dot--warn { background: var(--color-orange); }
.dot--error { background: var(--color-red); }
.dot--blue { background: var(--color-primary); }
.dot--cyan { background: var(--color-cyan); }
.monitor-name { flex: 1; color: var(--text-secondary); font-size: 11px; }
.monitor-latency { color: var(--text-muted); font-size: 10px; }
.monitor-empty { font-size: 11px; color: var(--text-muted); padding: 8px 0; }

.event-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 11px;
}
.event-time { color: var(--text-muted); min-width: 36px; font-size: 10px; }
.event-desc { color: var(--text-secondary); font-size: 11px; }
</style>
