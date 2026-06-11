<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useLocaleStore } from '@/stores/locale'
import { useThemeStore } from '@/stores/theme'
import { getChartColors } from '@/utils/chart-theme'
import HudChart from '@/components/chart/HudChart.vue'
import DataTable from '@/components/data/DataTable.vue'
import StatCard from '@/components/data/StatCard.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'

const api = useApi()
const router = useRouter()
const locale = useLocaleStore()
const themeStore = useThemeStore()

const loading = ref(true)
const stats = ref<any>(null)
const timeRange = ref<'7d' | '30d' | 'all'>('30d')
const lastSync = ref('')

const timeRangeOptions = computed(() => [
  { value: '7d' as const, label: locale.t('traces.range7d') },
  { value: '30d' as const, label: locale.t('traces.range30d') },
  { value: 'all' as const, label: locale.t('traces.rangeAll') },
])

const sealedOption = computed(() => {
  if (!stats.value) return undefined
  const colors = getChartColors(themeStore.theme)
  const data = stats.value.sealedCounts || []
  const dates = stats.value.dates || []
  if (data.length === 0) return undefined
  return {
    backgroundColor: 'transparent',
    textStyle: { color: colors.textStyle.color, fontFamily: colors.textStyle.fontFamily, fontSize: 11 },
    xAxis: {
      type: 'category',
      data: dates,
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
      data,
      itemStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: colors.seriesColors[0] },
            { offset: 1, color: colors.seriesColors[0] + '4D' },
          ],
        },
        borderRadius: [2, 2, 0, 0],
      },
      barWidth: data.length <= 7 ? '40%' : '60%',
      ...(data.length <= 3 ? { label: { show: true, position: 'top', color: colors.textStyle.color, fontSize: 10 } } : {}),
    }],
    tooltip: { trigger: 'axis', ...colors.tooltip },
    grid: { left: 40, right: 16, top: 24, bottom: 24 },
  }
})

const rankOption = computed(() => {
  if (!stats.value) return undefined
  const colors = getChartColors(themeStore.theme)
  const topUsers = stats.value.topUsers || []
  if (topUsers.length === 0) return undefined
  const hasAnyPulse = topUsers.some((u: any) => u.totalScore > 0)
  if (!hasAnyPulse) return undefined
  return {
    backgroundColor: 'transparent',
    textStyle: { color: colors.textStyle.color, fontFamily: colors.textStyle.fontFamily, fontSize: 11 },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: colors.splitLine.lineStyle.color } },
      axisLabel: { color: colors.axisLabel.color, fontSize: 10 },
    },
    yAxis: {
      type: 'category',
      data: topUsers.map((u: any) => u.nickname).reverse(),
      axisLine: { lineStyle: { color: colors.axisLine.lineStyle.color } },
      axisLabel: { color: colors.axisLabel.color, fontSize: 11 },
    },
    series: [{
      type: 'bar',
      data: topUsers.map((u: any) => u.totalScore).reverse(),
      itemStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
          colorStops: [
            { offset: 0, color: colors.seriesColors[1] + '4D' },
            { offset: 1, color: colors.seriesColors[1] },
          ],
        },
        borderRadius: [0, 2, 2, 0],
      },
      barWidth: '50%',
    }],
    tooltip: { trigger: 'axis', ...colors.tooltip },
    grid: { left: 80, right: 16, top: 16, bottom: 24 },
  }
})

const summaryStats = computed(() => {
  if (!stats.value) return { sealed: 0, activeUsers: 0, activeFormations: 0, totalPulse: 0 }
  return {
    sealed: stats.value.totalSealed ?? 0,
    activeUsers: stats.value.activeUserCount ?? (stats.value.topUsers?.length ?? 0),
    activeFormations: stats.value.activeFormationCount ?? (stats.value.topFormations?.length ?? 0),
    totalPulse: stats.value.totalPulse ?? (stats.value.topUsers || []).reduce((s: number, u: any) => s + (u.totalScore || 0), 0),
  }
})

