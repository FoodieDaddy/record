import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory('/admin'),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/login/LoginView.vue'),
      meta: { public: true }
    },
    {
      path: '/',
      component: () => import('@/components/layout/AppLayout.vue'),
      children: [
        { path: '', redirect: '/dashboard' },
        { path: 'dashboard', name: 'dashboard', component: () => import('@/views/dashboard/DashboardView.vue') },
        { path: 'users', name: 'users', component: () => import('@/views/users/UserListView.vue') },
        { path: 'users/:id', name: 'user-detail', component: () => import('@/views/users/UserDetailView.vue') },
        { path: 'formations', name: 'formations', component: () => import('@/views/formations/FormationListView.vue') },
        { path: 'formations/:id', name: 'formation-detail', component: () => import('@/views/formations/FormationDetailView.vue') },
        { path: 'traces', name: 'traces', component: () => import('@/views/traces/TraceCenterView.vue') },
        { path: 'directives/logs', name: 'directive-logs', component: () => import('@/views/directives/DirectiveLogsView.vue') },
        { path: 'directives/logs/:id', name: 'directive-detail', component: () => import('@/views/directives/DirectiveDetailView.vue') },
        { path: 'mirrors', name: 'mirrors', component: () => import('@/views/mirrors/MirrorListView.vue') },
        { path: 'mirrors/:userId', name: 'mirror-detail', component: () => import('@/views/mirrors/MirrorDetailView.vue') },
        { path: 'system/health', name: 'system-health', component: () => import('@/views/system/HealthView.vue') },
        { path: 'system/alerts', name: 'system-alerts', component: () => import('@/views/system/AlertsView.vue') },
        { path: 'admins', name: 'admins', component: () => import('@/views/admins/AdminListView.vue') },
        { path: 'admins/roles', name: 'roles', component: () => import('@/views/admins/RolesView.vue') },
        { path: 'audit', name: 'audit', component: () => import('@/views/audit/AuditLogView.vue') },
      ]
    }
  ]
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isLoggedIn) {
    return { name: 'login' }
  }
})

export default router
