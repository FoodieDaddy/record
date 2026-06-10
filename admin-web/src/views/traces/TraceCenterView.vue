<template>
  <div>
    <div class="grid-3" style="margin-bottom:16px;">
      <div class="base-panel" style="min-height:300px;">
        <div class="base-panel__header"><span class="base-panel__title">脉冲趋势</span></div>
        <div class="base-panel__body" style="display:flex;align-items:center;justify-content:center;min-height:240px;color:var(--text-muted);font-size:12px;">折线图区域</div>
      </div>
      <div class="base-panel" style="min-height:300px;">
        <div class="base-panel__header"><span class="base-panel__title">封存航程</span></div>
        <div class="base-panel__body" style="display:flex;align-items:center;justify-content:center;min-height:240px;color:var(--text-muted);font-size:12px;">柱状图区域</div>
      </div>
      <div class="base-panel" style="min-height:300px;">
        <div class="base-panel__header"><span class="base-panel__title">活跃排行</span></div>
        <div class="base-panel__body" style="display:flex;align-items:center;justify-content:center;min-height:240px;color:var(--text-muted);font-size:12px;">条形图区域</div>
      </div>
    </div>
    <div class="base-panel">
      <div class="base-panel__header"><span class="base-panel__title">全站脉冲记录</span></div>
      <div class="base-panel__body" style="color:var(--text-muted);font-size:12px;">接入后端 API 后渲染脉冲记录表</div>
    </div>
  </div>
</template>
