# 镜像页重构：全息观测舱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将镜像页从「人格终端」升级为「全息观测舱」，实现完整的舱内体验闭环。

**Architecture:** 原地重构 `pages/mirror/index.*`，通过 `viewMode` 状态切换实现 main/calibration 双视图。雷达图扩展 hero 模式居中显示，分享海报 Canvas 完全重绘。

**Tech Stack:** 微信小程序原生框架, Canvas 2D API, 现有 radar-chart / mbti-swipe-test / mbti-picker-modal 组件

---

## File Structure

| 文件 | 操作 | 职责 |
|---|---|---|
| `miniprogram/pages/mirror/index.wxml` | 重写 | 双视图模板：main 三区布局 + calibration 全屏校准 |
| `miniprogram/pages/mirror/index.wxss` | 重写 | sr-* 令牌、动效守卫、校准视图样式 |
| `miniprogram/pages/mirror/index.js` | 修改 | viewMode 状态、合并可信度、校准流程、海报重绘 |
| `miniprogram/components/mbti-swipe-test/mbti-swipe-test.wxml` | 修改 | 按钮文案：不符合/跳过/符合 |
| `miniprogram/components/mbti-swipe-test/mbti-swipe-test.wxss` | 修改 | 按钮文案样式微调 |
| `miniprogram/components/mbti-picker-modal/mbti-picker-modal.wxml` | 修改 | 入口文案：快速接入 |
| `miniprogram/components/radar-chart/radar-chart.wxml` | 修改 | 新增 heroCenter slot 区域 |
| `miniprogram/components/radar-chart/radar-chart.js` | 修改 | 新增 heroMode prop |
| `miniprogram/components/radar-chart/radar-chart.wxss` | 修改 | hero 模式样式 |

---

## Task 1: 文案替换 — mbti-swipe-test 按钮文案

**Files:**
- Modify: `miniprogram/components/mbti-swipe-test/mbti-swipe-test.wxml:48-61`
- Modify: `miniprogram/components/mbti-swipe-test/mbti-swipe-test.wxss` (如需微调)

- [ ] **Step 1: 修改 mbti-swipe-test.wxml 按钮文案**

将 `mbti-swipe-test.wxml` 第 48-61 行的底部操作区改为：

```xml
  <!-- 底部操作 -->
  <view class="swipe-actions">
    <view class="action-btn action-reject" bindtap="onSwipeLeft">
      <text class="action-kicker">REJECT</text>
      <text class="action-text">不符合</text>
    </view>
    <view class="action-btn action-skip" bindtap="onNotSure">
      <text class="action-kicker">SKIP</text>
      <text class="action-text">跳过</text>
    </view>
    <view class="action-btn action-confirm" bindtap="onSwipeRight">
      <text class="action-kicker">CONFIRM</text>
      <text class="action-text">符合</text>
    </view>
  </view>
```

- [ ] **Step 2: 验证**

在微信开发者工具中打开镜像页，点击「完整校准」，确认三个按钮显示为「不符合 / 跳过 / 符合」。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/components/mbti-swipe-test/mbti-swipe-test.wxml
git commit -m "refactor: 校准按钮文案改为不符合/跳过/符合"
```

---

## Task 2: 文案替换 — mbti-picker-modal 入口文案

**Files:**
- Modify: `miniprogram/components/mbti-picker-modal/mbti-picker-modal.wxml:31-41`

- [ ] **Step 1: 修改 mbti-picker-modal.wxml 头部文案**

将 `mbti-picker-modal.wxml` 第 31-41 行改为：

```xml
  <!-- 头部 -->
  <view class="picker-header">
    <view class="picker-header-left">
      <text class="picker-kicker">QUICK SYNC</text>
      <text class="picker-title">协议快速接入</text>
    </view>
    <view class="picker-close">
      <sr-hatch-close bind:close="onClose" reduceMotion="{{reduceMotion}}" />
    </view>
  </view>

  <view class="picker-hint">选择 4 个维度，立即写入当前人格协议。</view>
```

- [ ] **Step 2: 修改维度说明**

将 `mbti-picker-modal.js` 第 6-11 行的 PAIRS dimLabel 改为：

```javascript
var PAIRS = [
  { key: 'EI', options: [{ code: 'E', label: '外向' }, { code: 'I', label: '内向' }], dimLabel: '外向 / 内向 · 能量接入方式' },
  { key: 'SN', options: [{ code: 'S', label: '感知' }, { code: 'N', label: '直觉' }], dimLabel: '感知 / 直觉 · 信息读取方式' },
  { key: 'TF', options: [{ code: 'T', label: '思维' }, { code: 'F', label: '情感' }], dimLabel: '思维 / 情感 · 判断决策方式' },
  { key: 'JP', options: [{ code: 'J', label: '判断' }, { code: 'P', label: '感知' }], dimLabel: '判断 / 感知 · 节奏控制方式' }
];
```

- [ ] **Step 3: 修改同步按钮文案**

将 `mbti-picker-modal.wxml` 第 98-104 行的 apply 按钮改为：

```xml
      <view class="apply-btn {{syncing ? 'apply-syncing' : ''}} {{syncSuccess ? 'apply-success' : ''}} {{syncError ? 'apply-error' : ''}}" bindtap="onConfirm">
        <text class="apply-kicker">WRITE</text>
        <text class="apply-text" wx:if="{{syncing}}">协议写入中...</text>
        <text class="apply-text" wx:elif="{{syncSuccess}}">协议已同步</text>
        <text class="apply-text apply-error-text" wx:elif="{{syncError}}">{{syncError}}</text>
        <text class="apply-text" wx:else>写入人格协议</text>
      </view>
```

- [ ] **Step 4: 验证**

在微信开发者工具中打开镜像页，点击「快速接入」，确认标题为「协议快速接入」，维度说明包含能量/信息/判断/节奏描述，按钮为「写入人格协议」。

- [ ] **Step 5: Commit**

```bash
git add miniprogram/components/mbti-picker-modal/mbti-picker-modal.wxml miniprogram/components/mbti-picker-modal/mbti-picker-modal.js
git commit -m "refactor: 快速接入文案统一为舰载终端术语"
```

---

## Task 3: 雷达图 hero 模式

**Files:**
- Modify: `miniprogram/components/radar-chart/radar-chart.js:27-44`
- Modify: `miniprogram/components/radar-chart/radar-chart.wxml`
- Modify: `miniprogram/components/radar-chart/radar-chart.wxss`

- [ ] **Step 1: 新增 heroMode prop**

在 `radar-chart.js` 的 properties 中新增 `heroMode`：

```javascript
  properties: {
    dimensions: {
      type: Array,
      value: []
    },
    size: {
      type: Number,
      value: 560
    },
    reduceMotion: {
      type: Boolean,
      value: false
    },
    locked: {
      type: Boolean,
      value: false
    },
    heroMode: {
      type: Boolean,
      value: false
    },
    heroLabel: {
      type: String,
      value: ''
    }
  },
```

- [ ] **Step 2: 修改 radar-chart.wxml 支持 hero 中心文字**

将 `radar-chart.wxml` 改为：

```xml
<view class="radar-wrap {{heroMode ? 'radar-hero' : ''}}">
  <canvas
    type="2d"
    id="radarCanvas"
    class="radar-canvas {{locked ? 'radar-locked' : ''}}"
    style="width:{{size}}rpx;height:{{size}}rpx;"
    bindtap="onCanvasTap"
  ></canvas>

  <!-- hero 模式中心标签 -->
  <view class="hero-center" wx:if="{{heroMode && heroLabel}}">
    <text class="hero-center-text">{{heroLabel}}</text>
  </view>

  <!-- 浮窗 -->
  <view
    class="tooltip"
    wx:if="{{tooltipVisible}}"
    style="left:{{tooltipX}}px;top:{{tooltipY}}px;"
    bindtap="closeTooltip"
  >
    <text class="tooltip-label">{{tooltipLabel}}</text>
    <text class="tooltip-value">{{tooltipValue}}/100</text>
    <text class="tooltip-desc">{{tooltipDesc}}</text>
  </view>
