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
      { name: locale.t('nav.overview'), path: '/dashboard' },
      { name: locale.t('nav.users'), path: '/users' },
      { name: locale.t('nav.formations'), path: '/formations' },
      { name: locale.t('nav.traces'), path: '/traces' },
    ]
  },
  {
    title: locale.t('group.data'),
    items: [
      { name: locale.t('nav.directives'), path: '/directives/logs' },
      { name: locale.t('nav.mirrors'), path: '/mirrors' },
    ]
  },
  {
    title: locale.t('group.system'),
    items: [
      { name: locale.t('nav.system'), path: '/system/health' },
    ]
  },
  {
    title: locale.t('group.access'),
    items: [
      { name: locale.t('nav.admins'), path: '/admins' },
      { name: locale.t('nav.audit'), path: '/audit' },
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
      <div v-for="group in navGroups" :key="group.title" class="nav-group">
        <div v-if="!app.sidebarCollapsed" class="nav-group__title">{{ group.title }}</div>
        <div
          v-for="item in group.items"
          :key="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
          @click="router.push(item.path)"
        >
          <div class="nav-item__dot" />
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
  background: linear-gradient(180deg, rgba(4,8,16,0.98), rgba(2,4,12,0.98));
  border-right: 1px solid rgba(10,132,255,0.10);
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
  border-bottom: 1px solid rgba(10,132,255,0.08);
  background: rgba(10,132,255,0.02);
}
.nav-brand__icon svg { width: 32px; height: 32px; }
.nav-brand__title { font-size: 14px; font-weight: 600; color: var(--text-main); }
.nav-brand__kicker {
  font-size: 10px; color: var(--text-disabled);
  letter-spacing: 1px; font-family: var(--font-mono);
}

.nav-list {
  flex: 1; padding: 8px 0;
  display: flex; flex-direction: column;
  overflow-y: auto;
}
.nav-list::-webkit-scrollbar { width: 4px; }
.nav-list::-webkit-scrollbar-track { background: transparent; }
.nav-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 2px; }

.nav-group {
  padding: 0 8px;
  margin-bottom: 4px;
}
.nav-group__title {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-disabled);
  letter-spacing: 1px;
  padding: 12px 12px 6px;
  text-transform: uppercase;
}

.nav-item {
  display: flex; align-items: center; gap: 12px;
  padding: 9px 12px; border-radius: 4px;
  cursor: pointer; border-left: 2px solid transparent;
  transition: background-color .15s, border-color .15s;
  color: var(--text-muted);
}
.nav-item:hover { background: rgba(10,132,255,0.04); color: var(--text-secondary); }
.nav-item.active {
  background: rgba(10,132,255,0.08);
  border-left-color: var(--color-cyan);
  color: var(--color-cyan);
  box-shadow: inset 2px 0 8px rgba(0,200,255,0.06);
}
.nav-item__dot {
  width: 6px; height: 6px; border-radius: 50%;
  flex-shrink: 0; background: currentColor; opacity: 0.4;
}
.nav-item.active .nav-item__dot {
  opacity: 1; box-shadow: 0 0 8px rgba(0,200,255,0.4);
  animation: pulse-glow 2s ease-in-out infinite;
}
.nav-item__name { font-size: 13px; font-weight: 500; }

.nav-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(10,132,255,0.08);
  background: rgba(10,132,255,0.02);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--text-muted);
}
.nav-footer:hover { color: var(--text-secondary); }
</style>
