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
const mirrors = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const chartOption = ref<any>(null)

const columns = [
  { key: 'id', label: 'ID', width: '120px' },
  { key: 'userId', label: '用户 ID', width: '140px' },
  { key: 'mbtiType', label: '协议类型', width: '100px' },
  { key: 'personaConfidence', label: '一致率', width: '90px' },
  { key: 'sampleCount', label: '样本数', width: '80px' },
  { key: 'updatedAt', label: '最近更新', width: '140px' },
  { key: 'actions', label: '操作', width: '80px' },
]

async function load() {
  loading.value = true
  try {
    const data: any = await api.get('/admin/mirrors', { params: { page: page.value, size: 20, keyword: search.value } })
    mirrors.value = data.records || []
    total.value = data.total || 0
  } finally { loading.value = false }
}

async function loadChart() {
  try {
    const data: any = await api.get('/admin/dashboard/trace-stats')
    chartOption.value = {
      xAxis: {
        type: 'category',
        data: data.dates || [],
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
        type: 'line',
        data: data.sealedCounts || [],
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#5E5CE6', width: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(94,92,230,0.25)' },
              { offset: 1, color: 'rgba(94,92,230,0.02)' },
            ],
          },
        },
      }],
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(4,8,16,0.95)', borderColor: 'rgba(0,200,255,0.22)', textStyle: { color: '#fff', fontSize: 12 } },
      grid: { left: 40, right: 16, top: 16, bottom: 24 },
    }
  } catch {}
}

const mbtiDistribution = computed(() => {
  const types: Record<string, number> = {}
  mirrors.value.forEach(m => {
    const t = m.mbtiType || '未知'
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
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px;">
      <HudChart title="封存航程趋势" kicker="近 30 天" :option="chartOption" style="min-height:200px;" />
      <div class="base-panel" style="min-height:200px;">
        <div class="base-panel__header">
          <span class="base-panel__title">协议分布</span>
          <span class="hud-label">MBTI</span>
        </div>
        <div class="base-panel__body">
          <div v-for="(item, i) in mbtiDistribution" :key="i" style="display:flex;align-items:center;gap:12px;padding:6px 0;">
            <span style="width:8px;height:8px;border-radius:50;" :style="{ background: item.color }" />
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">{{ item.label }}</span>
            <span class="text-mono" style="font-size:13px;color:var(--text-main);">{{ item.count }}</span>
          </div>
          <div v-if="mbtiDistribution.length === 0" style="font-size:12px;color:var(--text-muted);padding:16px 0;">暂无数据</div>
        </div>
      </div>
    </div>

    <div class="base-panel">
      <div class="base-panel__header">
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="base-panel__title">镜像档案</span>
          <span class="hud-label">MIRROR ARCHIVES</span>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.03);">
        <input v-model="search" class="input-field" style="width:260px;" placeholder="搜索用户 ID" @keyup.enter="load" />
        <CommandButton variant="secondary" @click="load">搜索</CommandButton>
      </div>
      <div class="base-panel__body" style="padding-top:0;">
        <DataTable :columns="columns" :data="mirrors" :loading="loading">
          <template #mbtiType="{ row }">
            <span class="text-mono" style="color:var(--color-purple);">{{ row.mbtiType || '-' }}</span>
          </template>
          <template #personaConfidence="{ row }">
            <span class="text-mono" :style="{ color: (row.personaConfidence || 0) >= 70 ? 'var(--color-green)' : 'var(--color-orange)' }">{{ row.personaConfidence || 0 }}%</span>
          </template>
          <template #updatedAt="{ value }">
            <span style="font-size:12px;color:var(--text-muted);">{{ value ? value.substring(0, 16) : '-' }}</span>
          </template>
          <template #actions="{ row }">
            <CommandButton variant="ghost" style="height:26px;font-size:11px;padding:0 10px;" @click="router.push(`/mirrors/${row.userId}`)">详情</CommandButton>
          </template>
        </DataTable>
        <DataPagination v-model:page="page" :total="total" :page-size="20" @update:page="load" />
      </div>
    </div>
  </div>
</template>
