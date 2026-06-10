<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useLocaleStore } from '@/stores/locale'
import StatCard from '@/components/data/StatCard.vue'
import StatusPill from '@/components/status/StatusPill.vue'
import SkeletonLoader from '@/components/feedback/SkeletonLoader.vue'

const route = useRoute()
const api = useApi()
const locale = useLocaleStore()
const user = ref<any>(null)
const loading = ref(true)
const formations = ref<any[]>([])
const formationsLoading = ref(true)

onMounted(async () => {
  try {
    user.value = await api.get(`/admin/users/${route.params.id}`)
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }

  try {
    const data: any = await api.get(`/admin/users/${route.params.id}/formations`)
    formations.value = Array.isArray(data) ? data : []
  } catch {} finally { formationsLoading.value = false }
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
          <div style="font-size:18px;font-weight:600;">{{ user.nickname || '-' }}</div>
          <div style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono);">ID: {{ user.userId || user.id }}</div>
        </div>
        <StatusPill :status="user.status === 1 || user.status === '正常' ? 'ok' : 'error'" :label="user.status === 1 || user.status === '正常' ? locale.t('system.ok') : locale.t('system.error')" style="margin-left:auto;" />
      </div>
    </div>

    <div class="grid-4" style="margin-bottom:16px;">
      <StatCard :label="locale.t('user.identityLevel')" kicker="IDENTITY LEVEL" :value="user.identityLevel || '-'" />
      <StatCard :label="locale.t('user.experience')" kicker="EXPERIENCE" :value="user.experience || 0" />
      <StatCard :label="locale.t('user.sealed')" kicker="SEALED" :value="user.sealedCount || 0" />
      <StatCard :label="locale.t('user.registered')" kicker="REGISTERED" :value="user.createdAt ? user.createdAt.substring(0, 10) : '-'" />
    </div>

    <div class="base-panel">
      <div class="base-panel__header"><span class="base-panel__title">{{ locale.t('user.techInfo') }}</span></div>
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
    <div class="base-panel" style="margin-top:16px;">
      <div class="base-panel__header"><span class="base-panel__title">{{ locale.t('user.formations') }}</span></div>
      <div class="base-panel__body">
        <div v-if="formationsLoading" style="padding:16px;color:var(--text-muted);font-size:12px;">{{ locale.t('common.loading') }}</div>
        <div v-else-if="formations.length === 0" style="padding:16px;color:var(--text-muted);font-size:12px;">{{ locale.t('common.noData') }}</div>
        <div v-else>
          <div v-for="f in formations" :key="f.roomId" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.03);">
            <span class="text-mono" style="color:var(--color-cyan);font-size:13px;">{{ f.roomNo }}</span>
            <span style="font-size:11px;color:var(--text-muted);">{{ f.scoreMode === 1 ? locale.t('formations.pulseFlow') : locale.t('formations.segmentWrite') }}</span>
            <span style="flex:1;" />
            <span class="text-mono" style="color:var(--color-primary);font-size:13px;">{{ f.finalScore || 0 }}</span>
            <span style="font-size:11px;color:var(--text-muted);">{{ f.joinedAt ? f.joinedAt.substring(0, 16) : '' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else style="text-align:center;padding:48px;color:var(--text-muted);">用户不存在</div>
</template>
