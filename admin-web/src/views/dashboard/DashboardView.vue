<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import { useLocaleStore } from '@/stores/locale'
import { useThemeStore } from '@/stores/theme'
import { getChartColors } from '@/utils/chart-theme'
import StatCard from '@/components/data/StatCard.vue'
import HudChart from '@/components/chart/HudChart.vue'

const api = useApi()
const locale = useLocaleStore()
const themeStore = useThemeStore()
const loading = ref(true)
const lastSync = ref('')
const nextSync = ref(30)
const trendOption = ref<any>(null)
const events = ref<any[]>([])
const healthItems = ref<any[]>([])
const trendData = ref<any>(null)
let syncTimer: number
let countdownTimer: number

const stats = computed(() => [
  { label: locale.t('stat.activeFormations'), kicker: locale.t('statKicker.activeFormations'), value: '-', trend: '', trendType: 'up' as const, color: '#2F80ED', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { label: locale.t('stat.todayPulse'), kicker: locale.t('statKicker.todayPulse'), value: '-', trend: '', trendType: 'up' as const, color: '#58A6D8', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { label: locale.t('stat.newUsers'), kicker: locale.t('statKicker.newUsers'), value: '-', trend: '', trendType: 'up' as const, color: '#7088F5', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
  { label: locale.t('stat.sealedToday'), kicker: locale.t('statKicker.sealedToday'), value: '-', trend: '', trendType: 'up' as const, color: '#5AB784', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
  { label: locale.t('stat.segmentWrites'), kicker: locale.t('statKicker.segmentWrites'), value: '-', trend: '', trendType: 'up' as const, color: '#E6A24D', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { label: locale.t('stat.totalTransfers'), kicker: locale.t('statKicker.totalTransfers'), value: '-', trend: '', trendType: 'up' as const, color: '#7088F5', icon: 'M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z M8 12h8 M12 8v8' },
])

const sortedHealth = computed(() => {
  const order: Record<string, number> = { error: 0, warn: 1, ok: 2 }
  return [...healthItems.value].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3))
})

const overallStatus = computed(() => {
  if (healthItems.value.some(h => h.status === 'error')) return 'error'
  if (healthItems.value.some(h => h.status === 'warn')) return 'warn'
  return 'ok'
})

const overallStatusText = computed(() => {
  if (overallStatus.value === 'error') return locale.t('dashboard.baseError')
  if (overallStatus.value === 'warn') return locale.t('dashboard.baseWarn')
  return locale.t('dashboard.baseOk')
})

function mapServiceName(name: string): string {
  const map: Record<string, string> = {
    'API 服务': locale.t('system.apiService'),
    'MySQL': locale.t('system.database'),
    'Redis': locale.t('system.cache'),
    'WebSocket': locale.t('system.realtime'),
    'CloudBase 存储': locale.t('system.cloudStorage'),
    'TTS 主引擎': locale.t('system.voiceMain'),
    'TTS 副引擎': locale.t('system.voiceAlt'),
    'Edge-TTS': locale.t('system.voiceMain'),
    'MiMo': locale.t('system.voiceAlt'),
    'LLM': locale.t('system.navMain'),
    '导航主引擎': locale.t('system.navMain'),
  }
  return map[name] || name
}

function formatNum(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + (locale.isZh ? '万' : 'W')
  return n.toLocaleString()
}

function updateSyncTime() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  lastSync.value = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  nextSync.value = 30
}

const statsData = ref<any[]>([])
const overviewData = ref<any>({})

function updateStatsFromData(ov: any, pulseStats: any) {
  overviewData.value = ov
  const newData = [...stats.value]
  newData[0] = { ...newData[0], value: formatNum(ov.activeFormations || 0), trend: ov.activeFormations > 0 ? locale.t('trend.running') : locale.t('trend.noFormations') }
  newData[1] = { ...newData[1], value: formatNum(ov.todayTransfers || 0), trend: ov.todayTransfers > 0 ? `${ov.todayTransfers} ${locale.t('trend.pulseCount')}` : locale.t('trend.noPulseToday') }
  newData[2] = { ...newData[2], value: formatNum(ov.todayActiveUsers || 0), trend: ov.todayActiveUsers > 0 ? locale.t('trend.activeToday') : locale.t('trend.noPulseToday') }
  newData[3] = { ...newData[3], value: formatNum(ov.todaySealed || 0), trend: ov.todaySealed > 0 ? locale.t('trend.sealedToday') : locale.t('trend.noPulseToday') }
  newData[4] = { ...newData[4], value: formatNum(pulseStats?.totalRounds || 0), trend: pulseStats?.pendingRounds ? `${pulseStats.pendingRounds} ${locale.t('trend.pendingConfirm')}` : '' }
  newData[5] = { ...newData[5], value: formatNum(pulseStats?.totalTransfers || 0), trend: '' }
  statsData.value = newData
}

function buildTrendOption(tr: any) {
  const colors = getChartColors(themeStore.theme)
  const hasData = tr.userGrowth?.some((v: number) => v > 0) || tr.formationCreated?.some((v: number) => v > 0)
  if (!hasData) return null
  return {
    backgroundColor: 'transparent',
    textStyle: { color: colors.textStyle.color, fontFamily: colors.textStyle.fontFamily, fontSize: 11 },
    xAxis: {
      type: 'category',
      data: tr.dates,
      axisLine: { lineStyle: { color: colors.axisLine.lineStyle.color } },
      axisLabel: { color: colors.axisLabel.color, fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: colors.splitLine.lineStyle.color } },
      axisLabel: { color: colors.axisLabel.color, fontSize: 10 },
    },
    series: [
      {
        name: locale.t('chart.userGrowth'), type: 'line', data: tr.userGrowth, smooth: true, symbol: 'none',
        lineStyle: { color: colors.seriesColors[0], width: 2 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: colors.seriesColors[0] + '28' }, { offset: 1, color: colors.seriesColors[0] + '04' }] } },
      },
      {
        name: locale.t('chart.formationCreated'), type: 'line', data: tr.formationCreated, smooth: true, symbol: 'none',
        lineStyle: { color: colors.seriesColors[1], width: 2 },
      },
    ],
    tooltip: { trigger: 'axis', ...colors.tooltip },
    legend: { data: [locale.t('chart.userGrowth'), locale.t('chart.formationCreated')], textStyle: { color: colors.textStyle.color, fontSize: 11 }, top: 0, right: 0 },
    grid: { left: 40, right: 16, top: 32, bottom: 20 },
  }
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

    const ov = overview as any
    updateStatsFromData(ov, pulseStats as any)

    if (Array.isArray(health)) healthItems.value = health

    trendData.value = trends
    trendOption.value = buildTrendOption(trends as any)

    events.value = Array.isArray(eventData) ? eventData.slice(0, 6) : []

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

