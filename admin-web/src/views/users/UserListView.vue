<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'
import { useLocaleStore } from '@/stores/locale'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'
import StatusPill from '@/components/status/StatusPill.vue'
import CommandButton from '@/components/button/CommandButton.vue'
import ConfirmDangerModal from '@/components/modal/ConfirmDangerModal.vue'

const router = useRouter()
const api = useApi()
const toast = useToastStore()
const locale = useLocaleStore()

const loading = ref(false)
const users = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const selectedIds = ref<(string | number)[]>([])
const showBatchConfirm = ref(false)
const batchAction = ref<'enable' | 'disable' | 'delete'>('disable')


const columns = computed(() => [
  { key: 'id', label: 'User ID', width: '140px' },
  { key: 'nickname', label: locale.t('users.search').split('/')[1]?.trim() || 'Callsign' },
  { key: 'identityLevel', label: locale.t('user.identityLevel'), width: '100px' },
  { key: 'experience', label: locale.t('user.experience'), width: '100px' },
  { key: 'status', label: locale.t('common.status'), width: '80px' },
  { key: 'createdAt', label: locale.t('user.registered'), width: '140px' },
  { key: 'actions', label: locale.t('common.actions'), width: '160px' },
])

const hasSelection = computed(() => selectedIds.value.length > 0)
const selectionCount = computed(() => selectedIds.value.length)

async function loadUsers() {
  loading.value = true
  selectedIds.value = []
  try {
    const data: any = await api.get('/admin/users', {
      params: { page: page.value, size: 20, keyword: search.value }
    })
    users.value = data.records || []
    total.value = data.total || 0
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}


async function toggleUserStatus(user: any) {
  const newStatus = user.status === 1 ? 0 : 1
  try {
    await api.put(`/admin/users/${user.id || user.userId}/status`, null, { params: { status: newStatus } })
    toast.success(newStatus === 1 ? '已启用' : '已禁用')
    loadUsers()
  } catch {}
}

function openBatch(action: 'enable' | 'disable' | 'delete') {
  batchAction.value = action
  showBatchConfirm.value = true
}

async function executeBatch() {
  try {
    if (batchAction.value === 'delete') {
      await api.delete('/admin/users/batch', { data: selectedIds.value })
      toast.success(`已删除 ${selectionCount.value} 个用户`)
    } else {
      const status = batchAction.value === 'enable' ? 1 : 0
      await api.put('/admin/users/batch-status', selectedIds.value, { params: { status } })
      toast.success(`已${batchAction.value === 'enable' ? '启用' : '禁用'} ${selectionCount.value} 个用户`)
    }
    showBatchConfirm.value = false
    loadUsers()
  } catch {}
}

onMounted(() => { loadUsers() })
</script>

<template>
  <div>
    <div class="base-panel">
      <div class="base-panel__header">
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="base-panel__title">{{ locale.t('users.title') }}</span>
          <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">VESSEL REGISTRY</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span v-if="hasSelection" style="font-size:12px;color:var(--color-cyan);">
            {{ locale.t('common.selected') }} {{ selectionCount }}
          </span>
        </div>
      </div>

      <!-- 筛选与批量操作栏 -->
      <div class="toolbar">
        <div style="display:flex;gap:8px;align-items:center;">
          <input
            v-model="search"
            class="input-field"
            style="width:260px;"
            :placeholder="locale.t('users.search')"
            @keyup.enter="loadUsers"
          />
          <CommandButton variant="secondary" @click="loadUsers">{{ locale.t('common.search') }}</CommandButton>
        </div>

        <div v-if="hasSelection" class="batch-actions">
          <CommandButton variant="secondary" style="height:30px;font-size:12px;" @click="openBatch('enable')">
            {{ locale.t('batch.enable') }}
          </CommandButton>
          <CommandButton variant="danger" style="height:30px;font-size:12px;" @click="openBatch('disable')">
            {{ locale.t('batch.disable') }}
          </CommandButton>
          <CommandButton variant="danger" style="height:30px;font-size:12px;" @click="openBatch('delete')">
            {{ locale.t('batch.delete') }}
          </CommandButton>
        </div>
      </div>

      <div class="base-panel__body" style="padding-top:0;">
        <DataTable
          :columns="columns"
          :data="users"
          :loading="loading"
          :selectable="true"
          v-model:selectedIds="selectedIds"
        >
          <template #status="{ row }">
            <StatusPill
              :status="row.status === 1 ? 'ok' : row.status === 0 ? 'offline' : 'error'"
              :label="row.status === 1 ? locale.t('system.ok') : row.status === 0 ? locale.t('common.disable') : locale.t('system.error')"
            />
          </template>
          <template #createdAt="{ value }">
            <span style="font-size:12px;color:var(--text-muted);">{{ value ? value.substring(0, 16) : '-' }}</span>
          </template>
          <template #actions="{ row }">
            <div style="display:flex;gap:6px;">
              <CommandButton variant="ghost" style="height:26px;font-size:11px;padding:0 10px;" @click="router.push(`/users/${row.id || row.userId}`)">
                {{ locale.t('common.detail') }}
              </CommandButton>
              <CommandButton
                :variant="row.status === 1 ? 'danger' : 'secondary'"
                style="height:26px;font-size:11px;padding:0 10px;"
                @click="toggleUserStatus(row)"
              >
                {{ row.status === 1 ? locale.t('common.disable') : locale.t('common.enable') }}
              </CommandButton>
            </div>
          </template>
        </DataTable>

        <DataPagination v-model:page="page" :total="total" :page-size="20" @update:page="loadUsers" />
      </div>
    </div>

    <!-- 批量操作确认弹窗 -->
    <ConfirmDangerModal
      :visible="showBatchConfirm"
      :title="batchAction === 'delete' ? locale.t('batch.confirmDelete') : batchAction === 'enable' ? locale.t('batch.confirmEnable') : locale.t('batch.confirmDisable')"
      :description="`${locale.t('common.confirm')} ${selectionCount} ?`"
      :impact="batchAction === 'delete' ? locale.t('batch.irreversible') : undefined"
      :confirm-text="locale.t('common.confirm')"
      :require-confirm-word="batchAction === 'delete'"
      confirm-word="DELETE"
      @confirm="executeBatch"
      @cancel="showBatchConfirm = false"
    />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.batch-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  animation: fade-in .2s ease;
}
</style>
