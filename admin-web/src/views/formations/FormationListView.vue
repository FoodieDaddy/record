<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useLocaleStore } from '@/stores/locale'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'
import StatusPill from '@/components/status/StatusPill.vue'
import CommandButton from '@/components/button/CommandButton.vue'
import HudChart from '@/components/chart/HudChart.vue'
import { exportToCSV } from '@/utils/export-csv'
import { useThemeStore } from '@/stores/theme'
import { getChartColors } from '@/utils/chart-theme'

const router = useRouter()
const themeStore = useThemeStore()
const api = useApi()
const locale = useLocaleStore()
const loading = ref(false)
const formations = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const chartOption = ref<any>(null)
const statusFilter = ref<'all' | 'running' | 'sealed'>('all')
const selectedIds = ref<(string | number)[]>([])

const columns = computed(() => [
  { key: 'id', label: 'ID', width: '140px', copyable: true },
  { key: 'roomNo', label: locale.t('formations.code'), width: '100px' },
  { key: 'ownerId', label: locale.t('formations.owner'), width: '140px', copyable: true },
  { key: 'memberCount', label: locale.t('formations.members'), width: '80px' },
  { key: 'scoreMode', label: locale.t('formations.protocol'), width: '100px' },
  { key: 'status', label: locale.t('common.status'), width: '80px' },
  { key: 'createdAt', label: locale.t('formations.createdAt'), width: '140px' },
  { key: 'lastActiveAt', label: locale.t('formations.lastActive'), width: '140px' },
  { key: 'actions', label: locale.t('common.actions'), width: '100px' },
])

const summaryStats = computed(() => ({
  total: total.value,
  running: formations.value.filter(f => f.status === 0).length,
  sealed: formations.value.filter(f => f.status === 1).length,
  todayCreated: 0,
}))

async function load() {
  loading.value = true
  try {
    const params: any = { page: page.value, size: 20, keyword: search.value }
    if (statusFilter.value === 'running') params.status = 0
    if (statusFilter.value === 'sealed') params.status = 1
    const data: any = await api.get('/admin/formations', { params })
    formations.value = data.records || []
    total.value = data.total || 0
  } finally { loading.value = false }
}

async function loadChart() {
  try {
    const trends: any = await api.get('/admin/dashboard/trends')
    const colors = getChartColors(themeStore.theme)
    chartOption.value = {
      backgroundColor: 'transparent',
      textStyle: { color: colors.textStyle.color, fontFamily: colors.textStyle.fontFamily, fontSize: 11 },
      xAxis: {
        type: 'category',
        data: trends.dates,
        axisLine: { lineStyle: { color: colors.axisLine.lineStyle.color } },
        axisLabel: { color: colors.axisLabel.color, fontSize: 10 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: colors.splitLine.lineStyle.color } },
        axisLabel: { color: colors.axisLabel.color, fontSize: 10 },
      },
      series: [{
        type: 'bar',
        data: trends.formationCreated,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: colors.seriesColors[1] },
              { offset: 1, color: colors.seriesColors[1] + '4D' },
            ],
          },
          borderRadius: [2, 2, 0, 0],
        },
        barWidth: '60%',
      }],
      tooltip: { trigger: 'axis', ...colors.tooltip },
      grid: { left: 40, right: 16, top: 16, bottom: 24 },
    }
  } catch {}
}

const modeDistribution = computed(() => {
  const free = formations.value.filter(f => f.scoreMode === 1).length
  const round = formations.value.filter(f => f.scoreMode === 2).length
  return [
    { label: locale.t('formations.pulseFlow'), count: free, color: 'var(--color-primary)' },
    { label: locale.t('formations.segmentWrite'), count: round, color: 'var(--color-cyan)' },
  ]
})

function setFilter(f: 'all' | 'running' | 'sealed') {
  statusFilter.value = f
  page.value = 1
  load()
}

onMounted(() => { load(); loadChart() })
</script>

