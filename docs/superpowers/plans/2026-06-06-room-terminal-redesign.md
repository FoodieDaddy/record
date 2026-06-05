# Room Terminal 全面改造实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将房间页从"记分工具"重构为"积分流转终端"，统一赛博终端视觉风格。

**Architecture:** 改造 room.wxml/wxss/js 三个核心文件 + 10 个相关组件。保持现有数据流和 API 不变，仅改视觉层和动画层。移除房间页的 force-graph 引用。

**Tech Stack:** 原生微信小程序 (WXML/WXSS/JS)，Canvas 2D (score-chart)

---

## 文件变更总览

| 文件 | 操作 | 说明 |
|---|---|---|
| `miniprogram/pages/room/room.wxml` | 修改 | 主模板：终端栏、成员网络、流转终端、积分流、洞察、结算按钮、确认弹窗 |
| `miniprogram/pages/room/room.wxss` | 修改 | 主样式：全部模块视觉改造 |
| `miniprogram/pages/room/room.js` | 修改 | 动画系统重构（单动画）、结算确认逻辑、移除网络图数据加载 |
| `miniprogram/pages/room/room.json` | 修改 | 移除 force-graph 组件引用 |
| `miniprogram/components/host-fill-modal/*` | 修改 | 暗色玻璃卡风格 |
| `miniprogram/components/member-fill-modal/*` | 修改 | 暗色玻璃卡风格 |
| `miniprogram/components/round-confirm-modal/*` | 修改 | 暗色玻璃卡风格 |
| `miniprogram/components/round-status-bar/*` | 修改 | 配色统一 |
| `miniprogram/components/battle-summary/*` | 修改 | 配色统一 |
| `miniprogram/components/battle-insight/*` | 修改 | 数据块风格 |
| `miniprogram/components/score-chart/*` | 修改 | 移除橙色，统一蓝绿红 |
| `miniprogram/components/persona-signal/*` | 修改 | 配色统一 |

---

### Task 1: ROOM TERMINAL 顶部终端栏改造

**Files:**
- Modify: `miniprogram/pages/room/room.wxml:340-365`
- Modify: `miniprogram/pages/room/room.wxss:1250-1354`

- [ ] **Step 1: 改造 WXML 顶部终端栏**

将当前的单行信息改为分段式终端状态栏：

```xml
<!-- ROOM TERMINAL 顶部终端栏 -->
<view class="room-terminal">
  <view class="rt-top-row">
    <text class="rt-kicker">ROOM TERMINAL</text>
    <view class="rt-status">
      <view class="rt-status-dot"></view>
      <text class="rt-status-text">ONLINE</text>
    </view>
  </view>
  <view class="rt-info-grid">
    <view class="rt-info-seg">
      <text class="rt-info-label">ROOM ID</text>
      <text class="rt-info-value">{{currentRoom.roomNo}}</text>
    </view>
    <view class="rt-info-seg">
      <text class="rt-info-label">MODE</text>
      <text class="rt-info-value">{{currentRoom.scoreMode === 1 ? '自由流转' : '本局录入'}}</text>
    </view>
    <view class="rt-info-seg">
      <text class="rt-info-label">PLAYERS</text>
      <text class="rt-info-value">{{memberGrid.length}} / {{currentRoom.maxMembers || 16}}</text>
    </view>
  </view>
  <view class="rt-actions">
    <view class="rt-action" bindtap="copyRoomNo">
      <view class="icon-clip"></view>
    </view>
    <view class="rt-action" bindtap="openShareSheet">
      <view class="icon-share"></view>
    </view>
  </view>
</view>
```

- [ ] **Step 2: 改造 WXSS 顶部终端栏样式**

替换 `.room-terminal` 到 `.rt-action:active` 的全部样式（约 line 1250-1354）：

```css
/* ===== ROOM TERMINAL 顶部终端栏 ===== */
.room-terminal {
  padding: 24rpx;
  border: 1rpx solid rgba(0,170,255,0.15);
  border-radius: 16px;
  background: #0A0F18;
  position: relative;
  overflow: hidden;
  margin-bottom: 16rpx;
}
.room-terminal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 10%;
  right: 10%;
  height: 1rpx;
  background: linear-gradient(90deg, transparent, rgba(0,170,255,0.3), transparent);
}
.rt-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}
.rt-kicker {
  font-size: 18rpx;
  color: rgba(0,170,255,0.72);
  letter-spacing: 4rpx;
  font-family: monospace;
}
.rt-status {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.rt-status-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: #36FF74;
  box-shadow: 0 0 8rpx rgba(54,255,116,0.6);
}
.rt-status-text {
  font-size: 16rpx;
  color: #36FF74;
  letter-spacing: 2rpx;
  font-family: monospace;
}
.rt-info-grid {
  display: flex;
  gap: 32rpx;
  margin-bottom: 20rpx;
}
.rt-info-seg {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.rt-info-label {
  font-size: 16rpx;
  color: #7C8698;
  letter-spacing: 2rpx;
  font-family: monospace;
}
.rt-info-value {
  font-size: 28rpx;
  font-weight: 700;
  color: #00AFFF;
  letter-spacing: 2rpx;
  font-family: "SF Mono", "Menlo", "Courier New", monospace;
  font-variant-numeric: tabular-nums;
}
.rt-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
  justify-content: flex-end;
}
.rt-action {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(0,170,255,0.2);
  background: transparent;
  transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s;
  opacity: 0.7;
  color: #00AFFF;
}
.rt-action:active {
  opacity: 1;
  transform: scale(0.9);
  box-shadow: 0 0 12rpx rgba(0,170,255,0.3);
}
```

- [ ] **Step 3: 验证**

