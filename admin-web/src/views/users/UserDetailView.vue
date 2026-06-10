<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '@/composables/useApi'
import StatCard from '@/components/data/StatCard.vue'
import StatusPill from '@/components/status/StatusPill.vue'
import SkeletonLoader from '@/components/feedback/SkeletonLoader.vue'

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
  <div v-if="loading">
    <div class="base-panel" style="margin-bottom:16px;">
      <div class="base-panel__body">
        <SkeletonLoader :avatar="true" :lines="3" />
      </div>
    </div>
    <div class="grid-4" style="margin-bottom:16px;">
      <div v-for="i in 4" :key="i" class="base-panel">
        <div class="base-panel__body"><SkeletonLoader :card="true" /></div>
      </div>
    </div>
  </div>
  <div v-else-if="user">
    <div class="base-panel" style="margin-bottom:16px;">
      <div class="base-panel__body" style="display:flex;align-items:center;gap:20px;">
        <div style="width:64px;height:64px;border-radius:50%;background:rgba(10,132,255,0.10);border:1px solid rgba(10,132,255,0.20);display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--color-primary);">
          {{ (user.nickname || '?')[0] }}
        </div>
        <div>
          <div style="font-size:18px;font-weight:600;">{{ user.nickname || '未命名航船' }}</div>
          <div style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono);">ID: {{ user.userId || user.id }}</div>
        </div>
        <StatusPill :status="user.status === 1 || user.status === '正常' ? 'ok' : 'error'" :label="user.status === 1 || user.status === '正常' ? '正常' : '异常'" style="margin-left:auto;" />
      </div>
    </div>

    <div class="grid-4" style="margin-bottom:16px;">
      <StatCard label="身份等级" kicker="IDENTITY LEVEL" :value="user.identityLevel || '-'" />
      <StatCard label="航行经验" kicker="EXPERIENCE" :value="user.experience || 0" />
      <StatCard label="封存航程" kicker="SEALED" :value="user.sealedCount || 0" />
      <StatCard label="注册时间" kicker="REGISTERED" :value="user.createdAt ? user.createdAt.substring(0, 10) : '-'" />
    </div>

    <div class="base-panel">
      <div class="base-panel__header"><span class="base-panel__title">用户信息</span></div>
      <div class="base-panel__body">
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;">
          <div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">OpenID</div>
            <div class="text-mono" style="font-size:12px;color:var(--text-secondary);word-break:break-all;">{{ user.openid || '-' }}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">头像 URL</div>
            <div style="font-size:12px;color:var(--text-secondary);word-break:break-all;">{{ user.avatarUrl || '-' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else style="text-align:center;padding:48px;color:var(--text-muted);">用户不存在</div>
</template>