</view>
```

- [ ] **Step 3: 在 radar-chart.wxss 末尾追加 hero 模式样式**

```css
/* hero 模式 */
.radar-hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;
}

.hero-center-text {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--color-cyan, #00C8FF);
  font-family: 'SF Mono', 'Courier New', monospace;
  letter-spacing: 6rpx;
  text-shadow: 0 0 16rpx rgba(0, 200, 255, 0.30);
}
```

- [ ] **Step 4: 验证**

在微信开发者工具中确认雷达图组件正常渲染，heroMode=true 时中心显示 heroLabel 文字。

- [ ] **Step 5: Commit**

```bash
git add miniprogram/components/radar-chart/radar-chart.js miniprogram/components/radar-chart/radar-chart.wxml miniprogram/components/radar-chart/radar-chart.wxss
git commit -m "feat: radar-chart 新增 heroMode 居中大尺寸模式"
```

---

## Task 4: 重写 index.wxml — 主视图三区布局

**Files:**
- Rewrite: `miniprogram/pages/mirror/index.wxml`

- [ ] **Step 1: 重写 index.wxml 完整模板**

用以下内容替换整个 `index.wxml`：

```xml
<view class="mirror-bay {{reduceMotion ? 'reduce-motion' : ''}}">

  <!-- Loading Skeleton -->
  <block wx:if="{{loading}}">
    <view class="skeleton-card primary"></view>
    <view class="skeleton-card secondary"></view>
    <view class="skeleton-card tertiary"></view>
  </block>

  <!-- ==================== MAIN 视图 ==================== -->
  <block wx:if="{{!loading && viewMode === 'main'}}">

    <!-- 顶部区：舱位状态 -->
    <view class="bay-header" style="opacity: {{headerOpacity}};">
      <view class="bay-title-row">
        <text class="bay-title">全息观测舱</text>
        <text class="bay-kicker">MIRROR BAY</text>
      </view>
      <text class="bay-subtitle">{{baySubtitle}}</text>
    </view>

    <!-- 中部区：镜像核心 -->
    <view class="mirror-hero" style="opacity: {{heroOpacity}};">
      <!-- 雷达图 / 扫描环 -->
      <view class="hero-radar-wrap">
        <radar-chart
          id="radarChart"
          dimensions="{{radarDimensions}}"
          size="{{560}}"
          reduceMotion="{{reduceMotion}}"
          locked="{{radarLocked}}"
          heroMode="{{true}}"
          heroLabel="{{mbti.calibrated ? mbti.mbtiType : ''}}"
        />
      </view>

      <!-- 核心信息 -->
      <view class="hero-info">
        <block wx:if="{{mbti.calibrated}}">
          <text class="hero-type">{{mbti.mbtiType}}</text>
          <text class="hero-dot">·</text>
          <text class="hero-title">{{mbti.mbtiTitle}}</text>
        </block>
        <block wx:else>
          <text class="hero-uncalibrated">未校准</text>
        </block>
      </view>

      <!-- 状态摘要 -->
      <view class="hero-summary" wx:if="{{mbti.calibrated}}">
        <view class="summary-item">
          <text class="summary-label">协议一致率</text>
          <text class="summary-val">{{personaConfidence}}%</text>
        </view>
        <view class="summary-sep"></view>
        <view class="summary-item">
          <text class="summary-label">黑匣子样本</text>
          <text class="summary-val">{{battlePersona.sampleSize}} / 3</text>
        </view>
      </view>

      <!-- 校准入口（未校准态） -->
      <view class="hero-actions" wx:if="{{!mbti.calibrated}}">
        <view class="term-btn" bindtap="startFullCalibration">
          <text>完整校准</text>
        </view>
        <view class="term-btn-desc">20 组信号，生成较完整人格协议</view>
        <view class="term-btn ghost" bindtap="openMbtiPicker">
          <text>快速接入</text>
        </view>
        <view class="term-btn-desc">手动选择协议维度，立即写入</view>
      </view>
    </view>

    <!-- 底部区：信息卡片 -->
    <view class="mirror-sections" style="opacity: {{sectionsOpacity}};">

      <!-- 协议状态卡 -->
      <view class="sr-card protocol-card" wx:if="{{mbti.calibrated}}">
        <view class="card-header">
          <view class="card-title-row">
            <text class="card-title">协议状态</text>
            <text class="card-kicker">PROTOCOL STATUS</text>
          </view>
          <view class="sr-card-line card-line"></view>
        </view>
        <view class="protocol-grid">
          <view class="protocol-row">
            <text class="protocol-label">协议编号</text>
            <view class="protocol-value protocol-code">
              <text class="pc-prefix">SR</text><text class="pc-sep">-</text><text class="pc-core">MBTI</text><text class="pc-sep">-</text><text class="pc-type">{{mbti.mbtiType}}</text>
            </view>
          </view>
          <view class="protocol-row">
            <text class="protocol-label">来源</text>
            <text class="protocol-value">{{mbti.mbtiSource === 'test' ? '完整校准' : '快速接入'}}</text>
          </view>
          <view class="protocol-row">
            <text class="protocol-label">状态</text>
            <text class="protocol-value status-active">已同步</text>
          </view>
        </view>
        <view class="protocol-actions">
          <view class="term-btn-sm" bindtap="startFullCalibration">重新校准</view>
          <view class="term-btn-sm ghost" bindtap="openMbtiPicker">修改协议</view>
        </view>
      </view>

      <!-- 系统判读 -->
      <view class="sr-card reading-card">
        <view class="card-header">
          <view class="card-title-row">
            <text class="card-title">系统判读</text>
            <text class="card-kicker">SYSTEM READING</text>
          </view>
          <view class="sr-card-line card-line"></view>
        </view>

        <block wx:if="{{reading.available}}">
          <view class="reading-sub-card" wx:if="{{reading.observation}}">
            <text class="reading-sub-label">观测</text>
            <text class="reading-sub-text">{{reading.observation}}</text>
          </view>
          <view class="reading-sub-card" wx:if="{{reading.deviation}}">
            <text class="reading-sub-label">偏差</text>
            <text class="reading-sub-text">{{reading.deviation}}</text>
          </view>
          <view class="reading-sub-card" wx:if="{{reading.risk}}">
            <text class="reading-sub-label">风险</text>
            <text class="reading-sub-text">{{reading.risk}}</text>
          </view>
          <view class="reading-sub-card" wx:if="{{reading.growthAdvice}}">
            <text class="reading-sub-label">成长建议</text>
            <text class="reading-sub-text">{{reading.growthAdvice}}</text>
          </view>
          <view class="reading-sub-card" wx:if="{{!reading.observation && reading.text}}">
            <text class="reading-sub-label">系统判断</text>
            <text class="reading-sub-text">{{reading.text}}</text>
          </view>
        </block>

        <block wx:else>
          <view class="reading-locked">
            <text class="reading-locked-text" wx:if="{{!mbti.calibrated}}">请先完成人格协议校准</text>
            <text class="reading-locked-text" wx:elif="{{battlePersona.sampleSize < 3}}">完成 3 次封存后解锁系统判读</text>
            <text class="reading-locked-text" wx:else>数据计算中</text>
          </view>
        </block>
      </view>

      <!-- 信号标签 -->
      <view class="sr-card signal-card">
        <view class="card-header">
          <view class="card-title-row">
            <text class="card-title">信号标签</text>
            <text class="card-kicker">SIGNAL TAGS</text>
          </view>
          <view class="sr-card-line card-line"></view>
        </view>

        <block wx:if="{{personaSignals.length > 0}}">
          <view class="signal-tag-wrap">
            <view class="signal-tag" wx:for="{{personaSignals}}" wx:key="*this">
              <text>{{item}}</text>
            </view>
          </view>
        </block>

        <block wx:else>
          <view class="signal-scanning">
            <text class="scanning-text">信号采集中</text>
            <view class="scanning-dots">
              <view class="scanning-dot"></view>
              <view class="scanning-dot"></view>
              <view class="scanning-dot"></view>
            </view>
            <text class="scanning-hint">完成校准后生成信号标签</text>
          </view>
        </block>
      </view>

      <!-- 协议偏移 -->
      <view class="sr-card deviation-card">
        <view class="card-header">
          <view class="card-title-row">
            <text class="card-title">协议偏移</text>
            <text class="card-kicker">DEVIATION</text>
          </view>
          <view class="sr-card-line card-line"></view>
        </view>

        <block wx:if="{{personaMatch.available}}">
          <view class="dev-grid">
            <view class="dev-col">
              <text class="dev-label">校准人格</text>
              <text class="dev-type dev-type-blue">{{mbti.mbtiType}}</text>
            </view>
            <view class="dev-connector">
              <view class="dev-arrow"></view>
              <text class="dev-percent">{{personaMatch.deviationPercent}}%</text>
            </view>
            <view class="dev-col">
              <text class="dev-label">行为人格</text>
              <text class="dev-type dev-type-orange">{{personaMatch.inferredMbtiType}}</text>
            </view>
          </view>
          <view class="dev-bar-track">
            <view class="dev-bar-fill" style="width: {{personaMatch.deviationPercent}}%;"></view>
          </view>
          <text class="dev-summary">{{personaMatch.summary}}</text>
        </block>

        <block wx:else>
          <view class="dev-empty">
            <view class="dev-empty-grid">
              <view class="dev-col">
                <text class="dev-label">校准人格</text>
                <text class="dev-type dev-type-blue">{{mbti.mbtiType || '---'}}</text>
              </view>
              <view class="dev-connector">
                <view class="dev-arrow dim"></view>
                <text class="dev-percent dim">--</text>
              </view>
              <view class="dev-col">
                <text class="dev-label">行为人格</text>
                <text class="dev-type dev-type-dim">采集中</text>
              </view>
            </view>
            <view class="dev-empty-status">
              <text class="dev-status-text" wx:if="{{!mbti.calibrated}}">完成人格校准后解锁</text>
              <text class="dev-status-text" wx:elif="{{battlePersona.sampleSize < 3}}">等待任务样本</text>
              <text class="dev-status-text" wx:else>数据计算中</text>
              <text class="dev-status-hint" wx:if="{{!mbti.calibrated || battlePersona.sampleSize < 3}}">完成 3 次封存后自动生成</text>
            </view>
          </view>
        </block>
      </view>

      <!-- 协议演化 -->
      <view class="sr-card evolution-card">
        <view class="card-header">
          <view class="card-title-row">
            <text class="card-title">协议演化</text>
            <text class="card-kicker">EVOLUTION</text>
          </view>
          <view class="sr-card-line card-line"></view>
        </view>

        <block wx:if="{{evolution.length > 0}}">
          <view class="evo-timeline">
            <view class="evo-item" wx:for="{{evolution}}" wx:key="date">
              <view class="evo-dot {{index === 0 ? 'evo-dot-current' : ''}}"></view>
              <view class="evo-line" wx:if="{{index < evolution.length - 1}}"></view>
              <view class="evo-content">
                <text class="evo-date">{{item.date}}</text>
                <text class="evo-type">{{item.type}}</text>
                <text class="evo-deviation">偏差 {{item.deviation}}%</text>
              </view>
            </view>
          </view>
        </block>

        <block wx:else>
          <view class="evo-empty">
            <text class="evo-empty-text">协议演化轨迹将在多次校准后生成</text>
            <text class="evo-empty-hint">每次校准将记录一次快照</text>
          </view>
        </block>
      </view>

    </view>

    <!-- 底部占位 -->
    <view class="dossier-spacer"></view>

  </block>

  <!-- ==================== CALIBRATION 视图 ==================== -->
  <block wx:if="{{!loading && viewMode === 'calibration'}}">
    <view class="calibration-view">
      <!-- 顶部 -->
      <view class="cal-header">
        <text class="cal-title">镜像舱</text>
        <text class="cal-subtitle">协议校准中</text>
      </view>

      <!-- 扫描环 -->
      <view class="cal-ring-wrap">
        <view class="cal-ring {{reduceMotion ? '' : 'cal-ring-spin'}}"></view>
        <view class="cal-ring-inner"></view>
      </view>

      <!-- 进度 -->
      <view class="cal-progress">
        <text class="cal-progress-text">信号 {{calibrationProgress}}</text>
      </view>

      <!-- 内嵌 mbti-swipe-test -->
      <view class="cal-test-wrap">
        <mbti-swipe-test
          reduceMotion="{{reduceMotion}}"
          bind:complete="handleMbtiComplete"
          bind:close="closeMbtiTest"
        />
      </view>
    </view>
  </block>

  <!-- 固定底部：生成镜像卡 -->
  <view class="dossier-bar {{reduceMotion ? '' : 'scan-glow'}}" wx:if="{{!loading && viewMode === 'main'}}" bindtap="generateDossier">
    <text class="flight-primary dossier-btn">生成镜像卡</text>
  </view>

  <!-- MBTI 直接输入 -->
  <mbti-picker-modal
    wx:if="{{showMbtiPicker}}"
    id="mbtiPicker"
    reduceMotion="{{reduceMotion}}"
    bind:confirm="handleMbtiDirectInput"
    bind:close="closeMbtiPicker"
  />

  <!-- 退出确认弹窗 -->
  <terminal-popup
    wx:if="{{showExitConfirm}}"
    visible="{{showExitConfirm}}"
    title="系统警告"
    subtitle="WARN"
    content="退出后本次校准不会保存。"
    cancelText="继续校准"
    confirmText="撤出"
    confirmType="danger"
    reduceMotion="{{reduceMotion}}"
    bind:cancel="onExitCancel"
    bind:confirm="onExitConfirm"
  />

  <!-- 隐藏 Canvas -->
  <canvas type="2d" id="personaCardCanvas" class="persona-card-canvas"></canvas>

  <!-- 预览弹窗 -->
  <view wx:if="{{showCardPreview}}" class="card-preview-mask" catchtouchmove="noop">
    <view class="card-preview-panel">
      <view class="preview-head">
        <text class="preview-title">镜像档案卡</text>
        <sr-hatch-close bind:close="closeCardPreview" reduceMotion="{{reduceMotion}}" />
      </view>
      <image class="preview-img" src="{{cardTempPath}}" mode="widthFix" />
      <view class="preview-actions">
        <view class="preview-btn preview-btn-primary" bindtap="saveCard">
          <text class="preview-btn-text">保存镜像卡</text>
        </view>
        <button class="preview-btn preview-btn-share" open-type="share">
          <text class="preview-btn-text">发送给朋友</text>
        </button>
      </view>
    </view>
  </view>

  <!-- 生成扫描动画 -->
  <view class="scan-overlay {{generatingCard ? 'scan-active' : ''}} {{reduceMotion ? 'reduce-motion' : ''}}" wx:if="{{generatingCard}}">
    <view class="scan-ring"></view>
    <view class="scan-terminal">
      <text class="scan-line {{scanStep >= 1 ? 'scan-line-show' : ''}}">[SCAN] 读取协议参数</text>
      <text class="scan-line {{scanStep >= 2 ? 'scan-line-show' : ''}}">[MIRROR] 生成镜像投影</text>
      <text class="scan-line {{scanStep >= 3 ? 'scan-line-show' : ''}}">[LOCK] 档案封装完成</text>
    </view>
  </view>

  <!-- 权限确认弹窗 -->
  <terminal-popup
    wx:if="{{showPermDialog}}"
    visible="{{showPermDialog}}"
    title="需要相册权限"
    subtitle="PERMISSION"
    content="保存档案图需要相册访问权限。"
    cancelText="取消"
    confirmText="去设置"
    confirmType="primary"
    reduceMotion="{{reduceMotion}}"
    bind:cancel="onPermCancel"
    bind:confirm="onPermConfirm"
  />

  <!-- 终端 Toast -->
  <sr-toast id="srToast" reduceMotion="{{reduceMotion}}" />