<template>
  <div>
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-header__title">{{ locale.t('formations.title') }}</h1>
        <p class="page-header__subtitle">{{ locale.t('formations.subtitle') }}</p>
      </div>
    </div>

    <!-- 摘要指标 -->
    <div class="summary-cards">
      <div class="summary-card">
        <div class="summary-card__icon" style="background:rgba(47,128,237,0.08);color:#2F80ED;">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" stroke-width="1.5"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </div>
        <div class="summary-card__info">
          <span class="summary-card__value text-mono">{{ summaryStats.total }}</span>
          <span class="summary-card__label">{{ locale.t('formations.total') }}</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-card__icon" style="background:rgba(90,183,132,0.08);color:#5AB784;">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" stroke-width="1.5"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <div class="summary-card__info">
          <span class="summary-card__value text-mono" style="color:var(--color-green);">{{ summaryStats.running }}</span>
          <span class="summary-card__label">{{ locale.t('formations.active') }}</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-card__icon" style="background:rgba(138,150,168,0.08);color:#8A96A8;">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" stroke-width="1.5"><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
        </div>
        <div class="summary-card__info">
          <span class="summary-card__value text-mono" style="color:var(--text-muted);">{{ summaryStats.sealed }}</span>
          <span class="summary-card__label">{{ locale.t('formations.sealedCount') }}</span>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px;">
      <HudChart :title="locale.t('formations.creationTrend')" :kicker="locale.t('dashboard.last30days')" :option="chartOption" style="min-height:200px;" />
      <div class="base-panel" style="min-height:200px;">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('formations.protocol') }}</span>
          <span class="hud-label">{{ locale.t('formations.mode') }}</span>
        </div>
        <div class="base-panel__body">
          <div v-for="(item, i) in modeDistribution" :key="i" style="display:flex;align-items:center;gap:12px;padding:8px 0;">
            <span style="width:8px;height:8px;border-radius:50%;" :style="{ background: item.color }" />
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">{{ item.label }}</span>
            <span class="text-mono" style="font-size:13px;color:var(--text-main);">{{ item.count }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="base-panel">
      <div class="base-panel__header">
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="base-panel__title">{{ locale.t('formations.title') }}</span>
          <span class="hud-label">{{ locale.t('formations.subtitle') }}</span>
        </div>
      </div>
      <div class="toolbar">
        <div style="display:flex;gap:8px;align-items:center;">
          <input v-model="search" class="input-field" style="width:260px;" :placeholder="locale.t('formations.search')" @keyup.enter="load" />
          <CommandButton variant="secondary" @click="load">{{ locale.t('common.search') }}</CommandButton>
          <CommandButton variant="ghost" style="height:32px;font-size:11px;" @click="load" :title="locale.t('common.refresh')">↻</CommandButton>
          <CommandButton variant="ghost" style="height:32px;font-size:11px;" @click="exportToCSV('formations', columns, formations)">CSV</CommandButton>
          <div class="filter-group">
            <button class="filter-btn" :class="{ active: statusFilter === 'all' }" @click="setFilter('all')">{{ locale.t('formations.filterAll') }}</button>
            <button class="filter-btn" :class="{ active: statusFilter === 'running' }" @click="setFilter('running')">{{ locale.t('formations.filterRunning') }}</button>
            <button class="filter-btn" :class="{ active: statusFilter === 'sealed' }" @click="setFilter('sealed')">{{ locale.t('formations.filterSealed') }}</button>
          </div>
        </div>
      </div>
      <div class="base-panel__body" style="padding-top:0;">
        <DataTable :columns="columns" :data="formations" :loading="loading" selectable :selected-ids="selectedIds" @update:selectedIds="selectedIds = $event">
          <template #roomNo="{ row }">
            <span class="text-mono" style="color:var(--color-cyan);">{{ row.roomNo }}</span>
          </template>
          <template #scoreMode="{ row }">
            <span style="font-size:12px;">{{ row.scoreMode === 1 ? locale.t('formations.pulseFlow') : locale.t('formations.segmentWrite') }}</span>
          </template>
          <template #status="{ row }">
            <StatusPill :status="row.status === 0 ? 'running' : 'offline'" :label="row.status === 0 ? locale.t('formations.running') : locale.t('formations.sealed')" />
          </template>
          <template #createdAt="{ value }">
            <span style="font-size:12px;color:var(--text-muted);">{{ value ? value.substring(0, 16) : '-' }}</span>
          </template>
          <template #lastActiveAt="{ value }">
            <span style="font-size:12px;color:var(--text-muted);">{{ value ? value.substring(0, 16) : '-' }}</span>
          </template>
          <template #actions="{ row }">
            <CommandButton variant="ghost" style="height:26px;font-size:11px;padding:0 10px;" @click="router.push(`/formations/${row.id}`)">{{ locale.t('common.viewDetail') }}</CommandButton>
          </template>
        </DataTable>
        <DataPagination v-model:page="page" :total="total" :page-size="20" @update:page="load" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 16px;
}
.page-header__title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.3;
}
.page-header__subtitle {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-top: 4px;
}
.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}
.summary-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  height: 92px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 251, 255, 0.92));
  border: 1px solid rgba(130, 150, 180, 0.16);
  border-radius: 18px;
  box-shadow: 0 12px 28px rgba(31, 52, 88, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.85);
  transition: transform .2s ease, box-shadow .2s ease;
}
.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 36px rgba(31, 52, 88, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.85);
}
.summary-card__icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: linear-gradient(135deg, #E8F2FF, #DDF8FA);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
.summary-card__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.summary-card__value {
  font-size: 28px;
  font-weight: 800;
  color: #111827;
  line-height: 1.1;
}
.summary-card__label {
  font-size: 12px;
  font-weight: 600;
  color: #536176;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--table-row-border);
}
.filter-group {
  display: flex;
  gap: 2px;
  margin-left: 8px;
}
.filter-btn {
  padding: 5px 12px;
  font-size: 11px;
  border: 1px solid var(--border-subtle);
  border-radius: 3px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color .12s, border-color .12s, color .12s;
}
.filter-btn.active {
  background: var(--btn-primary-bg);
  border-color: var(--btn-primary-border);
  color: var(--color-primary);
}
.filter-btn:hover:not(.active) {
  background: var(--btn-ghost-hover-bg);
}
</style>
