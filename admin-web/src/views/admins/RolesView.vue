<script setup lang="ts">
import { useLocaleStore } from '@/stores/locale'

const locale = useLocaleStore()
</script>

<template>
  <div class="base-panel">
    <div class="base-panel__header"><span class="base-panel__title">{{ locale.t('admins.rolePermissions') }}</span></div>
    <div class="base-panel__body">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
        <div style="padding:18px;background:var(--bg-panel);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);">
          <div style="font-size:14px;font-weight:600;color:var(--color-red);margin-bottom:4px;">{{ locale.t('role.superAdmin') }}</div>
          <div style="font-size:12px;color:var(--text-muted);">{{ locale.t('admins.superAdminDesc') }}</div>
          <div style="font-size:11px;color:var(--text-disabled);margin-top:8px;">{{ locale.t('admins.superAdminPerms') }}</div>
        </div>
        <div style="padding:18px;background:var(--bg-panel);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);">
          <div style="font-size:14px;font-weight:600;color:var(--color-primary);margin-bottom:4px;">{{ locale.t('role.operator') }}</div>
          <div style="font-size:12px;color:var(--text-muted);">{{ locale.t('admins.operatorDesc') }}</div>
          <div style="font-size:11px;color:var(--text-disabled);margin-top:8px;">{{ locale.t('admins.operatorPerms') }}</div>
        </div>
        <div style="padding:18px;background:var(--bg-panel);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);">
          <div style="font-size:14px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">{{ locale.t('role.viewer') }}</div>
          <div style="font-size:12px;color:var(--text-muted);">{{ locale.t('admins.viewerDesc') }}</div>
          <div style="font-size:11px;color:var(--text-disabled);margin-top:8px;">{{ locale.t('admins.viewerPerms') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
