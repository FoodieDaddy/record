<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import StatCard from '@/components/data/StatCard.vue'
import HudChart from '@/components/chart/HudChart.vue'

const api = useApi()
const loading = ref(true)

const stats = ref([
  { label: '总航船用户', kicker: 'SPACE VESSELS', value: '-', trend: '', trendType: 'up' as const },
  { label: '今日活跃航船', kicker: 'ACTIVE TODAY', value: '-', trend: '', trendType: 'up' as const },
  { label: '当前活跃编队', kicker: 'ACTIVE FORMATIONS', value: '-', trend: '', trendType: 'up' as const },
  { label: '今日封存航程', kicker: 'SEALED TODAY', value: '-', trend: '', trendType: 'up' as const },
  { label: '今日脉冲流向', kicker: 'PULSE TRANSFERS', value: '-', trend: '', trendType: 'up' as const },
  { label: '今日航段写入', kicker: 'SEGMENT WRITES', value: '-', trend: '', trendType: 'up' as const },
])

const healthItems = ref([
  { name: 'API 服务', status: 'ok', latency: '-' },
  { name: 'MySQL', status: 'ok', latency: '-' },
  { name: 'Redis', status: 'ok', latency: '-' },
  { name: 'WebSocket', status: 'ok', latency: '-' },
  { name: 'CloudBase 存储', status: 'ok', latency: '-' },
  { name: 'TTS 主引擎', status: 'ok', latency: '-' },
  { name: 'TTS 副引擎', status: 'ok', latency: '-' },
  { name: '导航主引擎', status: 'ok', latency: '-' },
])

function formatNum(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return n.toLocaleString()
}

onMounted(async () => {
  try {
    const data: any = await api.get('/admin/dashboard/overview')
    stats.value[0].value = formatNum(data.totalUsers || 0)
    stats.value[1].value = formatNum(data.todayActiveUsers || 0)
    stats.value[2].value = formatNum(data.activeFormations || 0)
    stats.value[3].value = formatNum(data.todaySealed || 0)
    stats.value[4].value = formatNum(data.todayTransfers || 0)
    stats.value[5].value = formatNum(data.todayRoundWrites || 0)
  } catch (e) {
    console.error('Dashboard load failed:', e)
  } finally {
    loading.value = false
  }

  try {
    const health: any = await api.get('/admin/system/health')
    if (Array.isArray(health)) {
      healthItems.value = health
    }
  } catch {}
})
</script>

