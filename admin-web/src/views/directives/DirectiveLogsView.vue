<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'
import CommandButton from '@/components/button/CommandButton.vue'

const router = useRouter()
const api = useApi()
const loading = ref(false)
const logs = ref<any[]>([])
const total = ref(0)
const page = ref(1)

const columns = [
  { key: 'logId', label: '日志 ID', width: '140px' },
  { key: 'nickname', label: '本舰呼号' },
  { key: 'sampleCount', label: '样本数', width: '80px' },
  { key: 'source', label: '生成来源', width: '100px' },
  { key: 'duration', label: '耗时', width: '80px' },
  { key: 'status', label: '状态', width: '80px' },
  { key: 'createdAt', label: '创建时间', width: '140px' },
  { key: 'actions', label: '操作', width: '80px' },
]

async function load() {
  loading.value = true
  try {
    const data: any = await api.get('/admin/directives/logs', { params: { page: page.value, size: 20 } })
    logs.value = data.records || []
    total.value = data.total || 0
  } finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <div class="base-panel">
    <div class="base-panel__header">
      <span class="base-panel__title">指令日志</span>
      <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">DIRECTIVE LOGS</span>
    </div>
    <div class="base-panel__body">
      <DataTable :columns="columns" :data="logs" :loading="loading">
        <template #source="{ row }">
          <span :style="{ color: row.source === '主引擎' ? 'var(--color-primary)' : 'var(--text-muted)' }">{{ row.source }}</span>
        </template>
        <template #duration="{ row }">
          <span class="text-mono">{{ row.duration }}ms</span>
        </template>
        <template #actions="{ row }">
          <CommandButton variant="ghost" @click="router.push(`/directives/logs/${row.logId}`)">查看</CommandButton>
        </template>
      </DataTable>
      <DataPagination v-model:page="page" :total="total" :page-size="20" />
    </div>
  </div>
</template>
