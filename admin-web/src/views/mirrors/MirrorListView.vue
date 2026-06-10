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
const mirrors = ref<any[]>([])
const total = ref(0)
const page = ref(1)

const columns = [
  { key: 'userId', label: '用户 ID', width: '140px' },
  { key: 'nickname', label: '本舰呼号' },
  { key: 'mbtiType', label: '协议类型', width: '100px' },
  { key: 'matchPercentage', label: '协议一致率', width: '100px' },
  { key: 'sampleCount', label: '航迹样本', width: '90px' },
  { key: 'scanStatus', label: '扫描状态', width: '100px' },
  { key: 'updatedAt', label: '最近更新', width: '140px' },
  { key: 'actions', label: '操作', width: '80px' },
]

async function load() {
  loading.value = true
  try {
    const data: any = await api.get('/admin/mirrors', { params: { page: page.value, size: 20 } })
    mirrors.value = data.records || []
    total.value = data.total || 0
  } finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <div class="base-panel">
    <div class="base-panel__header">
      <span class="base-panel__title">镜像档案</span>
      <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">MIRROR ARCHIVES</span>
    </div>
    <div class="base-panel__body">
      <DataTable :columns="columns" :data="mirrors" :loading="loading">
        <template #matchPercentage="{ row }">
          <span class="text-mono" :style="{ color: row.matchPercentage >= 70 ? 'var(--color-green)' : 'var(--color-orange)' }">{{ row.matchPercentage }}%</span>
        </template>
        <template #scanStatus="{ row }">
          <StatusPill :status="row.scanStatus === '已完成' ? 'ok' : row.scanStatus === '采集中' ? 'running' : 'offline'" :label="row.scanStatus" />
        </template>
        <template #actions="{ row }">
          <CommandButton variant="ghost" @click="router.push(`/mirrors/${row.userId}`)">查看</CommandButton>
        </template>
      </DataTable>
      <DataPagination v-model:page="page" :total="total" :page-size="20" />
    </div>
  </div>
</template>
