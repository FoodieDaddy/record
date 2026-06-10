<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const routeNames: Record<string, string> = {
  'dashboard': '基地总览',
  'users': '航船用户',
  'user-detail': '用户详情',
  'formations': '任务编队',
  'formation-detail': '编队详情',
  'traces': '航迹中心',
  'directive-logs': '指令日志',
  'directive-detail': '指令详情',
  'mirrors': '镜像档案',
  'mirror-detail': '镜像详情',
  'system-health': '系统监控',
  'system-alerts': '告警中心',
  'admins': '管理员',
  'roles': '角色权限',
  'audit': '审计日志',
}

const crumbs = computed(() => {
  const items: Array<{ name: string; path: string; clickable: boolean }> = []
  const matched = route.matched

  for (const m of matched) {
    if (m.name && routeNames[m.name as string]) {
      items.push({
        name: routeNames[m.name as string],
        path: m.path,
        clickable: m.name !== route.name,
      })
    }
  }

  // 当前路由未在 matched 中时追加
  if (route.name && routeNames[route.name as string]) {
    const last = items[items.length - 1]
    if (!last || last.name !== routeNames[route.name as string]) {
      items.push({
        name: routeNames[route.name as string],
        path: route.path,
        clickable: false,
      })
    }
  }

  return items
})

function navigate(path: string) {
  router.push(path)
}
</script>

<template>
  <nav v-if="crumbs.length > 1" class="breadcrumb">
    <span
      v-for="(c, i) in crumbs"
      :key="i"
      class="breadcrumb__item"
      :class="{ clickable: c.clickable }"
      @click="c.clickable && navigate(c.path)"
    >
      <span v-if="i > 0" class="breadcrumb__sep">/</span>
      {{ c.name }}
    </span>
  </nav>
</template>

<style scoped>
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0;
  font-size: 12px;
  color: var(--text-muted);
}
.breadcrumb__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.breadcrumb__item.clickable {
  cursor: pointer;
  color: var(--text-secondary);
}
.breadcrumb__item.clickable:hover {
  color: var(--color-primary);
}
.breadcrumb__sep {
  color: var(--text-disabled);
  margin: 0 2px;
}
</style>
