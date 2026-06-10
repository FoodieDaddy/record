<template>
  <footer class="bottom-status">
    <span>v0.1.0</span>
    <span>MySQL: 3ms</span>
    <span>Redis: 1ms</span>
    <span>最后部署: 2026-06-10</span>
  </footer>
</template>

<style scoped>
.bottom-status {
  height: 32px;
  display: flex; align-items: center; gap: 24px;
  padding: 0 24px;
  border-top: 1px solid var(--border-subtle);
  font-size: var(--text-xs);
  color: var(--text-disabled);
  font-family: var(--font-mono);
}
</style>
