<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useLocaleStore } from '@/stores/locale'
import { useToastStore } from '@/stores/toast'
import SkeletonLoader from '@/components/feedback/SkeletonLoader.vue'
import StatusPill from '@/components/status/StatusPill.vue'
import CommandButton from '@/components/button/CommandButton.vue'
import ConfirmDangerModal from '@/components/modal/ConfirmDangerModal.vue'

const route = useRoute()
const router = useRouter()
const api = useApi()
const locale = useLocaleStore()
const toast = useToastStore()
const admin = ref<any>(null)
const loading = ref(true)
const error = ref('')
const showDisableConfirm = ref(false)

function mapRoleName(role: string): string {
  if (role === 'SUPER_ADMIN') return locale.t('role.superAdmin')
  if (role === 'OPERATOR') return locale.t('role.operator')
  return locale.t('role.viewer')
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    admin.value = await api.get(`/admin/admins/${route.params.id}`)
  } catch {
    error.value = locale.isZh ? '管理员不存在或已被删除' : 'Admin not found or deleted'
  } finally { loading.value = false }
}

async function toggleStatus() {
  const newStatus = admin.value.status === 1 ? 0 : 1
  try {
    await api.put(`/admin/admins/${admin.value.id}/status`, null, { params: { status: newStatus } })
    toast.success(newStatus === 1 ? locale.t('admins.enabled') : locale.t('admins.disabled'))
    load()
  } catch { toast.warn(locale.isZh ? '操作失败' : 'Operation failed') }
  showDisableConfirm.value = false
}

onMounted(load)
</script>

<template>
  <div>
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-header__title">{{ locale.isZh ? '管理员详情' : 'Admin Detail' }}</h1>
      </div>
      <CommandButton variant="secondary" @click="router.push('/admins')">
        {{ locale.isZh ? '返回列表' : 'Back to List' }}
      </CommandButton>
    </div>

    <div v-if="loading"><SkeletonLoader :card="true" /></div>
    <div v-else-if="error" style="text-align:center;padding:64px;color:var(--text-muted);">
      <p>{{ error }}</p>
    </div>
    <div v-else-if="admin">
      <div class="base-panel" style="margin-bottom:16px;">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('profile.accountInfo') }}</span>
        </div>
        <div class="base-panel__body">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">
            <div>
              <div style="font-size:11px;color:var(--text-muted);">{{ locale.t('admins.username') }}</div>
              <div class="text-mono" style="font-size:15px;margin-top:4px;">{{ admin.username }}</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);">{{ locale.t('admins.role') }}</div>
              <div class="text-mono" style="color:var(--color-purple);font-size:15px;margin-top:4px;">{{ mapRoleName(admin.role) }}</div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);">{{ locale.t('common.status') }}</div>
              <StatusPill :status="admin.status === 1 ? 'ok' : 'offline'" :label="admin.status === 1 ? locale.t('common.enabled') : locale.t('common.disabled')" style="margin-top:4px;" />
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);">{{ locale.t('admins.lastLogin') }}</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">{{ admin.lastLoginAt || locale.t('admins.neverLogin') }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="base-panel" style="margin-bottom:16px;">
        <div class="base-panel__header"><span class="base-panel__title">{{ locale.isZh ? '安全信息' : 'Security Info' }}</span></div>
        <div class="base-panel__body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
            <div class="info-row">
              <span class="info-label">ID</span>
              <span class="text-mono info-value">{{ admin.id }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ locale.isZh ? '创建时间' : 'Created' }}</span>
              <span class="info-value">{{ admin.createdAt || '-' }}</span>
            </div>
            <div v-if="admin.status !== undefined" class="info-row">
              <span class="info-label">{{ locale.isZh ? '失败次数' : 'Failed Attempts' }}</span>
              <span class="info-value" :style="{ color: (admin.failedAttempts || 0) > 0 ? 'var(--color-orange)' : 'var(--color-green)' }">{{ admin.failedAttempts || 0 }}</span>
            </div>
            <div v-if="admin.lockedUntil" class="info-row">
              <span class="info-label">{{ locale.isZh ? '锁定至' : 'Locked Until' }}</span>
              <span class="info-value" style="color:var(--color-red);">{{ admin.lockedUntil }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="base-panel">
        <div class="base-panel__header"><span class="base-panel__title">{{ locale.isZh ? '操作' : 'Actions' }}</span></div>
        <div class="base-panel__body">
          <CommandButton
            variant="danger"
            @click="showDisableConfirm = true"
          >
            {{ admin.status === 1 ? locale.t('common.disable') : locale.t('common.enable') }}
          </CommandButton>
        </div>
      </div>

      <ConfirmDangerModal
        :visible="showDisableConfirm"
        :title="locale.t('admins.confirmDisable')"
        :description="admin.username"
        :confirm-text="admin.status === 1 ? locale.t('common.disable') : locale.t('common.enable')"
        @confirm="toggleStatus"
        @cancel="showDisableConfirm = false"
      />
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px; gap: 16px;
}
.page-header__title {
  font-size: var(--text-xl); font-weight: 600; color: var(--text-main);
}
.info-row {
  display: flex; align-items: center; padding: 8px 0; gap: 12px;
  border-bottom: 1px solid var(--table-row-border);
}
.info-label {
  width: 100px; font-size: 12px; font-weight: 600;
  color: var(--text-muted); flex-shrink: 0;
}
.info-value {
  font-size: 12px; color: var(--text-main);
}
</style>
