<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'
import { useLocaleStore } from '@/stores/locale'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'
import StatusPill from '@/components/status/StatusPill.vue'
import CommandButton from '@/components/button/CommandButton.vue'
import ConfirmDangerModal from '@/components/modal/ConfirmDangerModal.vue'

const api = useApi()
const toast = useToastStore()
const locale = useLocaleStore()
const router = useRouter()
const loading = ref(false)
const admins = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')

const showCreate = ref(false)
const createForm = ref({ username: '', password: '', role: 'VIEWER' })
const creating = ref(false)

const showDisableConfirm = ref(false)
const disableTarget = ref<any>(null)

function mapRoleName(role: string): string {
  if (role === 'SUPER_ADMIN') return locale.t('role.superAdmin')
  if (role === 'OPERATOR') return locale.t('role.operator')
  if (role === 'VIEWER') return locale.t('role.viewer')
  return role
}

const columns = computed(() => [
  { key: 'id', label: 'ID', width: '140px', copyable: true },
  { key: 'username', label: locale.t('admins.username') },
  { key: 'role', label: locale.t('admins.role'), width: '140px' },
  { key: 'status', label: locale.t('common.status'), width: '80px' },
  { key: 'lastLoginAt', label: locale.t('admins.lastLogin'), width: '160px' },
  { key: 'actions', label: locale.t('common.actions'), width: '160px' },
])

async function load() {
  loading.value = true
  try {
    const params: any = { page: page.value, size: 20 }
    if (search.value) params.keyword = search.value
    const res: any = await api.get('/admin/admins', { params })
    admins.value = res.records || []
    total.value = res.total || 0
  } finally { loading.value = false }
}

async function handleCreate() {
  if (!createForm.value.username || !createForm.value.password) {
    toast.warn(locale.t('admins.fillRequired'))
    return
  }
  creating.value = true
  try {
    await api.post('/admin/admins', createForm.value)
    toast.success(locale.t('admins.createSuccess'))
    showCreate.value = false
    createForm.value = { username: '', password: '', role: 'VIEWER' }
    load()
  } catch { toast.warn(locale.isZh ? '操作失败' : 'Operation failed') } finally { creating.value = false }
}

function confirmToggleStatus(admin: any) {
  if (admin.status === 1) {
    disableTarget.value = admin
    showDisableConfirm.value = true
  } else {
    toggleStatus(admin)
  }
}

async function toggleStatus(admin: any) {
  const newStatus = admin.status === 1 ? 0 : 1
  try {
    await api.put(`/admin/admins/${admin.id}/status`, null, { params: { status: newStatus } })
    toast.success(newStatus === 1 ? locale.t('admins.enabled') : locale.t('admins.disabled'))
    load()
  } catch { toast.warn(locale.isZh ? '操作失败' : 'Operation failed') }
}

function executeDisable() {
  if (disableTarget.value) {
    toggleStatus(disableTarget.value)
  }
  showDisableConfirm.value = false
  disableTarget.value = null
}

const roleDistribution = computed(() => {
  const roles: Record<string, number> = {}
  admins.value.forEach(a => {
    const r = a.role || 'VIEWER'
    roles[r] = (roles[r] || 0) + 1
  })
  return Object.entries(roles).map(([label, count]) => ({
    label: mapRoleName(label),
    count,
    color: label === 'SUPER_ADMIN' ? 'var(--color-red)' : label === 'OPERATOR' ? 'var(--color-primary)' : 'var(--text-muted)',
  }))
})

watch(page, load)
onMounted(load)
</script>

