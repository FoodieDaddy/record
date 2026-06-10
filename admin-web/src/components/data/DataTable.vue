<script setup lang="ts">
import EmptyState from '@/components/feedback/EmptyState.vue'

defineProps<{
  columns: Array<{ key: string; label: string; width?: string }>
  data: Array<Record<string, any>>
  loading?: boolean
}>()
</script>

<template>
  <div style="overflow-x:auto;">
    <table class="data-table">
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key" :style="{ width: col.width }">
            {{ col.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td :colspan="columns.length" style="text-align:center;padding:32px;color:var(--text-muted);">
            加载中...
          </td>
        </tr>
        <tr v-else-if="data.length === 0">
          <td :colspan="columns.length" style="padding:0;">
            <EmptyState title="暂无数据" description="当前没有可显示的记录" icon="data" />
          </td>
        </tr>
        <tr v-for="(row, i) in data" :key="i">
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