</view>
```

- [ ] **Step 2: 验证模板无语法错误**

在微信开发者工具中确认页面能加载（虽然样式和 JS 还没改，会显示不完整，但不应报模板解析错误）。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/mirror/index.wxml
git commit -m "refactor: 镜像页模板重构为全息观测舱三区布局"
```

---

## Task 5: 重写 index.wxss — 全息观测舱样式

**Files:**
- Rewrite: `miniprogram/pages/mirror/index.wxss`

- [ ] **Step 1: 重写 index.wxss 完整样式**

用以下内容替换整个 `index.wxss`：

```css
/* ===== 全息观测舱 — Mirror Bay ===== */

/* ---- 根容器 ---- */
.mirror-bay {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 16rpx 28rpx calc(env(safe-area-inset-bottom) + 140rpx);
  background:
    radial-gradient(circle at 20% 0%, rgba(10,132,255,0.12), transparent 32%),
    radial-gradient(circle at 90% 18%, rgba(94,92,230,0.08), transparent 30%),
    #0A0A0A;
  color: var(--text-main, rgba(255,255,255,0.92));
}

/* ---- 顶部区：舱位状态 ---- */
.bay-header {
  padding: 20rpx 0 8rpx;
  transition: opacity 0.3s;
}

.bay-title-row {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
}

.bay-title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text-main, rgba(255,255,255,0.92));
  letter-spacing: 4rpx;
}

.bay-kicker {
  font-size: 18rpx;
  letter-spacing: 5rpx;
  color: var(--text-muted, rgba(255,255,255,0.28));
  text-transform: uppercase;
}

.bay-subtitle {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: var(--text-secondary, rgba(255,255,255,0.56));
}

/* ---- 中部区：镜像核心 ---- */
.mirror-hero {
  padding: 24rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: opacity 0.3s;
}

.hero-radar-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 16rpx;
}

.hero-info {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
  margin-bottom: 12rpx;
}

.hero-type {
  font-size: 40rpx;
  font-weight: 800;
  color: var(--color-cyan, #00C8FF);
  font-family: 'SF Mono', 'Courier New', monospace;
  letter-spacing: 6rpx;
  text-shadow: 0 0 16rpx rgba(0, 200, 255, 0.30);
}

.hero-dot {
  font-size: 28rpx;
  color: var(--text-muted, rgba(255,255,255,0.28));
}

.hero-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-main, rgba(255,255,255,0.92));
}

.hero-uncalibrated {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-muted, rgba(255,255,255,0.28));
  letter-spacing: 4rpx;
}

.hero-summary {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 16rpx 32rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(10,132,255,0.12);
  background: rgba(255,255,255,0.02);
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}

.summary-label {
  font-size: 20rpx;
  color: var(--text-secondary, rgba(255,255,255,0.56));
}

.summary-val {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--color-cyan, #00C8FF);
  font-variant-numeric: tabular-nums;
}

.summary-sep {
  width: 1rpx;
  height: 40rpx;
  background: rgba(255,255,255,0.08);
}

.hero-actions {
  margin-top: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  width: 100%;
  max-width: 480rpx;
}

.term-btn-desc {
  font-size: 20rpx;
  color: var(--text-muted, rgba(255,255,255,0.28));
  margin-bottom: 12rpx;
}

/* ---- 底部区：信息卡片 ---- */
.mirror-sections {
  transition: opacity 0.3s;
}

.sr-card {
  border-radius: 28rpx;
  border: 1rpx solid rgba(10,132,255,0.18);
  background: rgba(255,255,255,0.035);
  padding: 24rpx 26rpx;
  margin-bottom: 16rpx;
}

.card-header {
  position: relative;
  margin-bottom: 16rpx;
}

.card-title-row {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.card-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--color-cyan, #00C8FF);
  letter-spacing: 2rpx;
}

.card-kicker {
  font-size: 18rpx;
  letter-spacing: 5rpx;
  color: rgba(126, 156, 180, 0.30);
  text-transform: uppercase;
}

.card-line {
  margin-top: 10rpx;
}

/* ---- HUD 按钮 ---- */
.term-btn {
  width: 100%;
  max-width: 480rpx;
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  border-radius: 6rpx;
  border: 1rpx solid rgba(0, 200, 255, 0.30);
  background: rgba(0, 200, 255, 0.06);
  color: rgba(0, 200, 255, 0.90);
  font-size: 26rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
}

.term-btn.ghost {
  border-color: rgba(126, 156, 180, 0.10);
  background: rgba(255,255,255,0.02);
  color: var(--text-secondary, rgba(255,255,255,0.56));
}

.term-btn:active {
  background: rgba(0, 200, 255, 0.14);
}

.term-btn-sm {
  width: 180rpx;
  height: 56rpx;
  line-height: 56rpx;
  text-align: center;
  border-radius: 6rpx;
  border: 1rpx solid rgba(0, 200, 255, 0.25);
  background: rgba(0, 200, 255, 0.05);
  color: rgba(0, 200, 255, 0.80);
  font-size: 22rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
}

.term-btn-sm.ghost {
  border-color: rgba(126, 156, 180, 0.10);
  background: rgba(255,255,255,0.02);
  color: var(--text-secondary, rgba(255,255,255,0.56));
}

.term-btn-sm:active {
  background: rgba(0, 200, 255, 0.12);
}

.protocol-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 18rpx;
  justify-content: flex-end;
}

/* ---- 协议状态卡 ---- */
.protocol-grid {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.protocol-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4rpx 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.04);
}

.protocol-row:last-child {
  border-bottom: none;
}

.protocol-label {
  font-size: 24rpx;
  color: rgba(140, 176, 205, 0.48);
}

.protocol-value {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-main, rgba(255,255,255,0.92));
}

.protocol-value.protocol-code {
  font-size: 28rpx;
  font-weight: 800;
  letter-spacing: 4rpx;
  font-family: 'SF Mono', 'Courier New', monospace;
  display: flex;
  align-items: center;
}

.pc-prefix {
  color: rgba(140, 176, 205, 0.38);
}

.pc-sep {
  color: var(--text-disabled, rgba(255,255,255,0.24));
  margin: 0 2rpx;
}

.pc-core {
  color: var(--text-secondary, rgba(255,255,255,0.56));
}

.pc-type {
  color: var(--color-cyan, #00C8FF);
  text-shadow: 0 0 12rpx rgba(0, 200, 255, 0.22);
  letter-spacing: 6rpx;
}

.protocol-value.status-active {
  color: var(--color-green, #30D158);
}

/* ---- 系统判读 ---- */
.reading-sub-card {
  padding: 14rpx 18rpx;
  border-radius: 8rpx;
  border-left: 3rpx solid rgba(0, 200, 255, 0.30);
  background: rgba(0, 200, 255, 0.03);
  margin-bottom: 12rpx;
}

.reading-sub-card:last-child {
  margin-bottom: 0;
}

.reading-sub-label {
  display: block;
  font-size: 18rpx;
  color: rgba(0, 200, 255, 0.50);
  letter-spacing: 2rpx;
  margin-bottom: 6rpx;
}

.reading-sub-text {
  font-size: 24rpx;
  color: var(--text-main, rgba(255,255,255,0.92));
  line-height: 1.6;
}

.reading-locked {
  padding: 24rpx 0;
  text-align: center;
}

.reading-locked-text {
  font-size: 22rpx;
  color: rgba(126, 156, 180, 0.35);
}

/* ---- 信号标签 ---- */
.signal-tag-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.signal-tag {
  height: 48rpx;
  padding: 0 20rpx;
  border-radius: 6rpx;
  border: 1rpx solid rgba(0, 200, 255, 0.15);
  background: rgba(0, 200, 255, 0.04);
  display: flex;
  align-items: center;
  font-size: 22rpx;
  color: rgba(0, 200, 255, 0.75);
}

.signal-scanning {
  padding: 24rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.scanning-text {
  font-size: 22rpx;
  letter-spacing: 4rpx;
  color: rgba(0, 200, 255, 0.40);
}

.scanning-dots {
  display: flex;
  gap: 8rpx;
}

.scanning-dot {
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: rgba(0, 200, 255, 0.40);
  animation: dotPulse 1.2s ease-in-out infinite;
}

.scanning-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.scanning-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes dotPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.scanning-hint {
  font-size: 20rpx;
  color: rgba(126, 156, 180, 0.25);
}

/* ---- 协议偏移 ---- */
.dev-grid {
  display: flex;
  align-items: center;
  gap: 0;
  margin-top: 8rpx;
}

.dev-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8rpx 0;
}

.dev-label {
  font-size: 20rpx;
  color: rgba(126, 156, 180, 0.35);
  letter-spacing: 2rpx;
}

.dev-type {
  margin-top: 8rpx;
  font-size: 36rpx;
  font-weight: 800;
  font-family: 'SF Mono', 'Courier New', monospace;
  letter-spacing: 4rpx;
}

.dev-type-blue {
  color: var(--color-cyan, #00C8FF);
}

.dev-type-orange {
  color: var(--color-orange, #FF9F0A);
}

.dev-type-dim {
  font-size: 24rpx;
  color: rgba(0, 200, 255, 0.50);
  letter-spacing: 2rpx;
}

.dev-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  padding: 0 12rpx;
}

.dev-arrow {
  width: 40rpx;
  height: 2rpx;
  background: linear-gradient(90deg, rgba(0, 200, 255, 0.10), rgba(0, 200, 255, 0.50), rgba(255, 159, 10, 0.10));
  position: relative;
}

.dev-arrow::after {
  content: '';
  position: absolute;
  right: -2rpx;
  top: -4rpx;
  border: 5rpx solid transparent;
  border-left: 6rpx solid rgba(255, 159, 10, 0.50);
}

.dev-arrow.dim {
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
}

.dev-arrow.dim::after {
  border-left-color: rgba(126, 156, 180, 0.10);
}

.dev-percent {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--color-orange, #FF9F0A);
  font-variant-numeric: tabular-nums;
}

.dev-percent.dim {
  color: var(--text-disabled, rgba(255,255,255,0.24));
}

.dev-bar-track {
  margin-top: 16rpx;
  height: 4rpx;
  border-radius: 2rpx;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
}

.dev-bar-fill {
  height: 100%;
  border-radius: 2rpx;
  background: linear-gradient(90deg, rgba(0, 200, 255, 0.60), rgba(255, 159, 10, 0.80));
  transition: width 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

.dev-summary {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: rgba(140, 176, 205, 0.45);
  line-height: 1.5;
}

.dev-empty {
  padding: 4rpx 0;
}

.dev-empty-grid {
  display: flex;
  align-items: center;
  gap: 0;
}

.dev-empty-status {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}

.dev-status-text {
  font-size: 22rpx;
  color: rgba(126, 156, 180, 0.35);
}

.dev-status-hint {
  font-size: 20rpx;
  color: rgba(126, 156, 180, 0.22);
}

/* ---- 协议演化 ---- */
.evo-timeline {
  padding: 4rpx 0;
}

.evo-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  padding-left: 28rpx;
  padding-bottom: 24rpx;
}

.evo-item:last-child {
  padding-bottom: 0;
}

.evo-dot {
  position: absolute;
  left: 0;
  top: 8rpx;
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(0, 200, 255, 0.40);
  background: rgba(255,255,255,0.035);
}

.evo-dot-current {
  border-color: var(--color-cyan, #00C8FF);
  background: var(--color-cyan, #00C8FF);
  box-shadow: 0 0 8rpx rgba(0, 200, 255, 0.50);
}

.evo-line {
  position: absolute;
  left: 4rpx;
  top: 22rpx;
  width: 2rpx;
  bottom: 0;
  background: linear-gradient(180deg, rgba(0, 200, 255, 0.25), rgba(0, 200, 255, 0.06));
}

.evo-content {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  flex-wrap: wrap;
}

.evo-date {
  font-size: 20rpx;
  color: rgba(126, 156, 180, 0.35);
  font-variant-numeric: tabular-nums;
}

.evo-type {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-main, rgba(255,255,255,0.92));
  font-family: 'SF Mono', 'Courier New', monospace;
  letter-spacing: 2rpx;
}

.evo-deviation {
  font-size: 22rpx;
  color: rgba(0, 200, 255, 0.70);
}

.evo-empty {
  padding: 24rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.evo-empty-text {
  font-size: 22rpx;
  color: rgba(126, 156, 180, 0.35);
}

.evo-empty-hint {
  font-size: 20rpx;
  color: var(--text-disabled, rgba(255,255,255,0.24));
}

/* ===== Calibration 视图 ===== */
.calibration-view {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(circle at 50% 30%, rgba(10,132,255,0.08), transparent 60%),
    #05070A;
  z-index: 500;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 32rpx 48rpx;
}

.cal-header {
  text-align: center;
  margin-bottom: 32rpx;
}

.cal-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-main, rgba(255,255,255,0.92));
  letter-spacing: 4rpx;
}

.cal-subtitle {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--text-secondary, rgba(255,255,255,0.56));
  letter-spacing: 2rpx;
}

.cal-ring-wrap {
  position: relative;
  width: 160rpx;
  height: 160rpx;
  margin-bottom: 24rpx;
}

.cal-ring {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(0, 200, 255, 0.20);
  border-top-color: var(--color-cyan, #00C8FF);
}

.cal-ring-spin {
  animation: calRingSpin 2s linear infinite;
}

@keyframes calRingSpin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.cal-ring-inner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  border: 1rpx solid rgba(0, 200, 255, 0.10);
}

.cal-progress {
  margin-bottom: 16rpx;
}

.cal-progress-text {
  font-size: 24rpx;
  color: rgba(0, 200, 255, 0.60);
  letter-spacing: 3rpx;
  font-family: 'SF Mono', 'Courier New', monospace;
}

.cal-test-wrap {
  flex: 1;
  width: 100%;
  overflow: hidden;
}

/* ===== 固定底部 ===== */
.dossier-spacer {
  height: 20rpx;
}

.dossier-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16rpx 32rpx calc(env(safe-area-inset-bottom) + 16rpx);
  background: rgba(10, 15, 24, 0.95);
  border-top: 1rpx solid rgba(0, 200, 255, 0.20);
  z-index: 100;
  overflow: hidden;
}

.scan-glow::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 2rpx;
  background: linear-gradient(90deg, transparent, rgba(0, 200, 255, 0.60), transparent);
  animation: scanFlow 3s linear infinite;
}

@keyframes scanFlow {
  0% { left: -100%; }
  100% { left: 100%; }
}

.dossier-btn {
  display: block;
  width: 100%;
}

.dossier-bar:active {
  opacity: 0.8;
}

/* ===== Skeleton ===== */
.skeleton-card {
  height: 180rpx;
  border-radius: 28rpx;
  background: rgba(0, 200, 255, 0.03);
  border: 1rpx solid rgba(0, 200, 255, 0.06);
  margin-bottom: 16rpx;
  animation: shimmer 1.5s infinite;
}

.skeleton-card.secondary {
  height: 280rpx;
}

.skeleton-card.tertiary {
  height: 160rpx;
}

@keyframes shimmer {
  0% { opacity: 0.4; }
  50% { opacity: 0.7; }
  100% { opacity: 0.4; }
}

/* ===== Reduce Motion ===== */
.reduce-motion .skeleton-card {
  animation: none !important;
}

.reduce-motion {
  animation: none !important;
  transition: none !important;
}

.reduce-motion .dev-bar-fill {
  transition: none;
}

.reduce-motion .scanning-dot {
  animation: none !important;
}

.reduce-motion .scan-glow::before {
  animation: none !important;
}

.reduce-motion .cal-ring {
  animation: none !important;
}

/* ===== 隐藏 Canvas ===== */
.persona-card-canvas {
  position: fixed;
  left: -9999rpx;
  top: -9999rpx;
  width: 750rpx;
  height: 1200rpx;
}

/* ===== 预览弹窗 ===== */
.card-preview-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
  background: rgba(0, 0, 0, 0.82);
  box-sizing: border-box;
}

.card-preview-panel {
  width: 100%;
  max-height: 92vh;
  padding: 28rpx;
  border-radius: 32rpx;
  border: 1rpx solid rgba(10, 132, 255, 0.24);
  background: rgba(6, 10, 16, 0.96);
  box-sizing: border-box;
}

.preview-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.preview-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-main, rgba(255,255,255,0.92));
}

.preview-img {
  width: 100%;
  border-radius: 24rpx;
  overflow: hidden;
  background: #0A0A0A;
}

.preview-actions {
  display: flex;
  gap: 18rpx;
  margin-top: 24rpx;
}

.preview-btn {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  border: 1rpx solid rgba(126, 156, 180, 0.10);
  background: rgba(255,255,255,0.02);
  padding: 0;
  margin: 0;
  line-height: 80rpx;
  box-sizing: border-box;
}

.preview-btn::after {
  border: none;
}

.preview-btn:active {
  background: rgba(255,255,255,0.06);
}

.preview-btn-primary {
  border-color: rgba(10, 132, 255, 0.36);
  background: rgba(10, 132, 255, 0.08);
}

.preview-btn-primary:active {
  background: rgba(10, 132, 255, 0.16);
}

.preview-btn-share {
  color: var(--text-main, rgba(255,255,255,0.92));
}

.preview-btn-text {
  font-size: 26rpx;
  color: var(--text-main, rgba(255,255,255,0.92));
}

.preview-btn-primary .preview-btn-text {
  color: #0A84FF;
}

/* ===== 扫描动画遮罩 ===== */
.scan-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(5, 7, 10, 0.97);
  z-index: 9998;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 40rpx;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
}

.scan-overlay.scan-active {
  opacity: 1;
  pointer-events: auto;
}

.scan-ring {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(0, 200, 255, 0.30);
  border-top-color: var(--color-cyan, #00C8FF);
  animation: scanRingSpin 1.2s linear infinite;
}

@keyframes scanRingSpin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.scan-terminal {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  align-items: center;
}

.scan-line {
  font-size: 22rpx;
  font-family: 'SF Mono', 'Courier New', monospace;
  letter-spacing: 2rpx;
  color: rgba(0, 200, 255, 0.00);
  transition: color 0.4s;
}

.scan-line-show {
  color: rgba(0, 200, 255, 0.80);
}

.reduce-motion .scan-ring {
  animation: none;
}

.reduce-motion .scan-line {
  transition: none;
}
```