在微信开发者工具中查看房间页顶部终端栏：
- 背景应为 `#0A0F18` 深色
- ROOM ID / MODE / PLAYERS 三段式显示
- 在线状态为绿色
- 操作按钮有蓝色描边

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/room/room.wxml miniprogram/pages/room/room.wxss
git commit -m "feat(room): 顶部终端栏改为分段式状态栏"
```

---

### Task 2: PLAYER NETWORK 成员网络改造

**Files:**
- Modify: `miniprogram/pages/room/room.wxml:384-413`
- Modify: `miniprogram/pages/room/room.wxss:1378-1516`
- Modify: `miniprogram/pages/room/room.js` — `buildMemberGrid()` 和 `getScoreStyle()`

- [ ] **Step 1: 改造 WXML 成员网络**

替换成员网格模板，增加赛博环、HOST 标签、TARGET LOCKED：

```xml
<!-- PLAYER NETWORK 成员网络 -->
<view class="player-network">
  <view class="pn-header">
    <view class="pn-title-group">
      <text class="pn-cn">成员网络</text>
      <text class="pn-en">PLAYER NETWORK</text>
    </view>
    <text class="pn-count">{{memberGrid.length}} / {{currentRoom.maxMembers || 16}}</text>
  </view>
  <view class="pn-divider"></view>
  <scroll-view class="member-h-scroll" scroll-x="{{memberGrid.length > 4}}" enhanced show-scrollbar="{{false}}">
    <view class="member-h-list">
      <view class="mg-cell {{item.userId === transferTo ? 'mg-cell-selected' : ''}}"
            wx:for="{{memberGrid}}" wx:key="userId"
            bindtap="onTapMember" data-user-id="{{item.userId}}">
        <view class="mg-avatar-wrap">
          <!-- 赛博环 -->
          <view class="mg-cyber-ring {{item.userId === transferTo ? 'ring-selected' : ''}} {{item.score > 0 ? 'ring-positive' : item.score < 0 ? 'ring-negative' : ''}} {{item.isHost ? 'ring-host' : ''}}"></view>
          <view class="auto-avatar" style="background:{{item.avatarColor}};" wx:if="{{!item.avatarUrl}}">
            <text class="auto-avatar-char">{{item.avatarChar}}</text>
          </view>
          <image class="mg-avatar" src="{{item.avatarUrl}}" mode="aspectFill" wx:else binderror="onAvatarError" data-user-id="{{item.userId}}"></image>
          <!-- HOST 标签 -->
          <view class="mg-host-badge" wx:if="{{item.isHost}}">HOST</view>
        </view>
        <text class="mg-name">{{t.truncateName(item.nickname)}}</text>
        <text class="mg-score score-number" style="color:{{item.scoreColor}};">
          {{item.score > 0 ? '+' : ''}}{{fmt.formatScore(item.displayScore)}}
        </text>
        <!-- TARGET LOCKED -->
        <text class="mg-target-lock" wx:if="{{item.userId === transferTo}}">TARGET LOCKED</text>
      </view>
    </view>
  </scroll-view>
</view>
```

- [ ] **Step 2: 改造 WXSS 成员网络样式**

替换 `.player-network` 到 `.mg-score` 的全部样式（约 line 1378-1516）：

```css
/* ===== PLAYER NETWORK 成员网络 ===== */
.player-network {
  padding: 24rpx;
  border: 1rpx solid rgba(0,170,255,0.12);
  border-radius: 16rpx;
  background: rgba(255,255,255,0.025);
  margin-bottom: 16rpx;
}
.pn-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}
.pn-title-group {
  display: flex;
  flex-direction: column;
}
.pn-cn {
  font-size: 28rpx;
  font-weight: 600;
  color: #FFFFFF;
  letter-spacing: 2rpx;
}
.pn-en {
  font-size: 18rpx;
  color: rgba(0,170,255,0.5);
  letter-spacing: 4rpx;
  font-family: monospace;
  margin-top: 2rpx;
}
.pn-count {
  font-size: 22rpx;
  color: #7C8698;
  font-variant-numeric: tabular-nums;
}
.pn-divider {
  height: 1rpx;
  background: rgba(255,255,255,0.04);
  margin: 16rpx 0;
}

/* 横向滚动 */
.member-h-scroll {
  white-space: nowrap;
}
.member-h-list {
  display: inline-flex;
  gap: 24rpx;
  padding: 8rpx 0;
}
.mg-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  min-width: 120rpx;
  padding: 16rpx 8rpx;
  border-radius: 12rpx;
  transition: opacity 0.2s, transform 0.2s, background-color 0.2s;
  position: relative;
}
.mg-cell:active {
  transform: scale(0.92);
}
.mg-cell-selected {
  background: rgba(0,170,255,0.06);
  transform: translateY(-4rpx);
}

/* 头像 + 赛博环 */
.mg-avatar-wrap {
  position: relative;
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mg-cyber-ring {
  position: absolute;
  inset: -4rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(255,255,255,0.12);
  transition: border-color 0.3s, box-shadow 0.3s;
  pointer-events: none;
}
.ring-selected {
  border-color: #00AFFF;
  box-shadow: 0 0 16rpx rgba(0,170,255,0.4);
  animation: ringBreathe 2s ease-in-out infinite;
}
.ring-positive {
  border-color: rgba(54,255,116,0.4);
  box-shadow: 0 0 8rpx rgba(54,255,116,0.15);
}
.ring-negative {
  border-color: rgba(255,77,79,0.4);
  box-shadow: 0 0 8rpx rgba(255,77,79,0.15);
}
.ring-host {
  border-color: rgba(0,170,255,0.3);
}
@keyframes ringBreathe {
  0%, 100% { opacity: 1; box-shadow: 0 0 16rpx rgba(0,170,255,0.4); }
  50% { opacity: 0.6; box-shadow: 0 0 24rpx rgba(0,170,255,0.6); }
}
.mg-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  overflow: hidden;
  display: block;
}
.mg-cell .auto-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.auto-avatar-char {
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
}

/* HOST 标签 */
.mg-host-badge {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  font-size: 14rpx;
  color: #00AFFF;
  background: rgba(0,170,255,0.15);
  border: 1rpx solid rgba(0,170,255,0.3);
  border-radius: 6rpx;
  padding: 2rpx 8rpx;
  letter-spacing: 1rpx;
  font-family: monospace;
  pointer-events: none;
}

