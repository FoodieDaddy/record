<script setup lang="ts">
import EmptyState from '@/components/feedback/EmptyState.vue'
import { useToastStore } from '@/stores/toast'
import { useLocaleStore } from '@/stores/locale'
import { computed, ref } from 'vue'

const props = defineProps<{
  columns: Array<{ key: string; label: string; width?: string; copyable?: boolean; sortable?: boolean }>
  data: Array<Record<string, any>>
  loading?: boolean
  selectable?: boolean
  selectedIds?: Array<string | number>
  maxHeight?: string
}>()

const emit = defineEmits(['update:selectedIds'])
const toast = useToastStore()
const locale = useLocaleStore()

// 排序状态
const sortKey = ref('')
const sortAsc = ref(true)

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = true
  }
}

const sortedData = computed(() => {
  if (!sortKey.value) return props.data
  return [...props.data].sort((a, b) => {
    const va = a[sortKey.value]
    const vb = b[sortKey.value]
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1

    let cmp = 0
    if (typeof va === 'number' && typeof vb === 'number') {
      cmp = va - vb
    } else if (typeof va === 'string' && typeof vb === 'string') {
      cmp = va.localeCompare(vb)
    } else {
      cmp = String(va).localeCompare(String(vb))
    }
    return sortAsc.value ? cmp : -cmp
  })
})

const allSelected = computed(() => {
  if (!props.selectedIds || sortedData.value.length === 0) return false
  return sortedData.value.every(row => props.selectedIds!.includes(row.id || row.userId))
})

const indeterminate = computed(() => {
  if (!props.selectedIds || sortedData.value.length === 0) return false
  const selected = sortedData.value.filter(row => props.selectedIds!.includes(row.id || row.userId))
  return selected.length > 0 && selected.length < sortedData.value.length
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
  else { emit('update:selectedIds', sortedData.value.map(row => row.id || row.userId)) }
}

function isRowSelected(row: any) {
  return (props.selectedIds || []).includes(row.id || row.userId)
}

function copyId(value: string) {
  navigator.clipboard.writeText(String(value)).then(() => {
    toast.success(locale.t('common.copied'))
  }).catch(() => {
    toast.error(locale.t('common.copyFailed'))
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
          <th v-for="col in columns" :key="col.key" :style="{ width: col.width, cursor: col.sortable !== false ? 'pointer' : 'default' }"
            :class="{ sortable: col.sortable !== false }"
            @click="col.sortable !== false && toggleSort(col.key)">
            {{ col.label }}
            <span v-if="sortKey === col.key" class="sort-arrow">{{ sortAsc ? ' ▲' : ' ▼' }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td :colspan="columns.length + (selectable ? 1 : 0)" style="text-align:center;padding:32px;color:var(--text-muted);">
            {{ locale.t('common.loading') }}
          </td>
        </tr>
        <tr v-else-if="sortedData.length === 0">
          <td :colspan="columns.length + (selectable ? 1 : 0)" style="padding:0;">
            <EmptyState :title="locale.t('common.noData')" :description="locale.t('common.noDataDesc')" icon="data" />
          </td>
        </tr>
        <tr v-for="(row, i) in sortedData" :key="i" :class="{ 'row-selected': isRowSelected(row) }">
          <td v-if="selectable">
            <input type="checkbox" :checked="isRowSelected(row)" @change="toggleRow(row)" class="table-checkbox" />
          </td>
          <td v-for="col in columns" :key="col.key">
            <div v-if="col.copyable && row[col.key]" class="cell-copyable">
              <span class="cell-value text-mono">{{ row[col.key] }}</span>
              <button class="cell-copy-btn" @click="copyId(row[col.key])" :title="locale.t('common.copyId')">{{ locale.t('common.copyId') }}</button>
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
  background: var(--table-row-selected) !important;
}
.sortable {
  user-select: none;
}
.sortable:hover {
  color: var(--color-cyan);
}
.sort-arrow {
  font-size: 9px;
  color: var(--color-cyan);
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
  background: var(--copy-btn-bg);
  border: 1px solid var(--copy-btn-border);
  border-radius: 2px;
  padding: 1px 6px;
  cursor: pointer;
  transition: background-color .15s, border-color .15s, color .15s;
  opacity: 0;
}
.cell-copyable:hover .cell-copy-btn {
  opacity: 1;
}
.cell-copy-btn:hover {
  background: var(--btn-primary-bg);
  border-color: var(--btn-primary-border);
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
