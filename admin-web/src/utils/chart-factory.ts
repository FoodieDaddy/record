import { graphic } from 'echarts/core'

/**
 * 构建系统异常趋势 (Line Chart) 的 ECharts 配置项
 */
export function createErrorTrendOption(
  trend: { dates: string[]; jsErrors: number[]; networkErrors: number[] },
  colors: any,
  isZh: boolean
) {
  const dates = trend?.dates || []
  const jsErrors = trend?.jsErrors || []
  const networkErrors = trend?.networkErrors || []

  return {
    backgroundColor: 'transparent',
    textStyle: colors.textStyle,
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: colors.axisLine,
      axisLabel: { ...colors.axisLabel, fontSize: 10 },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      splitLine: colors.splitLine,
      axisLabel: { ...colors.axisLabel, fontSize: 10 }
    },
    legend: {
      data: [isZh ? 'JS 错误' : 'JS Error', isZh ? '网络错误' : 'Network Error'],
      textStyle: { color: colors.textStyle.color, fontSize: 10 },
      top: 5
    },
    series: [
      {
        name: isZh ? 'JS 错误' : 'JS Error',
        type: 'line',
        data: jsErrors,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: colors.seriesColors[4] || '#FF5A5A' },
        itemStyle: { color: colors.seriesColors[4] || '#FF5A5A' },
        areaStyle: {
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: (colors.seriesColors[4] || '#FF5A5A') + '20' },
            { offset: 1, color: (colors.seriesColors[4] || '#FF5A5A') + '02' }
          ])
        }
      },
      {
        name: isZh ? '网络错误' : 'Network Error',
        type: 'line',
        data: networkErrors,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: colors.seriesColors[3] || '#E6A24D' },
        itemStyle: { color: colors.seriesColors[3] || '#E6A24D' },
        areaStyle: {
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: (colors.seriesColors[3] || '#E6A24D') + '20' },
            { offset: 1, color: (colors.seriesColors[3] || '#E6A24D') + '02' }
          ])
        }
      }
    ],
    tooltip: {
      ...colors.tooltip,
      trigger: 'axis'
    },
    grid: {
      left: 36,
      right: 16,
      top: 40,
      bottom: 24
    }
  }
}

/**
 * 构建接口慢响应排行 (Horizontal Bar Chart) 的 ECharts 配置项
 */
export function createSlowRequestsOption(
  slowRequests: Array<{ method: string; url: string; avgDuration: number; count: number }>,
  colors: any,
  isZh: boolean
) {
  const list = [...(slowRequests || [])].reverse()
  const paths = list.map(item => `${item.method} ${item.url}`)
  const durations = list.map(item => item.avgDuration)

  return {
    backgroundColor: 'transparent',
    textStyle: colors.textStyle,
    yAxis: {
      type: 'category',
      data: paths,
      axisLabel: {
        fontSize: 9,
        color: colors.axisLabel.color,
        formatter: (value: string) => {
          return value.length > 28 ? value.substring(0, 28) + '...' : value
        }
      },
      axisLine: colors.axisLine,
      axisTick: { show: false }
    },
    xAxis: {
      type: 'value',
      axisLabel: { fontSize: 10, color: colors.axisLabel.color },
      splitLine: colors.splitLine
    },
    series: [
      {
        type: 'bar',
        data: durations,
        itemStyle: {
          color: colors.seriesColors[0] || '#4DA3FF',
          borderRadius: [0, 4, 4, 0]
        },
        label: {
          show: true,
          position: 'right',
          formatter: '{c}ms',
          fontSize: 9,
          color: colors.textStyle.color
        }
      }
    ],
    tooltip: {
      ...colors.tooltip,
      trigger: 'axis',
      formatter: (params: any) => {
        const idx = params[0].dataIndex
        const item = list[idx]
        return `<strong>${item.method} ${item.url}</strong><br/>` +
               `${isZh ? '平均响应' : 'Avg Duration'}: <span style="color:${colors.seriesColors[0] || '#4DA3FF'}">${item.avgDuration}ms</span><br/>` +
               `${isZh ? '触发次数' : 'Frequency'}: ${item.count} ${isZh ? '次' : 'times'}`
      }
    },
    grid: {
      left: 110,
      right: 46,
      top: 16,
      bottom: 24
    }
  }
}