.mg-name {
  font-size: 22rpx;
  color: #BFC7D5;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120rpx;
}
.mg-score {
  font-size: 28rpx;
  font-weight: 700;
  text-align: center;
  white-space: nowrap;
  font-family: "SF Mono", "Menlo", "Courier New", monospace;
  font-variant-numeric: tabular-nums;
}

/* TARGET LOCKED */
.mg-target-lock {
  font-size: 14rpx;
  color: #00AFFF;
  letter-spacing: 2rpx;
  font-family: monospace;
  opacity: 0.8;
  animation: targetPulse 1.5s ease-in-out infinite;
}
@keyframes targetPulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 0.4; }
}

.reduce-motion .ring-selected { animation: none; }
.reduce-motion .mg-target-lock { animation: none; opacity: 0.8; }
```

- [ ] **Step 3: 改造 JS `buildMemberGrid()` 增加 `isHost` 字段**

在 `buildMemberGrid()` 方法中（约 line 221），为每个成员增加 `isHost` 标记：

```javascript
// 在 buildMemberGrid() 的 grid = sorted.map(...) 中增加：
return {
  ...m,
  score,
  displayScore,
  scoreFontSize: style.fontSize,
  scoreColor: style.color,
  isHost: String(m.userId) === String(room.ownerId)
};
```

- [ ] **Step 4: 改造 JS `getScoreStyle()` 零分颜色**

将零分颜色从 `#9CA3AF` 改为 `#7C8698`：

```javascript
getScoreStyle(score) {
  const fontSize = 28;
  let color;
  if (score === 0) {
    color = '#7C8698';
  } else if (score > 0) {
    color = '#36FF74';
  } else {
    color = '#FF4D4F';
  }
  return { fontSize, color };
},
```

- [ ] **Step 5: 验证**

- 成员头像有赛博环（灰蓝默认、蓝色选中、绿色正收益、红色负收益）
- 房主有 HOST 标签
- 选中成员显示 TARGET LOCKED
- 积分正数绿色带 `+`，负数红色带 `-`，零分灰色
- 人数 > 4 时可横向滚动

- [ ] **Step 6: Commit**

```bash
git add miniprogram/pages/room/room.wxml miniprogram/pages/room/room.wxss miniprogram/pages/room/room.js
git commit -m "feat(room): 成员网络改为赛博节点风格，增加环/标签/锁定态"
```

---

### Task 3: TRANSFER TERMINAL 流转终端改造

**Files:**
- Modify: `miniprogram/pages/room/room.wxml:531-595`
- Modify: `miniprogram/pages/room/room.wxss:1617-1854`

- [ ] **Step 1: 改造 WXML 流转终端**

增加 FROM/TO 标签、改善预览区域：

```xml
<!-- TRANSFER TERMINAL 流转终端 -->
<view class="transfer-overlay {{showNumpad ? 'transfer-show' : ''}}" catchtap="closeNumpad">
  <view class="transfer-sheet" catchtap="preventClose">
    <view class="transfer-header">
      <text class="transfer-kicker">TRANSFER TERMINAL</text>
      <text class="transfer-subtitle">积分流转</text>
    </view>

    <!-- FROM → TO -->
    <view class="transfer-direction">
      <view class="transfer-player">
        <text class="transfer-role-label">FROM</text>
        <view class="auto-avatar-sm" style="background:{{transferFromInfo.avatarColor}};" wx:if="{{!transferFromInfo.avatarUrl && transferFromInfo}}">
          <text class="auto-avatar-char-sm">{{transferFromInfo.avatarChar}}</text>
        </view>
        <image class="transfer-avatar" src="{{transferFromInfo.avatarUrl}}" wx:elif="{{transferFromInfo}}" mode="aspectFill"></image>
        <text class="transfer-player-name">{{t.truncateName(transferFromInfo.nickname)}}</text>
      </view>
      <view class="transfer-arrow-wrap">
        <view class="transfer-arrow-line"></view>
        <text class="transfer-arrow-head">→</text>
      </view>
      <view class="transfer-player">
        <text class="transfer-role-label">TO</text>
        <view class="auto-avatar-sm" style="background:{{transferToInfo.avatarColor}};" wx:if="{{!transferToInfo.avatarUrl && transferToInfo}}">
          <text class="auto-avatar-char-sm">{{transferToInfo.avatarChar}}</text>
        </view>
        <image class="transfer-avatar" src="{{transferToInfo.avatarUrl}}" wx:elif="{{transferToInfo}}" mode="aspectFill"></image>
        <text class="transfer-player-name">{{t.truncateName(transferToInfo.nickname)}}</text>
      </view>
    </view>

    <!-- AMOUNT -->
    <view class="transfer-amount-section">
      <text class="transfer-amount-label">AMOUNT</text>
      <text class="transfer-display-value">{{numpadValue > 0 ? '+' : ''}}{{numpadValue || '0'}}</text>
    </view>

    <!-- 实时预览 -->
    <view class="transfer-preview" wx:if="{{numpadValue > 0 && transferPreview}}">
      <view class="tp-row">
        <text class="tp-name">{{transferPreview.fromName}}</text>
        <view class="tp-arrow">
          <text class="tp-score-old">{{transferPreview.fromOldScore}}</text>
          <text class="tp-arrow-icon">→</text>
          <text class="tp-score" style="color:#FF4D4F;">{{transferPreview.fromNewScore}}</text>
        </view>
      </view>
      <view class="tp-divider"></view>
      <view class="tp-row">
        <text class="tp-name">{{transferPreview.toName}}</text>
        <view class="tp-arrow">
          <text class="tp-score-old">{{transferPreview.toOldScore}}</text>
          <text class="tp-arrow-icon">→</text>
          <text class="tp-score" style="color:#36FF74;">{{transferPreview.toNewScore}}</text>
        </view>
      </view>
    </view>

    <!-- 数字键盘 -->
    <view class="transfer-numpad">
      <view class="transfer-key" bindtap="onNumpadKey" data-key="1">1</view>
      <view class="transfer-key" bindtap="onNumpadKey" data-key="2">2</view>
      <view class="transfer-key" bindtap="onNumpadKey" data-key="3">3</view>
      <view class="transfer-key" bindtap="onNumpadKey" data-key="4">4</view>
      <view class="transfer-key" bindtap="onNumpadKey" data-key="5">5</view>
      <view class="transfer-key" bindtap="onNumpadKey" data-key="6">6</view>
      <view class="transfer-key" bindtap="onNumpadKey" data-key="7">7</view>
      <view class="transfer-key" bindtap="onNumpadKey" data-key="8">8</view>
      <view class="transfer-key" bindtap="onNumpadKey" data-key="9">9</view>
      <view class="transfer-key transfer-key-func" bindtap="onNumpadKey" data-key="clear">C</view>
      <view class="transfer-key" bindtap="onNumpadKey" data-key="0">0</view>
      <view class="transfer-key transfer-key-func" bindtap="onNumpadKey" data-key="del">⌫</view>
    </view>
    <view class="transfer-actions">
      <view class="transfer-confirm" bindtap="confirmNumpad">
        <text class="transfer-confirm-text">确认流转</text>
        <text class="transfer-confirm-sub">CONFIRM FLOW</text>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 2: 改造 WXSS 流转终端样式**

更新 key 部分样式（保持整体结构不变，调整细节）：

```css
/* 增加角色标签 */
.transfer-role-label {
  font-size: 14rpx;
  color: #7C8698;
  letter-spacing: 2rpx;
  font-family: monospace;
}

