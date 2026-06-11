<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useLocaleStore } from '@/stores/locale'
import { useDebounce } from '@/composables/useDebounce'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'
import CommandButton from '@/components/button/CommandButton.vue'
import HudChart from '@/components/chart/HudChart.vue'
import { useThemeStore } from '@/stores/theme'
import { getChartColors } from '@/utils/chart-theme'

const router = useRouter()
const route = useRoute()
const api = useApi()
const locale = useLocaleStore()
const themeStore = useThemeStore()
const loading = ref(false)
const logs = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const debouncedSearch = useDebounce(search, 350)

// 防抖后自动触发搜索（无需回车）
watch(debouncedSearch, () => {
  page.value = 1
  load()
})

const chartOption = ref<any>(null)

const columns = computed(() => [
  { key: 'id', label: 'ID', width: '140px', copyable: true },
  { key: 'userId', label: locale.t('users.userId'), width: '140px', copyable: true },
  { key: 'source', label: locale.t('directives.source'), width: '100px' },
  { key: 'success', label: locale.t('common.status'), width: '80px' },
  { key: 'duration', label: locale.t('directives.duration'), width: '80px' },
  { key: 'createdAt', label: locale.t('formations.createdAt'), width: '140px' },
  { key: 'actions', label: locale.t('common.actions'), width: '80px' },
])

const summaryStats = computed(() => {
  const success = logs.value.filter(l => l.success === 1).length
  const failed = logs.value.filter(l => l.success !== 1).length
  const backup = logs.value.filter(l => l.source === 'fallback' || l.source === 'backup').length
  return { total: total.value, success, failed, backup }
})

async function load() {
  loading.value = true
  try {
    const params: any = { page: page.value, size: 20 }
    if (search.value && search.value.trim()) {
      const trimmed = search.value.trim()
      if (/^\d+$/.test(trimmed)) {
        params.userId = trimmed
      }
      // 检测类似 trace ID 的格式（如 SIM- 开头或 16 位以上混合字符）
      if (/^(SIM-|[a-zA-Z0-9]{16,})/.test(trimmed)) {
        params.requestId = trimmed
      }
    }
    const data: any = await api.get('/admin/directives/logs', { params })
    logs.value = data.records || []
    total.value = data.total || 0
  } finally { loading.value = false }
}

async function loadChart() {
  try {
    const stats: any = await api.get('/admin/dashboard/pulse-stats')
    const colors = getChartColors(themeStore.theme)
    chartOption.value = {
      backgroundColor: 'transparent',
      textStyle: { color: colors.textStyle.color, fontFamily: colors.textStyle.fontFamily, fontSize: 11 },
      xAxis: {
        type: 'category',
        data: [locale.t('directives.chartTotalFlow'), locale.t('directives.chartTotalPulse'), locale.t('directives.chartSegments'), locale.t('directives.chartSealed')],
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
        data: [stats.totalTransfers || 0, stats.totalPulseValue || 0, stats.totalRounds || 0, stats.sealedRooms || 0],
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: colors.seriesColors[2] },
              { offset: 1, color: colors.seriesColors[2] + '4D' },
            ],
          },
          borderRadius: [2, 2, 0, 0],
        },
        barWidth: '50%',
      }],
      tooltip: { trigger: 'axis', ...colors.tooltip },
      grid: { left: 50, right: 16, top: 16, bottom: 24 },
    }
  } catch {}
}

function mapSource(source: string): string {
  if (source === 'fallback' || source === 'backup') return locale.t('directives.backup')
  if (source === 'llm' || source === 'LLM' || source === 'main') return locale.t('directives.mainEngine')
  return source || locale.t('directives.mainEngine')
}

let refreshTimer: number
onMounted(() => {
  if (route.query.requestId) {
    search.value = String(route.query.requestId)
  } else if (route.query.userId) {
    search.value = String(route.query.userId)
  }
  load()
  loadChart()
  refreshTimer = window.setInterval(load, 30000)
})
onUnmounted(() => { clearInterval(refreshTimer) })
</script>

