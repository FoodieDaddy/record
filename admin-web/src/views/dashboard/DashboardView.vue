<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useApi } from '@/composables/useApi'
import { useLocaleStore } from '@/stores/locale'
import StatCard from '@/components/data/StatCard.vue'
import HudChart from '@/components/chart/HudChart.vue'
import SkeletonLoader from '@/components/feedback/SkeletonLoader.vue'
import { chartTheme } from '@/utils/chart-theme'

const api = useApi()
const locale = useLocaleStore()
const loading = ref(true)
const lastSync = ref('')
const nextSync = ref(30)
const trendOption = ref<any>(null)
const events = ref<any[]>([])
const healthItems = ref<any[]>([])
let syncTimer: number
let countdownTimer: number

// 按优先级排列：系统健康 > 活跃编队 > 今日脉冲 > 新增用户 > 封存航程 > 航段写入
const stats = ref([
  { label: '活跃编队', kicker: 'ACTIVE FORMATIONS', value: '-', trend: '', trendType: 'up' as const },
  { label: '今日脉冲', kicker: 'TODAY PULSE', value: '-', trend: '', trendType: 'up' as const },
  { label: '新增用户', kicker: 'NEW USERS', value: '-', trend: '', trendType: 'up' as const },
  { label: '封存航程', kicker: 'SEALED TODAY', value: '-', trend: '', trendType: 'up' as const },
  { label: '航段写入', kicker: 'SEGMENT WRITES', value: '-', trend: '', trendType: 'up' as const },
  { label: '脉冲总量', kicker: 'TOTAL TRANSFERS', value: '-', trend: '', trendType: 'up' as const },
])

const trendsExpanded = ref(true)

function formatNum(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return n.toLocaleString()
}

function updateSyncTime() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  lastSync.value = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  nextSync.value = 30
}

