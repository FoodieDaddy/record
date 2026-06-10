<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'
import { useLocaleStore } from '@/stores/locale'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'
import StatusPill from '@/components/status/StatusPill.vue'
import CommandButton from '@/components/button/CommandButton.vue'
import HudChart from '@/components/chart/HudChart.vue'

const api = useApi()
const toast = useToastStore()
const locale = useLocaleStore()
const loading = ref(false)
const admins = ref<any[]>([])
const total = ref(0)
const page = ref(1)

// 创建管理员弹窗
const showCreate = ref(false)
const createForm = ref({ username: '', password: '', role: 'VIEWER' })
const creating = ref(false)

const columns = computed(() => [
  { key: 'id', label: 'ID', width: '140px' },
  { key: 'username', label: locale.t('admins.username') },
  { key: 'role', label: locale.t('admins.role'), width: '140px' },
  { key: 'status', label: locale.t('common.status'), width: '80px' },
  { key: 'lastLoginAt', label: locale.t('formations.lastActive'), width: '160px' },
  { key: 'actions', label: locale.t('common.actions'), width: '160px' },
])

async function load() {
  loading.value = true
  try {
    const res: any = await api.get('/admin/admins', { params: { page: page.value, size: 20 } })
    admins.value = res.records || []
    total.value = res.total || 0
  } finally { loading.value = false }
}

async function handleCreate() {
  if (!createForm.value.username || !createForm.value.password) {
    toast.warn('请填写用户名和密码')
    return
  }
  creating.value = true
  try {
    await api.post('/admin/admins', createForm.value)
    toast.success('管理员创建成功')
    showCreate.value = false
    createForm.value = { username: '', password: '', role: 'VIEWER' }
    load()
  } catch {} finally { creating.value = false }
}

async function toggleStatus(admin: any) {
  const newStatus = admin.status === 1 ? 0 : 1
  try {
    await api.put(`/admin/admins/${admin.id}/status`, null, { params: { status: newStatus } })
    toast.success(newStatus === 1 ? '已启用' : '已禁用')
    load()
  } catch {}
}

const roleDistribution = computed(() => {
  const roles: Record<string, number> = {}
  admins.value.forEach(a => {
    roles[a.role || 'VIEWER'] = (roles[a.role || 'VIEWER'] || 0) + 1
  })
  return Object.entries(roles).map(([label, count]) => ({
    label,
    count,
    color: label === 'SUPER_ADMIN' ? 'var(--color-red)' : label === 'OPERATOR' ? 'var(--color-primary)' : 'var(--text-muted)',
  }))
})

watch(page, load)
onMounted(load)
</script>

<template>
  <div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
      <div class="base-panel">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('admins.roles') }}</span>
          <span class="hud-label">ROLES</span>
        </div>
        <div class="base-panel__body">
          <div v-for="(item, i) in roleDistribution" :key="i" style="display:flex;align-items:center;gap:12px;padding:8px 0;">
            <span style="width:8px;height:8px;border-radius:50;" :style="{ background: item.color }" />
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">{{ item.label }}</span>
            <span class="text-mono" style="font-size:13px;color:var(--text-main);">{{ item.count }}</span>
          </div>
        </div>
      </div>
      <div class="base-panel">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('admins.statusDist') }}</span>
          <span class="hud-label">STATUS</span>
        </div>
        <div class="base-panel__body">
          <div style="display:flex;align-items:center;gap:12px;padding:8px 0;">
            <span style="width:8px;height:8px;border-radius:50;background:var(--color-green);" />
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">{{ locale.t('system.ok') }}</span>
            <span class="text-mono" style="font-size:13px;color:var(--text-main);">{{ admins.filter(a => a.status === 1).length }}</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:8px 0;">
            <span style="width:8px;height:8px;border-radius:50;background:var(--color-red);" />
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">{{ locale.t('common.disable') }}</span>
            <span class="text-mono" style="font-size:13px;color:var(--text-main);">{{ admins.filter(a => a.status === 0).length }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="base-panel">
      <div class="base-panel__header">
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="base-panel__title">{{ locale.t('admins.title') }}</span>
          <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">ADMIN REGISTRY</span>
        </div>
        <CommandButton variant="primary" style="height:28px;font-size:11px;" @click="showCreate = true">{{ locale.t('admins.create') }}</CommandButton>
      </div>
      <div class="base-panel__body">
        <DataTable :columns="columns" :data="admins" :loading="loading">
          <template #role="{ row }">
            <span class="text-mono" style="color:var(--color-purple);">{{ row.role }}</span>
          </template>
          <template #status="{ row }">
            <StatusPill :status="row.status === 1 ? 'ok' : 'offline'" :label="row.status === 1 ? locale.t('system.ok') : locale.t('common.disable')" />
          </template>
          <template #lastLoginAt="{ row }">
            <span style="font-size:12px;color:var(--text-muted);">{{ row.lastLoginAt || '从未登录' }}</span>
          </template>
          <template #actions="{ row }">
            <div style="display:flex;gap:8px;">
              <CommandButton variant="ghost" style="height:28px;font-size:11px;" @click="toggleStatus(row)">
                {{ row.status === 1 ? locale.t('common.disable') : locale.t('common.enable') }}
              </CommandButton>
            </div>
          </template>
        </DataTable>
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
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  <option value="OPERATOR">OPERATOR</option>
                  <option value="VIEWER">VIEWER</option>
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
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.create-modal {
  background: var(--bg-elevated); border: 1px solid var(--border-accent);
  clip-path: var(--clip-panel); width: 400px;
}
.create-modal__header { padding: 16px 20px; border-bottom: 1px solid var(--border-subtle); }
.create-modal__body { padding: 20px; }
.create-modal__actions {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 16px 20px; border-top: 1px solid var(--border-subtle);
}
</style>