<template>
  <div class="dashboard">
    <div class="dashboard__stats grid-6">
      <StatCard v-for="s in stats" :key="s.label" v-bind="s" />
    </div>

    <div class="dashboard__row">
      <div class="base-panel base-panel--hud dashboard__situation">
        <div class="base-panel__header">
          <span class="base-panel__title">基地态势</span>
          <span class="dashboard__kicker">BASE SITUATION</span>
        </div>
        <div class="base-panel__body dashboard__situation-body">
          <svg viewBox="0 0 500 300" fill="none" style="width:100%;max-width:500px;">
            <circle cx="250" cy="150" r="120" stroke="rgba(10,132,255,0.06)" stroke-width="1" stroke-dasharray="4 4" />
            <circle cx="250" cy="150" r="80" stroke="rgba(10,132,255,0.08)" stroke-width="1" stroke-dasharray="4 4" />
            <circle cx="250" cy="150" r="40" stroke="rgba(0,200,255,0.10)" stroke-width="1" />
            <circle cx="250" cy="150" r="8" fill="rgba(0,200,255,0.4)" />
            <circle cx="180" cy="100" r="18" fill="rgba(10,132,255,0.10)" stroke="rgba(10,132,255,0.25)" stroke-width="1" />
            <circle cx="320" cy="90" r="14" fill="rgba(10,132,255,0.08)" stroke="rgba(10,132,255,0.20)" stroke-width="1" />
            <circle cx="350" cy="180" r="22" fill="rgba(10,132,255,0.12)" stroke="rgba(10,132,255,0.30)" stroke-width="1" />
            <circle cx="160" cy="200" r="12" fill="rgba(48,209,88,0.08)" stroke="rgba(48,209,88,0.20)" stroke-width="1" />
            <circle cx="280" cy="220" r="10" fill="rgba(255,69,58,0.08)" stroke="rgba(255,69,58,0.20)" stroke-width="1" />
            <line x1="250" y1="150" x2="180" y2="100" stroke="rgba(10,132,255,0.08)" stroke-width="1" stroke-dasharray="3 3" />
            <line x1="250" y1="150" x2="320" y2="90" stroke="rgba(10,132,255,0.08)" stroke-width="1" stroke-dasharray="3 3" />
            <line x1="250" y1="150" x2="350" y2="180" stroke="rgba(10,132,255,0.08)" stroke-width="1" stroke-dasharray="3 3" />
            <line x1="250" y1="150" x2="160" y2="200" stroke="rgba(48,209,88,0.06)" stroke-width="1" stroke-dasharray="3 3" />
            <line x1="250" y1="150" x2="280" y2="220" stroke="rgba(255,69,58,0.06)" stroke-width="1" stroke-dasharray="3 3" />
            <circle cx="120" cy="80" r="2" fill="rgba(10,132,255,0.3)" />
            <circle cx="400" cy="120" r="2" fill="rgba(10,132,255,0.2)" />
          </svg>
        </div>
      </div>

      <div class="base-panel dashboard__health">
        <div class="base-panel__header">
          <span class="base-panel__title">系统健康</span>
          <span class="dashboard__kicker">HEALTH MATRIX</span>
        </div>
        <div class="base-panel__body">
          <div v-for="h in healthItems" :key="h.name" class="health-row">
            <span class="health-dot" :class="`dot--${h.status}`" />
            <span class="health-name">{{ h.name }}</span>
            <span class="health-status" :class="`text--${h.status}`">
              {{ h.status === 'ok' ? '正常' : h.status === 'warn' ? '注意' : '异常' }}
            </span>
            <span class="health-latency text-mono">{{ h.latency }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="dashboard__row" style="margin-top:16px;">
      <HudChart title="脉冲记录趋势" kicker="近 30 天" style="min-height:280px;" />
      <div class="base-panel dashboard__events">
        <div class="base-panel__header">
          <span class="base-panel__title">实时事件</span>
          <span class="dashboard__kicker">LIVE</span>
        </div>
        <div class="base-panel__body" style="padding:8px 16px;">
          <div v-for="i in 8" :key="i" class="event-row">
            <span class="event-time text-mono">14:{{ 40 - i }}</span>
            <span class="event-dot dot--cyan" />
            <span class="event-text">事件流数据接入后渲染</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard__stats { margin-bottom: 16px; }
.dashboard__row { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
.dashboard__kicker { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }
.dashboard__situation { min-height: 400px; }
.dashboard__situation-body { display: flex; align-items: center; justify-content: center; min-height: 340px; }
.dashboard__health { min-height: 400px; }
.dashboard__events { min-height: 280px; }

.health-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: var(--text-sm); }
.health-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.dot--ok { background: var(--color-green); }
.dot--warn { background: var(--color-orange); }
.dot--error { background: var(--color-red); }
.health-name { flex: 1; color: var(--text-secondary); }
.health-status { font-size: var(--text-xs); }
.text--ok { color: var(--color-green); }
.text--warn { color: var(--color-orange); }
.text--error { color: var(--color-red); }
.health-latency { color: var(--text-muted); font-size: var(--text-xs); }

.event-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: var(--text-xs); }
.event-time { color: var(--text-muted); min-width: 40px; }
.event-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.dot--cyan { background: var(--color-cyan); }
.event-text { color: var(--text-secondary); }
</style>
