<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useLocaleStore } from '@/stores/locale'
import StatCard from '@/components/data/StatCard.vue'
import StatusPill from '@/components/status/StatusPill.vue'
import SkeletonLoader from '@/components/feedback/SkeletonLoader.vue'

const route = useRoute()
const router = useRouter()
const api = useApi()
const locale = useLocaleStore()
const user = ref<any>(null)
const loading = ref(true)
const formations = ref<any[]>([])
const formationsLoading = ref(true)
const techExpanded = ref(false)

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
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      <button class="cmd-btn" style="font-size:12px;" @click="router.push('/users')">← {{ locale.isZh ? '返回列表' : 'Back' }}</button>
      <span style="font-size:11px;color:var(--text-muted);">{{ locale.isZh ? '用户详情' : 'User Detail' }}</span>
    </div>
    <!-- 三栏布局：用户档案 -->
    <div class="vessel-profile">
      <!-- 左栏：身份信息 -->
      <div class="base-panel vessel-identity">
        <div class="base-panel__body" style="display:flex;flex-direction:column;align-items:center;padding:24px 16px;gap:12px;">
          <div class="vessel-avatar">
            {{ (user.nickname || '?')[0] }}
          </div>
          <div style="text-align:center;">
            <div style="font-size:16px;font-weight:600;">{{ user.nickname || '-' }}</div>
            <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);margin-top:4px;">ID: {{ user.userId || user.id }}</div>
          </div>
          <StatusPill :status="user.status === 1 || user.status === '正常' ? 'ok' : 'error'" :label="user.status === 1 || user.status === '正常' ? locale.t('system.ok') : locale.t('system.error')" />
          <div style="width:100%;border-top:1px solid var(--table-row-border);padding-top:12px;margin-top:4px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 0;">
              <span style="color:var(--text-muted);">{{ locale.t('user.identityLevel') }}</span>
              <span class="text-mono" style="color:var(--color-cyan);">{{ user.identityLevel || '-' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 中栏：统计卡 -->
      <div class="vessel-stats">
        <StatCard :label="locale.t('user.experience')" kicker="EXPERIENCE" :value="user.experience || 0" />
        <StatCard :label="locale.t('user.sealed')" kicker="SEALED" :value="user.sealedCount || 0" />
        <StatCard :label="locale.t('user.registered')" kicker="REGISTERED" :value="user.createdAt ? user.createdAt.substring(0, 10) : '-'" />
      </div>

      <!-- 右栏：参与的编队 -->
      <div class="base-panel vessel-formations">
        <div class="base-panel__header"><span class="base-panel__title">{{ locale.t('user.formations') }}</span></div>
        <div class="base-panel__body" style="overflow-y:auto;max-height:260px;">
          <div v-if="formationsLoading" style="padding:16px;color:var(--text-muted);font-size:12px;">{{ locale.t('common.loading') }}</div>
          <div v-else-if="formations.length === 0" style="padding:16px;color:var(--text-muted);font-size:12px;">{{ locale.t('common.noData') }}</div>
          <div v-else>
            <div v-for="f in formations" :key="f.roomId" class="formation-item">
              <span class="text-mono" style="color:var(--color-cyan);font-size:12px;">{{ f.roomNo }}</span>
              <span style="font-size:10px;color:var(--text-muted);">{{ f.scoreMode === 1 ? locale.t('formations.pulseFlow') : locale.t('formations.segmentWrite') }}</span>
              <span style="flex:1;" />
              <span class="text-mono" style="color:var(--color-primary);font-size:12px;">{{ f.finalScore || 0 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 技术信息（可折叠） -->
    <div class="base-panel" style="margin-top:16px;">
      <div class="base-panel__header" style="cursor:pointer;" @click="techExpanded = !techExpanded">
        <span class="base-panel__title">{{ locale.t('user.techInfo') }}</span>
        <span style="font-size:11px;color:var(--text-muted);transition:transform .2s;" :style="{ transform: techExpanded ? 'rotate(90deg)' : 'rotate(0)' }">&#9654;</span>
      </div>
      <div v-if="techExpanded" class="base-panel__body" style="padding-top:0;">
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;">
          <div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">OpenID</div>
            <div class="text-mono" style="font-size:12px;color:var(--text-secondary);word-break:break-all;">{{ user.openid || '-' }}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">{{ locale.isZh ? '头像 URL' : 'Avatar URL' }}</div>
            <div style="font-size:12px;color:var(--text-secondary);word-break:break-all;">{{ user.avatarUrl || '-' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else style="text-align:center;padding:48px;color:var(--text-muted);">{{ locale.isZh ? '用户不存在' : 'User not found' }}</div>
</template>

<style scoped>
.vessel-profile {
  display: grid;
  grid-template-columns: 200px 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
.vessel-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--btn-primary-bg);
  border: 1px solid var(--btn-primary-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  color: var(--color-primary);
}
.vessel-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.vessel-formations { min-height: 0; }
.formation-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--table-row-border);
}
.formation-item:last-child { border-bottom: none; }
</style>
