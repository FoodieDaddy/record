<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'
import StatusPill from '@/components/status/StatusPill.vue'
import CommandButton from '@/components/button/CommandButton.vue'

const router = useRouter()
const api = useApi()
const loading = ref(false)
const formations = ref<any[]>([])
const total = ref(0)
const page = ref(1)

const columns = [
  { key: 'roomId', label: '编队 ID', width: '140px' },
  { key: 'roomNo', label: '编队码', width: '100px' },
  { key: 'ownerName', label: '编队主控' },
  { key: 'memberCount', label: '成员数', width: '80px' },
  { key: 'mode', label: '记录协议', width: '100px' },
  { key: 'status', label: '状态', width: '80px' },
  { key: 'createdAt', label: '创建时间', width: '140px' },
  { key: 'lastActiveAt', label: '最后活动', width: '140px' },
  { key: 'actions', label: '操作', width: '100px' },
]

async function load() {
  loading.value = true
  try {
    const data: any = await api.get('/admin/formations', { params: { page: page.value, size: 20 } })
    formations.value = data.records || []
    total.value = data.total || 0
  } finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <div class="base-panel">
    <div class="base-panel__header">
      <span class="base-panel__title">任务编队</span>
      <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">FLEET REGISTRY</span>
    </div>
    <div class="base-panel__body">
      <DataTable :columns="columns" :data="formations" :loading="loading">
        <template #roomNo="{ row }">
          <span class="text-mono" style="color:var(--color-cyan);">{{ row.roomNo }}</span>
        </template>
        <template #memberCount="{ row }">
          <span class="text-mono">{{ row.memberCount }}/16</span>
        </template>
        <template #status="{ row }">
          <StatusPill
            :status="row.status === '运行中' ? 'running' : row.status === '已封存' ? 'ok' : 'offline'"
            :label="row.status"
          />
        </template>
        <template #actions="{ row }">
          <CommandButton variant="ghost" @click="router.push(`/formations/${row.roomId}`)">查看</CommandButton>
        </template>
      </DataTable>
      <DataPagination v-model:page="page" :total="total" :page-size="20" />
    </div>
  </div>
</template>
