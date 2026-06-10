<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'
import StatusPill from '@/components/status/StatusPill.vue'
import CommandButton from '@/components/button/CommandButton.vue'

const api = useApi()
const loading = ref(false)
const admins = ref<any[]>([])
const total = ref(0)
const page = ref(1)

const columns = [
  { key: 'id', label: 'ID', width: '80px' },
  { key: 'username', label: '用户名' },
  { key: 'role', label: '角色', width: '140px' },
  { key: 'status', label: '状态', width: '80px' },
  { key: 'lastLoginAt', label: '最后登录', width: '140px' },
  { key: 'actions', label: '操作', width: '140px' },
]

async function load() {
  loading.value = true
  try {
    const res: any = await api.get('/admin/admins', { params: { page: page.value, size: 20 } })
    admins.value = res.records || []
    total.value = res.total || 0
  } finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <div class="base-panel">
    <div class="base-panel__header">
      <span class="base-panel__title">管理员</span>
      <CommandButton variant="primary" style="height:28px;font-size:11px;">新增管理员</CommandButton>
    </div>
    <div class="base-panel__body">
      <DataTable :columns="columns" :data="admins" :loading="loading">
        <template #role="{ row }">
          <span class="text-mono" style="color:var(--color-purple);">{{ row.role }}</span>
        </template>
        <template #status="{ row }">
          <StatusPill :status="row.status === 1 ? 'ok' : 'offline'" :label="row.status === 1 ? '正常' : '禁用'" />
        </template>
        <template #actions="{ row }">
          <div style="display:flex;gap:8px;">
            <CommandButton variant="ghost" style="height:28px;font-size:11px;">编辑</CommandButton>
            <CommandButton variant="danger" style="height:28px;font-size:11px;">禁用</CommandButton>
          </div>
        </template>
      </DataTable>
      <DataPagination v-model:page="page" :total="total" :page-size="20" />
    </div>
  </div>
</template>
