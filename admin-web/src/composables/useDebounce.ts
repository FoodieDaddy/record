import { ref, watch, onUnmounted, type Ref } from 'vue'

/**
 * 输入防抖组合式函数
 * @param source 原始响应式值
 * @param delay 防抖延迟（毫秒），默认 350ms
 * @returns 防抖后的响应式值
 */
export function useDebounce<T>(source: Ref<T>, delay = 350): Ref<T> {
  const debouncedValue = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | null = null

  watch(source, (newVal) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      debouncedValue.value = newVal
    }, delay)
  })

  onUnmounted(() => {
    if (timer) clearTimeout(timer)
  })

  return debouncedValue
}