- [ ] **Step 2: 验证样式无报错**

在微信开发者工具中确认 WXSS 编译无错误。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/mirror/index.wxss
git commit -m "refactor: 镜像页样式重构为 sr-* 令牌体系"
```

---

## Task 6: 修改 index.js — viewMode + 数据模型 + 校准流程

**Files:**
- Modify: `miniprogram/pages/mirror/index.js`

- [ ] **Step 1: 新增 viewMode 和校准相关 data 字段**

将 `index.js` 第 45-117 行的 data 对象改为：

```javascript
  data: {
    loading: true,
    loadedOnce: false,
    reduceMotion: false,
    viewMode: 'main', // 'main' | 'calibration'

    // 入场动画
    headerOpacity: 0,
    heroOpacity: 0,
    sectionsOpacity: 0,

    // 舱位状态
    baySubtitle: '接入人格协议以启动镜像',

    // 人格协议
    mbti: {
      calibrated: false,
      mbtiType: '',
      mbtiTitle: '',
      confidence: 0,
      mbtiSource: '',
      calibratedAt: ''
    },
    traits: [],
    syncActive: false,

    // 镜像投影
    battlePersona: {
      generated: false,
      sampleSize: 0,
      tag: 'INSUFFICIENT_DATA',
      title: '黑匣子样本不足',
      summary: ''
    },
    radarDimensions: [
      { key: 'aggression', label: '推进倾向', value: 0, desc: '' },
      { key: 'stability', label: '舰体稳定', value: 0, desc: '' },
      { key: 'participation', label: '接入频率', value: 0, desc: '' },
      { key: 'comeback', label: '回稳能力', value: 0, desc: '' },
      { key: 'dominance', label: '场域控制', value: 0, desc: '' }
    ],
    radarLocked: true,

    // 协议一致率（原人格可信度）
    personaConfidence: 0,

    // 协议偏移（原人格偏差）
    personaMatch: {
      available: false,
      matchPercentage: 0,
      prediction: '',
      actualSummary: '',
      summary: '',
      inferredMbtiType: '',
      inferredMbtiTitle: '',
      deviationPercent: 0
    },

    // 系统判读
    reading: {
      available: false,
      text: '',
      observation: '',
      deviation: '',
      risk: '',
      growthAdvice: ''
    },

    // 信号标签
    personaSignals: [],

    // 协议演化
    evolution: [],

    // 弹窗控制
    showMbtiPicker: false,
    showExitConfirm: false,

    // 校准进度
    calibrationProgress: '01 / 20',

    // 生成镜像卡
    showCardPreview: false,
    generatingCard: false,
    scanStep: 0,
    cardTempPath: '',
    showPermDialog: false,
    generatedAt: ''
  },
