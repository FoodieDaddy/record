<script setup lang="ts">
defineProps<{
  visible: boolean
  title: string
  description: string
  impact?: string
  confirmText?: string
}>()

const emit = defineEmits(['confirm', 'cancel'])
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="emit('cancel')">
      <div class="danger-modal">
        <div class="danger-modal__header">
          <div class="danger-modal__title">{{ title }}</div>
        </div>
        <div class="danger-modal__body">
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;">{{ description }}</p>
          <div v-if="impact" class="danger-modal__impact">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">影响范围</div>
            <div style="font-size:12px;color:var(--text-secondary);">{{ impact }}</div>
          </div>
        </div>
        <div class="danger-modal__actions">
          <button class="cmd-btn cmd-btn--secondary" @click="emit('cancel')">取消</button>
          <button class="cmd-btn cmd-btn--danger" @click="emit('confirm')">
            {{ confirmText || '确认' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.danger-modal {
  background: var(--bg-elevated);
  border: 1px solid rgba(255,69,58,0.20);
  clip-path: var(--clip-panel);
  width: 480px; max-width: 90vw;
}
.danger-modal__header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255,69,58,0.10);
}
.danger-modal__title { font-size: 16px; font-weight: 600; color: var(--color-red); }
.danger-modal__body { padding: 20px; }
.danger-modal__impact {
  padding: 12px;
  background: rgba(255,69,58,0.05);
  border: 1px solid rgba(255,69,58,0.10);
  border-radius: 4px; margin-top: 12px;
}
.danger-modal__actions {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 16px 20px; border-top: 1px solid var(--border-subtle);
}
</style>
