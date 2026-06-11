<script setup lang="ts">
defineProps<{
  lines?: number
  avatar?: boolean
  card?: boolean
}>()
</script>

<template>
  <div v-if="card" class="skeleton-card">
    <div class="skeleton-line skeleton-line--title" />
    <div class="skeleton-line skeleton-line--short" />
    <div class="skeleton-line" />
    <div class="skeleton-line skeleton-line--medium" />
  </div>
  <div v-else class="skeleton">
    <div v-if="avatar" class="skeleton-avatar" />
    <div class="skeleton-lines">
      <div v-for="i in (lines || 3)" :key="i" class="skeleton-line" :class="{ 'skeleton-line--short': i % 3 === 0 }" />
    </div>
  </div>
</template>

<style scoped>
.skeleton {
  display: flex;
  gap: 16px;
  padding: 16px;
}
.skeleton-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(90deg, var(--border-subtle) 25%, var(--border-medium) 50%, var(--border-subtle) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
.skeleton-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.skeleton-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.skeleton-line {
  height: 14px;
  border-radius: var(--radius-xs);
  background: linear-gradient(90deg, var(--border-subtle) 25%, var(--border-medium) 50%, var(--border-subtle) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
.skeleton-line--title {
  height: 20px;
  width: 40%;
}
.skeleton-line--short {
  width: 60%;
}
.skeleton-line--medium {
  width: 80%;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