```

- [ ] **Step 2: 修改 onLoad 添加入场动画**

将 `index.js` 的 `onLoad` 方法改为：

```javascript
  onLoad() {
    var reduceMotion =
      !app.globalData.animationEnabled ||
      app.globalData.reduceMotion === true;
    this.setData({ reduceMotion: reduceMotion });
    this._toastRef = null;
    this._scanTimers = [];
    this._entryTimers = [];
    this._generatedAt = this._formatDate();
    this.loadProfile();
  },
```

- [ ] **Step 3: 修改 onUnload 清理所有 timer**

将 `index.js` 的 `onUnload` 方法改为：

```javascript
  onUnload() {
    this._clearScanTimers();
    this._clearEntryTimers();
  },
```

- [ ] **Step 4: 新增 _clearEntryTimers 方法**

在 `_clearScanTimers` 方法后面添加：

```javascript
  _clearEntryTimers() {
    for (var i = 0; i < this._entryTimers.length; i++) {
      clearTimeout(this._entryTimers[i]);
    }
    this._entryTimers = [];
  },
```

- [ ] **Step 5: 新增 _playEntryAnimation 方法**

在 `_clearEntryTimers` 方法后面添加：

```javascript
  _playEntryAnimation() {
    if (this.data.reduceMotion) {
      this.setData({ headerOpacity: 1, heroOpacity: 1, sectionsOpacity: 1 });
      return;
    }
    var self = this;
    this._clearEntryTimers();
    var t1 = setTimeout(function () { self.setData({ headerOpacity: 1 }); }, 120);
    var t2 = setTimeout(function () { self.setData({ heroOpacity: 1 }); }, 240);
    var t3 = setTimeout(function () { self.setData({ sectionsOpacity: 1 }); }, 600);
    this._entryTimers = [t1, t2, t3];
  },
