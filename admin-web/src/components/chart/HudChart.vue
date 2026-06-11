<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { graphic } from 'echarts/core'

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])
import { getChartColors } from '@/utils/chart-theme'
import { useThemeStore } from '@/stores/theme'

const props = defineProps<{
  title?: string
  kicker?: string
  option?: echarts.EChartsCoreOption
}>()

const themeStore = useThemeStore()
const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

function buildDefaultOption() {
  const colors = getChartColors(themeStore.theme)
  return {
    ...colors,
    xAxis: {
      type: 'category',
      data: Array.from({ length: 30 }, (_, i) => `${i + 1}`),
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
      data: [120, 200, 150, 80, 70, 110, 130, 180, 220, 190, 160, 140, 200, 250, 230, 180, 160, 190, 210, 240, 200, 170, 150, 180, 220, 260, 230, 200, 180, 210],
      smooth: true,
      symbol: 'none',
      lineStyle: { color: colors.seriesColors[0], width: 2 },
      areaStyle: {
        color: new graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: colors.seriesColors[0] + '28' },
          { offset: 1, color: colors.seriesColors[0] + '04' },
        ]),
      },
    }],
    tooltip: {
      ...colors.tooltip,
      trigger: 'axis',
    },
    grid: {
      left: 40,
      right: 16,
      top: 16,
      bottom: 24,
    },
  }
}

function applyOption(opt?: echarts.EChartsCoreOption) {
  if (!chart) return
  const merged = opt || buildDefaultOption()
  chart.setOption(merged, true)
}

function initChart() {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value)
  applyOption(props.option)
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
  applyOption(opt)
}, { deep: true })

watch(() => themeStore.theme, () => {
  applyOption(props.option)
})
</script>

<template>
  <div class="hud-chart" :class="{ 'hud-chart--with-header': title }">
    <div v-if="title" class="hud-chart__header">
      <span class="hud-chart__title">{{ title }}</span>
      <span v-if="kicker" class="hud-chart__kicker">{{ kicker }}</span>
    </div>
    <div class="hud-chart__canvas-wrap">
      <div ref="chartRef" class="hud-chart__canvas" />
    </div>
  </div>
</template>

<style scoped>
.hud-chart {
  position: relative;
  background: linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.58));
  border: 1px solid rgba(255,255,255,0.38);
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  box-shadow: 0 18px 42px rgba(31,52,88,0.09), 0 4px 14px rgba(31,52,88,0.05), inset 0 1px 0 rgba(255,255,255,0.78);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  overflow: hidden;
}
.hud-chart::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.02));
  pointer-events: none;
}
.hud-chart__header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 20px;
  background: linear-gradient(180deg, rgba(255,255,255,0.46), rgba(255,255,255,0.22));
  border-bottom: 1px solid rgba(255,255,255,0.30);
}
.hud-chart__title {
  font-size: 14px;
  font-weight: 700;
  color: #2A3442;
}
.hud-chart__canvas-wrap {
  flex: 1;
  min-height: 0;
  padding: 4px;
}
.hud-chart__canvas {
  width: 100%;
  height: 100%;
}
.hud-chart__kicker {
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}
</style>
