<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'

const route = useRoute()
const router = useRouter()
const app = useAppStore()

const navItems = [
  { name: '基地总览', kicker: 'OVERVIEW', path: '/dashboard' },
  { name: '航船用户', kicker: 'USERS', path: '/users' },
  { name: '任务编队', kicker: 'FORMATIONS', path: '/formations' },
  { name: '航迹中心', kicker: 'TRACES', path: '/traces' },
  { name: '指令日志', kicker: 'DIRECTIVES', path: '/directives/logs' },
  { name: '镜像档案', kicker: 'MIRRORS', path: '/mirrors' },
  { name: '系统监控', kicker: 'SYSTEM', path: '/system/health' },
  { name: '管理员权限', kicker: 'ADMINS', path: '/admins' },
  { name: '审计日志', kicker: 'AUDIT', path: '/audit' },
]

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<template>
  <aside class="nav-sidebar" :class="{ collapsed: app.sidebarCollapsed }">
    <div class="nav-brand" @click="router.push('/dashboard')">
      <div class="nav-brand__icon">
        <svg viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" stroke="rgba(0,200,255,0.3)" stroke-width="1" />
          <circle cx="16" cy="16" r="8" stroke="rgba(10,132,255,0.4)" stroke-width="1" />
          <circle cx="16" cy="16" r="3" fill="rgba(0,200,255,0.6)" />
        </svg>
      </div>
      <div v-if="!app.sidebarCollapsed" class="nav-brand__text">
        <div class="nav-brand__title">基地总控台</div>
        <div class="nav-brand__kicker">COMMAND BASE</div>
      </div>
    </div>

    <nav class="nav-list">
      <div
        v-for="item in navItems"
        :key="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
        @click="router.push(item.path)"
      >
        <div class="nav-item__dot" />
        <div v-if="!app.sidebarCollapsed" class="nav-item__text">
          <div class="nav-item__name">{{ item.name }}</div>
          <div class="nav-item__kicker">{{ item.kicker }}</div>
        </div>
      </div>
    </nav>

    <div class="nav-footer" @click="app.toggleSidebar">
      <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
        <path
          :d="app.sidebarCollapsed ? 'M7 4l6 6-6 6' : 'M13 4l-6 6 6 6'"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </div>
  </aside>
</template>

<style scoped>
.nav-sidebar {
  width: var(--sidebar-width);
  height: 100vh;
  background: var(--bg-elevated);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  transition: width .2s;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
}
.nav-sidebar.collapsed { width: var(--sidebar-collapsed); }
.nav-sidebar::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 1px;
  background: linear-gradient(180deg, rgba(10,132,255,0.12), transparent 50%, rgba(10,132,255,0.06));
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px;
  cursor: pointer;
}
.nav-brand__icon svg { width: 32px; height: 32px; }
.nav-brand__title { font-size: 14px; font-weight: 600; color: var(--text-main); }
.nav-brand__kicker {
  font-size: 10px; color: var(--text-disabled);
  letter-spacing: 1px; font-family: var(--font-mono);
}

.nav-list {
  flex: 1; padding: 8px;
  display: flex; flex-direction: column; gap: 2px;
  overflow-y: auto;
}

.nav-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: 6px;
  cursor: pointer; border-left: 2px solid transparent;
  transition: background-color .15s, border-color .15s;
  color: var(--text-muted);
}
.nav-item:hover { background: rgba(10,132,255,0.04); color: var(--text-secondary); }
.nav-item.active {
  background: rgba(10,132,255,0.08);
  border-left-color: var(--color-cyan);
  color: var(--color-cyan);
}
.nav-item__dot {
  width: 6px; height: 6px; border-radius: 50%;
  flex-shrink: 0; background: currentColor; opacity: 0.4;
}
.nav-item.active .nav-item__dot {
  opacity: 1; box-shadow: 0 0 8px rgba(0,200,255,0.4);
}
.nav-item__name { font-size: 13px; font-weight: 500; }
.nav-item__kicker {
  font-size: 10px; font-family: var(--font-mono);
  letter-spacing: 0.5px; opacity: 0.6;
}

.nav-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-subtle);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--text-muted);
}
.nav-footer:hover { color: var(--text-secondary); }
</style>
