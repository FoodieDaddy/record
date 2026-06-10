<script setup lang="ts">
defineProps<{
  label: string
  kicker?: string
  value: string | number
  trend?: string
  trendType?: 'up' | 'down' | 'neutral'
}>()
</script>

<template>
  <div class="stat-card">
    <div class="stat-card__label">{{ label }}</div>
    <div v-if="kicker" class="stat-card__kicker">{{ kicker }}</div>
    <div class="stat-card__value">{{ value }}</div>
    <div
      v-if="trend"
      class="stat-card__trend"
      :class="`stat-card__trend--${trendType || 'neutral'}`"
    >
      {{ trend }}
    </div>
  </div>
</template>
