<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '@/composables/useApi'

const route = useRoute()
const api = useApi()
const mirror = ref<any>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    mirror.value = await api.get(`/admin/mirrors/${route.params.userId}`)
  } finally { loading.value = false }
})
</script>

<template>
  <div v-if="loading" style="color:var(--text-muted);padding:48px;text-align:center;">加载中...</div>
  <div v-else-if="mirror">
    <div class="base-panel" style="margin-bottom:16px;">
      <div class="base-panel__header"><span class="base-panel__title">全息档案</span></div>
      <div class="base-panel__body" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">
        <div><div style="font-size:11px;color:var(--text-muted);">本舰呼号</div><div>{{ mirror.nickname }}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);">协议类型</div><div class="text-mono" style="color:var(--color-purple);">{{ mirror.mbtiType || '-' }}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);">协议一致率</div><div class="text-mono" style="color:var(--color-green);">{{ mirror.matchPercentage }}%</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);">航迹样本</div><div class="text-mono">{{ mirror.sampleCount }}</div></div>
      </div>
    </div>
    <div class="base-panel">
      <div class="base-panel__header"><span class="base-panel__title">全息扫描图</span></div>
      <div class="base-panel__body" style="display:flex;align-items:center;justify-content:center;min-height:300px;color:var(--text-muted);font-size:12px;">五维雷达图 — 接入 ECharts 后渲染</div>
    </div>
  </div>
</template>