async function loadAll() {
  try {
    const [overview, health, trends, eventData, pulseStats] = await Promise.all([
      api.get('/admin/dashboard/overview'),
      api.get('/admin/system/health'),
      api.get('/admin/dashboard/trends'),
      api.get('/admin/dashboard/events'),
      api.get('/admin/dashboard/pulse-stats'),
    ])

    // 指标卡
    const ov = overview as any
    stats.value[0].value = formatNum(ov.activeFormations || 0)
    stats.value[1].value = formatNum(ov.todayTransfers || 0)
    stats.value[2].value = formatNum(ov.todayActiveUsers || 0)
    stats.value[3].value = formatNum(ov.todaySealed || 0)
    stats.value[4].value = formatNum((pulseStats as any)?.totalRounds || 0)
    stats.value[5].value = formatNum((pulseStats as any)?.totalTransfers || 0)

    // 健康
    if (Array.isArray(health)) healthItems.value = health

    // 趋势
    const tr = trends as any
    trendOption.value = {
      ...chartTheme,
      xAxis: {
        type: 'category',
        data: tr.dates,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisLabel: { color: 'rgba(255,255,255,0.38)', fontSize: 10 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
        axisLabel: { color: 'rgba(255,255,255,0.38)', fontSize: 10 },
      },
      series: [
        { name: '用户增长', type: 'line', data: tr.userGrowth, smooth: true, symbol: 'none', lineStyle: { color: '#0A84FF', width: 2 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(10,132,255,0.25)' }, { offset: 1, color: 'rgba(10,132,255,0.02)' }] } } },
        { name: '编队创建', type: 'line', data: tr.formationCreated, smooth: true, symbol: 'none', lineStyle: { color: '#00C8FF', width: 2 } },
      ],
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(4,8,16,0.95)', borderColor: 'rgba(0,200,255,0.22)', textStyle: { color: '#fff', fontSize: 12 } },
      legend: { data: ['用户增长', '编队创建'], textStyle: { color: 'rgba(255,255,255,0.56)', fontSize: 11 }, top: 0, right: 0 },
      grid: { left: 40, right: 16, top: 32, bottom: 24 },
    }

    // 事件
    events.value = Array.isArray(eventData) ? eventData : []

    updateSyncTime()
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function refreshAll() {
  loading.value = true
  loadAll()
}

onMounted(() => {
  loadAll()
  syncTimer = window.setInterval(loadAll, 30000)
  countdownTimer = window.setInterval(() => {
    if (nextSync.value > 0) nextSync.value--
  }, 1000)
})

onUnmounted(() => {
  window.clearInterval(syncTimer)
  window.clearInterval(countdownTimer)
})
</script>

<template>
  <div class="dashboard">
    <!-- 加载骨架 -->
    <div v-if="loading">
      <div class="grid-6" style="margin-bottom:16px;">
        <div v-for="i in 6" :key="i" class="base-panel">
          <div class="base-panel__body"><SkeletonLoader :card="true" /></div>
        </div>
      </div>
    </div>

    <template v-else>
      <!-- 基地状态总览条 -->
      <div class="dashboard__status-bar">
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="health-dot" :class="healthItems.some(h => h.status === 'error') ? 'dot--error' : healthItems.some(h => h.status === 'warn') ? 'dot--warn' : 'dot--ok'" />
          <span style="font-size:13px;color:var(--text-main);">{{ healthItems.some(h => h.status === 'error') ? locale.t('dashboard.baseError') : healthItems.some(h => h.status === 'warn') ? locale.t('dashboard.baseWarn') : locale.t('dashboard.baseOk') }}</span>
        </div>
        <div style="display:flex;align-items:center;gap:16px;">
          <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">
            {{ locale.t('dashboard.lastSync') }} {{ lastSync }} · {{ locale.t('dashboard.nextSync') }} {{ nextSync }}s
          </span>
          <button class="cmd-btn cmd-btn--ghost" style="height:24px;padding:0 8px;font-size:11px;" @click="refreshAll">{{ locale.t('common.refresh') }}</button>
        </div>
      </div>

      <!-- 指标卡 -->
      <div class="dashboard__stats grid-6">
        <StatCard
          v-for="(s, i) in stats"
          :key="s.label"
          v-bind="s"
          :style="{ animationDelay: `${i * 60}ms` }"
          class="animate-fade-in-up"
        />
      </div>

      <!-- 态势图 + 健康矩阵 -->
      <div class="dashboard__row">
        <div class="base-panel base-panel--hud dashboard__situation">
          <div class="base-panel__header">
            <span class="base-panel__title">{{ locale.t('dashboard.situation') }}</span>
            <span class="hud-label">SITUATION</span>
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
            <span class="base-panel__title">{{ locale.t('dashboard.health') }}</span>
            <span class="hud-label">HEALTH</span>
          </div>
          <div class="base-panel__body">
            <div v-for="h in healthItems" :key="h.name" class="health-row">
              <span class="health-dot" :class="`dot--${h.status}`" />
              <span class="health-name">{{ h.name }}</span>
              <span class="health-status" :class="`text--${h.status}`">
                {{ h.status === 'ok' ? locale.t('system.ok') : h.status === 'warn' ? locale.t('system.warn') : locale.t('system.error') }}
              </span>
              <span class="health-latency text-mono">{{ h.latency }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 趋势图 + 事件流 -->
      <div class="dashboard__row" style="margin-top:16px;">
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:12px;color:var(--text-muted);">{{ locale.t('dashboard.trends') }}</span>
            <button class="cmd-btn cmd-btn--ghost" style="height:22px;padding:0 6px;font-size:10px;" @click="trendsExpanded = !trendsExpanded">
              {{ trendsExpanded ? '收起' : '展开' }}
            </button>
          </div>
          <HudChart v-if="trendsExpanded" title="脉冲记录趋势" kicker="近 30 天" :option="trendOption" style="min-height:240px;" />
        </div>

        <div class="base-panel dashboard__events">
          <div class="base-panel__header">
            <span class="base-panel__title">{{ locale.t('dashboard.events') }}</span>
            <span class="hud-label">LIVE</span>
          </div>
          <div class="base-panel__body" style="padding:8px 16px;">
            <div v-for="(e, i) in events" :key="i" class="event-row" :class="`event-row--${e.color}`">
              <span class="event-time text-mono">{{ e.time }}</span>
              <span class="event-dot" :class="`dot--${e.color}`" />
              <span class="event-text">{{ e.desc }}</span>
            </div>
            <div v-if="events.length === 0" style="text-align:center;padding:24px;color:var(--text-muted);font-size:12px;">
              {{ locale.t('dashboard.noEvents') }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard__status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  margin-bottom: 16px;
  background: rgba(4,8,16,0.5);
  border: 1px solid rgba(10,132,255,0.08);
  border-radius: 4px;
}
.dashboard__stats { margin-bottom: 16px; }
.dashboard__row { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
.dashboard__situation { min-height: 360px; }
.dashboard__situation-body { display: flex; align-items: center; justify-content: center; min-height: 300px; }
.dashboard__health { min-height: 360px; }
.dashboard__events { min-height: 240px; }

.health-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.dot--ok { background: var(--color-green); }
.dot--warn { background: var(--color-orange); }
.dot--error { background: var(--color-red); }
.health-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: var(--text-sm); }
.health-name { flex: 1; color: var(--text-secondary); }
.health-status { font-size: var(--text-xs); }
.text--ok { color: var(--color-green); }
.text--warn { color: var(--color-orange); }
.text--error { color: var(--color-red); }
.health-latency { color: var(--text-muted); font-size: var(--text-xs); }

.event-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: var(--text-xs); }
.event-row--error { opacity: 1; }
.event-row--warn { opacity: 0.9; }
.event-row--green { opacity: 0.8; }
.event-time { color: var(--text-muted); min-width: 40px; }
.event-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.dot--cyan { background: var(--color-cyan); }
.dot--green { background: var(--color-green); }
.dot--blue { background: var(--color-primary); }
.event-text { color: var(--text-secondary); }

@media (max-width: 1440px) {
  .dashboard__stats {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 1024px) {
  .dashboard__stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .dashboard__row {
    grid-template-columns: 1fr;
  }
}
</style>
