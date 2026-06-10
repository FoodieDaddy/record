<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useLocaleStore } from '@/stores/locale'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'
import CommandButton from '@/components/button/CommandButton.vue'
import HudChart from '@/components/chart/HudChart.vue'

const router = useRouter()
const api = useApi()
const locale = useLocaleStore()
const loading = ref(false)
const logs = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const chartOption = ref<any>(null)

const columns = computed(() => [
  { key: 'id', label: 'ID', width: '140px' },
  { key: 'userId', label: 'User ID', width: '140px' },
  { key: 'source', label: locale.t('directives.source'), width: '100px' },
  { key: 'success', label: locale.t('common.status'), width: '80px' },
  { key: 'createdAt', label: locale.t('formations.createdAt'), width: '160px' },
  { key: 'actions', label: locale.t('common.actions'), width: '80px' },
])

async function load() {
  loading.value = true
  try {
    const data: any = await api.get('/admin/directives/logs', { params: { page: page.value, size: 20, keyword: search.value } })
    logs.value = data.records || []
    total.value = data.total || 0
  } finally { loading.value = false }
}

async function loadChart() {
  try {
    const stats: any = await api.get('/admin/dashboard/pulse-stats')
    chartOption.value = {
      xAxis: {
        type: 'category',
        data: ['总流向', '总脉冲值', '航段数', '封存编队'],
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisLabel: { color: 'rgba(255,255,255,0.38)', fontSize: 10 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
        axisLabel: { color: 'rgba(255,255,255,0.38)', fontSize: 10 },
      },
      series: [{
        type: 'bar',
        data: [stats.totalTransfers || 0, stats.totalPulseValue || 0, stats.totalRounds || 0, stats.sealedRooms || 0],
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#5E5CE6' },
              { offset: 1, color: 'rgba(94,92,230,0.3)' },
            ],
          },
          borderRadius: [2, 2, 0, 0],
        },
        barWidth: '50%',
      }],
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(4,8,16,0.95)', borderColor: 'rgba(0,200,255,0.22)', textStyle: { color: '#fff', fontSize: 12 } },
      grid: { left: 50, right: 16, top: 16, bottom: 24 },
    }
  } catch {}
}

const sourceDistribution = computed(() => {
  const success = logs.value.filter(l => l.success === 1).length
  const failed = logs.value.filter(l => l.success !== 1).length
  return [
    { label: locale.t('directives.success'), count: success, color: 'var(--color-green)' },
    { label: locale.t('directives.failed'), count: failed, color: 'var(--color-red)' },
  ]
})

onMounted(() => { load(); loadChart() })
</script>

<template>
  <div>
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px;">
      <HudChart title="脉冲数据概览" kicker="总量统计" :option="chartOption" style="min-height:200px;" />
      <div class="base-panel" style="min-height:200px;">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('directives.source') }}</span>
          <span class="hud-label">STATUS</span>
        </div>
        <div class="base-panel__body">
          <div v-for="(item, i) in sourceDistribution" :key="i" style="display:flex;align-items:center;gap:12px;padding:8px 0;">
            <span style="width:8px;height:8px;border-radius:50;" :style="{ background: item.color }" />
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">{{ item.label }}</span>
            <span class="text-mono" style="font-size:13px;color:var(--text-main);">{{ item.count }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="base-panel">
      <div class="base-panel__header">
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="base-panel__title">{{ locale.t('directives.title') }}</span>
          <span class="hud-label">DIRECTIVE LOGS</span>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.03);">
        <input v-model="search" class="input-field" style="width:260px;" :placeholder="locale.t('directives.search')" @keyup.enter="load" />
        <CommandButton variant="secondary" @click="load">{{ locale.t('common.search') }}</CommandButton>
      </div>
      <div class="base-panel__body" style="padding-top:0;">
        <DataTable :columns="columns" :data="logs" :loading="loading">
          <template #source="{ row }">
            <span :style="{ color: row.source === '主引擎' ? 'var(--color-primary)' : 'var(--text-muted)' }">{{ row.source || locale.t('directives.mainEngine') }}</span>
          </template>
          <template #success="{ row }">
            <span :style="{ color: row.success === 1 ? 'var(--color-green)' : 'var(--color-red)' }">{{ row.success === 1 ? locale.t('directives.success') : locale.t('directives.failed') }}</span>
          </template>
          <template #createdAt="{ value }">
            <span style="font-size:12px;color:var(--text-muted);">{{ value ? value.substring(0, 16) : '-' }}</span>
          </template>
          <template #actions="{ row }">
            <CommandButton variant="ghost" style="height:26px;font-size:11px;padding:0 10px;" @click="router.push(`/directives/logs/${row.id}`)">{{ locale.t('common.detail') }}</CommandButton>
          </template>
        </DataTable>
        <DataPagination v-model:page="page" :total="total" :page-size="20" @update:page="load" />
      </div>
    </div>
  </div>
</template>
