<script setup lang="ts">
import { useLocaleStore } from '@/stores/locale'

const locale = useLocaleStore()
</script>

<template>
  <footer class="bottom-status">
    <span class="bottom-status__item">
      <span class="bottom-status__dot dot--ok" />
      <span>{{ locale.t('common.apiOk') }}</span>
    </span>
    <span class="bottom-status__item">v0.1.0</span>
    <span class="bottom-status__item">{{ locale.t('common.local') }}</span>
  </footer>
</template>

<style scoped>
.bottom-status {
  height: 28px;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 28px;
  border-top: 1px solid var(--bottom-border);
  font-size: 10px;
  color: var(--bottom-color);
  font-family: var(--font-mono);
  transition: var(--theme-transition);
}
.bottom-status__item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.bottom-status__dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
}
.dot--ok { background: var(--color-green); }
</style>
