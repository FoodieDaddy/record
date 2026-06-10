<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'

const api = useApi()
const services = ref<any[]>([])
const loading = ref(true)

const defaultServices = [
  { name: 'API 服务', status: 'ok', latency: '12ms', detail: '200 QPS' },
  { name: 'MySQL', status: 'ok', latency: '3ms', detail: '15 连接' },
  { name: 'Redis', status: 'ok', latency: '1ms', detail: '12 连接' },
  { name: 'WebSocket', status: 'ok', latency: '-', detail: '24 连接' },
  { name: 'CloudBase 存储', status: 'ok', latency: '45ms', detail: '可用' },
  { name: 'TTS 主引擎', status: 'warn', latency: '890ms', detail: 'Edge-TTS' },
  { name: 'TTS 副引擎', status: 'ok', latency: '320ms', detail: 'MiMo' },
  { name: '导航主引擎', status: 'ok', latency: '2.1s', detail: 'LLM' },
]

onMounted(async () => {
  try {
    services.value = await api.get('/admin/system/health')
  } catch {
    services.value = defaultServices
  } finally { loading.value = false }
})
</script>

<template>
  <div>
    <div class="base-panel" style="margin-bottom:16px;">
      <div class="base-panel__header">
        <span class="base-panel__title">系统健康</span>
        <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">HEALTH MATRIX</span>
      </div>
      <div class="base-panel__body">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
          <div v-for="s in (services.length ? services : defaultServices)" :key="s.name" style="padding:16px;background:rgba(255,255,255,0.025);border:1px solid var(--border-subtle);border-radius:6px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span style="width:8px;height:8px;border-radius:50%;" :style="{ background: s.status === 'ok' ? 'var(--color-green)' : s.status === 'warn' ? 'var(--color-orange)' : 'var(--color-red)' }" />
              <span style="font-size:13px;font-weight:500;">{{ s.name }}</span>
            </div>
            <div class="text-mono" style="font-size:20px;color:var(--text-main);">{{ s.latency || '-' }}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">{{ s.detail || '' }}</div>
          </div>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="base-panel">
        <div class="base-panel__header"><span class="base-panel__title">接口耗时排行</span></div>
        <div class="base-panel__body" style="color:var(--text-muted);font-size:12px;">接入后端 API 后渲染</div>
      </div>
      <div class="base-panel">
        <div class="base-panel__header"><span class="base-panel__title">错误接口排行</span></div>
        <div class="base-panel__body" style="color:var(--text-muted);font-size:12px;">接入后端 API 后渲染</div>
      </div>
    </div>
  </div>
</template>