const statTrends = computed(() => {
  const s = summaryStats.value
  const rangeDays = timeRange.value === '7d' ? '7' : timeRange.value === '30d' ? '30' : ''
  return {
    sealed: s.sealed > 0 ? locale.t('traces.sealedStatus') : locale.t('traces.waitingSealed'),
    activeUsers: s.activeUsers > 0 ? locale.t('traces.activeStatus') : locale.t('traces.noActiveVessels'),
    activeFormations: s.activeFormations > 0 ? (locale.isZh ? `近 ${rangeDays} 天` : `Last ${rangeDays} Days`) : locale.t('traces.noActiveFormations'),
    totalPulse: s.totalPulse > 0 ? locale.t('traces.cumulativeStatus') : locale.t('traces.noCumulative'),
  }
})

const hasLowData = computed(() => {
  const dates = stats.value?.dates || []
  return dates.length > 0 && dates.length <= 3
})

const allPulseZero = computed(() => {
  const users = stats.value?.topUsers || []
  return users.length > 0 && users.every((u: any) => !u.totalScore)
})

const userColumns = computed(() => [
  { key: 'rank', label: '#', width: '48px' },
  { key: 'nickname', label: locale.t('users.callsign') },
  { key: 'sealedCount', label: locale.t('traces.sealedCount'), width: '100px' },
  { key: 'totalScore', label: locale.t('traces.totalPulseLabel'), width: '100px' },
  { key: 'actions', label: locale.t('common.actions'), width: '160px' },
])

function setTimeRange(range: '7d' | '30d' | 'all') {
  timeRange.value = range
  loadData()
}