watch(() => themeStore.theme, () => {
  if (trendData.value) {
    trendOption.value = buildTrendOption(trendData.value)
  }
})

watch(() => locale.locale, () => {
  if (trendData.value) {
    trendOption.value = buildTrendOption(trendData.value)
  }
  loadAll()
})
</script>

<template>
  <div class="dashboard-screen">
    <!-- 1. 页面标题区 -->
    <div class="dash-header">
      <div class="dash-header__left">
        <h1 class="dash-header__title">{{ locale.t('dashboard.title') }}</h1>
        <span class="dash-header__sub">{{ locale.t('dashboard.subtitle') }}</span>
      </div>
      <div class="dash-header__right">
        <span class="dash-header__sync text-mono">{{ locale.t('dashboard.lastSync') }} {{ lastSync }}</span>
        <button class="cmd-btn cmd-btn--secondary" style="height:30px;padding:0 14px;font-size:11px;" @click="refreshAll">{{ locale.t('common.refresh') }}</button>
      </div>
    </div>

    <!-- 2. 指标卡区 -->
    <div class="dash-stats">
      <StatCard
        v-for="(s, i) in (statsData.length ? statsData : stats)"
        :key="s.label"
        v-bind="s"
        :style="{ animationDelay: `${i * 50}ms` }"
        class="animate-fade-in-up"
      />
    </div>

    <!-- 3. 主内容区 -->
    <div class="dash-main-row">
      <!-- 运行总览 -->
      <div class="base-panel dash-overview">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('dashboard.situation') }}</span>
          <div class="dash-status-indicator">
            <span class="health-dot" :class="`dot--${overallStatus}`" />
            <span class="dash-status-text">{{ overallStatusText }}</span>
          </div>
        </div>
        <div class="base-panel__body dash-overview__body">
          <div class="dash-overview__orbit">
            <svg viewBox="0 0 200 200" fill="none" class="dash-orbit-svg">
              <circle cx="100" cy="100" r="80" stroke="var(--border-subtle)" stroke-width="1" stroke-dasharray="4 4" />
              <circle cx="100" cy="100" r="55" stroke="var(--border-medium)" stroke-width="1" stroke-dasharray="3 3" />
              <circle cx="100" cy="100" r="30" stroke="var(--color-primary)" stroke-width="1" opacity="0.2" />
              <circle cx="100" cy="100" r="5" fill="var(--color-primary)" opacity="0.4" />
              <circle cx="50" cy="55" r="10" fill="var(--btn-primary-bg)" stroke="var(--btn-primary-border)" stroke-width="1" />
              <circle cx="150" cy="50" r="8" fill="var(--btn-primary-bg)" stroke="var(--btn-primary-border)" stroke-width="1" />
              <circle cx="155" cy="130" r="12" fill="var(--btn-primary-bg)" stroke="var(--btn-primary-border)" stroke-width="1" />
              <circle cx="45" cy="140" r="7" fill="var(--pill-ok-bg)" stroke="var(--pill-ok-border)" stroke-width="1" />
              <circle cx="120" cy="160" r="6" fill="var(--pill-error-bg)" stroke="var(--pill-error-border)" stroke-width="1" />
              <line x1="100" y1="100" x2="50" y2="55" stroke="var(--border-subtle)" stroke-width="1" stroke-dasharray="2 2" />
              <line x1="100" y1="100" x2="150" y2="50" stroke="var(--border-subtle)" stroke-width="1" stroke-dasharray="2 2" />
              <line x1="100" y1="100" x2="155" y2="130" stroke="var(--border-subtle)" stroke-width="1" stroke-dasharray="2 2" />
            </svg>
          </div>
          <div class="dash-overview__data">
            <div class="readout-row">
              <span class="readout-label">{{ locale.t('stat.activeFormations') }}</span>
              <span class="readout-value">{{ overviewData.activeFormations ?? '-' }}</span>
            </div>
            <div class="readout-row">
              <span class="readout-label">{{ locale.t('stat.todayPulse') }}</span>
              <span class="readout-value">{{ overviewData.todayTransfers ?? '-' }}</span>
            </div>
            <div class="readout-row">
              <span class="readout-label">{{ locale.t('stat.sealedToday') }}</span>
              <span class="readout-value">{{ overviewData.todaySealed ?? '-' }}</span>
            </div>
            <div class="readout-row">
              <span class="readout-label">{{ locale.t('dashboard.events') }}</span>
              <span class="readout-value">{{ events.length }}</span>
            </div>
            <div class="readout-row">
              <span class="readout-label">{{ locale.t('dashboard.health') }}</span>
              <span class="readout-value" style="display:flex;align-items:center;gap:6px;">
                <span class="health-dot" :class="`dot--${overallStatus}`" />
                <span :class="`text--${overallStatus}`" style="font-size:12px;font-weight:600;">{{ overallStatusText }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 系统健康 -->
      <div class="base-panel dash-health">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('dashboard.health') }}</span>
        </div>
        <div class="base-panel__body dash-health__body">
          <div v-for="h in sortedHealth" :key="h.name" class="health-row" :class="{ 'health-row--error': h.status === 'error' }">
            <span class="health-dot" :class="`dot--${h.status}`" />
            <span class="health-name">{{ mapServiceName(h.name) }}</span>
            <span class="health-status" :class="`text--${h.status}`">
              {{ h.status === 'ok' ? locale.t('system.ok') : h.status === 'warn' ? locale.t('system.warn') : locale.t('system.error') }}
            </span>
            <span class="health-latency text-mono">{{ h.latency || '-' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. 底部趋势/事件区 -->
    <div class="dash-bottom-row">
      <div class="dash-trend">
        <div class="dash-trend__header">
          <span class="dash-trend__title">{{ locale.t('dashboard.pulseTrend') }}</span>
          <span class="hud-label">{{ locale.t('dashboard.last30days') }}</span>
        </div>
        <div class="dash-trend__body">
          <HudChart v-if="trendOption" :option="trendOption" style="height:100%;" />
          <div v-else class="dash-trend__empty">
            <span style="font-size:12px;color:var(--text-muted);">{{ locale.t('dashboard.noTrendData') }}</span>
          </div>
        </div>
      </div>

      <div class="base-panel dash-events">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('dashboard.events') }}</span>
        </div>
        <div class="base-panel__body dash-events__body">
          <div v-for="(e, i) in events" :key="i" class="event-row">
            <span class="event-time text-mono">{{ e.time }}</span>
            <span class="event-dot" :class="`dot--${e.color}`" />
            <span class="event-text">{{ e.desc }}</span>
          </div>
          <div v-if="events.length === 0" class="dash-events__empty">
            {{ locale.t('dashboard.noEvents') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── 一屏 Grid ── */
.dashboard-screen {
  height: 100%;
  overflow: hidden;
  display: grid;
  grid-template-rows: 52px minmax(80px, 100px) minmax(0, 1fr) minmax(140px, 180px);
  gap: 16px;
}

/* ── 1. 标题区 ── */
.dash-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 0;
}
.dash-header__title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.2;
}
.dash-header__sub {
  font-size: 11px;
  color: var(--text-muted);
  margin-left: 12px;
}
.dash-header__right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.dash-header__sync { font-size: 10px; color: var(--text-muted); }