/* AMOUNT 区域 */
.transfer-amount-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.05);
}
.transfer-amount-label {
  font-size: 16rpx;
  color: #7C8698;
  letter-spacing: 3rpx;
  font-family: monospace;
  margin-bottom: 8rpx;
}

/* 预览区域增加旧分→新分 */
.tp-arrow {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.tp-score-old {
  font-size: 24rpx;
  color: #7C8698;
  font-family: "SF Mono", "Menlo", "Courier New", monospace;
}
.tp-arrow-icon {
  font-size: 20rpx;
  color: #00AFFF;
}

/* 数字键盘按键边框改为蓝色弱描边 */
.transfer-key {
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.04);
  border: 1rpx solid rgba(0,170,255,0.12);
  border-radius: 14rpx;
  font-size: 40rpx;
  font-weight: 500;
  color: #fff;
  transition: background 0.15s, border-color 0.15s;
}
.transfer-key:active {
  background: rgba(0,170,255,0.12);
  border-color: rgba(0,170,255,0.3);
}
.transfer-key-func {
  background: transparent;
  border-color: rgba(255,255,255,0.06);
  color: #7C8698;
  font-size: 32rpx;
}
```

- [ ] **Step 3: 改造 JS `transferPreview` 增加旧分**

在 `onNumpadKey` 处理中（约 line 840-877），计算 preview 时增加 `fromOldScore` 和 `toOldScore`：

```javascript
// 在 numpad 计算 preview 的位置，确保 transferPreview 包含：
transferPreview: {
  fromName: fromMember.nickname,
  fromOldScore: fromScore,
  fromNewScore: fromScore - amount,
  toName: toMember.nickname,
  toOldScore: toScore,
  toNewScore: toScore + amount
}
```

- [ ] **Step 4: 验证**

- 流转终端有 FROM / TO / AMOUNT 标签
- 预览显示 旧分 → 新分
- 数字键盘按键有蓝色弱描边
- 确认按钮为蓝色 `CONFIRM FLOW`

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/room/room.wxml miniprogram/pages/room/room.wxss miniprogram/pages/room/room.js
git commit -m "feat(room): 流转终端增加角色标签和旧分预览"
```

---

### Task 4: 积分动画重构 — 单动画模式

**Files:**
- Modify: `miniprogram/pages/room/room.js` — `playTransferAnimation()` 和 `playScoreRollAnimation()`

- [ ] **Step 1: 重构 `playScoreRollAnimation()` 为短促跳变**

将当前 600ms 的滚动动画改为 300ms 的跳变（淡出 → 淡入 + scale）：

```javascript
/** 分数跳变动画：淡出 → 新值淡入 + scale */
playScoreRollAnimation(fromUserId, toUserId, amount) {
  if (this._rollTimer) return;

  const grid = this.data.memberGrid;
  const fromIdx = grid.findIndex(m => String(m.userId) === String(fromUserId));
  const toIdx = grid.findIndex(m => String(m.userId) === String(toUserId));
  if (fromIdx < 0 || toIdx < 0) return;

  const fromOld = this._rollOldFromScore;
  const toOld = this._rollOldToScore;
  const fromNew = grid[fromIdx].score;
  const toNew = grid[toIdx].score;

  if (fromOld === fromNew && toOld === toNew) {
    this._animatingScores = {};
    return;
  }

  if (!app.globalData.animationEnabled) {
    const updates = {};
    updates[`memberGrid[${fromIdx}].displayScore`] = fromNew;
    updates[`memberGrid[${toIdx}].displayScore`] = toNew;
    this.setData(updates);
    this._animatingScores = {};
    return;
  }

  const duration = 300;
  const startTime = Date.now();

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const t = Math.min(elapsed / duration, 1);

    // scale: 1.0 → 1.12 → 1.0
    const scale = 1 + 0.12 * Math.sin(t * Math.PI);
    // opacity: 1 → 0.3 → 1
    const opacity = 0.3 + 0.7 * Math.abs(Math.cos(t * Math.PI));

    const updates = {};
    // 前半段显示旧值（淡出），后半段显示新值（淡入）
    if (t < 0.5) {
      updates[`memberGrid[${fromIdx}].displayScore`] = fromOld;
      updates[`memberGrid[${toIdx}].displayScore`] = toOld;
    } else {
      updates[`memberGrid[${fromIdx}].displayScore`] = fromNew;
      updates[`memberGrid[${toIdx}].displayScore`] = toNew;
    }
    this.setData(updates);

    if (t < 1) {
      this._rollTimer = setTimeout(animate, 16);
    } else {
      const finalUpdates = {};
      finalUpdates[`memberGrid[${fromIdx}].displayScore`] = fromNew;
      finalUpdates[`memberGrid[${toIdx}].displayScore`] = toNew;
      this.setData(finalUpdates);
      this._rollTimer = null;
      this._animatingScores = {};
    }
  };

  this._rollTimer = setTimeout(animate, 16);
},
```