async function loadData() {
  loading.value = true
  try {
    const data: any = await api.get(`/admin/dashboard/trace-stats?range=${timeRange.value}`)
    stats.value = data
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    lastSync.value = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

watch(() => locale.locale, () => {})
</script>

<template>
  <div class="trace-center">
    <!-- 页面头部 -->
    <div class="trace-header">
      <div class="trace-header__left">
        <h1 class="trace-header__title">{{ locale.t('traces.title') }}</h1>
        <p class="trace-header__subtitle">{{ locale.t('traces.subtitle') }}</p>
      </div>
      <div class="trace-header__right">
        <span v-if="lastSync" class="trace-header__sync text-mono">{{ locale.t('dashboard.lastSync') }} {{ lastSync }}</span>
        <div class="trace-header__range">
          <button
            v-for="r in timeRangeOptions"
            :key="r.value"
            class="cmd-btn cmd-btn--ghost"
            :class="{ 'range-active': timeRange === r.value }"
            style="height:28px;padding:0 10px;font-size:11px;"
            @click="setTimeRange(r.value)"
          >{{ r.label }}</button>
        </div>
        <button class="cmd-btn cmd-btn--secondary" style="height:28px;padding:0 10px;font-size:11px;" @click="loadData">
          {{ locale.t('common.refresh') }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="trace-loading">
      <div class="trace-loading__text">{{ locale.t('traces.loadingData') }}</div>
    </div>

    <template v-else>
      <!-- 摘要指标 -->
      <div class="grid-4 trace-summary">
        <StatCard :label="locale.t('traces.sealedRoutes')" :value="summaryStats.sealed" :kicker="locale.t('traces.sealedRoutesKicker')" :trend="statTrends.sealed" />
        <StatCard :label="locale.t('traces.activeVessels')" :value="summaryStats.activeUsers" :kicker="locale.t('traces.activeVesselsKicker')" :trend="statTrends.activeUsers" />
        <StatCard :label="locale.t('traces.activeFormations')" :value="summaryStats.activeFormations" :kicker="locale.t('traces.activeFormationsKicker')" :trend="statTrends.activeFormations" />
        <StatCard :label="locale.t('traces.totalPulse')" :value="summaryStats.totalPulse" :kicker="locale.t('traces.totalPulseKicker')" :trend="statTrends.totalPulse" />
      </div>

      <!-- 图表区域 -->
      <div class="trace-charts-grid">
        <!-- 封存航程趋势 -->
        <div v-if="sealedOption" class="base-panel trace-chart-panel">
          <div class="base-panel__header">
            <span class="base-panel__title">{{ locale.t('traces.sealedTrend') }}</span>
            <span class="trace-chart__kicker">{{ timeRange === '7d' ? locale.t('traces.range7d') : timeRange === '30d' ? locale.t('traces.range30d') : locale.t('traces.rangeAll') }}</span>
          </div>
          <div class="base-panel__body" style="padding:8px;">
            <HudChart title="" :option="sealedOption" style="min-height:260px;" />
          </div>
          <div v-if="hasLowData" class="trace-hint">
            {{ locale.t('traces.lowDataHint') }}
          </div>
        </div>
        <div v-else class="base-panel trace-chart-panel" style="min-height:300px;">
          <div class="base-panel__header">
            <span class="base-panel__title">{{ locale.t('traces.sealedTrend') }}</span>
          </div>
          <EmptyState :title="locale.t('traces.noSealedData')" :description="locale.t('traces.noSealedDesc')" icon="data" />
        </div>

        <!-- 活跃排行 -->
        <div class="base-panel trace-chart-panel">
          <div class="base-panel__header">
            <span class="base-panel__title">{{ locale.t('traces.activeRank') }}</span>
            <span class="trace-chart__kicker">{{ locale.isZh ? '前十' : 'Top 10' }}</span>
          </div>
          <template v-if="rankOption">
            <div class="base-panel__body" style="padding:8px;">
              <HudChart title="" :option="rankOption" style="min-height:260px;" />
            </div>
          </template>
          <template v-else-if="allPulseZero">
            <div class="base-panel__body" style="padding:12px 16px;">
              <div class="trace-zero-hint">{{ locale.t('traces.pulseZeroHint') }}</div>
              <div
                v-for="(u, i) in (stats?.topUsers || []).slice(0, 5)"
                :key="u.userId || i"
                class="trace-user-row"
              >
                <span class="trace-user-rank text-mono">{{ i + 1 }}</span>
                <span class="trace-user-name">{{ u.nickname }}</span>
                <span style="flex:1;" />
                <span class="trace-user-meta">{{ locale.t('traces.sealedCount') }} {{ u.sealedCount || 0 }}</span>
                <span class="trace-user-meta">{{ locale.t('traces.totalPulseLabel') }} {{ u.totalScore || 0 }}</span>
              </div>
            </div>
          </template>
          <EmptyState v-else :title="locale.t('traces.noRankData')" :description="locale.t('traces.noRankDesc')" icon="user" />
        </div>

        <!-- 高活跃编队 -->
        <div class="base-panel trace-chart-panel">
          <div class="base-panel__header">
            <span class="base-panel__title">{{ locale.t('traces.topFormations') }}</span>
            <span class="trace-chart__kicker">{{ locale.isZh ? '前十' : 'Top 10' }}</span>
          </div>
          <div v-if="(stats?.topFormations || []).length > 0" class="base-panel__body" style="padding:8px 12px;">
            <div
              v-for="(f, i) in (stats?.topFormations || [])"
              :key="f.roomId"
              class="trace-formation-row"
              @click="router.push(`/formations/${f.roomId}`)"
            >
              <span class="trace-formation-rank text-mono">{{ i + 1 }}</span>
              <span class="trace-formation-code text-mono">{{ f.roomNo }}</span>
              <span style="flex:1;" />
              <span class="trace-formation-meta">{{ f.memberCount }}{{ locale.isZh ? '人' : '' }}</span>
              <span class="trace-formation-meta">{{ f.scoreMode === 1 ? locale.t('formations.pulseFlow') : locale.t('formations.segmentWrite') }}</span>
            </div>
          </div>
          <EmptyState v-else :title="locale.t('traces.noFormations')" :description="locale.t('traces.noFormationsDesc')" icon="data" />
        </div>
      </div>

      <!-- 表格区域 -->
      <div class="base-panel trace-table">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('traces.topUsers') }}</span>
          <span class="trace-chart__kicker">{{ locale.t('traces.bySealedAndPulse') }}</span>
        </div>
        <div class="base-panel__body">
          <DataTable
            :columns="userColumns"
            :data="(stats?.topUsers || []).map((u: any, i: number) => ({ ...u, rank: i + 1 }))"
          >
            <template #rank="{ value }">
              <span class="text-mono" style="color:var(--text-muted);font-size:11px;">{{ value }}</span>
            </template>
            <template #nickname="{ row }">
              <span style="color:var(--text-main);">{{ row.nickname }}</span>
            </template>
            <template #sealedCount="{ value }">
              <span class="text-mono" style="color:var(--color-green);text-align:right;display:inline-block;min-width:40px;">{{ value }}</span>
            </template>
            <template #totalScore="{ value }">
              <span
                class="text-mono"
                :style="{ color: value > 0 ? 'var(--color-cyan)' : 'var(--text-disabled)', textAlign: 'right', display: 'inline-block', minWidth: '40px' }"
              >{{ value }}</span>
            </template>
            <template #actions="{ row }">
              <div style="display:flex;gap:6px;">
                <button class="cmd-btn cmd-btn--ghost" style="height:24px;padding:0 8px;font-size:10px;" @click="router.push(`/users/${row.userId}`)">{{ locale.t('traces.viewUser') }}</button>
                <button class="cmd-btn cmd-btn--ghost" style="height:24px;padding:0 8px;font-size:10px;" @click="router.push(`/users/${row.userId}`)">{{ locale.t('traces.viewTrace') }}</button>
              </div>
            </template>
          </DataTable>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.trace-center {
  animation: fade-in-up .35s ease both;
}

.trace-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 16px;
}
.trace-header__title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.3;
}
.trace-header__subtitle {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-top: 4px;
}
.trace-header__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.trace-header__sync {
  font-size: var(--text-xs);
  color: var(--text-disabled);
}
.trace-header__range {
  display: flex;
  gap: 2px;
}
.range-active {
  background: var(--btn-primary-bg) !important;
  border-color: var(--btn-primary-border) !important;
  color: var(--color-primary) !important;
}

