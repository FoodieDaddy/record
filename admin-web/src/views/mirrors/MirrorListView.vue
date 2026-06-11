<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useLocaleStore } from '@/stores/locale'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'
import CommandButton from '@/components/button/CommandButton.vue'
import HudChart from '@/components/chart/HudChart.vue'
import { useThemeStore } from '@/stores/theme'
import { exportToCSV } from '@/utils/export-csv'
import { getChartColors } from '@/utils/chart-theme'

const router = useRouter()
const api = useApi()
const locale = useLocaleStore()
const themeStore = useThemeStore()
const loading = ref(false)
const mirrors = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const mbtiFilter = ref('')
const chartOption = ref<any>(null)

const columns = computed(() => [
  { key: 'userId', label: locale.t('users.userId'), width: '140px', copyable: true },
  { key: 'nickname', label: locale.t('mirrors.callsign'), width: '120px' },
  { key: 'mbtiType', label: locale.t('mirrors.mbti'), width: '100px' },
  { key: 'personaConfidence', label: locale.t('mirrors.confidence'), width: '90px' },
  { key: 'sampleCount', label: locale.t('mirrors.samples'), width: '80px' },
  { key: 'updatedAt', label: locale.t('mirrors.updated'), width: '140px' },
  { key: 'actions', label: locale.t('common.actions'), width: '160px' },
])

const summaryStats = computed(() => {
  const calibrated = mirrors.value.filter(m => m.mbtiType && m.mbtiType !== '-').length
  const uncalibrated = mirrors.value.length - calibrated
  const avgConf = mirrors.value.length > 0
    ? Math.round(mirrors.value.reduce((s, m) => s + (m.personaConfidence || 0), 0) / mirrors.value.length)
    : 0
  return { total: total.value, calibrated, uncalibrated, avgConf }
})

async function load() {
  loading.value = true
  try {
    const params: any = { page: page.value, size: 20, keyword: search.value }
    if (mbtiFilter.value) params.mbtiType = mbtiFilter.value
    const data: any = await api.get('/admin/mirrors', { params })
    mirrors.value = data.records || []
    total.value = data.total || 0
  } catch { /* 后台图表非关键，静默降级 */ } finally { loading.value = false }
}

async function loadChart() {
  try {
    const data: any = await api.get('/admin/dashboard/trace-stats')
    const colors = getChartColors(themeStore.theme)
    chartOption.value = {
      backgroundColor: 'transparent',
      textStyle: { color: colors.textStyle.color, fontFamily: colors.textStyle.fontFamily, fontSize: 11 },
      xAxis: {
        type: 'category',
        data: data.dates || [],
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
        type: 'line',
        data: data.sealedCounts || [],
        smooth: true,
        symbol: 'none',
        lineStyle: { color: colors.seriesColors[2], width: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: colors.seriesColors[2] + '30' },
              { offset: 1, color: colors.seriesColors[2] + '04' },
            ],
          },
        },
      }],
      tooltip: { trigger: 'axis', ...colors.tooltip },
      grid: { left: 40, right: 16, top: 16, bottom: 24 },
    }
  } catch {}
}

const mbtiDistribution = computed(() => {
  const types: Record<string, number> = {}
  mirrors.value.forEach(m => {
    const t = m.mbtiType || (locale.isZh ? '未校准' : 'Uncalibrated')
    types[t] = (types[t] || 0) + 1
  })
  return Object.entries(types).map(([label, count]) => ({
    label,
    count,
    color: 'var(--color-purple)',
  })).slice(0, 6)
})

onMounted(() => { load(); loadChart() })
</script>

