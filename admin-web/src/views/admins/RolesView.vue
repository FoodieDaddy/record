<template>
  <div class="base-panel">
    <div class="base-panel__header"><span class="base-panel__title">角色权限</span></div>
    <div class="base-panel__body">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
        <div style="padding:16px;background:rgba(255,255,255,0.025);border:1px solid var(--border-subtle);border-radius:6px;">
          <div style="font-size:14px;font-weight:600;color:var(--color-red);margin-bottom:4px;">SUPER_ADMIN</div>
          <div style="font-size:12px;color:var(--text-muted);">超级管理员，所有权限</div>
          <div style="font-size:11px;color:var(--text-disabled);margin-top:8px;">权限: 全部</div>
        </div>
        <div style="padding:16px;background:rgba(255,255,255,0.025);border:1px solid var(--border-subtle);border-radius:6px;">
          <div style="font-size:14px;font-weight:600;color:var(--color-primary);margin-bottom:4px;">OPERATOR</div>
          <div style="font-size:12px;color:var(--text-muted);">运营处理，用户/编队管理</div>
          <div style="font-size:11px;color:var(--text-disabled);margin-top:8px;">权限: 用户、编队、指令、镜像</div>
        </div>
        <div style="padding:16px;background:rgba(255,255,255,0.025);border:1px solid var(--border-subtle);border-radius:6px;">
          <div style="font-size:14px;font-weight:600;color:var(--text-secondary);margin-bottom:4px;">VIEWER</div>
          <div style="font-size:12px;color:var(--text-muted);">只读观察，仅查看</div>
          <div style="font-size:11px;color:var(--text-disabled);margin-top:8px;">权限: 只读</div>
        </div>
      </div>
    </div>
  </div>
</template>
