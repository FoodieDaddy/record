/**
 * 全局快捷键组合式函数
 * 注册一组全局快捷键，组件卸载时自动清理
 */
import { onMounted, onUnmounted } from 'vue'

export interface ShortcutBinding {
  key: string
  ctrl?: boolean
  shift?: boolean
  handler: (e: KeyboardEvent) => void
  /** 仅当没有输入框聚焦时触发 */
  excludeInput?: boolean
}

export function useGlobalShortcuts(bindings: ShortcutBinding[]) {
  function onKeyDown(e: KeyboardEvent) {
    for (const b of bindings) {
      if (e.key !== b.key) continue
      if (b.ctrl && !(e.ctrlKey || e.metaKey)) continue
      if (b.shift && !e.shiftKey) continue
      if (!b.ctrl && (e.ctrlKey || e.metaKey)) continue

      // 排除输入框
      if (b.excludeInput !== false) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') continue
      }

      e.preventDefault()
      b.handler(e)
    }
  }

  onMounted(() => document.addEventListener('keydown', onKeyDown))
  onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
}
