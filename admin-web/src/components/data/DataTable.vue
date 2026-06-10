<script setup lang="ts">
import EmptyState from '@/components/feedback/EmptyState.vue'
import { useToastStore } from '@/stores/toast'
import { computed } from 'vue'

const props = defineProps<{
  columns: Array<{ key: string; label: string; width?: string; copyable?: boolean }>
  data: Array<Record<string, any>>
  loading?: boolean
  selectable?: boolean
  selectedIds?: Array<string | number>
  maxHeight?: string
}>()

const emit = defineEmits(['update:selectedIds'])
const toast = useToastStore()

const allSelected = computed(() => {
  if (!props.selectedIds || props.data.length === 0) return false
  return props.data.every(row => props.selectedIds!.includes(row.id || row.userId))
})

const indeterminate = computed(() => {
  if (!props.selectedIds || props.data.length === 0) return false
  const selected = props.data.filter(row => props.selectedIds!.includes(row.id || row.userId))
  return selected.length > 0 && selected.length < props.data.length
})

function toggleRow(row: any) {
  const id = row.id || row.userId
  const ids = [...(props.selectedIds || [])]
  const idx = ids.indexOf(id)
  if (idx >= 0) { ids.splice(idx, 1) } else { ids.push(id) }
  emit('update:selectedIds', ids)
}

function toggleAll() {
  if (allSelected.value) { emit('update:selectedIds', []) }
  else { emit('update:selectedIds', props.data.map(row => row.id || row.userId)) }
}

function isRowSelected(row: any) {
  return (props.selectedIds || []).includes(row.id || row.userId)
}

function copyId(value: string) {
  navigator.clipboard.writeText(String(value)).then(() => {
    toast.success('已复制到剪贴板')
  }).catch(() => {
    toast.error('复制失败')
  })
}
</script>

<template>
  <div class="data-table-wrap" :style="{ maxHeight: maxHeight || 'none' }">
    <table class="data-table">
      <thead>
        <tr>
          <th v-if="selectable" style="width:40px;">
            <input type="checkbox" :checked="allSelected" :indeterminate="indeterminate" @change="toggleAll" class="table-checkbox" />
          </th>
          <th v-for="col in columns" :key="col.key" :style="{ width: col.width }">
            {{ col.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td :colspan="columns.length + (selectable ? 1 : 0)" style="text-align:center;padding:32px;color:var(--text-muted);">
            正在接入数据...
          </td>
        </tr>
        <tr v-else-if="data.length === 0">
          <td :colspan="columns.length + (selectable ? 1 : 0)" style="padding:0;">
            <EmptyState title="未检索到匹配航迹" description="尝试调整筛选条件或搜索关键词" icon="data" />
          </td>
        </tr>
        <tr v-for="(row, i) in data" :key="i" :class="{ 'row-selected': isRowSelected(row) }">
          <td v-if="selectable">
            <input type="checkbox" :checked="isRowSelected(row)" @change="toggleRow(row)" class="table-checkbox" />
          </td>
          <td v-for="col in columns" :key="col.key">
            <div v-if="col.copyable && row[col.key]" class="cell-copyable">
              <span class="cell-value text-mono">{{ row[col.key] }}</span>
              <button class="cell-copy-btn" @click="copyId(row[col.key])" title="复制">复制</button>
            </div>
            <slot v-else :name="col.key" :row="row" :value="row[col.key]">
              <span class="cell-truncate" :title="String(row[col.key] || '')">{{ row[col.key] }}</span>
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.data-table-wrap {
  overflow-x: auto;
  overflow-y: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
}
.data-table thead {
  position: sticky;
  top: 0;
  z-index: 10;
}
.table-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--color-cyan);
  cursor: pointer;
}
.row-selected td {
  background: rgba(10,132,255,0.08) !important;
}

.cell-copyable {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cell-value {
  font-size: 12px;
  color: var(--text-secondary);
}
.cell-copy-btn {
  font-size: 10px;
  color: var(--text-muted);
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 2px;
  padding: 1px 6px;
  cursor: pointer;
  transition: all .15s;
  opacity: 0;
}
.cell-copyable:hover .cell-copy-btn {
  opacity: 1;
}
.cell-copy-btn:hover {
  background: rgba(10,132,255,0.10);
  border-color: rgba(10,132,255,0.20);
  color: var(--color-primary);
}

.cell-truncate {
  display: inline-block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
</style>
