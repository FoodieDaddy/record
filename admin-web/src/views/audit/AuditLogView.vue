<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import { useLocaleStore } from '@/stores/locale'
import DataTable from '@/components/data/DataTable.vue'
import DataPagination from '@/components/data/DataPagination.vue'
import EmptyState from '@/components/feedback/EmptyState.vue'
import { exportToCSV } from '@/utils/export-csv'

const api = useApi()
const locale = useLocaleStore()
const loading = ref(false)
const error = ref('')
const logs = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const filterActionType = ref('')

const columns = computed(() => [
  { key: 'id', label: 'ID', width: '120px', copyable: true },
  { key: 'adminName', label: locale.t('audit.adminFilter'), width: '120px' },
  { key: 'actionType', label: locale.t('audit.actionType'), width: '100px' },
  { key: 'targetType', label: locale.t('audit.targetType'), width: '100px' },
  { key: 'targetId', label: locale.t('audit.targetId'), width: '140px', copyable: true },
  { key: 'ip', label: 'IP', width: '120px' },
  { key: 'result', label: locale.t('audit.result'), width: '80px' },
  { key: 'createdAt', label: locale.t('formations.createdAt'), width: '160px' },
])

const highRiskActions = ['DELETE', 'REMOVE', 'DISABLE', 'BATCH_DELETE', 'FORCE_SEAL', 'FORCE_DISSOLVE']
const actionTypes = ['LOGIN', 'LOGOUT', 'CREATE', 'CREATE_ADMIN', 'UPDATE', 'UPDATE_STATUS', 'BATCH_UPDATE_STATUS', 'DELETE', 'BATCH_DELETE', 'CHANGE_PASSWORD', 'VIEW']

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params: any = { page: page.value, size: 20 }
    if (search.value) params.keyword = search.value
    if (filterActionType.value) params.actionType = filterActionType.value
    const res: any = await api.get('/admin/audit', { params })
    logs.value = res.records || []
    total.value = res.total || 0
  } catch {
    error.value = locale.isZh ? '加载审计日志失败' : 'Failed to load audit logs'
  } finally { loading.value = false }
}

const actionDistribution = computed(() => {
  const actions: Record<string, number> = {}
  logs.value.forEach(l => {
    const a = l.actionType || (locale.isZh ? '未知' : 'Unknown')
    actions[a] = (actions[a] || 0) + 1
  })
  return Object.entries(actions).map(([label, count]) => ({
    label, count,
    color: highRiskActions.includes(label) ? 'var(--color-orange)' : 'var(--color-cyan)',
  }))
})

function isHighRisk(actionType: string): boolean {
  return highRiskActions.includes(actionType)
}

function resetFilters() {
  search.value = ''
  filterActionType.value = ''
  page.value = 1
  load()
}

onMounted(load)
</script>

<template>
  <div>
    <div class="page-header">
      <div class="page-header__left">
        <h1 class="page-header__title">{{ locale.t('audit.title') }}</h1>
        <p class="page-header__subtitle">{{ locale.t('audit.description') }}</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px;">
      <div class="base-panel">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('audit.title') }}</span>
        </div>
        <div class="base-panel__body" style="color:var(--text-muted);font-size:12px;padding:24px;">
          {{ locale.t('audit.description') }}
        </div>
      </div>
      <div class="base-panel">
        <div class="base-panel__header">
          <span class="base-panel__title">{{ locale.t('audit.actionDist') }}</span>
        </div>
        <div class="base-panel__body">
          <div v-for="(item, i) in actionDistribution" :key="i" style="display:flex;align-items:center;gap:12px;padding:6px 0;">
            <span style="width:8px;height:8px;border-radius:50%;" :style="{ background: item.color }" />
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">{{ item.label }}</span>
            <span class="text-mono" style="font-size:13px;color:var(--text-main);">{{ item.count }}</span>
          </div>
          <div v-if="actionDistribution.length === 0" style="font-size:12px;color:var(--text-muted);padding:16px 0;">{{ locale.t('common.noDataYet') }}</div>
        </div>
      </div>
    </div>

    <div class="base-panel">
      <div class="base-panel__header">
        <span class="base-panel__title">{{ locale.t('audit.title') }}</span>
      </div>
      <div class="filter-body">
        <div class="filter-col">
          <label class="filter-label">{{ locale.isZh ? '关键字' : 'Keyword' }}</label>
          <input v-model="search" class="hud-input text-mono" :placeholder="locale.isZh ? '管理员/目标ID...' : 'Admin/Target ID...'" @keyup.enter="page=1;load()" />
        </div>
        <div class="filter-col">
          <label class="filter-label">{{ locale.t('audit.actionType') }}</label>
          <select v-model="filterActionType" class="hud-select" @change="page=1;load()">
            <option value="">{{ locale.t('behavior.allTypes') }}</option>
            <option v-for="t in actionTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="filter-actions">
          <button class="cmd-btn cmd-btn--primary" @click="page=1;load()">{{ locale.t('common.search') }}</button>
          <button class="cmd-btn" @click="resetFilters">{{ locale.t('common.refresh') }}</button>
          <button class="cmd-btn" style="font-size:11px;" @click="exportToCSV('audit', columns, logs)">CSV</button>
        </div>
      </div>
      <div class="base-panel__body" style="padding-top:0;">
        <EmptyState v-if="!loading && !error && logs.length === 0" :title="locale.t('audit.noMatch')" :description="locale.t('audit.noMatchDesc')" icon="data" />
        <div v-else-if="error" style="text-align:center;padding:48px;color:var(--text-muted);">{{ error }}</div>
        <template v-else>
          <DataTable :columns="columns" :data="logs" :loading="loading">
            <template #result="{ row }">
              <span :style="{ color: row.result === '成功' || row.result === 'Success' ? 'var(--color-green)' : 'var(--color-red)' }">{{ row.result }}</span>
            </template>
            <template #actionType="{ row }">
              <span class="text-mono" :style="{ fontSize: '11px', color: isHighRisk(row.actionType) ? 'var(--color-orange)' : 'var(--color-cyan)' }">{{ row.actionType }}</span>
            </template>
            <template #createdAt="{ value }">
              <span style="font-size:12px;color:var(--text-muted);">{{ value ? value.substring(0, 16) : '-' }}</span>
            </template>
          </DataTable>
          <DataPagination v-model:page="page" :total="total" :page-size="20" @update:page="load" />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 16px; gap: 16px;
}
.page-header__title { font-size: var(--text-xl); font-weight: 600; color: var(--text-main); }
.page-header__subtitle { font-size: var(--text-sm); color: var(--text-muted); margin-top: 4px; }
.filter-body {
  display: flex; align-items: flex-end; gap: 16px;
  padding: 12px 16px; border-bottom: 1px solid var(--table-row-border);
}
.filter-col { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.filter-label {
  font-size: 10px; font-weight: 600; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.5px;
}
.hud-select, .hud-input {
  height: 36px; background: rgba(255,255,255,0.45);
  border: 1px solid rgba(130,150,180,0.18); border-radius: 8px;
  padding: 0 12px; font-size: 12px; color: var(--text-main); outline: none;
}
.hud-select:focus, .hud-input:focus { border-color: var(--color-cyan); }
.filter-actions { display: flex; gap: 8px; height: 36px; }
</style>
