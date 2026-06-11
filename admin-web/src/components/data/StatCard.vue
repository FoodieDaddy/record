<script setup lang="ts">
defineProps<{
  label: string
  kicker?: string
  value: string | number
  trend?: string
  trendType?: 'up' | 'down' | 'neutral'
  color?: string
  icon?: string
}>()
</script>

<template>
  <div class="stat-card">
    <div class="stat-card__icon" :style="color ? { background: `linear-gradient(135deg, ${color}18, ${color}10)`, color } : {}">
      <svg v-if="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path :d="icon" />
      </svg>
    </div>
    <div class="stat-card__info">
      <span class="stat-card__label">{{ label }}</span>
      <span class="stat-card__value">{{ value }}</span>
      <span v-if="trend" class="stat-card__trend" :class="`stat-card__trend--${trendType || 'neutral'}`">{{ trend }}</span>
    </div>
  </div>
</template>
