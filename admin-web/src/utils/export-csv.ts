/**
 * CSV 导出工具
 * 将表格数据导出为 CSV 文件触发浏览器下载
 */
export function exportToCSV(filename: string, columns: { key: string; label: string }[], data: Record<string, any>[]) {
  const header = columns.map(c => escapeCsvField(c.label)).join(',')
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.key]
      return escapeCsvField(val != null ? String(val) : '')
    }).join(',')
  )
  const bom = '\uFEFF' // UTF-8 BOM 解决 Excel 中文乱码
  const csv = bom + [header, ...rows].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}
