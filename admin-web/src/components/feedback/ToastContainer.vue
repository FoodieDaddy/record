<script setup lang="ts">
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <Teleport to="body">
    <div class="toast-container">
      <transition-group name="toast">
        <div
          v-for="t in toast.toasts"
          :key="t.id"
          class="toast-item"
          :class="`toast-item--${t.type}`"
          @click="toast.remove(t.id)"
        >
          <span class="toast-dot" />
          <span class="toast-message">{{ t.message }}</span>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  min-width: 280px;
  max-width: 420px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.46);
  border-radius: 16px;
  font-size: 13px;
  color: var(--text-main);
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 16px 48px rgba(31, 52, 88, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(18px);
}

.toast-item--success { border-left: 3px solid var(--color-green); }
.toast-item--error { border-left: 3px solid var(--color-red); }
.toast-item--warn { border-left: 3px solid var(--color-orange); }
.toast-item--info { border-left: 3px solid var(--color-primary); }

.toast-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.toast-item--success .toast-dot { background: var(--color-green); }
.toast-item--error .toast-dot { background: var(--color-red); }
.toast-item--warn .toast-dot { background: var(--color-orange); }
.toast-item--info .toast-dot { background: var(--color-primary); }

.toast-message {
  flex: 1;
  line-height: 1.4;
}

.toast-enter-active {
  animation: toast-in .25s ease;
}
.toast-leave-active {
  animation: toast-out .18s ease forwards;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateX(30px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes toast-out {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(30px); }
}
</style>
