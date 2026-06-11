import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

type Role = 'SUPER_ADMIN' | 'OPERATOR' | 'VIEWER'

/**
 * 角色权限映射：每个角色可访问的路由名称列表
 * SUPER_ADMIN 用 '*' 表示拥有所有权限
 */
const rolePermissions: Record<Role, string[]> = {
  SUPER_ADMIN: ['*'],
  OPERATOR: [
    'dashboard', 'users', 'user-detail', 'formations', 'formation-detail',
    'traces', 'directive-logs', 'directive-detail', 'mirrors', 'mirror-detail',
    'profile',
  ],
  VIEWER: [
    'dashboard', 'users', 'user-detail', 'formations', 'formation-detail',
    'traces', 'directive-logs', 'directive-detail', 'mirrors', 'mirror-detail',
    'profile',
  ],
}

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
        { path: 'dashboard', name: 'dashboard', component: () => import('@/views/dashboard/DashboardView.vue'), meta: { roles: ['SUPER_ADMIN', 'OPERATOR', 'VIEWER'] } },
        { path: 'users', name: 'users', component: () => import('@/views/users/UserListView.vue'), meta: { roles: ['SUPER_ADMIN', 'OPERATOR', 'VIEWER'] } },
        { path: 'users/:id', name: 'user-detail', component: () => import('@/views/users/UserDetailView.vue'), meta: { roles: ['SUPER_ADMIN', 'OPERATOR', 'VIEWER'] } },
        { path: 'formations', name: 'formations', component: () => import('@/views/formations/FormationListView.vue'), meta: { roles: ['SUPER_ADMIN', 'OPERATOR', 'VIEWER'] } },
        { path: 'formations/:id', name: 'formation-detail', component: () => import('@/views/formations/FormationDetailView.vue'), meta: { roles: ['SUPER_ADMIN', 'OPERATOR', 'VIEWER'] } },
        { path: 'traces', name: 'traces', component: () => import('@/views/traces/TraceCenterView.vue'), meta: { roles: ['SUPER_ADMIN', 'OPERATOR', 'VIEWER'] } },
        { path: 'directives/logs', name: 'directive-logs', component: () => import('@/views/directives/DirectiveLogsView.vue'), meta: { roles: ['SUPER_ADMIN', 'OPERATOR', 'VIEWER'] } },
        { path: 'directives/logs/:id', name: 'directive-detail', component: () => import('@/views/directives/DirectiveDetailView.vue'), meta: { roles: ['SUPER_ADMIN', 'OPERATOR', 'VIEWER'] } },
        { path: 'mirrors', name: 'mirrors', component: () => import('@/views/mirrors/MirrorListView.vue'), meta: { roles: ['SUPER_ADMIN', 'OPERATOR', 'VIEWER'] } },
        { path: 'mirrors/:userId', name: 'mirror-detail', component: () => import('@/views/mirrors/MirrorDetailView.vue'), meta: { roles: ['SUPER_ADMIN', 'OPERATOR', 'VIEWER'] } },
        { path: 'system/health', name: 'system-health', component: () => import('@/views/system/HealthView.vue'), meta: { roles: ['SUPER_ADMIN'] } },
        { path: 'system/behavior', name: 'system-behavior', component: () => import('@/views/system/BehaviorView.vue'), meta: { roles: ['SUPER_ADMIN'] } },
        { path: 'system/alerts', name: 'system-alerts', component: () => import('@/views/system/AlertsView.vue'), meta: { roles: ['SUPER_ADMIN'] } },
        { path: 'admins', name: 'admins', component: () => import('@/views/admins/AdminListView.vue'), meta: { roles: ['SUPER_ADMIN'] } },
        { path: 'admins/:id', name: 'admin-detail', component: () => import('@/views/admins/AdminDetailView.vue'), meta: { roles: ['SUPER_ADMIN'] } },
        { path: 'admins/roles', name: 'roles', component: () => import('@/views/admins/RolesView.vue'), meta: { roles: ['SUPER_ADMIN'] } },
        { path: 'audit', name: 'audit', component: () => import('@/views/audit/AuditLogView.vue'), meta: { roles: ['SUPER_ADMIN'] } },
        { path: 'profile', name: 'profile', component: () => import('@/views/profile/AdminProfileView.vue'), meta: { roles: ['SUPER_ADMIN', 'OPERATOR', 'VIEWER'] } },
        { path: ':pathMatch(.*)*', name: 'not-found', component: () => import('@/views/system/NotFoundView.vue'), meta: { roles: ['SUPER_ADMIN', 'OPERATOR', 'VIEWER'] } },
      ]
    }
  ]
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  // 未登录 → 重定向到登录页
  if (!to.meta.public && !auth.isLoggedIn) {
    return { name: 'login' }
  }

  // 已登录但角色权限不足 → 重定向到 dashboard
  if (to.meta.roles && auth.role) {
    const allowedRoles = to.meta.roles as string[]
    if (!allowedRoles.includes(auth.role)) {
      return { name: 'dashboard' }
    }
  }
})

export default router
