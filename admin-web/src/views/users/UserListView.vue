<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'
import StatusPill from '@/components/status/StatusPill.vue'
import CommandButton from '@/components/button/CommandButton.vue'
import { useToastStore } from '@/stores/toast'

const router = useRouter()
const api = useApi()
const toast = useToastStore()

const loading = ref(false)
const users = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')

const columns = [
  { key: 'userId', label: '用户 ID', width: '140px' },
  { key: 'nickname', label: '本舰呼号' },
  { key: 'identityLevel', label: '授权等级', width: '100px' },
  { key: 'experience', label: '航行经验', width: '100px' },
  { key: 'sealedCount', label: '封存航程', width: '100px' },
  { key: 'lastActiveAt', label: '最近活跃', width: '140px' },
  { key: 'status', label: '状态', width: '80px' },
  { key: 'actions', label: '操作', width: '140px' },
]

async function loadUsers() {
  loading.value = true
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
    await api.put(`/admin/users/${user.userId || user.id}/status`, null, { params: { status: newStatus } })
    toast.success(newStatus === 1 ? '已启用' : '已禁用')
    loadUsers()
  } catch {}
}

onMounted(loadUsers)
</script>

<template>
  <div>
    <div class="base-panel" style="margin-bottom:16px;">
      <div class="base-panel__header">
        <span class="base-panel__title">航船用户</span>
        <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">VESSEL REGISTRY</span>
      </div>
      <div class="base-panel__body">
        <div style="display:flex;gap:12px;margin-bottom:16px;">
          <input
            v-model="search"
            class="input-field"
            style="width:300px;"
            placeholder="搜索用户 ID / 本舰呼号"
            @keyup.enter="loadUsers"
          />
          <CommandButton variant="secondary" @click="loadUsers">搜索</CommandButton>
        </div>

        <DataTable :columns="columns" :data="users" :loading="loading">
          <template #status="{ row }">
            <StatusPill
              :status="row.status === '正常' ? 'ok' : row.status === '异常' ? 'error' : 'offline'"
              :label="row.status || '正常'"
            />
          </template>
          <template #actions="{ row }">
            <div style="display:flex;gap:8px;">
              <CommandButton variant="ghost" @click="router.push(`/users/${row.userId || row.id}`)">查看</CommandButton>
              <CommandButton
                :variant="row.status === 1 ? 'danger' : 'secondary'"
                style="height:28px;font-size:11px;"
                @click="toggleUserStatus(row)"
              >
                {{ row.status === 1 ? '禁用' : '启用' }}
              </CommandButton>
            </div>
          </template>
        </DataTable>

        <DataPagination v-model:page="page" :total="total" :page-size="20" />
      </div>
    </div>
  </div>
</template>
