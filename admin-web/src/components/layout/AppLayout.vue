<script setup lang="ts">
import { ref } from 'vue'
import NavSidebar from './NavSidebar.vue'
import TopStatusBar from './TopStatusBar.vue'
import RightMonitor from './RightMonitor.vue'
import BottomStatus from './BottomStatus.vue'
import ErrorBoundary from '@/components/feedback/ErrorBoundary.vue'
import { useAppStore } from '@/stores/app'
import { useGlobalShortcuts } from '@/composables/useGlobalShortcuts'
import { useRoute } from 'vue-router'
import { RouterView } from 'vue-router'
import { computed } from 'vue'

const app = useAppStore()
const route = useRoute()

const isDashboard = computed(() => route.path === '/dashboard')

// 全局快捷键：Esc 关闭右侧监控面板
useGlobalShortcuts([
  { key: 'Escape', handler: () => { if (app.rightPanelOpen) app.toggleRightPanel() } },
])
</script>

<template>
  <div class="app-layout">
    <NavSidebar />
    <div class="app-main" :class="{ 'sidebar-collapsed': app.sidebarCollapsed }">
      <TopStatusBar />
      <div class="app-workspace" :class="{ 'app-workspace--dashboard': isDashboard }">
        <ErrorBoundary>
          <RouterView v-slot="{ Component }">
            <transition name="page-fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </RouterView>
        </ErrorBoundary>
      </div>
      <BottomStatus />
    </div>
    <RightMonitor />
  </div>
</template>

<style scoped>
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity .18s ease, transform .18s ease;
}
.page-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-fade-leave-to {
  opacity: 0;
}
.app-layout { height: 100vh; overflow: hidden; }
.app-main {
  margin-left: var(--sidebar-width);
  transition: margin-left .2s;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-base);
}
.app-main.sidebar-collapsed { margin-left: var(--sidebar-collapsed); }
.app-workspace {
  flex: 1;
  min-height: 0;
  padding: 24px 28px;
  overflow-y: auto;
}
.app-workspace--dashboard {
  padding: 20px 24px;
  overflow: hidden;
}
</style>
