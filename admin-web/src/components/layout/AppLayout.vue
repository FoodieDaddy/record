<script setup lang="ts">
import NavSidebar from './NavSidebar.vue'
import TopStatusBar from './TopStatusBar.vue'
import RightMonitor from './RightMonitor.vue'
import BottomStatus from './BottomStatus.vue'
import { useAppStore } from '@/stores/app'
import { RouterView } from 'vue-router'

const app = useAppStore()
</script>

<template>
  <div class="app-layout">
    <NavSidebar />
    <div class="app-main" :class="{ 'sidebar-collapsed': app.sidebarCollapsed }">
      <TopStatusBar />
      <div class="app-content">
        <div class="app-workspace">
          <RouterView v-slot="{ Component }">
            <transition name="page-fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </RouterView>
        </div>
        <RightMonitor v-if="app.rightPanelOpen" />
      </div>
      <BottomStatus />
    </div>
  </div>
</template>

<style scoped>
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity .15s ease;
}
.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}
.app-layout { min-height: 100vh; }
.app-main {
  margin-left: var(--sidebar-width);
  transition: margin-left .2s;
  display: flex; flex-direction: column; min-height: 100vh;
}
.app-main.sidebar-collapsed { margin-left: var(--sidebar-collapsed); }
.app-content { display: flex; flex: 1; }
.app-workspace { flex: 1; padding: 24px; min-width: 0; }
</style>
