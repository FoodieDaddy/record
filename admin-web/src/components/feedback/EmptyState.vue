<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  icon?: string
}>()
</script>

<template>
  <div class="empty-state">
    <div class="empty-state__icon">
      <svg v-if="icon === 'data'" viewBox="0 0 48 48" fill="none" width="48" height="48">
        <rect x="8" y="12" width="32" height="24" rx="2" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
        <line x1="8" y1="20" x2="40" y2="20" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
        <line x1="8" y1="28" x2="40" y2="28" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
        <line x1="20" y1="12" x2="20" y2="36" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
      </svg>
      <svg v-else-if="icon === 'user'" viewBox="0 0 48 48" fill="none" width="48" height="48">
        <circle cx="24" cy="18" r="8" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
        <path d="M10 40c0-8 6-14 14-14s14 6 14 14" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" fill="none" />
      </svg>
      <svg v-else viewBox="0 0 48 48" fill="none" width="48" height="48">
        <circle cx="24" cy="24" r="16" stroke="rgba(255,255,255,0.10)" stroke-width="1.5" stroke-dasharray="4 4" />
        <circle cx="24" cy="24" r="4" fill="rgba(0,200,255,0.2)" />
      </svg>
    </div>
    <div class="empty-state__title">{{ title }}</div>
    <div v-if="description" class="empty-state__desc">{{ description }}</div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}
.empty-state__icon {
  margin-bottom: 16px;
  opacity: 0.6;
}
.empty-state__title {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.empty-state__desc {
  font-size: 12px;
  color: var(--text-muted);
  max-width: 280px;
  line-height: 1.5;
}
</style>
