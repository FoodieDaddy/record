<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useApi } from '@/composables/useApi'
import { useLocaleStore } from '@/stores/locale'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'

const api = useApi()
const locale = useLocaleStore()
const loading = ref(false)
const data = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const error = ref('')

const columns = [
  { key: 'alertId', label: 'ID', width: '140px' },
  { key: 'level', label: locale.isZh ? '级别' : 'Level', width: '80px' },
  { key: 'message', label: locale.isZh ? '告警信息' : 'Alert Message' },
  { key: 'createdAt', label: locale.isZh ? '时间' : 'Time', width: '140px' },
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params: any = { page: page.value, size: 20 }
    if (search.value) params.keyword = search.value
    const res: any = await api.get('/admin/system/alerts', { params })
    data.value = res.records || []
    total.value = res.total || 0
  } catch {
    error.value = locale.isZh ? '加载告警数据失败' : 'Failed to load alerts'
  } finally { loading.value = false }
}

watch(page, load)
onMounted(load)
</script>

<template>
  <div class="page-header">
    <div class="page-header__left">
      <h1 class="page-header__title">{{ locale.isZh ? '告警中心' : 'Alert Center' }}</h1>
    </div>
  </div>
  <div class="base-panel">
    <div class="base-panel__header">
      <span class="base-panel__title">{{ locale.isZh ? '告警中心' : 'Alert Center' }}</span>
    </div>
    <div class="toolbar">
      <div style="display:flex;gap:8px;align-items:center;">
        <input v-model="search" class="input-field" style="width:240px;" :placeholder="locale.isZh ? '搜索告警信息...' : 'Search alerts...'" @keyup.enter="page=1;load()" />
        <button class="cmd-btn cmd-btn--secondary" @click="page=1;load()">{{ locale.t('common.search') }}</button>
      </div>
    </div>
    <div class="base-panel__body" style="padding-top:0;">
      <EmptyState v-if="!loading && !error && data.length === 0" :title="locale.t('common.noDataYet')" icon="data" />
      <div v-else-if="error" style="text-align:center;padding:48px;color:var(--text-muted);">{{ error }}</div>
      <template v-else>
        <DataTable :columns="columns" :data="data" :loading="loading">
          <template #level="{ row }">
            <span :style="{ color: row.level === 'CRITICAL' ? 'var(--color-red)' : row.level === 'WARN' ? 'var(--color-orange)' : 'var(--color-cyan)' }">{{ row.level }}</span>
          </template>
        </DataTable>
        <DataPagination v-model:page="page" :total="total" :page-size="20" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 16px; gap: 16px;
}
.page-header__title { font-size: var(--text-xl); font-weight: 600; color: var(--text-main); }
.toolbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; border-bottom: 1px solid var(--table-row-border);
}
</style>
