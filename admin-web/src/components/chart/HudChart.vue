<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { graphic } from 'echarts/core'

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])
import { chartTheme } from '@/utils/chart-theme'

const props = defineProps<{
  title: string
  kicker?: string
  option?: echarts.EChartsCoreOption
}>()

const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

const defaultOption: echarts.EChartsCoreOption = {
  ...chartTheme,
  xAxis: {
    type: 'category',
    data: Array.from({ length: 30 }, (_, i) => `${i + 1}日`),
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
    data: [120, 200, 150, 80, 70, 110, 130, 180, 220, 190, 160, 140, 200, 250, 230, 180, 160, 190, 210, 240, 200, 170, 150, 180, 220, 260, 230, 200, 180, 210],
    smooth: true,
    symbol: 'none',
    lineStyle: { color: '#0A84FF', width: 2 },
    areaStyle: {
      color: new graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(10,132,255,0.25)' },
        { offset: 1, color: 'rgba(10,132,255,0.02)' },
      ]),
    },
  }],
  tooltip: {
    ...chartTheme.tooltip,
    trigger: 'axis',
  },
  grid: {
    left: 40,
    right: 16,
    top: 16,
    bottom: 24,
  },
}

function initChart() {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value)
  chart.setOption(props.option || defaultOption)
}

function handleResize() {
  chart?.resize()
}

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  chart?.dispose()
  window.removeEventListener('resize', handleResize)
})

watch(() => props.option, (opt) => {
  if (opt && chart) chart.setOption(opt, true)
}, { deep: true })
</script>

<template>
  <div class="base-panel hud-chart">
    <div class="base-panel__header">
      <span class="base-panel__title">{{ title }}</span>
      <span v-if="kicker" style="font-size:11px;color:var(--text-muted);">{{ kicker }}</span>
    </div>
    <div class="base-panel__body" style="padding:8px;">
      <div ref="chartRef" style="width:100%;height:220px;" />
    </div>
  </div>
</template>
