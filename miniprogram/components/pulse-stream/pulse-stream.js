const MAX_RENDER_ROWS = 18

function parseTime(value) {
  if (!value) return '--:--'
  if (value === '刚刚') return value
  const safe = typeof value === 'string' ? value.replace(/-/g, '/') : value
  const date = new Date(safe)
  if (Number.isNaN(date.getTime())) return String(value).slice(-5)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

Component({
  properties: {
    records: { type: Array, value: [] },
    live: { type: Boolean, value: false },
    loading: { type: Boolean, value: false },
    title: { type: String, value: '脉冲数据流' },
    showClose: { type: Boolean, value: false },
    maxRows: { type: Number, value: 12 }
  },

  data: {
    visibleRecords: [],
    hiddenCount: 0
  },

  observers: {
    'records, maxRows': function (records, maxRows) {
      const limit = Math.max(1, Math.min(Number(maxRows) || 12, MAX_RENDER_ROWS))
      const source = Array.isArray(records) ? records : []
      const visibleRecords = source.slice(0, limit).map(record => ({
        ...record,
        timeDisplay: record.timeDisplay || record.timeFormatted || parseTime(record.createdAt),
        amountDisplay: String(Math.abs(Number(record.amount || record.value || 0))),
        routeDisplay: `${record.fromName || '?'} → ${record.toName || '?'}`
      }))
      this.setData({
        visibleRecords,
        hiddenCount: Math.max(0, source.length - visibleRecords.length)
      })
    }
  },

  methods: {
    close() {
      this.triggerEvent('close')
    }
  }
})
