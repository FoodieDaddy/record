<script setup lang="ts">
import { RouterView } from 'vue-router'
import ToastContainer from '@/components/feedback/ToastContainer.vue'
import { useThemeStore } from '@/stores/theme'

// 初始化主题，确保存在即应用
const theme = useThemeStore()
</script>

<template>
  <RouterView />
  <ToastContainer />
</template>