```

- [ ] **Step 6: 修改 loadProfile 更新 baySubtitle 和触发动画**

在 `loadProfile` 方法的 `this.setData({ ... })` 调用中，添加 `baySubtitle` 的计算。将 setData 块改为：

```javascript
      var baySubtitle = '镜像舱在线';
      if (!mbti.calibrated) {
        baySubtitle = '接入人格协议以启动镜像';
      } else if (battle.sampleSize < 3) {
        baySubtitle = '黑匣子样本读取中';
      }

      this.setData({
        mbti: mbti,
        traits: traits,
        syncActive: mbti.calibrated,
        battlePersona: battle,
        personaMatch: sanitizeMirrorObject(res.personaMatch || this.data.personaMatch),
        reading: reading,
        personaConfidence: personaConfidence,
        personaSignals: signals,
        evolution: evolution,
        generatedAt: this._generatedAt,
        baySubtitle: baySubtitle,
        loading: false,
        loadedOnce: true,
        needRefresh: false
      });

      this._playEntryAnimation();
      this.loadStats();
```

注意：删除原来的 `confidenceChecklist` 相关代码（已合并到协议状态卡中）。

- [ ] **Step 7: 修改 startMbtiTest → startFullCalibration**

将 `startMbtiTest` 方法改为：

```javascript
  startFullCalibration() {
    this.setData({ viewMode: 'calibration' });
  },
