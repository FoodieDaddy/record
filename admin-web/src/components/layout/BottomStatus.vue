<template>
  <footer class="bottom-status">
    <span class="bottom-status__item">
      <span class="bottom-status__dot dot--ok" />
      <span>API 正常</span>
    </span>
    <span class="bottom-status__item">v0.1.0</span>
    <span class="bottom-status__item">local</span>
  </footer>
</template>

<style scoped>
.bottom-status {
  height: 28px;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 24px;
  border-top: 1px solid rgba(255,255,255,0.03);
  font-size: 10px;
  color: var(--text-disabled);
  font-family: var(--font-mono);
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
