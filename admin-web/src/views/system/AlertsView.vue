<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'

const api = useApi()
const loading = ref(false)
const data = ref<any[]>([])
const total = ref(0)
const page = ref(1)

const columns = [
  { key: 'alertId', label: 'ID', width: '140px' },
  { key: 'level', label: '级别', width: '80px' },
  { key: 'message', label: '告警信息' },
  { key: 'createdAt', label: '时间', width: '140px' },
]

async function load() {
  loading.value = true
  try {
    const res: any = await api.get('/admin/system/alerts', { params: { page: page.value, size: 20 } })
    data.value = res.records || []
    total.value = res.total || 0
  } finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <div class="base-panel">
    <div class="base-panel__header"><span class="base-panel__title">告警中心</span></div>
    <div class="base-panel__body">
      <DataTable :columns="columns" :data="data" :loading="loading" />
      <DataPagination v-model:page="page" :total="total" :page-size="20" />
    </div>
  </div>
</template>
