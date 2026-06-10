<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import HudChart from '@/components/chart/HudChart.vue'
import DataTable from '@/components/data/DataTable.vue'

const api = useApi()
const loading = ref(true)
const stats = ref<any>(null)
const sealedOption = ref<any>(null)
const rankOption = ref<any>(null)

const userColumns = [
  { key: 'rank', label: '#', width: '40px' },
  { key: 'nickname', label: '本舰呼号' },
  { key: 'sealedCount', label: '封存航程', width: '90px' },
  { key: 'totalScore', label: '总脉冲', width: '90px' },
]

const formationColumns = [
  { key: 'rank', label: '#', width: '40px' },
  { key: 'roomNo', label: '编队码', width: '100px' },
  { key: 'memberCount', label: '成员数', width: '80px' },
  { key: 'scoreMode', label: '协议', width: '100px' },
]

onMounted(async () => {
  try {
    const data: any = await api.get('/admin/dashboard/trace-stats')
    stats.value = data

    // 封存航程趋势图
    sealedOption.value = {
      xAxis: {
        type: 'category',
        data: data.dates,
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
        data: data.sealedCounts,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#0A84FF' },
              { offset: 1, color: 'rgba(10,132,255,0.3)' },
            ],
          },
          borderRadius: [2, 2, 0, 0],
        },
        barWidth: '60%',
      }],
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(4,8,16,0.95)', borderColor: 'rgba(0,200,255,0.22)', textStyle: { color: '#fff', fontSize: 12 } },
      grid: { left: 40, right: 16, top: 16, bottom: 24 },
    }

    // 活跃排行图
    const topUsers = data.topUsers || []
    rankOption.value = {
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
        axisLabel: { color: 'rgba(255,255,255,0.38)', fontSize: 10 },
      },
      yAxis: {
        type: 'category',
        data: topUsers.map((u: any) => u.nickname).reverse(),
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        axisLabel: { color: 'rgba(255,255,255,0.56)', fontSize: 11 },
      },
      series: [{
        type: 'bar',
        data: topUsers.map((u: any) => u.totalScore).reverse(),
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(0,200,255,0.3)' },
              { offset: 1, color: '#00C8FF' },
            ],
          },
          borderRadius: [0, 2, 2, 0],
        },
        barWidth: '50%',
      }],
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(4,8,16,0.95)', borderColor: 'rgba(0,200,255,0.22)', textStyle: { color: '#fff', fontSize: 12 } },
      grid: { left: 80, right: 16, top: 16, bottom: 24 },
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-if="loading" style="text-align:center;padding:48px;color:var(--text-muted);">正在接入航迹数据...</div>
  <div v-else>
    <div class="grid-3" style="margin-bottom:16px;">
      <HudChart title="封存航程趋势" kicker="近 30 天" :option="sealedOption" style="min-height:300px;" />
      <HudChart title="活跃排行" kicker="总脉冲 Top 10" :option="rankOption" style="min-height:300px;" />
      <div class="base-panel" style="min-height:300px;">
        <div class="base-panel__header">
          <span class="base-panel__title">高活跃编队</span>
          <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">TOP 10</span>
        </div>
        <div class="base-panel__body" style="padding:8px 12px;">
          <div v-for="(f, i) in (stats?.topFormations || [])" :key="f.roomId" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.03);">
            <span class="text-mono" style="width:20px;text-align:center;font-size:11px;color:var(--text-muted);">{{ i + 1 }}</span>
            <span class="text-mono" style="color:var(--color-cyan);font-size:12px;">{{ f.roomNo }}</span>
            <span style="flex:1;" />
            <span style="font-size:11px;color:var(--text-muted);">{{ f.memberCount }}人</span>
            <span style="font-size:11px;color:var(--text-muted);">{{ f.scoreMode === 1 ? '脉冲流向' : '航段写入' }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="base-panel">
      <div class="base-panel__header">
        <span class="base-panel__title">高活跃航船</span>
        <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">TOP 10</span>
      </div>
      <div class="base-panel__body">
        <DataTable :columns="userColumns" :data="(stats?.topUsers || []).map((u: any, i: number) => ({ ...u, rank: i + 1 }))">
          <template #rank="{ value }">
            <span class="text-mono" style="color:var(--text-muted);font-size:11px;">{{ value }}</span>
          </template>
          <template #nickname="{ row }">
            <span style="color:var(--text-main);">{{ row.nickname }}</span>
          </template>
          <template #sealedCount="{ value }">
            <span class="text-mono" style="color:var(--color-green);">{{ value }}</span>
          </template>
          <template #totalScore="{ value }">
            <span class="text-mono" style="color:var(--color-cyan);">{{ value }}</span>
          </template>
        </DataTable>
      </div>
    </div>
  </div>
</template>