<template>
  <div>
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-header__title">{{ locale.t('mirrors.title') }}</h1>
        <p class="page-header__subtitle">{{ locale.t('mirrors.subtitle') }}</p>
      </div>
    </div>

    <!-- 摘要指标 -->
    <div class="summary-cards">
      <div class="summary-card">
        <div class="summary-card__icon" style="background:rgba(112,136,245,0.08);color:#7088F5;">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" stroke-width="1.5"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        </div>
        <div class="summary-card__info">
          <span class="summary-card__value text-mono">{{ summaryStats.total }}</span>
          <span class="summary-card__label">{{ locale.t('mirrors.total') }}</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-card__icon" style="background:rgba(90,183,132,0.08);color:#5AB784;">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div class="summary-card__info">
          <span class="summary-card__value text-mono" style="color:var(--color-green);">{{ summaryStats.calibrated }}</span>
          <span class="summary-card__label">{{ locale.t('mirrors.calibrated') }}</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-card__icon" style="background:rgba(138,150,168,0.08);color:#8A96A8;">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" stroke-width="1.5"><path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div class="summary-card__info">
          <span class="summary-card__value text-mono" style="color:var(--text-muted);">{{ summaryStats.uncalibrated }}</span>
          <span class="summary-card__label">{{ locale.t('mirrors.uncalibrated') }}</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-card__icon" style="background:rgba(47,128,237,0.08);color:#2F80ED;">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" stroke-width="1.5"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
        </div>
        <div class="summary-card__info">
          <span class="summary-card__value text-mono">{{ summaryStats.avgConf }}%</span>
          <span class="summary-card__label">{{ locale.t('mirrors.avgConfidence') }}</span>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px;">
      <HudChart :title="locale.t('mirrors.sealedTrend')" :kicker="locale.t('dashboard.last30days')" :option="chartOption" style="min-height:200px;" />
      <div class="base-panel" style="min-height:200px;">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('mirrors.protocolDist') }}</span>
          <span class="hud-label">{{ locale.t('mirrors.mbti') }}</span>
        </div>
        <div class="base-panel__body">
          <div v-for="(item, i) in mbtiDistribution" :key="i" style="display:flex;align-items:center;gap:12px;padding:6px 0;">
            <span style="width:8px;height:8px;border-radius:50%;" :style="{ background: item.color }" />
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">{{ item.label }}</span>
            <span class="text-mono" style="font-size:13px;color:var(--text-main);">{{ item.count }}</span>
          </div>
          <div v-if="mbtiDistribution.length === 0" style="font-size:12px;color:var(--text-muted);padding:16px 0;">{{ locale.t('common.noDataYet') }}</div>
        </div>
      </div>
    </div>

    <div class="base-panel">
      <div class="base-panel__header">
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="base-panel__title">{{ locale.t('mirrors.title') }}</span>
          <span class="hud-label">{{ locale.t('mirrors.subtitle') }}</span>
        </div>
      </div>
      <div class="toolbar">
        <div style="display:flex;gap:8px;align-items:center;">
          <input v-model="search" class="input-field" style="width:200px;" :placeholder="locale.t('directives.search')" @keyup.enter="load" />
          <select v-model="mbtiFilter" class="hud-select" style="width:140px;" @change="load">
            <option value="">{{ locale.t('mirrors.mbti') }}</option>
            <option value="INTJ">INTJ</option><option value="INTP">INTP</option><option value="ENTJ">ENTJ</option><option value="ENTP">ENTP</option>
            <option value="INFJ">INFJ</option><option value="INFP">INFP</option><option value="ENFJ">ENFJ</option><option value="ENFP">ENFP</option>
            <option value="ISTJ">ISTJ</option><option value="ISFJ">ISFJ</option><option value="ESTJ">ESTJ</option><option value="ESFJ">ESFJ</option>
            <option value="ISTP">ISTP</option><option value="ISFP">ISFP</option><option value="ESTP">ESTP</option><option value="ESFP">ESFP</option>
          </select>
          <CommandButton variant="secondary" @click="load">{{ locale.t('common.search') }}</CommandButton>
          <CommandButton variant="ghost" style="height:32px;font-size:11px;" @click="load" :title="locale.t('common.refresh')">↻</CommandButton>
          <CommandButton variant="ghost" style="height:32px;font-size:11px;" @click="exportToCSV('mirrors', columns, mirrors)">CSV</CommandButton>
        </div>
      </div>
      <div class="base-panel__body" style="padding-top:0;">
        <DataTable :columns="columns" :data="mirrors" :loading="loading">
          <template #mbtiType="{ row }">
            <span class="text-mono" :style="{ color: row.mbtiType && row.mbtiType !== '-' ? 'var(--color-purple)' : 'var(--text-disabled)' }">{{ row.mbtiType || locale.t('mirrors.uncalibrated') }}</span>
          </template>
          <template #personaConfidence="{ row }">
            <span class="text-mono" :style="{ color: (row.personaConfidence || 0) >= 70 ? 'var(--color-green)' : (row.personaConfidence || 0) > 0 ? 'var(--color-orange)' : 'var(--text-disabled)' }">{{ row.personaConfidence || 0 }}%</span>
          </template>
          <template #updatedAt="{ value }">
            <span style="font-size:12px;color:var(--text-muted);">{{ value ? value.substring(0, 16) : '-' }}</span>
          </template>
          <template #actions="{ row }">
            <div style="display:flex;gap:6px;">
              <CommandButton variant="ghost" style="height:26px;font-size:11px;padding:0 10px;" @click="router.push(`/mirrors/${row.userId}`)">{{ locale.t('common.viewMirror') }}</CommandButton>
              <CommandButton variant="ghost" style="height:26px;font-size:11px;padding:0 10px;" @click="router.push(`/users/${row.userId}`)">{{ locale.t('common.viewUser') }}</CommandButton>
            </div>
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
