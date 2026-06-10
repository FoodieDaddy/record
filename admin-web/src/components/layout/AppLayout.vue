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
      <button
        v-if="!app.rightPanelOpen"
        class="monitor-toggle"
        @click="app.toggleRightPanel()"
      >
        &#8249;
      </button>
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
.monitor-toggle {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 40px;
  background: rgba(10,132,255,0.08);
  border: 1px solid rgba(10,132,255,0.15);
  border-right: none;
  border-radius: 4px 0 0 4px;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  z-index: 50;
  transition: background .15s;
}
.monitor-toggle:hover {
  background: rgba(10,132,255,0.15);
  color: var(--text-secondary);
}
</style>
