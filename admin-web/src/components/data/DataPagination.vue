<script setup lang="ts">
const props = defineProps<{
  page: number
  total: number
  pageSize: number
}>()

const emit = defineEmits(['update:page'])

const totalPages = Math.ceil(props.total / props.pageSize)

function go(p: number) {
  if (p >= 1 && p <= totalPages) emit('update:page', p)
}
</script>

<template>
  <div class="pagination">
    <button class="pagination__btn" :disabled="page <= 1" @click="go(page - 1)">‹</button>
    <button
      v-for="p in totalPages"
      :key="p"
      class="pagination__btn"
      :class="{ 'pagination__btn--active': p === page }"
      @click="go(p)"
    >
      {{ p }}
    </button>
    <button class="pagination__btn" :disabled="page >= totalPages" @click="go(page + 1)">›</button>
    <span class="pagination__info text-mono">共 {{ total }} 条</span>
  </div>
</template>

<style scoped>
.pagination { display: flex; align-items: center; gap: 4px; margin-top: 16px; }
.pagination__btn {
  min-width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px; border: 1px solid var(--border-subtle);
  background: transparent; color: var(--text-secondary);
  font-size: var(--text-sm); cursor: pointer;
}
.pagination__btn--active {
  background: rgba(10,132,255,0.15);
  border-color: rgba(10,132,255,0.30);
  color: var(--color-primary);
}
.pagination__btn:disabled { opacity: 0.3; cursor: not-allowed; }
.pagination__info {
  margin-left: 12px; font-size: var(--text-xs); color: var(--text-muted);
}
</style>