.trace-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
}
.trace-loading__text {
  font-size: var(--text-base);
  color: var(--text-muted);
}

.trace-summary {
  margin-bottom: 20px;
}

.trace-charts-grid {
  display: grid;
  grid-template-columns: 38% 34% 28%;
  gap: 16px;
  margin-bottom: 20px;
}
.trace-chart-panel {
  min-height: 300px;
}
.trace-chart__kicker {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.trace-hint {
  padding: 8px 16px 12px;
  font-size: 11px;
  color: var(--text-disabled);
  text-align: center;
}
.trace-zero-hint {
  font-size: 11px;
  color: var(--text-muted);
  padding: 8px 0 12px;
  text-align: center;
  border-bottom: 1px solid var(--table-row-border);
  margin-bottom: 8px;
}

.trace-user-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}
.trace-user-rank {
  width: 20px;
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
}
.trace-user-name {
  font-size: 12px;
  color: var(--text-main);
}
.trace-user-meta {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.trace-formation-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--table-row-border);
  cursor: pointer;
  transition: background .12s;
}
.trace-formation-row:hover {
  background: var(--table-row-hover);
}
.trace-formation-row:last-child {
  border-bottom: none;
}
.trace-formation-rank {
  width: 20px;
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
}
.trace-formation-code {
  color: var(--color-cyan);
  font-size: 12px;
}
.trace-formation-meta {
  font-size: 11px;
  color: var(--text-muted);
}

.trace-table {
  margin-bottom: 24px;
}

@media (max-width: 1440px) {
  .trace-charts-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 1024px) {
  .trace-charts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