- [ ] **Step 2: 验证**

- 给分后只有流光飞行动画（主动画）
- 飞行结束后，目标成员积分有短促跳变（300ms，scale 1.0→1.12→1.0）
- 不再有长时间的数字滚动
- 关闭动画开关后，数字直接更新

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/room/room.js
git commit -m "feat(room): 积分动画改为单动画模式，数字跳变替代滚动"
```

---

### Task 5: FLOW LOG 积分流改造

**Files:**
- Modify: `miniprogram/pages/room/room.wxml:416-464`
- Modify: `miniprogram/pages/room/room.wxss:1884-2050`

- [ ] **Step 1: 改造 WXML 积分流**

重新布局为时间线数据流，增加「我参与」高亮和空状态改善：

```xml
<!-- FLOW LOG 积分流 -->
<view class="flow-log">
  <view class="fl-header">
    <view class="fl-title-group">
      <text class="fl-cn">积分流</text>
      <text class="fl-en">FLOW LOG</text>
    </view>
    <view style="display:flex;gap:12rpx;">
      <view class="fl-filter {{filterMine ? 'fl-filter-on' : ''}}" bindtap="toggleFilterMine">
        <view class="icon-person matrix-btn-icon-svg"></view>
        <text class="fl-filter-text">我</text>
      </view>
      <view class="fl-overview-btn" bindtap="openMatrixPanel" wx:if="{{memberGrid.length >= 2}}">
        <view class="icon-chart matrix-btn-icon-svg"></view>
        <text class="fl-filter-text">总览</text>
      </view>
    </view>
  </view>
  <view class="fl-divider"></view>

  <!-- 空状态 -->
  <view wx:if="{{groupedRecords.length === 0}}" class="fl-empty">
    <view class="fl-empty-pulse"></view>
    <text class="fl-empty-title">NO FLOW DATA</text>
    <text class="fl-empty-text">暂无积分流</text>
    <text class="fl-empty-hint">完成一次积分流转后，系统将在此记录数据</text>
  </view>

  <!-- 记录列表 -->
  <view wx:else class="fl-list">
    <block wx:for="{{groupedRecords}}" wx:key="timeKey">
      <view class="fl-time-header">
        <text class="fl-time-dot">●</text>
        <text class="fl-time-text">{{item.timeDisplay}}</text>
      </view>
      <view class="fl-item {{rec.myRole ? 'fl-item-mine' : ''}}" wx:for="{{item.records}}" wx:for-item="rec" wx:key="id">
        <view class="fl-dot {{rec.myRole ? 'fl-dot-mine' : ''}}"></view>
        <text class="fl-from-name">{{rec.fromName}}</text>
        <view class="fl-arrow-wrap">
          <view class="fl-arrow-line"></view>
          <text class="fl-amount {{rec.myRole === 'from' ? 'fl-amt-red' : rec.myRole === 'to' ? 'fl-amt-green' : 'fl-amt-white'}}">{{fmt.formatAmount(rec.amount)}}</text>
          <view class="fl-arrow-line"></view>
          <text class="fl-arrow-head">→</text>
        </view>
        <text class="fl-to-name">{{rec.toName}}</text>
      </view>
    </block>
    <view wx:if="{{loadingMore}}" class="fl-loading">
      <text class="fl-loading-text">加载中...</text>
    </view>
    <view wx:if="{{noMore && groupedRecords.length > 0}}" class="fl-loading">
      <text class="fl-loading-text">— 没有更多了 —</text>
    </view>
  </view>
</view>
```

- [ ] **Step 2: 改造 WXSS 积分流样式**

```css
/* ===== FLOW LOG 积分流 ===== */
.flow-log {
  padding: 24rpx;
  border: 1rpx solid rgba(0,170,255,0.1);
  border-radius: 16rpx;
  background: rgba(255,255,255,0.025);
  overflow: visible;
}
.fl-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}
.fl-title-group {
  display: flex;
  flex-direction: column;
}
.fl-cn {
  font-size: 28rpx;
  font-weight: 600;
  color: #FFFFFF;
  letter-spacing: 2rpx;
}
.fl-en {
  font-size: 18rpx;
  color: rgba(0,170,255,0.5);
  letter-spacing: 4rpx;
  font-family: monospace;
  margin-top: 2rpx;
}
.fl-filter {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 16rpx;
  background: rgba(255,255,255,0.06);
  border: 1rpx solid rgba(255,255,255,0.08);
  border-radius: 32rpx;
  opacity: 0.4;
  transition: opacity 0.2s, background-color 0.2s, border-color 0.2s;
}
.fl-filter-on {
  opacity: 1;
  background: rgba(0,170,255,0.15);
  border-color: rgba(0,170,255,0.3);
}
.fl-filter-text {
  font-size: 22rpx;
  color: rgba(255,255,255,0.5);
}
.fl-overview-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 20rpx;
  background: rgba(255,255,255,0.06);
  border: 1rpx solid rgba(255,255,255,0.08);
  border-radius: 32rpx;
  transition: background-color 0.2s;
}
.fl-overview-btn:active {
  background: rgba(255,255,255,0.12);
}
.fl-divider {
  height: 1rpx;
  background: rgba(255,255,255,0.04);
  margin: 16rpx 0;
}

