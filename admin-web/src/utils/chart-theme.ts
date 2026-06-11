import type { Theme } from '@/stores/theme'

export function getChartColors(theme: Theme) {
  if (theme === 'dark') {
    return {
      backgroundColor: 'transparent',
      textStyle: {
        color: 'rgba(220, 232, 248, 0.60)',
        fontFamily: 'JetBrains Mono, SF Mono, monospace',
        fontSize: 11,
      },
      axisLine: { lineStyle: { color: 'rgba(80, 110, 150, 0.08)' } },
      axisLabel: { color: 'rgba(182, 198, 214, 0.42)' },
      splitLine: { lineStyle: { color: 'rgba(80, 110, 150, 0.05)' } },
      tooltip: {
        backgroundColor: 'rgba(15, 19, 24, 0.96)',
        borderColor: 'rgba(107, 184, 224, 0.14)',
        borderWidth: 1,
        textStyle: { color: 'rgba(232, 240, 248, 0.92)', fontSize: 12 },
      },
      seriesColors: ['#4DA3FF', '#6BB8E0', '#8B8AF0', '#6CC494', '#F0B860'],
    }
  }
  return {
    backgroundColor: 'transparent',
    textStyle: {
      color: '#1B2430',
      fontFamily: 'JetBrains Mono, SF Mono, monospace',
      fontSize: 11,
    },
    axisLine: { lineStyle: { color: 'rgba(120, 140, 170, 0.12)' } },
    axisLabel: { color: 'rgba(27, 36, 48, 0.48)' },
    splitLine: { lineStyle: { color: 'rgba(120, 140, 170, 0.06)' } },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: 'rgba(120, 140, 170, 0.12)',
      borderWidth: 1,
      textStyle: { color: '#1B2430', fontSize: 12 },
      extraCssText: 'box-shadow: 0 8px 24px rgba(31, 52, 88, 0.10); border-radius: 12px;',
    },
    seriesColors: ['#2F80ED', '#58A6D8', '#7088F5', '#5AB784', '#E6A24D'],
  }
}
