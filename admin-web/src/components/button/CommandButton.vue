<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  disabled?: boolean
  loading?: boolean
}>()

defineEmits(['click'])
</script>

<template>
  <button
    class="cmd-btn"
    :class="`cmd-btn--${variant || 'primary'}`"
    :disabled="disabled || loading"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>