/* 空状态 */
.fl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 0 32rpx;
  gap: 12rpx;
}
.fl-empty-pulse {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #00AFFF;
  opacity: 0.3;
  animation: emptyPulse 2s ease-in-out infinite;
  margin-bottom: 8rpx;
}
@keyframes emptyPulse {
  0%, 100% { opacity: 0.2; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.3); }
}
.fl-empty-title {
  font-size: 20rpx;
  color: #7C8698;
  letter-spacing: 4rpx;
  font-family: monospace;
}
.fl-empty-text {
  font-size: 26rpx;
  color: rgba(255,255,255,0.5);
}
.fl-empty-hint {
  font-size: 22rpx;
  color: #7C8698;
  text-align: center;
}

/* 时间头 */
.fl-time-header {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 16rpx 0 8rpx;
  position: sticky;
  top: 0;
  z-index: 5;
  background: rgba(10,10,10,0.95);
}
.fl-time-dot {
  font-size: 14rpx;
  color: #00AFFF;
}
.fl-time-text {
  font-size: 22rpx;
  color: #7C8698;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

/* 记录行 */
.fl-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 16rpx;
  border-radius: 8rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.03);
  transition: background-color 0.2s;
}
.fl-item:last-child {
  border-bottom: none;
}
.fl-item-mine {
  background: rgba(0,170,255,0.05);
}
.fl-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: #00AFFF;
  opacity: 0.4;
  flex-shrink: 0;
}
.fl-dot-mine {
  opacity: 1;
  box-shadow: 0 0 8rpx rgba(0,170,255,0.6);
}
.fl-from-name {
  font-size: 24rpx;
  color: #BFC7D5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
  max-width: 160rpx;
}
.fl-to-name {
  font-size: 24rpx;
  color: #FFFFFF;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
  max-width: 160rpx;
}
.fl-arrow-wrap {
  display: flex;
  align-items: center;
  gap: 6rpx;
  flex-shrink: 0;
}
.fl-arrow-line {
  width: 16rpx;
  height: 1rpx;
  background: rgba(0,170,255,0.3);
}
.fl-amount {
  font-size: 28rpx;
  font-weight: 700;
  font-family: "SF Mono", "Menlo", "Courier New", monospace;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.fl-arrow-head {
  font-size: 20rpx;
  color: #00AFFF;
}
.fl-amt-red {
  color: #FF4D4F;
}
.fl-amt-green {
  color: #36FF74;
}
.fl-amt-white {
  color: rgba(255,255,255,0.72);
}
.fl-loading {
  display: flex;
  justify-content: center;
  padding: 20rpx 0;
}
.fl-loading-text {
  font-size: 22rpx;
  color: #7C8698;
}

.reduce-motion .fl-empty-pulse { animation: none; opacity: 0.3; }
```

- [ ] **Step 3: 验证**

- 积分流为空时显示脉冲点 + NO FLOW DATA + 提示文案
- 我参与的记录有蓝色背景高亮和蓝点
- 时间头带蓝色圆点
- 来源玩家灰色，目标玩家白色，箭头蓝色

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/room/room.wxml miniprogram/pages/room/room.wxss
git commit -m "feat(room): 积分流改为时间线数据流布局"
```

---

### Task 6: ROOM INSIGHT 战局洞察改造

**Files:**
- Modify: `miniprogram/pages/room/room.wxml:467-500`
- Modify: `miniprogram/pages/room/room.wxss:2702-2800`

- [ ] **Step 1: 改造 WXML 战局洞察为数据块**

```xml
<!-- ROOM INSIGHT 战局洞察 -->
<view class="room-insight" wx:if="{{roomInsight && roomInsight.transferCount > 0}}">
  <view class="ri-header">
    <text class="ri-cn">战局洞察</text>
    <text class="ri-en">ROOM INSIGHT</text>
  </view>
  <view class="ri-divider"></view>
  <view class="ri-blocks">
    <!-- 最活跃 -->
    <view class="ri-block">
      <text class="ri-block-label">本场最活跃</text>
      <text class="ri-block-value" wx:if="{{roomInsight.mostActiveUser}}">{{roomInsight.mostActiveUser.nickname}}</text>
      <text class="ri-block-sub" wx:if="{{roomInsight.mostActiveUser}}">互动{{roomInsight.mostActiveUser.count}}次</text>
      <text class="ri-block-value ri-block-na" wx:else>—</text>
    </view>
    <!-- 最大流转 -->
    <view class="ri-block">
      <text class="ri-block-label">最大流转</text>
      <text class="ri-block-num">{{roomInsight.maxSingleTransfer}}</text>
    </view>
    <!-- 积分流转量 -->
    <view class="ri-block">
      <text class="ri-block-label">积分流转量</text>
      <text class="ri-block-num">{{roomInsight.totalTransfer}}</text>
    </view>
    <!-- 互动密度 -->
    <view class="ri-block">
      <text class="ri-block-label">互动密度</text>
      <view class="ri-density-wrap">
        <view class="ri-density-bar">
          <view class="ri-density-fill ri-density-{{roomInsight.networkDensity === 'HIGH' ? 'high' : roomInsight.networkDensity === 'MEDIUM' ? 'mid' : 'low'}}"
            style="width:{{roomInsight.networkDensity === 'HIGH' ? '100' : roomInsight.networkDensity === 'MEDIUM' ? '60' : '25'}}%;">
          </view>
        </view>
        <text class="ri-density-text">{{roomInsight.networkDensity}}</text>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 2: 改造 WXSS 战局洞察为数据块风格**

替换 `.room-insight` 区域样式：

```css
/* ===== ROOM INSIGHT 战局洞察 ===== */
.room-insight {
  padding: 24rpx;
  border: 1rpx solid rgba(0,170,255,0.1);
  border-radius: 16rpx;
  background: rgba(255,255,255,0.025);
  margin-bottom: 16rpx;
}
.ri-header {
  display: flex;
  flex-direction: column;
}
.ri-cn {
  font-size: 28rpx;
  font-weight: 600;
  color: #FFFFFF;
  letter-spacing: 2rpx;
}
.ri-en {
  font-size: 18rpx;
  color: rgba(0,170,255,0.5);
  letter-spacing: 4rpx;
  font-family: monospace;
  margin-top: 2rpx;
}
.ri-divider {
  height: 1rpx;
  background: rgba(255,255,255,0.04);
  margin: 16rpx 0;
}

/* 数据块网格 */
.ri-blocks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}
.ri-block {
  padding: 16rpx;
  background: rgba(255,255,255,0.02);
  border: 1rpx solid rgba(255,255,255,0.05);
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.ri-block-label {
  font-size: 20rpx;
  color: #7C8698;
}
.ri-block-value {
  font-size: 26rpx;
  font-weight: 600;
  color: #FFFFFF;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ri-block-na {
  color: #7C8698;
}
.ri-block-sub {
  font-size: 20rpx;
  color: #00AFFF;
}
.ri-block-num {
  font-size: 36rpx;
  font-weight: 700;
  color: #00AFFF;
  font-family: "SF Mono", "Menlo", "Courier New", monospace;
  font-variant-numeric: tabular-nums;
}

/* 密度条 */
.ri-density-wrap {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.ri-density-bar {
  flex: 1;
  height: 8rpx;
  background: rgba(255,255,255,0.06);
  border-radius: 4rpx;
  overflow: hidden;
}
.ri-density-fill {
  height: 100%;
  border-radius: 4rpx;
  transition: width 0.3s;
}
.ri-density-high {
  background: #36FF74;
}
.ri-density-mid {
  background: #00AFFF;
}
.ri-density-low {
  background: #FF4D4F;
}
.ri-density-text {
  font-size: 18rpx;
  color: #7C8698;
  font-family: monospace;
  letter-spacing: 1rpx;
  flex-shrink: 0;
}
```

- [ ] **Step 3: 验证**

- 战局洞察为 2x2 数据块网格
- 每块有标题小字 + 数值大字
- 互动密度条颜色正确（高=绿，中=蓝，低=红）

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/room/room.wxml miniprogram/pages/room/room.wxss
git commit -m "feat(room): 战局洞察改为终端仪表盘数据块"
```

---

### Task 7: 结算按钮 + 二次确认弹窗

**Files:**
- Modify: `miniprogram/pages/room/room.wxml:518-527` — 底部按钮区
- Modify: `miniprogram/pages/room/room.wxml` — 新增确认弹窗
- Modify: `miniprogram/pages/room/room.wxss:2651-2700` — 按钮样式
- Modify: `miniprogram/pages/room/room.js` — `quitRoom()` 改为先弹确认

- [ ] **Step 1: 改造 WXML 底部按钮**

```xml
<!-- 底部操作区 -->
<view class="room-bottom-bar">
  <view class="rb-settle-btn" bindtap="onSettleTap" wx:if="{{isOwner}}">
    <text class="rb-settle-text">结算并退出</text>
    <text class="rb-settle-sub">SETTLE &amp; EXIT</text>
  </view>
  <view class="rb-quit-btn" bindtap="quitRoom" wx:else>
    <text class="rb-quit-text">退出房间</text>
  </view>
</view>

<!-- 结算确认弹窗 -->
<view class="settle-confirm-mask {{showSettleConfirm ? 'sc-show' : ''}}" catchtap="closeSettleConfirm">
  <view class="settle-confirm-card" catchtap="preventClose">
    <text class="sc-kicker">SYSTEM WARNING</text>
    <text class="sc-title">确认结算并退出房间？</text>
    <text class="sc-desc">结算后本局积分将写入档案</text>
    <view class="sc-actions">
      <view class="sc-btn sc-btn-cancel" bindtap="closeSettleConfirm">
        <text class="sc-btn-text">取消</text>
      </view>
      <view class="sc-btn sc-btn-confirm" bindtap="confirmSettle">
        <text class="sc-btn-text">确认结算</text>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 2: 增加 WXSS 确认弹窗样式**

```css
/* ===== 结算确认弹窗 ===== */
.settle-confirm-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.25s, visibility 0.25s;
}
.sc-show {
  opacity: 1;
  visibility: visible;
}
.settle-confirm-card {
  width: 600rpx;
  padding: 40rpx 32rpx;
  background: #0A0F18;
  border: 1rpx solid rgba(0,170,255,0.2);
  border-radius: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}
.sc-kicker {
  font-size: 16rpx;
  color: #00AFFF;
  letter-spacing: 4rpx;
  font-family: monospace;
}
.sc-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #FFFFFF;
}
.sc-desc {
  font-size: 24rpx;
  color: #7C8698;
}
.sc-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 16rpx;
  width: 100%;
}
.sc-btn {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  transition: background-color 0.2s, transform 0.2s;
}
.sc-btn:active {
  transform: scale(0.97);
}
.sc-btn-cancel {
  background: transparent;
  border: 1rpx solid rgba(255,255,255,0.14);
}
.sc-btn-cancel .sc-btn-text {
  color: #7C8698;
}
.sc-btn-confirm {
  background: rgba(0,170,255,0.15);
  border: 1rpx solid rgba(0,170,255,0.4);
}
.sc-btn-confirm .sc-btn-text {
  color: #00AFFF;
  font-weight: 600;
}
.sc-btn-text {
  font-size: 28rpx;
  letter-spacing: 2rpx;
}
```

- [ ] **Step 3: 改造 JS 增加确认逻辑**

在 `room.js` 中增加：

```javascript
// data 中增加：
showSettleConfirm: false,

