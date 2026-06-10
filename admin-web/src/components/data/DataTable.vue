<script setup lang="ts">
import EmptyState from '@/components/feedback/EmptyState.vue'
import { computed } from 'vue'

const props = defineProps<{
  columns: Array<{ key: string; label: string; width?: string }>
  data: Array<Record<string, any>>
  loading?: boolean
  selectable?: boolean
  selectedIds?: Array<string | number>
}>()

const emit = defineEmits(['update:selectedIds', 'select-all'])

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
  if (idx >= 0) {
    ids.splice(idx, 1)
  } else {
    ids.push(id)
  }
  emit('update:selectedIds', ids)
}

function toggleAll() {
  if (allSelected.value) {
    emit('update:selectedIds', [])
  } else {
    emit('update:selectedIds', props.data.map(row => row.id || row.userId))
  }
}

function isRowSelected(row: any) {
  return (props.selectedIds || []).includes(row.id || row.userId)
}
</script>

<template>
  <div style="overflow-x:auto;">
    <table class="data-table">
      <thead>
        <tr>
          <th v-if="selectable" style="width:40px;">
            <input
              type="checkbox"
              :checked="allSelected"
              :indeterminate="indeterminate"
              @change="toggleAll"
              class="table-checkbox"
            />
          </th>
          <th v-for="col in columns" :key="col.key" :style="{ width: col.width }">
            {{ col.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td :colspan="columns.length + (selectable ? 1 : 0)" style="text-align:center;padding:32px;color:var(--text-muted);">
            加载中...
          </td>
        </tr>
        <tr v-else-if="data.length === 0">
          <td :colspan="columns.length + (selectable ? 1 : 0)" style="padding:0;">
            <EmptyState title="暂无数据" description="当前没有可显示的记录" icon="data" />
          </td>
        </tr>
        <tr
          v-for="(row, i) in data"
          :key="i"
          :class="{ 'row-selected': isRowSelected(row) }"
        >
          <td v-if="selectable">
            <input
              type="checkbox"
              :checked="isRowSelected(row)"
              @change="toggleRow(row)"
              class="table-checkbox"
            />
          </td>
          <td v-for="col in columns" :key="col.key">
            <slot :name="col.key" :row="row" :value="row[col.key]">
              {{ row[col.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--color-cyan);
  cursor: pointer;
}
.row-selected td {
  background: rgba(10,132,255,0.08) !important;
}
</style>
