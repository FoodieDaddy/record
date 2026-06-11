<script setup lang="ts">
import { useLocaleStore } from '@/stores/locale'

const props = withDefaults(defineProps<{
  visible: boolean
  title?: string
  width?: string
}>(), {
  title: '',
  width: '600px'
})

const emit = defineEmits(['update:visible'])
const locale = useLocaleStore()

function closeModal() {
  emit('update:visible', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade-scale">
      <div v-if="visible" class="hud-modal-overlay" @click.self="closeModal">
        <div class="hud-modal" :style="{ maxWidth: width }">
          <div class="hud-modal__header">
            <span class="hud-modal__title">{{ title }}</span>
            <button class="hud-modal__close" @click="closeModal" :title="locale.t('common.cancel')">&times;</button>
          </div>
          <div class="hud-modal__body">
            <slot />
          </div>
          <div class="hud-modal__footer">
            <slot name="footer">
              <button class="cmd-btn cmd-btn--primary" @click="closeModal">
                {{ locale.t('common.confirm') }}
              </button>
            </slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.hud-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.hud-modal {
  width: 90%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(255, 255, 255, 0.60));
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 24px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hud-modal__header {
  height: 52px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.15));
}

.hud-modal__title {
  font-size: 14px;
  font-weight: 700;
  color: #1E293B;
}

.hud-modal__close {
  background: transparent;
  border: none;
  font-size: 22px;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1;
  transition: color .15s;
}

.hud-modal__close:hover {
  color: var(--text-main);
}

.hud-modal__body {
  padding: 24px;
  overflow-y: auto;
  max-height: 70vh;
}

.hud-modal__footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.25);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Transition Animations */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 0.25s ease;
}

.fade-scale-enter-active .hud-modal,
.fade-scale-leave-active .hud-modal {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
}

.fade-scale-enter-from .hud-modal {
  transform: scale(0.92) translateY(10px);
  opacity: 0;
}

.fade-scale-leave-to .hud-modal {
  transform: scale(0.96) translateY(-4px);
  opacity: 0;
}
</style>
