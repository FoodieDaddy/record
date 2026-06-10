<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useToastStore } from '@/stores/toast'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'
import StatusPill from '@/components/status/StatusPill.vue'
import CommandButton from '@/components/button/CommandButton.vue'

const router = useRouter()
const api = useApi()
const toast = useToastStore()

const loading = ref(false)
const users = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const selectedIds = ref<(string | number)[]>([])
const showBatchConfirm = ref(false)
const batchAction = ref<'enable' | 'disable' | 'delete'>('disable')

const columns = [
  { key: 'id', label: '用户 ID', width: '140px' },
  { key: 'nickname', label: '本舰呼号' },
  { key: 'identityLevel', label: '授权等级', width: '100px' },
  { key: 'experience', label: '航行经验', width: '100px' },
  { key: 'status', label: '状态', width: '80px' },
  { key: 'createdAt', label: '注册时间', width: '140px' },
  { key: 'actions', label: '操作', width: '160px' },
]

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

onMounted(loadUsers)
</script>

<template>
  <div>
    <div class="base-panel">
      <div class="base-panel__header">
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="base-panel__title">航船用户</span>
          <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">VESSEL REGISTRY</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span v-if="hasSelection" style="font-size:12px;color:var(--color-cyan);">
            已选 {{ selectionCount }} 项
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
            placeholder="搜索用户 ID / 本舰呼号"
            @keyup.enter="loadUsers"
          />
          <CommandButton variant="secondary" @click="loadUsers">搜索</CommandButton>
        </div>

        <div v-if="hasSelection" class="batch-actions">
          <CommandButton variant="secondary" style="height:30px;font-size:12px;" @click="openBatch('enable')">
            批量启用
          </CommandButton>
          <CommandButton variant="danger" style="height:30px;font-size:12px;" @click="openBatch('disable')">
            批量禁用
          </CommandButton>
          <CommandButton variant="danger" style="height:30px;font-size:12px;" @click="openBatch('delete')">
            批量删除
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
              :label="row.status === 1 ? '正常' : row.status === 0 ? '禁用' : '异常'"
            />
          </template>
          <template #createdAt="{ value }">
            <span style="font-size:12px;color:var(--text-muted);">{{ value ? value.substring(0, 16) : '-' }}</span>
          </template>
          <template #actions="{ row }">
            <div style="display:flex;gap:6px;">
              <CommandButton variant="ghost" style="height:26px;font-size:11px;padding:0 10px;" @click="router.push(`/users/${row.id || row.userId}`)">
                详情
              </CommandButton>
              <CommandButton
                :variant="row.status === 1 ? 'danger' : 'secondary'"
                style="height:26px;font-size:11px;padding:0 10px;"
                @click="toggleUserStatus(row)"
              >
                {{ row.status === 1 ? '禁用' : '启用' }}
              </CommandButton>
            </div>
          </template>
        </DataTable>

        <DataPagination v-model:page="page" :total="total" :page-size="20" @update:page="loadUsers" />
      </div>
    </div>

    <!-- 批量操作确认弹窗 -->
    <Teleport to="body">
      <div v-if="showBatchConfirm" class="modal-overlay" @click.self="showBatchConfirm = false">
        <div class="batch-modal">
          <div class="batch-modal__header">
            <span style="font-size:16px;font-weight:600;color:var(--color-red);">
              {{ batchAction === 'delete' ? '批量删除' : batchAction === 'enable' ? '批量启用' : '批量禁用' }}
            </span>
          </div>
          <div class="batch-modal__body">
            <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;">
              确认{{ batchAction === 'delete' ? '删除' : batchAction === 'enable' ? '启用' : '禁用' }}
              <span style="color:var(--color-cyan);font-weight:600;">{{ selectionCount }}</span>
              个用户？
            </p>
            <div v-if="batchAction === 'delete'" style="margin-top:12px;padding:12px;background:rgba(255,69,58,0.05);border:1px solid rgba(255,69,58,0.10);border-radius:4px;">
              <div style="font-size:12px;color:var(--color-red);">此操作不可逆，用户数据将被永久删除。</div>
            </div>
          </div>
          <div class="batch-modal__actions">
            <CommandButton variant="secondary" @click="showBatchConfirm = false">取消</CommandButton>
            <CommandButton :variant="batchAction === 'delete' ? 'danger' : 'primary'" @click="executeBatch">
              确认{{ batchAction === 'delete' ? '删除' : batchAction === 'enable' ? '启用' : '禁用' }}
            </CommandButton>
          </div>
        </div>
      </div>
    </Teleport>
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
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.batch-modal {
  background: var(--bg-elevated);
  border: 1px solid var(--border-accent);
  clip-path: var(--clip-panel);
  width: 400px;
}
.batch-modal__header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
}
.batch-modal__body {
  padding: 20px;
}
.batch-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-subtle);
}
</style>
