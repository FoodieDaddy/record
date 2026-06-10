import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast {
  id: number
  type: 'success' | 'error' | 'warn' | 'info'
  message: string
  duration: number
}

let nextId = 0

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])

  function show(type: Toast['type'], message: string, duration = 3000) {
    const id = nextId++
    toasts.value.push({ id, type, message, duration })
    setTimeout(() => remove(id), duration)
  }

  function remove(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  function success(msg: string) { show('success', msg) }
  function error(msg: string) { show('error', msg, 5000) }
  function warn(msg: string) { show('warn', msg, 4000) }
  function info(msg: string) { show('info', msg) }

  return { toasts, show, remove, success, error, warn, info }
})
