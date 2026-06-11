import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportToCSV } from '@/utils/export-csv'

describe('exportToCSV', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('生成 CSV 并触发下载', () => {
    const columns = [{ key: 'id', label: 'ID' }, { key: 'name', label: '姓名' }]
    const data = [{ id: 1, name: '张三' }]
    exportToCSV('test', columns, data)
    expect(clickSpy).toHaveBeenCalled()
  })

  it('空数据处理', () => {
    const columns = [{ key: 'id', label: 'ID' }]
    exportToCSV('empty', columns, [])
    expect(clickSpy).toHaveBeenCalled()
  })

  it('特殊字符处理', () => {
    const columns = [{ key: 'val', label: '值' }]
    const data = [{ val: 'a,b' }, { val: '带"引号"' }]
    // 不应抛出异常
    expect(() => exportToCSV('special', columns, data)).not.toThrow()
    expect(clickSpy).toHaveBeenCalled()
  })
})