```

- [ ] **Step 8: 修改 closeMbtiTest 处理退出确认**

将 `closeMbtiTest` 方法保持不变（它已经设置 `showExitConfirm: true`）。

- [ ] **Step 9: 修改 onExitConfirm 切回 main**

将 `onExitConfirm` 方法改为：

```javascript
  onExitConfirm() {
    this.setData({ showExitConfirm: false, viewMode: 'main' });
  },
```

- [ ] **Step 10: 修改 handleMbtiComplete 切回 main 并播放入场动画**

将 `handleMbtiComplete` 方法改为：

```javascript
  async handleMbtiComplete(e) {
    var detail = e.detail;
    try {
      await api.submitMbtiTest({ testVersion: detail.testVersion, answers: detail.answers });
      this.setData({ viewMode: 'main' });
      this._showToast('协议已同步', 'dot-sync');
      this.loadProfile(true);
    } catch (err) {
      this._showToast('提交失败，请重试', 'dot-error');
    }
  },
```

- [ ] **Step 11: 修改 handleMbtiDirectInput 切回 main**

将 `handleMbtiDirectInput` 方法改为：

```javascript
  async handleMbtiDirectInput(e) {
    try {
      await api.submitMbtiDirect({ mbtiCode: e.detail.mbtiCode });
      this.setData({ showMbtiPicker: false, viewMode: 'main' });
      this._showToast('协议已同步', 'dot-sync');
      this.loadProfile(true);
    } catch (err) {
      var picker = this.selectComponent('#mbtiPicker');
      if (picker && picker.showError) {
        picker.showError('同步失败，请重试');
      } else {
        this._showToast('协议同步失败，请重试', 'dot-error');
      }
    }
  },
```

- [ ] **Step 12: 修改 loadStats 更新雷达维度标签**

将 `loadStats` 方法中的 `normalizeRadarDimensions` 调用改为使用新的维度标签：

```javascript
  async loadStats() {
    try {
      var res = await api.getMirrorStats();
      var sampleSize = this.data.battlePersona.sampleSize || 0;
      var dims = sampleSize >= 3 ? (res.dimensions || []) : [];
      var labelMap = {
        aggression: '推进倾向',
        stability: '舰体稳定',
        participation: '接入频率',
        comeback: '回稳能力',
        dominance: '场域控制'
      };
      var normalized = dims.map(function (item) {
        return Object.assign({}, item, {
          label: labelMap[item.key] || item.label
        });
      });
      this.setData({
        radarDimensions: normalized.length > 0 ? normalized : this.data.radarDimensions,
        radarLocked: sampleSize < 3
      });
    } catch (e) {
      // 雷达图加载失败不影响主流程
    }
  },
```

- [ ] **Step 13: 修改 onShow 刷新时重播入场动画**

将 `onShow` 方法改为：

```javascript
  onShow() {
    if (this.data.loadedOnce) {
      this.loadProfile(true);
    }
  },
