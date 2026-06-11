<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useLocaleStore } from '@/stores/locale'

const route = useRoute()
const router = useRouter()
const app = useAppStore()
const locale = useLocaleStore()

const navGroups = computed(() => [
  {
    title: locale.t('group.operations'),
    items: [
      { name: locale.t('nav.overview'), path: '/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4' },
      { name: locale.t('nav.users'), path: '/users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z' },
      { name: locale.t('nav.formations'), path: '/formations', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
      { name: locale.t('nav.traces'), path: '/traces', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    ]
  },
  {
    title: locale.t('group.data'),
    items: [
      { name: locale.t('nav.directives'), path: '/directives/logs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { name: locale.t('nav.mirrors'), path: '/mirrors', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
    ]
  },
  {
    title: locale.t('group.system'),
    items: [
      { name: locale.t('nav.system'), path: '/system/health', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' },
      { name: locale.t('nav.behavior'), path: '/system/behavior', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    ]
  },
  {
    title: locale.t('group.access'),
    items: [
      { name: locale.t('nav.admins'), path: '/admins', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
      { name: locale.t('nav.audit'), path: '/audit', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
      { name: locale.t('nav.profile'), path: '/profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    ]
  },
])

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<template>
  <aside class="nav-sidebar" :class="{ collapsed: app.sidebarCollapsed }">
    <div class="nav-brand" @click="router.push('/dashboard')">
      <div class="nav-brand__icon">
        <svg viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="14" stroke="var(--color-primary)" stroke-width="1.5" opacity="0.25" />
          <circle cx="18" cy="18" r="8" stroke="var(--color-primary)" stroke-width="1" opacity="0.40" />
          <circle cx="18" cy="18" r="3.5" fill="var(--color-primary)" opacity="0.70" />
        </svg>
      </div>
      <div v-if="!app.sidebarCollapsed" class="nav-brand__text">
        <div class="nav-brand__title">{{ locale.t('brand.title') }}</div>
        <div class="nav-brand__kicker">{{ locale.isZh ? '轨道舰桥' : 'Orbital Bridge' }}</div>
      </div>
    </div>

    <nav class="nav-list">
      <div v-for="group in navGroups" :key="group.title" class="nav-group">
        <div v-if="!app.sidebarCollapsed" class="nav-group__title">{{ group.title }}</div>
        <div
          v-for="item in group.items"
          :key="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
          @click="router.push(item.path)"
        >
          <div class="nav-item__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path :d="item.icon" />
            </svg>
          </div>
          <div v-if="!app.sidebarCollapsed" class="nav-item__text">
            <div class="nav-item__name">{{ item.name }}</div>
          </div>
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
  background: rgba(255, 255, 255, 0.58);
  border-right: 1px solid rgba(255, 255, 255, 0.30);
  box-shadow: 2px 0 16px rgba(31, 52, 88, 0.04);
  display: flex;
  flex-direction: column;
  transition: width .2s, var(--theme-transition);
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}
.nav-sidebar.collapsed { width: var(--sidebar-collapsed); }

.nav-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 18px;
  cursor: pointer;
  border-bottom: 1px solid rgba(130, 150, 180, 0.08);
}
.nav-brand__icon svg { width: 36px; height: 36px; }
.nav-brand__title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  letter-spacing: 0.2px;
}
.nav-brand__kicker {
  font-size: 10px;
  color: var(--text-disabled);
  letter-spacing: 0.5px;
  margin-top: 1px;
}

.nav-list {
  flex: 1; padding: 8px 0;
  display: flex; flex-direction: column;
  overflow-y: auto;
}
.nav-list::-webkit-scrollbar { width: 4px; }
.nav-list::-webkit-scrollbar-track { background: transparent; }
.nav-list::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 4px; }

.nav-group {
  padding: 0 10px;
  margin-bottom: 4px;
}
.nav-group__title {
  font-size: 10px;
  font-weight: 600;
  color: var(--nav-group-title);
  letter-spacing: 0.5px;
  padding: 14px 14px 6px;
  text-transform: uppercase;
}

.nav-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; border-radius: 14px;
  cursor: pointer;
  transition: background-color .15s, color .15s;
  color: var(--nav-item-color);
  margin-bottom: 2px;
  height: 44px;
}
.nav-item:hover {
  background: var(--nav-item-hover-bg);
  color: var(--nav-item-hover-color);
}
.nav-item.active {
  background: var(--nav-item-active-bg);
  color: var(--nav-item-active-color);
}
.nav-item__icon {
  width: 20px; height: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-item__icon svg {
  width: 18px; height: 18px;
}
.nav-item.active .nav-item__icon {
  color: var(--color-primary);
}
.nav-item__name { font-size: 13px; font-weight: 600; }

.nav-footer {
  padding: 14px 18px;
  border-top: 1px solid rgba(130, 150, 180, 0.08);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--text-disabled);
  transition: color .15s;
}
.nav-footer:hover { color: var(--text-muted); }
</style>
