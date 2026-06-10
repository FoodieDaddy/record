<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '@/composables/useApi'

const route = useRoute()
const api = useApi()
const log = ref<any>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    log.value = await api.get(`/admin/directives/logs/${route.params.id}`)
  } finally { loading.value = false }
})
</script>

<template>
  <div v-if="loading" style="color:var(--text-muted);padding:48px;text-align:center;">加载中...</div>
  <div v-else-if="log">
    <div class="base-panel" style="margin-bottom:16px;">
      <div class="base-panel__header"><span class="base-panel__title">生成请求摘要</span></div>
      <div class="base-panel__body" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
        <div><div style="font-size:11px;color:var(--text-muted);">用户</div><div>{{ log.nickname }}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);">样本数</div><div class="text-mono">{{ log.sampleCount }}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);">生成耗时</div><div class="text-mono">{{ log.duration }}ms</div></div>
      </div>
    </div>
    <div class="base-panel" style="margin-bottom:16px;">
      <div class="base-panel__header"><span class="base-panel__title">主引擎输出</span></div>
      <div class="base-panel__body" style="font-size:12px;color:var(--text-secondary);white-space:pre-wrap;line-height:1.8;">{{ log.rawOutput || '无输出' }}</div>
    </div>
    <div class="base-panel">
      <div class="base-panel__header"><span class="base-panel__title">最终展示内容</span></div>
      <div class="base-panel__body" style="font-size:12px;color:var(--text-secondary);white-space:pre-wrap;line-height:1.8;">{{ log.finalContent || '无内容' }}</div>
    </div>
  </div>
</template>