// 新增方法：
onSettleTap() {
  this.setData({ showSettleConfirm: true });
},

closeSettleConfirm() {
  this.setData({ showSettleConfirm: false });
},

confirmSettle() {
  this.setData({ showSettleConfirm: false });
  this.quitRoom();
},
```

- [ ] **Step 4: 验证**

- 房主点击「结算并退出」弹出确认弹窗
- 弹窗有 SYSTEM WARNING 标题、说明文字、取消/确认按钮
- 确认按钮为蓝色，不用红色
- 点击取消关闭弹窗，点击确认执行结算

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/room/room.wxml miniprogram/pages/room/room.wxss miniprogram/pages/room/room.js
git commit -m "feat(room): 结算按钮增加二次确认弹窗"
```

---

### Task 8: 移除房间页网络图 + 清理引用

**Files:**
- Modify: `miniprogram/pages/room/room.wxml:503-515` — 移除 NETWORK MAP 模块
- Modify: `miniprogram/pages/room/room.js` — `loadInsightData()` 不再加载 network
- Modify: `miniprogram/pages/room/room.json` — 移除 force-graph 组件引用
- Modify: `miniprogram/pages/room/room.wxss` — 移除 `.network-map` 区域样式

- [ ] **Step 1: 移除 WXML 中的 NETWORK MAP**

