/**
 * 格式化工具
 */
export function formatNumber(n: number | string | null | undefined): string {
  if (n == null) return '-'
  const num = typeof n === 'string' ? parseInt(n, 10) : n
  if (isNaN(num)) return String(n)
  return num.toLocaleString()
}

export function timeAgo(dateStr: string | null | undefined, isZh = true): string {
  if (!dateStr) return '-'
  const now = Date.now()
  const then = new Date(dateStr.replace(' ', 'T')).getTime()
  if (isNaN(then)) return dateStr.length > 10 ? dateStr.substring(0, 16) : dateStr
  const diff = Math.floor((now - then) / 1000)
  if (isZh) {
    if (diff < 60) return '刚刚'
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
    if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`
  } else {
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  }
  return dateStr.length > 10 ? dateStr.substring(0, 10) : dateStr
}
