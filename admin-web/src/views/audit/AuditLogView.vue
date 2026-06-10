<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'

const api = useApi()
const loading = ref(false)
const logs = ref<any[]>([])
const total = ref(0)
const page = ref(1)

const columns = [
  { key: 'id', label: 'ID', width: '120px' },
  { key: 'adminName', label: '管理员' },
  { key: 'actionType', label: '操作类型', width: '100px' },
  { key: 'targetType', label: '目标类型', width: '100px' },
  { key: 'targetId', label: '目标 ID', width: '140px' },
  { key: 'ip', label: 'IP', width: '120px' },
  { key: 'result', label: '结果', width: '80px' },
  { key: 'createdAt', label: '时间', width: '160px' },
]

async function load() {
  loading.value = true
  try {
    const res: any = await api.get('/admin/audit', { params: { page: page.value, size: 20 } })
    logs.value = res.records || []
    total.value = res.total || 0
  } finally { loading.value = false }
}

watch(page, load)
onMounted(load)
</script>

<template>
  <div class="base-panel">
    <div class="base-panel__header">
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="base-panel__title">审计日志</span>
        <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">AUDIT TRAIL</span>
      </div>
    </div>
    <div class="base-panel__body">
      <DataTable :columns="columns" :data="logs" :loading="loading">
        <template #result="{ row }">
          <span :style="{ color: row.result === '成功' ? 'var(--color-green)' : 'var(--color-red)' }">{{ row.result }}</span>
        </template>
        <template #actionType="{ row }">
          <span class="text-mono" style="font-size:11px;color:var(--color-cyan);">{{ row.actionType }}</span>
        </template>
      </DataTable>
      <DataPagination v-model:page="page" :total="total" :page-size="20" />
    </div>
  </div>
</template>