<template>
  <div>
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-header__title">{{ locale.t('admins.title') }}</h1>
        <p class="page-header__subtitle">{{ locale.t('admins.subtitle') }}</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <div class="base-panel">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('admins.roles') }}</span>
          <span class="hud-label">{{ locale.t('admins.rolePermissions') }}</span>
        </div>
        <div class="base-panel__body">
          <div v-for="(item, i) in roleDistribution" :key="i" style="display:flex;align-items:center;gap:12px;padding:8px 0;">
            <span style="width:8px;height:8px;border-radius:50%;" :style="{ background: item.color }" />
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">{{ item.label }}</span>
            <span class="text-mono" style="font-size:13px;color:var(--text-main);">{{ item.count }}</span>
          </div>
        </div>
      </div>
      <div class="base-panel">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('admins.statusDist') }}</span>
        </div>
        <div class="base-panel__body">
          <div style="display:flex;align-items:center;gap:12px;padding:8px 0;">
            <span style="width:8px;height:8px;border-radius:50;background:var(--color-green);" />
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">{{ locale.t('common.enabled') }}</span>
            <span class="text-mono" style="font-size:13px;color:var(--text-main);">{{ admins.filter(a => a.status === 1).length }}</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:8px 0;">
            <span style="width:8px;height:8px;border-radius:50;background:var(--color-red);" />
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">{{ locale.t('common.disabled') }}</span>
            <span class="text-mono" style="font-size:13px;color:var(--text-main);">{{ admins.filter(a => a.status === 0).length }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 角色权限说明 -->
    <div class="base-panel" style="margin-bottom:16px;">
      <div class="base-panel__header">
        <span class="base-panel__title">{{ locale.t('admins.rolePermissions') }}</span>
      </div>
      <div class="base-panel__body">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
          <div class="role-card">
            <div style="font-size:14px;font-weight:600;color:var(--color-red);margin-bottom:4px;">{{ locale.t('role.superAdmin') }}</div>
            <div style="font-size:12px;color:var(--text-muted);">{{ locale.t('admins.superAdminDesc') }}</div>
            <div style="font-size:11px;color:var(--text-disabled);margin-top:8px;">{{ locale.t('admins.superAdminPerms') }}</div>
          </div>
          <div class="role-card">
            <div style="font-size:14px;font-weight:600;color:var(--color-primary);margin-bottom:4px;">{{ locale.t('role.operator') }}</div>
            <div style="font-size:12px;color:var(--text-muted);">{{ locale.t('admins.operatorDesc') }}</div>
            <div style="font-size:11px;color:var(--text-disabled);margin-top:8px;">{{ locale.t('admins.operatorPerms') }}</div>
          </div>
          <div class="role-card">
            <div style="font-size:14px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">{{ locale.t('role.viewer') }}</div>
            <div style="font-size:12px;color:var(--text-muted);">{{ locale.t('admins.viewerDesc') }}</div>
            <div style="font-size:11px;color:var(--text-disabled);margin-top:8px;">{{ locale.t('admins.viewerPerms') }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="base-panel">
      <div class="base-panel__header">
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="base-panel__title">{{ locale.t('admins.title') }}</span>
          <span class="hud-label">{{ locale.t('admins.subtitle') }}</span>
        </div>
        <CommandButton variant="primary" style="height:32px;font-size:12px;" @click="showCreate = true">{{ locale.t('admins.create') }}</CommandButton>
      </div>
      <div class="base-panel__body">
        <div class="toolbar">
          <div style="display:flex;gap:8px;align-items:center;">
            <input v-model="search" class="input-field" style="width:200px;" :placeholder="locale.isZh ? '搜索用户名' : 'Search username'" @keyup.enter="load" />
            <CommandButton variant="secondary" @click="load">{{ locale.t('common.search') }}</CommandButton>
          </div>
        </div>
        <div style="padding:0;">
          <DataTable :columns="columns" :data="admins" :loading="loading">
            <template #role="{ row }">
              <span class="text-mono" style="color:var(--color-purple);">{{ mapRoleName(row.role) }}</span>
            </template>
            <template #status="{ row }">
              <StatusPill :status="row.status === 1 ? 'ok' : 'offline'" :label="row.status === 1 ? locale.t('common.enabled') : locale.t('common.disabled')" />
            </template>
            <template #lastLoginAt="{ row }">
              <span style="font-size:12px;color:var(--text-muted);">{{ row.lastLoginAt || locale.t('admins.neverLogin') }}</span>
            </template>
            <template #actions="{ row }">
              <div style="display:flex;gap:8px;">
                <CommandButton variant="ghost" style="height:28px;font-size:11px;" @click="router.push(`/admins/${row.id}`)">
                  {{ locale.t('common.viewDetail') }}
                </CommandButton>
                <CommandButton variant="ghost" style="height:28px;font-size:11px;" @click="confirmToggleStatus(row)">
                  {{ row.status === 1 ? locale.t('common.disable') : locale.t('common.enable') }}
                </CommandButton>
              </div>
            </template>
          </DataTable>
          </div>
          <DataPagination v-model:page="page" :total="total" :page-size="20" />
      </div>

      <!-- 创建管理员弹窗 -->
      <Teleport to="body">
        <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
          <div class="create-modal">
            <div class="create-modal__header">
              <span style="font-size:16px;font-weight:600;">{{ locale.t('admins.create') }}</span>
            </div>
            <div class="create-modal__body">
              <div style="margin-bottom:16px;">
                <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:6px;">{{ locale.t('admins.username') }}</label>
                <input v-model="createForm.username" class="input-field" style="width:100%;" :placeholder="locale.t('admins.username')" />
              </div>
              <div style="margin-bottom:16px;">
                <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:6px;">{{ locale.t('admins.password') }}</label>
                <input v-model="createForm.password" class="input-field" type="password" style="width:100%;" :placeholder="locale.t('admins.password')" />
              </div>
              <div>
                <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:6px;">{{ locale.t('admins.role') }}</label>
                <select v-model="createForm.role" class="input-field" style="width:100%;">
                  <option value="SUPER_ADMIN">{{ locale.t('role.superAdmin') }}</option>
                  <option value="OPERATOR">{{ locale.t('role.operator') }}</option>
                  <option value="VIEWER">{{ locale.t('role.viewer') }}</option>
                </select>
              </div>
            </div>
            <div class="create-modal__actions">
              <CommandButton variant="secondary" @click="showCreate = false">{{ locale.t('common.cancel') }}</CommandButton>
              <CommandButton variant="primary" :disabled="creating" @click="handleCreate">
                {{ creating ? '...' : locale.t('common.confirm') }}
              </CommandButton>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- 禁用确认弹窗 -->
      <ConfirmDangerModal
        :visible="showDisableConfirm"
        :title="locale.t('admins.confirmDisable')"
        :description="disableTarget ? `${disableTarget.username}` : ''"
        :confirm-text="locale.t('common.disable')"
        @confirm="executeDisable"
        @cancel="showDisableConfirm = false"
      />
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 16px;
}
.page-header__title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-main);
  line-height: 1.3;
}
.page-header__subtitle {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-top: 4px;
}
.role-card {
  padding: 18px;
  background: var(--bg-panel);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
}
.create-modal {
  background: var(--bg-elevated); border: 1px solid var(--border-accent);
  border-radius: 24px; width: 400px;
  box-shadow: var(--shadow-lg); overflow: hidden;
}
.create-modal__header { padding: 16px 20px; border-bottom: 1px solid var(--border-subtle); }
.create-modal__body { padding: 20px; }
.create-modal__actions {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 16px 20px; border-top: 1px solid var(--border-subtle);
}
.toolbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; border-bottom: 1px solid var(--table-row-border);
}
</style>
