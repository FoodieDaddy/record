<script setup lang="ts">
defineProps<{
  status: 'ok' | 'warn' | 'error' | 'running' | 'offline'
  label: string
}>()
</script>

<template>
  <span class="status-pill" :class="`status-pill--${status}`">
    <span class="status-pill__dot" />
    {{ label }}
  </span>
</template>