删除以下代码块（约 line 503-515）：

```xml
<!-- NETWORK MAP 积分关系图 -->
<view class="network-map" wx:if="{{roomNetwork && roomNetwork.nodes.length >= 2}}">
  ...
</view>
```

- [ ] **Step 2: 改造 JS `loadInsightData()` 不再加载 network**

```javascript
async loadInsightData(roomId) {
  try {
    const insight = await get(`/score/room/${roomId}/insight`);
    this.setData({ roomInsight: insight });
  } catch (e) {
    // 静默失败
  }
},
```

- [ ] **Step 3: 移除 room.json 中 force-graph 引用**

从 `usingComponents` 中删除 `"force-graph": "/components/force-graph/force-graph"`。

- [ ] **Step 4: 移除 WXSS 中 network-map 样式**

删除 `.network-map` 相关样式（约 line 2800 附近）。

- [ ] **Step 5: 验证**

- 房间页不再显示积分关系图
- 战局洞察正常显示
- 无 JS 报错

- [ ] **Step 6: Commit**

```bash
git add miniprogram/pages/room/room.wxml miniprogram/pages/room/room.js miniprogram/pages/room/room.json miniprogram/pages/room/room.wxss
git commit -m "feat(room): 移除房间页积分关系图"
```

---

### Task 9: 结算弹层视觉统一

**Files:**
- Modify: `miniprogram/components/score-chart/score-chart.js` — 移除橙色
- Modify: `miniprogram/components/battle-insight/battle-insight.wxml` — 数据块风格
- Modify: `miniprogram/components/battle-insight/battle-insight.wxss` — 样式改造
- Modify: `miniprogram/components/battle-summary/battle-summary.wxss` — 配色统一
- Modify: `miniprogram/components/persona-signal/persona-signal.wxss` — 配色统一

- [ ] **Step 1: score-chart 移除橙色曲线**

在 `score-chart.js` 的颜色数组中，将橙色替换为蓝/绿色系。找到 `colors` 数组（约 line 50-60），确保只使用蓝绿红体系：

```javascript
// 替换颜色数组中的橙色为蓝色系变体
const colors = [
  '#00AFFF', '#36FF74', '#5E5CE6', '#00C8FF',
  '#30D158', '#64D2FF', '#BF5AF2', '#FF4D4F'
];
```

- [ ] **Step 2: battle-insight 改为数据块风格**

改造 `battle-insight.wxml` 和 `battle-insight.wxss`，将列表式改为 2x2 数据块网格，与房间页 ROOM INSIGHT 风格统一。

- [ ] **Step 3: battle-summary 配色统一**

检查 `battle-summary.wxss`，确保 kicker 使用 `rgba(0,170,255,0.5)`，数值使用 `#00AFFF`，不使用橙色。

- [ ] **Step 4: persona-signal 配色统一**

检查 `persona-signal.wxss`，确保信号条使用蓝绿红体系。

- [ ] **Step 5: 验证**

- 结算弹层趋势图无橙色曲线
- 战局洞察为数据块风格
- 所有 kicker 统一为蓝色

- [ ] **Step 6: Commit**

```bash
git add miniprogram/components/score-chart/ miniprogram/components/battle-insight/ miniprogram/components/battle-summary/ miniprogram/components/persona-signal/
git commit -m "feat(room): 结算弹层视觉统一为赛博终端风格"
```

---

### Task 10: Mode 2 本局录入 UI 改造

**Files:**
- Modify: `miniprogram/components/host-fill-modal/host-fill-modal.wxml`
- Modify: `miniprogram/components/host-fill-modal/host-fill-modal.wxss`
- Modify: `miniprogram/components/member-fill-modal/member-fill-modal.wxml`
- Modify: `miniprogram/components/member-fill-modal/member-fill-modal.wxss`
- Modify: `miniprogram/components/round-confirm-modal/round-confirm-modal.wxml`
- Modify: `miniprogram/components/round-confirm-modal/round-confirm-modal.wxss`
- Modify: `miniprogram/components/round-status-bar/round-status-bar.wxss`

- [ ] **Step 1: host-fill-modal 暗色玻璃卡风格**

改造弹窗背景为 `#0A0F18`，边框 `rgba(0,170,255,0.15)`，标题用 kicker 风格，按钮统一 HUD 风格。

- [ ] **Step 2: member-fill-modal 暗色玻璃卡风格**

同上，统一弹窗视觉。

- [ ] **Step 3: round-confirm-modal 暗色玻璃卡风格**

同上，统一弹窗视觉。确认/拒绝按钮用蓝色/灰色区分。

- [ ] **Step 4: round-status-bar 配色统一**

进度条和文字统一为蓝色体系。

- [ ] **Step 5: 验证**

- 本局录入所有弹窗为暗色玻璃卡风格
- 标题有 kicker 英文副标题
- 按钮为 HUD 风格
- 状态条配色统一

- [ ] **Step 6: Commit**

```bash
git add miniprogram/components/host-fill-modal/ miniprogram/components/member-fill-modal/ miniprogram/components/round-confirm-modal/ miniprogram/components/round-status-bar/
git commit -m "feat(room): Mode 2 弹窗统一为暗色玻璃卡风格"
```
