<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '@/composables/useApi'
import StatCard from '@/components/data/StatCard.vue'
import StatusPill from '@/components/status/StatusPill.vue'

const route = useRoute()
const api = useApi()
const user = ref<any>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    user.value = await api.get(`/admin/users/${route.params.id}`)
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-if="loading" style="color:var(--text-muted);padding:48px;text-align:center;">加载中...</div>
  <div v-else-if="user">
    <div class="base-panel" style="margin-bottom:16px;">
      <div class="base-panel__body" style="display:flex;align-items:center;gap:20px;">
        <div style="width:64px;height:64px;border-radius:50%;background:rgba(10,132,255,0.10);border:1px solid rgba(10,132,255,0.20);display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--color-primary);">
          {{ (user.nickname || '?')[0] }}
        </div>
        <div>
          <div style="font-size:18px;font-weight:600;">{{ user.nickname || '未命名航船' }}</div>
          <div style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono);">ID: {{ user.userId }}</div>
        </div>
        <StatusPill :status="user.status === '正常' ? 'ok' : 'error'" :label="user.status || '正常'" style="margin-left:auto;" />
      </div>
    </div>

    <div class="grid-4" style="margin-bottom:16px;">
      <StatCard label="航行经验" kicker="EXPERIENCE" :value="user.experience || 0" />
      <StatCard label="稳定读数" kicker="STABILITY" :value="user.stability || '-'" />
      <StatCard label="封存航程" kicker="SEALED" :value="user.sealedCount || 0" />
      <StatCard label="净脉冲" kicker="NET PULSE" :value="user.netPulse || 0" />
    </div>

    <div class="base-panel">
      <div class="base-panel__header"><span class="base-panel__title">最近任务编队</span></div>
      <div class="base-panel__body" style="color:var(--text-muted);font-size:12px;">
        接入后端 API 后渲染编队列表
      </div>
    </div>
  </div>
</template>
