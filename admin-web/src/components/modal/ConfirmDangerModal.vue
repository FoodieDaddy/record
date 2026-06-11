<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLocaleStore } from '@/stores/locale'

const locale = useLocaleStore()

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
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">{{ locale.isZh ? '影响范围' : 'Impact' }}</div>
            <div style="font-size:12px;color:var(--text-secondary);">{{ impact }}</div>
          </div>
          <div v-if="requireConfirmWord" class="danger-modal__confirm-word">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">
              {{ locale.isZh ? '输入' : 'Type' }} <span style="color:var(--color-red);font-family:var(--font-mono);font-weight:600;">{{ confirmWord || 'DELETE' }}</span> {{ locale.isZh ? '以确认操作' : 'to confirm' }}
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
          <button class="cmd-btn cmd-btn--secondary" @click="handleCancel">{{ locale.isZh ? '取消' : 'Cancel' }}</button>
          <button class="cmd-btn cmd-btn--danger" :disabled="!canConfirm" @click="handleConfirm">
            {{ confirmText || (locale.isZh ? '确认' : 'Confirm') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(27, 36, 48, 0.24);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.danger-modal {
  position: relative;
  background: linear-gradient(180deg, rgba(255,255,255,0.88), rgba(255,255,255,0.78));
  border: 1px solid rgba(255, 255, 255, 0.46);
  border-radius: 24px;
  width: 480px; max-width: 90vw;
  box-shadow: 0 24px 56px rgba(31, 52, 88, 0.12), 0 4px 12px rgba(31, 52, 88, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(24px);
  overflow: hidden;
}
.danger-modal__header {
  padding: 18px 22px;
  border-bottom: 1px solid rgba(226, 109, 109, 0.08);
}
.danger-modal__title { font-size: 16px; font-weight: 600; color: var(--color-red); }
.danger-modal__body { padding: 22px; }
.danger-modal__impact {
  padding: 14px;
  background: rgba(226, 109, 109, 0.04);
  border: 1px solid rgba(226, 109, 109, 0.10);
  border-radius: var(--radius-sm); margin-top: 14px;
}
.danger-modal__confirm-word {
  margin-top: 16px;
}
.danger-modal__actions {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 16px 22px; border-top: 1px solid var(--border-subtle);
}
</style>
