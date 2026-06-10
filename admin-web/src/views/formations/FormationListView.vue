<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'
import StatusPill from '@/components/status/StatusPill.vue'
import CommandButton from '@/components/button/CommandButton.vue'
import HudChart from '@/components/chart/HudChart.vue'

const router = useRouter()
const api = useApi()
const loading = ref(false)
const formations = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const chartOption = ref<any>(null)

const columns = [
  { key: 'id', label: '编队 ID', width: '140px' },
  { key: 'roomNo', label: '编队码', width: '100px' },
  { key: 'ownerId', label: '主控 ID', width: '140px' },
  { key: 'scoreMode', label: '记录协议', width: '100px' },
  { key: 'status', label: '状态', width: '80px' },
  { key: 'createdAt', label: '创建时间', width: '140px' },
  { key: 'lastActiveAt', label: '最后活动', width: '140px' },
  { key: 'actions', label: '操作', width: '100px' },
]

async function load() {
  loading.value = true
  try {
    const data: any = await api.get('/admin/formations', { params: { page: page.value, size: 20, keyword: search.value } })
    formations.value = data.records || []
    total.value = data.total || 0
  } finally { loading.value = false }
}

async function loadChart() {
  try {
    const trends: any = await api.get('/admin/dashboard/trends')
    chartOption.value = {
      xAxis: {
        type: 'category',
        data: trends.dates,
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
        data: trends.formationCreated,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#00C8FF' },
              { offset: 1, color: 'rgba(0,200,255,0.3)' },
            ],
          },
          borderRadius: [2, 2, 0, 0],
        },
        barWidth: '60%',
      }],
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(4,8,16,0.95)', borderColor: 'rgba(0,200,255,0.22)', textStyle: { color: '#fff', fontSize: 12 } },
      grid: { left: 40, right: 16, top: 16, bottom: 24 },
    }
  } catch {}
}

const modeDistribution = computed(() => {
  const free = formations.value.filter(f => f.scoreMode === 1).length
  const round = formations.value.filter(f => f.scoreMode === 2).length
  return [
    { label: '脉冲流向', count: free, color: 'var(--color-primary)' },
    { label: '航段写入', count: round, color: 'var(--color-cyan)' },
  ]
})

onMounted(() => { load(); loadChart() })
</script>

<template>
  <div>
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px;">
      <HudChart title="编队创建趋势" kicker="近 30 天" :option="chartOption" style="min-height:200px;" />
      <div class="base-panel" style="min-height:200px;">
        <div class="base-panel__header">
          <span class="base-panel__title">协议分布</span>
          <span class="hud-label">MODE</span>
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
          <span class="base-panel__title">任务编队</span>
          <span class="hud-label">FLEET REGISTRY</span>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.03);">
        <input v-model="search" class="input-field" style="width:260px;" placeholder="搜索编队码" @keyup.enter="load" />
        <CommandButton variant="secondary" @click="load">搜索</CommandButton>
      </div>
      <div class="base-panel__body" style="padding-top:0;">
        <DataTable :columns="columns" :data="formations" :loading="loading">
          <template #roomNo="{ row }">
            <span class="text-mono" style="color:var(--color-cyan);">{{ row.roomNo }}</span>
          </template>
          <template #scoreMode="{ row }">
            <span style="font-size:12px;">{{ row.scoreMode === 1 ? '脉冲流向' : '航段写入' }}</span>
          </template>
          <template #status="{ row }">
            <StatusPill :status="row.status === 0 ? 'running' : 'ok'" :label="row.status === 0 ? '运行中' : '已封存'" />
          </template>
          <template #createdAt="{ value }">
            <span style="font-size:12px;color:var(--text-muted);">{{ value ? value.substring(0, 16) : '-' }}</span>
          </template>
          <template #lastActiveAt="{ value }">
            <span style="font-size:12px;color:var(--text-muted);">{{ value ? value.substring(0, 16) : '-' }}</span>
          </template>
          <template #actions="{ row }">
            <CommandButton variant="ghost" style="height:26px;font-size:11px;padding:0 10px;" @click="router.push(`/formations/${row.id}`)">详情</CommandButton>
          </template>
        </DataTable>
        <DataPagination v-model:page="page" :total="total" :page-size="20" @update:page="load" />
      </div>
    </div>
  </div>
</template>