/* ── 2. 指标卡 ── */
.dash-stats {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
  min-height: 0;
}
.dash-stats :deep(.stat-card) {
  padding: 14px 16px;
}
.dash-stats :deep(.stat-card__value) {
  font-size: 22px;
}
.dash-stats :deep(.stat-card__kicker) {
  margin-bottom: 4px;
}

/* ── 3. 主态势区 ── */
.dash-main-row {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 16px;
}

.dash-overview {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.dash-overview__body {
  flex: 1;
  display: flex;
  align-items: stretch;
  gap: 20px;
  min-height: 0;
  overflow: hidden;
  padding: 16px 20px;
}
.dash-overview__orbit {
  flex: 0 0 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dash-orbit-svg {
  width: 160px;
  height: 160px;
}
.dash-overview__data {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}
.dash-status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dash-status-text {
  font-size: 11px;
  color: var(--text-muted);
}

.dash-health {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.dash-health__body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
}

.dash-status-bar__left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dash-status-bar__text {
  font-size: 11px;
  color: var(--text-muted);
}

/* ── 4. 底部区 ── */
.dash-bottom-row {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 16px;
}

.dash-trend {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bg-panel-strong);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xs);
}
.dash-trend__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  background: var(--panel-header-bg);
  border-bottom: 1px solid var(--panel-header-border);
}
.dash-trend__title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
}
.dash-trend__body {
  flex: 1;
  min-height: 0;
  padding: 4px;
}
.dash-trend__empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dash-events {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.dash-events__body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 16px;
}
.dash-events__empty {
  text-align: center;
  padding: 16px 0;
  color: var(--text-muted);
  font-size: 11px;
}

