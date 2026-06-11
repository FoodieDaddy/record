import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useDebounce } from '@/composables/useDebounce'

describe('useDebounce', () => {
  it('立即返回初始值', () => {
    const source = ref('hello')
    const debounced = useDebounce(source, 300)
    expect(debounced.value).toBe('hello')
  })

  it('在延迟后更新防抖值', async () => {
    vi.useFakeTimers()
    const source = ref('hello')
    const debounced = useDebounce(source, 300)

    source.value = 'world'
    await nextTick()
    expect(debounced.value).toBe('hello')

    vi.advanceTimersByTime(300)
    await nextTick()
    expect(debounced.value).toBe('world')

    vi.useRealTimers()
  })

  it('连续变化只触发最后一次', async () => {
    vi.useFakeTimers()
    const source = ref('a')
    const debounced = useDebounce(source, 200)

    source.value = 'b'
    await nextTick()
    vi.advanceTimersByTime(50)
    await nextTick()

    source.value = 'c'
    await nextTick()
    vi.advanceTimersByTime(50)
    await nextTick()
    // b 的定时器还没触发，但已被新的 set 重置
    expect(debounced.value).toBe('a')

    vi.advanceTimersByTime(200)
    await nextTick()
    expect(debounced.value).toBe('c')

    vi.useRealTimers()
  })
})
