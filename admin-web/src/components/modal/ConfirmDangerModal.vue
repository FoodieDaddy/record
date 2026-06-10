<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  visible: boolean
  title: string
  description: string
  impact?: string
  confirmText?: string
  requireConfirmWord?: boolean
  confirmWord?: string
}>()

const emit = defineEmits(['confirm', 'cancel'])

const inputWord = ref('')
const canConfirm = computed(() => {
  if (!props.requireConfirmWord) return true
  return inputWord.value === (props.confirmWord || 'DELETE')
})

function handleCancel() {
  inputWord.value = ''
  emit('cancel')
}

function handleConfirm() {
  if (!canConfirm.value) return
  inputWord.value = ''
  emit('confirm')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="handleCancel">
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
          <div v-if="requireConfirmWord" class="danger-modal__confirm-word">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">
              输入 <span style="color:var(--color-red);font-family:var(--font-mono);font-weight:600;">{{ confirmWord || 'DELETE' }}</span> 以确认操作
            </div>
            <input
              v-model="inputWord"
              class="input-field"
              style="width:100%;"
              :placeholder="confirmWord || 'DELETE'"
            />
          </div>
        </div>
        <div class="danger-modal__actions">
          <button class="cmd-btn cmd-btn--secondary" @click="handleCancel">取消</button>
          <button class="cmd-btn cmd-btn--danger" :disabled="!canConfirm" @click="handleConfirm">
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
.danger-modal__confirm-word {
  margin-top: 16px;
}
.danger-modal__actions {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 16px 20px; border-top: 1px solid var(--border-subtle);
}
</style>
