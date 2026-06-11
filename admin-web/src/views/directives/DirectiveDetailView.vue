<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useLocaleStore } from '@/stores/locale'
import EmptyState from '@/components/feedback/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const api = useApi()
const locale = useLocaleStore()
const log = ref<any>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    log.value = await api.get(`/admin/directives/logs/${route.params.id}`)
  } catch {
    error.value = locale.isZh ? '指令日志不存在或已被清理' : 'Directive log not found'
  } finally { loading.value = false }
})
</script>

<template>
  <div v-if="loading" style="color:var(--text-muted);padding:48px;text-align:center;">{{ locale.t('common.loading') }}</div>
  <div v-else-if="error" style="text-align:center;padding:64px;">
    <EmptyState :title="error" icon="data" />
  </div>
  <div v-else-if="log">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
      <button class="cmd-btn" style="font-size:12px;" @click="router.push('/directives/logs')">← {{ locale.isZh ? '返回列表' : 'Back' }}</button>
    </div>
    <div class="base-panel" style="margin-bottom:16px;">
      <div class="base-panel__header"><span class="base-panel__title">{{ locale.isZh ? '生成请求摘要' : 'Generation Summary' }}</span></div>
      <div class="base-panel__body" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
        <div><div style="font-size:11px;color:var(--text-muted);">{{ locale.isZh ? '用户' : 'User' }}</div><div>{{ log.nickname }}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);">{{ locale.isZh ? '样本数' : 'Samples' }}</div><div class="text-mono">{{ log.sampleCount }}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);">{{ locale.isZh ? '生成耗时' : 'Duration' }}</div><div class="text-mono">{{ log.duration }}ms</div></div>
      </div>
    </div>
    <div class="base-panel" style="margin-bottom:16px;">
      <div class="base-panel__header"><span class="base-panel__title">{{ locale.isZh ? '主引擎输出' : 'Main Engine Output' }}</span></div>
      <div class="base-panel__body" style="font-size:12px;color:var(--text-secondary);white-space:pre-wrap;line-height:1.8;">{{ log.rawOutput || (locale.isZh ? '无输出' : 'No output') }}</div>
    </div>
    <div class="base-panel">
      <div class="base-panel__header"><span class="base-panel__title">{{ locale.isZh ? '最终展示内容' : 'Final Content' }}</span></div>
      <div class="base-panel__body" style="font-size:12px;color:var(--text-secondary);white-space:pre-wrap;line-height:1.8;">{{ log.finalContent || (locale.isZh ? '无内容' : 'No content') }}</div>
    </div>
  </div>
</template>
