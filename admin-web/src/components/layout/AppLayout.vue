<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { RouterView } from 'vue-router'
import NavSidebar from './NavSidebar.vue'
import TopStatusBar from './TopStatusBar.vue'
import RightMonitor from './RightMonitor.vue'
import BottomStatus from './BottomStatus.vue'
import ErrorBoundary from '@/components/feedback/ErrorBoundary.vue'
import { useAppStore } from '@/stores/app'
import { useGlobalShortcuts } from '@/composables/useGlobalShortcuts'
import { useIdleDetection } from '@/composables/useIdleDetection'

const app = useAppStore()
const route = useRoute()

const isDashboard = computed(() => route.path === '/dashboard')

// 全局快捷键：Esc 关闭右侧监控面板
useGlobalShortcuts([
  { key: 'Escape', handler: () => { if (app.rightPanelOpen) app.toggleRightPanel() } },
])

// 闲置检测
const { showWarning, countdown, handleStay, handleLogout } = useIdleDetection()
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

    <!-- 闲置警告弹窗 -->
    <teleport to="body">
      <div v-if="showWarning" class="idle-overlay">
        <div class="idle-dialog">
          <div class="idle-icon">
            <svg viewBox="0 0 24 24" fill="none" width="36" height="36" stroke="var(--color-orange)" stroke-width="1.5">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 class="idle-title">即将超时登出</h3>
          <p class="idle-desc">由于长时间未操作，系统将在 <strong>{{ countdown }}</strong> 秒后自动登出</p>
          <div class="idle-actions">
            <button class="cmd-btn cmd-btn--primary" @click="handleStay">继续操作</button>
            <button class="cmd-btn cmd-btn--secondary" @click="handleLogout">立即登出</button>
          </div>
        </div>
      </div>
    </teleport>
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

/* 闲置警告弹窗 */
.idle-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}
.idle-dialog {
  background: var(--bg-card, #1a1a2e);
  border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
  border-radius: 12px;
  padding: 32px 40px;
  text-align: center;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
.idle-icon { margin-bottom: 12px; }
.idle-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-main, #e0e0e0);
  margin: 0 0 8px;
}
.idle-desc {
  font-size: 14px;
  color: var(--text-muted, #888);
  margin: 0 0 24px;
  line-height: 1.6;
}
.idle-desc strong {
  color: var(--color-orange, #f59e0b);
  font-size: 16px;
}
.idle-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