/* ── 健康行 ── */
.health-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.dot--ok { background: var(--color-green); }
.dot--warn { background: var(--color-orange); }
.dot--error { background: var(--color-red); }
.health-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px;
  background: rgba(247, 250, 254, 0.80);
  border: 1px solid rgba(130, 150, 180, 0.08);
  border-radius: 12px;
  font-size: 12px;
  height: 42px;
  margin-bottom: 6px;
  transition: background .12s;
}
.health-row:last-child { margin-bottom: 0; }
.health-row:hover { background: rgba(240, 246, 252, 0.90); }
.health-row--error { order: -1; }
.health-name { flex: 1; color: #536176; font-weight: 500; }
.health-status { font-size: 11px; font-weight: 600; }
.text--ok { color: var(--color-green); }
.text--warn { color: var(--color-orange); }
.text--error { color: var(--color-red); }
.health-latency { color: var(--text-muted); font-size: 11px; font-family: var(--font-mono); }

/* ── 事件行 ── */
.event-row {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  background: rgba(247, 250, 254, 0.60);
  border: 1px solid rgba(130, 150, 180, 0.06);
  border-radius: 10px;
  font-size: 11px;
  margin-bottom: 4px;
  transition: background .12s;
}
.event-row:hover { background: rgba(240, 246, 252, 0.80); }
.event-time { color: var(--text-muted); min-width: 36px; font-family: var(--font-mono); }
.event-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.dot--cyan { background: var(--color-cyan); }
.dot--green { background: var(--color-green); }
.dot--blue { background: var(--color-primary); }
.event-text { color: #536176; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }

/* ── 响应式 ── */
@media (max-width: 1440px) {
  .dash-stats { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 1024px) {
  .dash-stats { grid-template-columns: repeat(2, 1fr); }
  .dash-main-row,
  .dash-bottom-row { grid-template-columns: 1fr; }
}
</style>