```

- [ ] **Step 14: 验证 JS 无报错**

在微信开发者工具中确认页面加载无 JS 错误，控制台无报错。

- [ ] **Step 15: Commit**

```bash
git add miniprogram/pages/mirror/index.js
git commit -m "refactor: 镜像页 JS 重构 — viewMode 双视图、合并可信度、校准流程切换"
```

---

## Task 7: 重绘分享海报 Canvas

**Files:**
- Modify: `miniprogram/pages/mirror/index.js` — `_drawContent` 方法

- [ ] **Step 1: 重写 _drawContent 方法**

将 `index.js` 的 `_drawContent` 方法（约第 418-528 行）替换为：

```javascript
  _drawContent(ctx, W, H) {
    var d = this.data;
    var mbti = d.mbti || {};
    var battle = d.battlePersona || {};
    var reading = d.reading || {};
    var signals = d.personaSignals || [];
    var padL = 72;
    var contentW = W - padL * 2;

    // ---- 顶部：弱装饰区 ----
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '16px sans-serif';
    this._fillLetterSpaced(ctx, 'SMART RECORD', padL, 72);
    this._fillLetterSpacedRight(ctx, 'MIRROR PROJECTION', W - padL, 72);

    // ---- 中央核心：MBTI 类型 ----
    var coreY = 280;
    ctx.fillStyle = '#00C8FF';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mbti.mbtiType || '----', W / 2, coreY);

    // 类型名
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '32px sans-serif';
    ctx.fillText(sanitizeMirrorText(mbti.mbtiTitle || ''), W / 2, coreY + 52);
    ctx.textAlign = 'left';

    // 简化五维扫描线
    var scanCenterX = W / 2;
    var scanCenterY = coreY + 140;
    var scanRadius = 100;
    var dims = d.radarDimensions || [];
    if (dims.length > 0 && battle.generated) {
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.20)';
      ctx.lineWidth = 1;
      // 外圈
      ctx.beginPath();
      ctx.arc(scanCenterX, scanCenterY, scanRadius, 0, Math.PI * 2);
      ctx.stroke();
      // 五条放射线
      for (var i = 0; i < 5; i++) {
        var angle = -Math.PI / 2 + (Math.PI * 2 / 5) * i;
        var val = (dims[i] ? dims[i].value : 0) / 100;
        var lineLen = scanRadius * val;
        var x2 = scanCenterX + Math.cos(angle) * lineLen;
        var y2 = scanCenterY + Math.sin(angle) * lineLen;
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.50)';
        ctx.beginPath();
        ctx.moveTo(scanCenterX, scanCenterY);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        // 端点
        ctx.fillStyle = '#00C8FF';
        ctx.beginPath();
        ctx.arc(x2, y2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ---- 信息区 ----
    var infoY = scanCenterY + scanRadius + 48;
    var infoBoxW = (contentW - 20) / 2;
    var infoBoxH = 72;

    // 左：协议一致率
    this._roundRect(ctx, padL, infoY, infoBoxW, infoBoxH, 12);
    ctx.strokeStyle = 'rgba(10,132,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.56)';
    ctx.font = '18px sans-serif';
    ctx.fillText('协议一致率', padL + 16, infoY + 28);
    ctx.fillStyle = '#00C8FF';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText((mbti.confidence || 0) + '%', padL + 16, infoY + 58);

    // 右：黑匣子样本
    var infoRX = padL + infoBoxW + 20;
    this._roundRect(ctx, infoRX, infoY, infoBoxW, infoBoxH, 12);
    ctx.strokeStyle = 'rgba(10,132,255,0.18)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.56)';
    ctx.font = '18px sans-serif';
    ctx.fillText('黑匣子样本', infoRX + 16, infoY + 28);
    ctx.fillStyle = '#00C8FF';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(battle.sampleSize + ' / 3', infoRX + 16, infoY + 58);

    // ---- 判读区 ----
    var readY = infoY + infoBoxH + 40;
    var readingText = this._buildReadingText(reading);
    ctx.fillStyle = 'rgba(255,255,255,0.56)';
    ctx.font = '26px sans-serif';
    this._drawWrappedText(ctx, readingText, padL, readY, contentW, 38, 3);

    // ---- 底部标识区 ----
    // 细线
    ctx.strokeStyle = 'rgba(10,132,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, H - 120);
    ctx.lineTo(W - padL, H - 120);
    ctx.stroke();

    // 时间戳
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '18px sans-serif';
    ctx.fillText(d.generatedAt || '', padL, H - 80);

    // 底部品牌
    ctx.fillStyle = 'rgba(10,132,255,0.35)';
    ctx.font = '16px sans-serif';
    this._fillLetterSpaced(ctx, 'SMART RECORD · MIRROR PROJECTION', padL, H - 50);
  },
```

- [ ] **Step 2: 新增 _fillLetterSpacedRight 辅助方法**

在 `_fillLetterSpaced` 方法后面添加：

```javascript
  _fillLetterSpacedRight(ctx, text, x, y) {
    var chars = text.split('');
    var totalW = 0;
    for (var i = 0; i < chars.length; i++) {
      totalW += ctx.measureText(chars[i]).width + 4;
    }
    var cx = x - totalW;
    for (var j = 0; j < chars.length; j++) {
      ctx.fillText(chars[j], cx, y);
      cx += ctx.measureText(chars[j]).width + 4;
    }
  },
```

- [ ] **Step 3: 验证海报生成**

在微信开发者工具中打开镜像页（需要已校准状态），点击「生成镜像卡」，确认：
- 海报中央显示大字 MBTI 类型
- 下方有简化五维扫描线
- 协议一致率和黑匣子样本并排显示
- 判读文字不超过 3 行
- 底部有品牌标识

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/mirror/index.js
git commit -m "refactor: 分享海报重绘为中央核心型布局"
```

---

## Task 8: 删除不再需要的代码

**Files:**
- Modify: `miniprogram/pages/mirror/index.js`

- [ ] **Step 1: 删除旧的 startMbtiTest 方法引用**

确认 `index.js` 中不再有 `startMbtiTest` 方法（已在 Task 6 中替换为 `startFullCalibration`）。如果 WXML 中还有引用 `startMbtiTest` 的地方，改为 `startFullCalibration`。

- [ ] **Step 2: 删除 confidenceChecklist 相关代码**

在 `loadProfile` 中搜索 `confidenceChecklist`，确认已删除相关 setData 字段。

- [ ] **Step 3: 删除 normalizeRadarDimensions 函数引用**

确认 `index.js` 顶部不再引用 `normalizeRadarDimensions`（已在 Task 6 的 loadStats 中替换）。删除函数定义和 `ZERO_DIMS` 的旧维度标签（保留新的）。

- [ ] **Step 4: 验证**

在微信开发者工具中确认页面功能正常，无 JS 报错。

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/mirror/index.js
git commit -m "refactor: 清理镜像页废弃代码"
```

---

## Task 9: 动效守卫与验收

**Files:**
- Verify: `miniprogram/pages/mirror/index.wxml`
- Verify: `miniprogram/pages/mirror/index.js`
- Verify: `miniprogram/pages/mirror/index.wxss`

- [ ] **Step 1: 验证 reduce-motion 绑定**

确认 `index.wxml` 根节点有 `{{reduceMotion ? 'reduce-motion' : ''}}` 类。

- [ ] **Step 2: 验证 timer 清理**

确认 `onUnload` 调用了 `_clearScanTimers()` 和 `_clearEntryTimers()`。

- [ ] **Step 3: 验证入场动画守卫**

确认 `_playEntryAnimation` 在 `reduceMotion` 为 true 时直接设置 opacity 为 1。

- [ ] **Step 4: 验证无穿帮词**

在微信开发者工具中全局搜索以下词，确认不出现在用户可见文案中：
- `LLM`、`LOW-NOISE`、`MEDIUM-NOISE`、`HIGH-NOISE`、`HIGH_RISK`
- `fallback`、`oracle`、`fortune`、`THE CALIBRATOR`
- `盈利`、`亏损`、`收益`、`胜率`、`预测`

- [ ] **Step 5: 验证无审核高风险词**

确认页面中不出现：棋牌、赌博、押注、运势、算命、占卜等词。

- [ ] **Step 6: 验证英文比例**

确认页面中英文仅作为弱装饰（kicker 标签），主操作和主标题为中文。

- [ ] **Step 7: 验证红色使用**

确认红色仅用于危险/错误/失败场景（如退出确认弹窗的 confirmType="danger"），不用于普通状态。

- [ ] **Step 8: 验证底部安全区**

确认底部固定栏有 `calc(env(safe-area-inset-bottom) + 16rpx)` padding。

- [ ] **Step 9: 最终 Commit**

```bash
git add -A
git commit -m "refactor: 镜像页全息观测舱重构完成"
```
