<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLocaleStore } from '@/stores/locale'

const route = useRoute()
const router = useRouter()
const locale = useLocaleStore()

const routeNameKeys: Record<string, string> = {
  'dashboard': 'nav.overview',
  'users': 'nav.users',
  'user-detail': 'user.title',
  'formations': 'nav.formations',
  'formation-detail': 'formation.title',
  'traces': 'nav.traces',
  'directive-logs': 'nav.directives',
  'directive-detail': 'nav.directives',
  'mirrors': 'nav.mirrors',
  'mirror-detail': 'nav.mirrors',
  'system-health': 'nav.system',
  'system-alerts': 'nav.system',
  'admins': 'nav.admins',
  'roles': 'nav.admins',
  'audit': 'nav.audit',
}

const crumbs = computed(() => {
  const items: Array<{ name: string; path: string; clickable: boolean }> = []
  const matched = route.matched

  for (const m of matched) {
    if (m.name && routeNameKeys[m.name as string]) {
      items.push({
        name: locale.t(routeNameKeys[m.name as string]),
        path: m.path,
        clickable: m.name !== route.name,
      })
    }
  }

  if (route.name && routeNameKeys[route.name as string]) {
    const last = items[items.length - 1]
    if (!last || last.name !== locale.t(routeNameKeys[route.name as string])) {
      items.push({
        name: locale.t(routeNameKeys[route.name as string]),
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
