<script setup lang="ts">
/**
 * 全局错误边界 — 捕获未处理的 Vue 渲染错误并展示降级 UI
 */
import { ref, onErrorCaptured } from 'vue'
import { useLocaleStore } from '@/stores/locale'

const locale = useLocaleStore()

const error = ref<string | null>(null)
const errorInfo = ref('')

onErrorCaptured((err: any, instance, info) => {
  console.error('[ErrorBoundary]', err)
  error.value = err?.message || String(err)
  errorInfo.value = info
  return false // 阻止错误向上冒泡
})

function handleRetry() {
  error.value = null
  errorInfo.value = ''
  window.location.reload()
}
</script>

<template>
  <div v-if="error" class="error-boundary">
    <div class="error-boundary__icon">
      <svg viewBox="0 0 24 24" fill="none" width="40" height="40" stroke="var(--color-red)" stroke-width="1.5">
        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    </div>
    <h2 class="error-boundary__title">{{ locale.t('error.title') }}</h2>
    <p class="error-boundary__desc">{{ error }}</p>
    <button class="cmd-btn cmd-btn--primary" @click="handleRetry" style="margin-top:20px;">
      {{ locale.t('common.retry') }}
    </button>
  </div>
  <slot v-else />
</template>

<style scoped>
.error-boundary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
  padding: 48px;
}
.error-boundary__icon { margin-bottom: 16px; opacity: 0.6; }
.error-boundary__title {
  font-size: 20px; font-weight: 700; color: var(--color-red);
  margin: 0 0 8px;
}
.error-boundary__desc {
  font-size: 13px; color: var(--text-muted); max-width: 480px;
  line-height: 1.6; word-break: break-all;
}
</style>
