import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(false)
  const rightPanelOpen = ref(false)

  function toggleSidebar() { sidebarCollapsed.value = !sidebarCollapsed.value }
  function toggleRightPanel() { rightPanelOpen.value = !rightPanelOpen.value }

  return { sidebarCollapsed, rightPanelOpen, toggleSidebar, toggleRightPanel }
})
