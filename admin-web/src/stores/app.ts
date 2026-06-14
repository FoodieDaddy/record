import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(localStorage.getItem('admin_sidebar') === '1')
  const rightPanelOpen = ref(false)

  function toggleSidebar() { sidebarCollapsed.value = !sidebarCollapsed.value }
  function toggleRightPanel() { rightPanelOpen.value = !rightPanelOpen.value }

  watch(sidebarCollapsed, (v) => {
    localStorage.setItem('admin_sidebar', v ? '1' : '0')
  })

  return { sidebarCollapsed, rightPanelOpen, toggleSidebar, toggleRightPanel }
})