<template>
  <div>
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-header__title">{{ locale.t('directives.title') }}</h1>
        <p class="page-header__subtitle">{{ locale.t('directives.subtitle') }}</p>
      </div>
    </div>

    <!-- 摘要指标 -->
    <div class="summary-cards">
      <div class="summary-card">
        <div class="summary-card__icon" style="background:rgba(47,128,237,0.08);color:#2F80ED;">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" stroke-width="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
        <div class="summary-card__info">
          <span class="summary-card__value text-mono">{{ summaryStats.total }}</span>
          <span class="summary-card__label">{{ locale.t('directives.total') }}</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-card__icon" style="background:rgba(90,183,132,0.08);color:#5AB784;">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div class="summary-card__info">
          <span class="summary-card__value text-mono" style="color:var(--color-green);">{{ summaryStats.success }}</span>
          <span class="summary-card__label">{{ locale.t('directives.successCount') }}</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-card__icon" style="background:rgba(226,109,109,0.08);color:#E26D6D;">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" stroke-width="1.5"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div class="summary-card__info">
          <span class="summary-card__value text-mono" style="color:var(--color-red);">{{ summaryStats.failed }}</span>
          <span class="summary-card__label">{{ locale.t('directives.failedCount') }}</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-card__icon" style="background:rgba(230,162,77,0.08);color:#E6A24D;">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" stroke-width="1.5"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </div>
        <div class="summary-card__info">
          <span class="summary-card__value text-mono" style="color:var(--color-orange);">{{ summaryStats.backup }}</span>
          <span class="summary-card__label">{{ locale.t('directives.backupCount') }}</span>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px;">
      <HudChart :title="locale.t('directives.chartTitle')" :kicker="locale.t('directives.chartKicker')" :option="chartOption" style="min-height:200px;" />
      <div class="base-panel" style="min-height:200px;">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('directives.source') }}</span>
          <span class="hud-label">{{ locale.t('directives.statusDist') }}</span>
        </div>
        <div class="base-panel__body">
          <div style="display:flex;align-items:center;gap:12px;padding:8px 0;">
            <span style="width:8px;height:8px;border-radius:50;background:var(--color-green);" />
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">{{ locale.t('directives.success') }}</span>
            <span class="text-mono" style="font-size:13px;color:var(--text-main);">{{ summaryStats.success }}</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:8px 0;">
            <span style="width:8px;height:8px;border-radius:50;background:var(--color-red);" />
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">{{ locale.t('directives.failed') }}</span>
            <span class="text-mono" style="font-size:13px;color:var(--text-main);">{{ summaryStats.failed }}</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:8px 0;">
            <span style="width:8px;height:8px;border-radius:50;background:var(--color-orange);" />
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">{{ locale.t('directives.backup') }}</span>
            <span class="text-mono" style="font-size:13px;color:var(--text-main);">{{ summaryStats.backup }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="base-panel">
      <div class="base-panel__header">
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="base-panel__title">{{ locale.t('directives.title') }}</span>
          <span class="hud-label">{{ locale.t('directives.subtitle') }}</span>
        </div>
      </div>
      <div class="toolbar">
        <div style="display:flex;gap:8px;align-items:center;">
          <input v-model="search" class="input-field" style="width:240px;" :placeholder="locale.t('directives.search')" @keyup.enter="load" />
          <CommandButton variant="secondary" @click="load">{{ locale.t('common.search') }}</CommandButton>
          <CommandButton variant="ghost" style="height:32px;font-size:11px;" @click="load" :title="locale.t('common.refresh')">↻</CommandButton>
        </div>
      </div>
      <div class="base-panel__body" style="padding-top:0;">
        <DataTable :columns="columns" :data="logs" :loading="loading">
          <template #source="{ row }">
            <span :style="{ color: mapSource(row.source) === locale.t('directives.mainEngine') ? 'var(--color-primary)' : 'var(--color-orange)' }">{{ mapSource(row.source) }}</span>
          </template>
          <template #success="{ row }">
            <span :style="{ color: row.success === 1 ? 'var(--color-green)' : 'var(--color-red)' }">{{ row.success === 1 ? locale.t('directives.success') : locale.t('directives.failed') }}</span>
          </template>
          <template #duration="{ row }">
            <span class="text-mono" style="font-size:11px;color:var(--text-muted);">{{ row.duration ? row.duration + 'ms' : '-' }}</span>
          </template>
          <template #createdAt="{ value }">
            <span style="font-size:12px;color:var(--text-muted);">{{ value ? value.substring(0, 16) : '-' }}</span>
          </template>
          <template #actions="{ row }">
            <CommandButton variant="ghost" style="height:26px;font-size:11px;padding:0 10px;" @click="router.push(`/directives/logs/${row.id}`)">{{ locale.t('common.viewDetail') }}</CommandButton>
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
  grid-template-columns: repeat(4, 1fr);
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
</style>
