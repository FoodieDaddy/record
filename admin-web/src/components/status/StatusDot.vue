<script setup lang="ts">
defineProps<{
  status: 'ok' | 'warn' | 'error' | 'running' | 'offline'
}>()
</script>

<template>
  <span class="status-dot" :class="`status-dot--${status}`" />
</template>

<style scoped>
.status-dot {
  width: 6px; height: 6px; border-radius: 50%; display: inline-block;
}
.status-dot--ok { background: var(--color-green); }
.status-dot--warn { background: var(--color-orange); }
.status-dot--error { background: var(--color-red); }
.status-dot--running { background: var(--color-primary); }
.status-dot--offline { background: var(--text-disabled); }
</style>
