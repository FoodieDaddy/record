<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useLocaleStore } from '@/stores/locale'
import SkeletonLoader from '@/components/feedback/SkeletonLoader.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const api = useApi()
const locale = useLocaleStore()
const mirror = ref<any>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    mirror.value = await api.get(`/admin/mirrors/${route.params.userId}`)
  } catch {
    error.value = locale.isZh ? '镜像数据不存在' : 'Mirror data not found'
  } finally { loading.value = false }
})
</script>

<template>
  <div v-if="loading"><SkeletonLoader :card="true" /></div>
  <div v-else-if="error" style="text-align:center;padding:64px;">
    <EmptyState :title="error" icon="data" />
  </div>
  <div v-else-if="mirror">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
      <button class="cmd-btn" style="font-size:12px;" @click="router.push('/mirrors')">← {{ locale.isZh ? '返回列表' : 'Back' }}</button>
    </div>
    <div class="base-panel" style="margin-bottom:16px;">
      <div class="base-panel__header"><span class="base-panel__title">{{ locale.t('mirrors.holographicArchive') }}</span></div>
      <div class="base-panel__body" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">
        <div><div style="font-size:11px;color:var(--text-muted);">{{ locale.t('mirrors.callsign') }}</div><div>{{ mirror.nickname || '-' }}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);">{{ locale.t('mirrors.mbti') }}</div><div class="text-mono" style="color:var(--color-purple);">{{ mirror.mbtiType || '-' }}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);">{{ locale.t('mirrors.protocolConfidence') }}</div><div class="text-mono" style="color:var(--color-green);">{{ mirror.matchPercentage || 0 }}%</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);">{{ locale.t('mirrors.traceSamples') }}</div><div class="text-mono">{{ mirror.sampleCount || 0 }}</div></div>
      </div>
    </div>
    <div class="base-panel">
      <div class="base-panel__header"><span class="base-panel__title">{{ locale.t('mirrors.holographicScan') }}</span></div>
      <div class="base-panel__body" style="display:flex;align-items:center;justify-content:center;min-height:300px;color:var(--text-muted);font-size:12px;">{{ locale.t('mirrors.radarHint') }}</div>
    </div>
  </div>
</template>
