<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
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

const actionDistribution = computed(() => {
  const actions: Record<string, number> = {}
  logs.value.forEach(l => {
    actions[l.actionType || '未知'] = (actions[l.actionType || '未知'] || 0) + 1
  })
  return Object.entries(actions).map(([label, count]) => ({
    label, count, color: 'var(--color-cyan)'
  }))
})

onMounted(load)
</script>

<template>
  <div>
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px;">
      <div class="base-panel">
        <div class="base-panel__header">
          <span class="base-panel__title">审计日志</span>
          <span class="hud-label">AUDIT TRAIL</span>
        </div>
        <div class="base-panel__body" style="color:var(--text-muted);font-size:12px;padding:24px;">
          记录所有管理员操作，包括登录、创建、修改、删除等。
        </div>
      </div>
      <div class="base-panel">
        <div class="base-panel__header">
          <span class="base-panel__title">操作类型分布</span>
          <span class="hud-label">ACTIONS</span>
        </div>
        <div class="base-panel__body">
          <div v-for="(item, i) in actionDistribution" :key="i" style="display:flex;align-items:center;gap:12px;padding:6px 0;">
            <span style="width:8px;height:8px;border-radius:50;" :style="{ background: item.color }" />
            <span style="flex:1;font-size:12px;color:var(--text-secondary);">{{ item.label }}</span>
            <span class="text-mono" style="font-size:13px;color:var(--text-main);">{{ item.count }}</span>
          </div>
          <div v-if="actionDistribution.length === 0" style="font-size:12px;color:var(--text-muted);padding:16px 0;">暂无数据</div>
        </div>
      </div>
    </div>

    <div class="base-panel">
      <div class="base-panel__body">
        <DataTable :columns="columns" :data="logs" :loading="loading">
          <template #result="{ row }">
            <span :style="{ color: row.result === '成功' ? 'var(--color-green)' : 'var(--color-red)' }">{{ row.result }}</span>
          </template>
          <template #actionType="{ row }">
            <span class="text-mono" style="font-size:11px;color:var(--color-cyan);">{{ row.actionType }}</span>
          </template>
          <template #createdAt="{ value }">
            <span style="font-size:12px;color:var(--text-muted);">{{ value ? value.substring(0, 16) : '-' }}</span>
          </template>
        </DataTable>
        <DataPagination v-model:page="page" :total="total" :page-size="20" @update:page="load" />
      </div>
    </div>
  </div>
</template>
