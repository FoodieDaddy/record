# Score Terminal Phase 1 — 前端视觉重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将房间页从「记分工具」重构为「积分流转终端」，统一赛博终端视觉风格。

**Architecture:** 纯前端改造，不涉及后端。改动集中在 `miniprogram/pages/room/` 下的 3 个文件：WXML（布局结构）、WXSS（样式）、JS（积分颜色逻辑 + 实时预览）。保持所有现有功能（自由流转/本局录入/结算/分享）不变。

**Tech Stack:** 微信小程序原生（WXML + WXSS + JS），无第三方依赖

**Spec:** `docs/superpowers/specs/2026-06-06-score-terminal-design.md`

---

## 改动文件总览

| 文件 | 操作 | 说明 |
|---|---|---|
| `miniprogram/pages/room/room.wxml` | 重构 | 4 个区域布局替换 |
| `miniprogram/pages/room/room.wxss` | 重构 | 新增终端风样式，删除旧样式 |
| `miniprogram/pages/room/room.js` | 小改 | `getScoreStyle()` 颜色逻辑 + numpad 实时预览 |

---

### Task 1: ROOM TERMINAL — 顶部终端栏

**目标:** 将房间内的顶部大卡片替换为紧凑 HUD 栏

**Files:**
- Modify: `miniprogram/pages/room/room.wxml:339-359`
- Modify: `miniprogram/pages/room/room.wxss:1243-1320`（删除旧 `.room-top-card` 样式）
- Modify: `miniprogram/pages/room/room.wxss`（新增 `.room-terminal` 样式）

- [ ] **Step 1: 替换 WXML 顶部卡片**

找到 `room.wxml` 中的 `<!-- 顶部信息卡片 -->` 注释（约第 339 行），将整个 `glass-card-glow room-top-card` 块替换为：

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
  <view class="rt-bottom-row">
    <view class="rt-info">
      <text class="rt-room-no">{{currentRoom.roomNo}}</text>
      <text class="rt-meta-sep">·</text>
      <text class="rt-meta">{{memberGrid.length}}/{{currentRoom.maxMembers || 16}}</text>
      <text class="rt-meta-sep">·</text>
      <text class="rt-mode-tag">{{currentRoom.scoreMode === 1 ? '自由流转' : '本局录入'}}</text>
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
</view>
```

- [ ] **Step 2: 删除旧顶部卡片 WXSS 样式**

在 `room.wxss` 中，找到并删除以下样式块（约第 1243-1320 行）：

```css
/* 删除这些样式 */
.room-top-card { ... }
.hero-glow { ... }
.top-card-row { ... }
.top-card-info { ... }
.top-card-label { ... }
.top-card-value { ... }
.top-card-actions { ... }
.tc-action { ... }
.tc-action:active { ... }
.tc-audio-on { ... }
.tc-danger .tc-icon { ... }
```

保留 `.tc-action` 的基础样式（如果其他地方用到），但实际检查后可以安全删除——这些样式只在顶部卡片中使用。

- [ ] **Step 3: 新增 ROOM TERMINAL 样式**

在 `room.wxss` 的 `/* 房间内容 */` 区域之后，新增：

```css
/* ===== ROOM TERMINAL 顶部终端栏 ===== */
.room-terminal {
  padding: 20rpx 24rpx;
  border: 1rpx solid rgba(10,132,255,0.18);
  border-radius: 16rpx;
  background: rgba(255,255,255,0.035);
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
  background: linear-gradient(90deg, transparent, rgba(10,132,255,0.4), transparent);
}
.rt-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.rt-kicker {
  font-size: 18rpx;
  color: rgba(10,132,255,0.72);
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
  background: #30D158;
  box-shadow: 0 0 8rpx rgba(48,209,88,0.6);
}
.rt-status-text {
  font-size: 16rpx;
  color: #30D158;
  letter-spacing: 2rpx;
  font-family: monospace;
}
.rt-bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.rt-info {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}
.rt-room-no {
  font-size: 32rpx;
  font-weight: 700;
  color: #0A84FF;
  letter-spacing: 4rpx;
  font-family: "SF Mono", "Menlo", "Courier New", monospace;
  font-variant-numeric: tabular-nums;
}
.rt-meta-sep {
  font-size: 20rpx;
  color: rgba(255,255,255,0.15);
}
.rt-meta {
  font-size: 22rpx;
  color: rgba(255,255,255,0.56);
  font-variant-numeric: tabular-nums;
}
.rt-mode-tag {
  font-size: 18rpx;
  color: rgba(0,191,255,0.6);
  border: 1rpx solid rgba(0,191,255,0.2);
  border-radius: 6rpx;
  padding: 2rpx 10rpx;
  letter-spacing: 1rpx;
}
.rt-actions {
  display: flex;
  align-items: center;
  gap: 4rpx;
}
.rt-action {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  opacity: 0.6;
  color: #fff;
}
.rt-action:active {
  opacity: 0.3;
  transform: scale(0.9);
}
```

- [ ] **Step 4: 验证**

在微信开发者工具中编译，进入房间页面。确认：
- 顶部显示 `ROOM TERMINAL` 蓝色 kicker + 绿色 `ONLINE`
- 房间号等宽蓝色显示，成员数和模式标签正确
- 复制/邀请按钮可点击
- 整体高度约 100-120rpx，不再占据大面积

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/room/room.wxml miniprogram/pages/room/room.wxss
git commit -m "feat(room): 顶部卡片替换为 ROOM TERMINAL HUD 栏"
```

---

### Task 2: 积分颜色逻辑 — 改为正绿/负红/零灰

**目标:** 将成员积分的颜色从当前的渐变橙/青改为统一的 `#36FF74` / `#FF5A5A` / `#9CA3AF`

**Files:**
- Modify: `miniprogram/pages/room/room.js:1287-1309`（`getScoreStyle` 方法）

- [ ] **Step 1: 替换 getScoreStyle 方法**

找到 `room.js` 中的 `getScoreStyle` 方法（约第 1287 行），替换为：

```javascript
getScoreStyle(score) {
  const fontSize = 26;
  let color;
  if (score === 0) {
    color = '#9CA3AF';
  } else if (score > 0) {
    color = '#36FF74';
  } else {
    color = '#FF5A5A';
  }
  return { fontSize, color };
},
```

- [ ] **Step 2: 同步修改 Flow Log 中的金额颜色类名**

在 `room.wxss` 中，更新积分记录的颜色类（约第 1976-1986 行）：

```css
/* 替换旧颜色 */
.sr-amt-gray {
  color: #9CA3AF;
}
.sr-amt-red {
  color: #FF5A5A;
}
.sr-amt-green {
  color: #36FF74;
}
```

- [ ] **Step 3: 验证**

进入房间，确认：
- 正分成员显示绿色 `#36FF74`
- 负分成员显示红色 `#FF5A5A`
- 零分成员显示灰色 `#9CA3AF`
- 积分记录中的金额颜色同步更新

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/room/room.js miniprogram/pages/room/room.wxss
git commit -m "feat(room): 积分颜色改为正绿/负红/零灰"
```

---

### Task 3: PLAYER NETWORK — 成员网络终端卡

**目标:** 将成员网格从普通卡片升级为终端风格玩家卡，选中效果改为圆形扫描环

**Files:**
- Modify: `miniprogram/pages/room/room.wxml:378-402`（成员区域 WXML）
- Modify: `miniprogram/pages/room/room.wxss:1345-1455`（成员网格样式）

- [ ] **Step 1: 替换成员区域 WXML**

找到 `<!-- 成员区域 -->` 注释（约第 378 行），将整个 `glass-card member-section` 块替换为：

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
  <scroll-view class="member-grid-scroll" scroll-y="{{memberGrid.length > 8}}" style="max-height:{{memberGrid.length > 8 ? '600rpx' : 'none'}};">
    <view class="member-grid">
      <view class="mg-cell {{item.userId === transferTo ? 'mg-cell-selected' : ''}}"
            wx:for="{{memberGrid}}" wx:key="userId"
            bindtap="onTapMember" data-user-id="{{item.userId}}">
        <view class="mg-avatar-wrap">
          <view class="auto-avatar" style="background:{{item.avatarColor}};" wx:if="{{!item.avatarUrl}}">
            <text class="auto-avatar-char">{{item.avatarChar}}</text>
          </view>
          <image class="mg-avatar" src="{{item.avatarUrl}}" mode="aspectFill" wx:else binderror="onAvatarError" data-user-id="{{item.userId}}"></image>
          <!-- 圆形扫描环（选中态） -->
          <view class="mg-scan-ring" wx:if="{{item.userId === transferTo}}"></view>
        </view>
        <text class="mg-name">{{t.truncateName(item.nickname)}}</text>
        <text class="mg-score score-number" style="color:{{item.scoreColor}};">
          {{fmt.formatScore(item.displayScore)}}
        </text>
      </view>
    </view>
  </scroll-view>
</view>
```

- [ ] **Step 2: 替换成员网格样式**

在 `room.wxss` 中，删除旧的成员网格样式（约第 1345-1455 行），替换为：

```css
/* ===== PLAYER NETWORK 成员网络 ===== */
.player-network {
  padding: 24rpx;
  border: 1rpx solid rgba(255,255,255,0.08);
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
  color: rgba(255,255,255,0.85);
  letter-spacing: 2rpx;
}
.pn-en {
  font-size: 18rpx;
  color: rgba(255,255,255,0.2);
  letter-spacing: 4rpx;
  font-family: monospace;
  margin-top: 2rpx;
}
.pn-count {
  font-size: 22rpx;
  color: rgba(255,255,255,0.38);
  font-variant-numeric: tabular-nums;
}
.pn-divider {
  height: 1rpx;
  background: rgba(255,255,255,0.04);
  margin: 16rpx 0;
}

/* 成员网格（保持 4 列） */
.member-grid-scroll {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.member-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx 12rpx;
}
.mg-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 4rpx;
  padding: 16rpx 0;
  border-radius: 12rpx;
  transition: all 0.2s ease;
  position: relative;
  min-width: 0;
}
.mg-cell:active {
  transform: scale(0.92);
  background: rgba(255,255,255,0.04);
}

/* 选中态：圆形扫描环 */
.mg-cell-selected {
  background: rgba(10,132,255,0.04);
}
.mg-avatar-wrap {
  position: relative;
  width: 96rpx;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mg-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(255,255,255,0.15);
  overflow: hidden;
  display: block;
}
.mg-cell .auto-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(255,255,255,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}
.auto-avatar-char {
  font-size: 36rpx;
  font-weight: 600;
  color: #fff;
}

/* 圆形扫描环 */
.mg-scan-ring {
  position: absolute;
  inset: -8rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(10,132,255,0.6);
  box-shadow: 0 0 16rpx rgba(10,132,255,0.4);
  animation: scanRing 1.5s ease-in-out infinite;
  pointer-events: none;
}
@keyframes scanRing {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.06); }
}

.mg-name {
  font-size: 22rpx;
  color: rgba(255,255,255,0.56);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.mg-score {
  font-size: 26rpx;
  font-weight: 700;
  max-width: 120rpx;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.5rpx;
  font-family: "SF Mono", "Menlo", "Courier New", monospace;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: 验证**

进入房间，确认：
- 标题显示「成员网络」+ `PLAYER NETWORK` 双层标题
- 右侧显示 `N / 16` 成员计数
- 积分颜色为绿/红/灰
- 点击非自己的成员时，头像外围出现蓝色圆形扫描环（脉冲动画）
- 矩形描边效果已消失

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/room/room.wxml miniprogram/pages/room/room.wxss
git commit -m "feat(room): 成员网格升级为 PLAYER NETWORK 终端卡"
```

---

### Task 4: TRANSFER TERMINAL — 流转终端键盘

**目标:** 将数字键盘从计算器风格改为终端机械风，新增实时预览功能

**Files:**
- Modify: `miniprogram/pages/room/room.wxml:463-490`（数字键盘 WXML）
- Modify: `miniprogram/pages/room/room.wxss:1564-1788`（数字键盘样式）
- Modify: `miniprogram/pages/room/room.js`（新增 preview 计算逻辑）

- [ ] **Step 1: 替换数字键盘 WXML**

找到 `<!-- 数字键盘弹窗 -->` 注释（约第 463 行），将整个 `numpad-overlay` 块替换为：

```xml
<!-- TRANSFER TERMINAL 流转终端 -->
<view class="transfer-overlay {{showNumpad ? 'transfer-show' : ''}}" catchtap="closeNumpad">
  <view class="transfer-sheet" catchtap="preventClose">
    <view class="transfer-header">
      <text class="transfer-kicker">TRANSFER TERMINAL</text>
    </view>
    <view class="transfer-direction">
      <view class="transfer-player">
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
        <view class="auto-avatar-sm" style="background:{{transferToInfo.avatarColor}};" wx:if="{{!transferToInfo.avatarUrl && transferToInfo}}">
          <text class="auto-avatar-char-sm">{{transferToInfo.avatarChar}}</text>
        </view>
        <image class="transfer-avatar" src="{{transferToInfo.avatarUrl}}" wx:elif="{{transferToInfo}}" mode="aspectFill"></image>
        <text class="transfer-player-name">{{t.truncateName(transferToInfo.nickname)}}</text>
      </view>
    </view>
    <view class="transfer-display">
      <text class="transfer-display-value">{{numpadValue > 0 ? '+' : ''}}{{numpadValue || '0'}}</text>
      <text class="transfer-display-unit">积分</text>
    </view>

    <!-- 实时预览 -->
    <view class="transfer-preview" wx:if="{{numpadValue > 0 && transferPreview}}">
      <view class="tp-row">
        <text class="tp-name">{{transferPreview.fromName}}</text>
        <text class="tp-score" style="color:#FF5A5A;">{{transferPreview.fromNewScore}}</text>
      </view>
      <view class="tp-divider"></view>
      <view class="tp-row">
        <text class="tp-name">{{transferPreview.toName}}</text>
        <text class="tp-score" style="color:#36FF74;">{{transferPreview.toNewScore}}</text>
      </view>
    </view>

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
        <text class="transfer-confirm-sub">CONFIRM TRANSFER</text>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 2: 新增 JS 逻辑 — 实时预览 + transferFromInfo**

在 `room.js` 的 `data` 对象中，新增两个字段：

```javascript
transferFromInfo: null,
transferPreview: null,
```

在 `onTapMember` 方法中（约第 798 行），在 `setData` 时同时设置 `transferFromInfo`：

```javascript
onTapMember(e) {
  const { userId } = e.currentTarget.dataset;
  if (String(userId) === String(app.globalData.userId)) return;
  const info = this.data.memberGrid.find(m => String(m.userId) === String(userId));
  if (!info) return;
  // 找到自己的信息作为 from
  const fromInfo = this.data.memberGrid.find(m => String(m.userId) === String(app.globalData.userId));
  try { wx.vibrateShort({ type: 'light' }); } catch (err) {}
  this.setData({
    transferTo: userId,
    transferToInfo: info,
    transferFromInfo: fromInfo || null,
    showNumpad: true,
    numpadValue: 0,
    transferPreview: null
  });
},
```

在 `onNumpadKey` 方法末尾（约第 829 行），添加预览计算：

```javascript
onNumpadKey(e) {
  const key = e.currentTarget.dataset.key;
  let val = this.data.numpadValue;
  const str = String(val);

  if (key === 'clear') {
    val = 0;
  } else if (key === 'del') {
    const sliced = str.slice(0, -1);
    val = parseInt(sliced) || 0;
  } else {
    const newVal = str === '0' ? key : str + key;
    if (newVal.length > 8) return;
    val = parseInt(newVal);
    if (val > 99999999) val = 99999999;
  }

  // 计算实时预览
  let preview = null;
  if (val > 0 && this.data.transferFromInfo && this.data.transferToInfo) {
    const fromScore = this.data.transferFromInfo.score || 0;
    const toScore = this.data.transferToInfo.score || 0;
    preview = {
      fromName: this.data.transferFromInfo.nickname,
      fromNewScore: fromScore - val,
      toName: this.data.transferToInfo.nickname,
      toNewScore: toScore + val
    };
  }

  this.setData({ numpadValue: val, transferPreview: preview });
},
```

在 `cancelTransfer` 方法中，清新增的字段：

```javascript
cancelTransfer() {
  this.setData({
    transferTo: '',
    transferToInfo: null,
    transferFromInfo: null,
    transferPreview: null,
    showNumpad: false,
    numpadValue: 0
  });
},
```

- [ ] **Step 3: 替换数字键盘样式**

在 `room.wxss` 中，删除旧的 `.numpad-*` 样式（约第 1564-1788 行），替换为：

```css
/* ===== TRANSFER TERMINAL 流转终端 ===== */
.transfer-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  z-index: 200;
  opacity: 0;
  visibility: hidden;
  transition: all 0.25s ease;
}
.transfer-show {
  opacity: 1;
  visibility: visible;
}
.transfer-sheet {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(16,16,16,0.97);
  backdrop-filter: blur(40rpx);
  -webkit-backdrop-filter: blur(40rpx);
  border-top: 1rpx solid rgba(10,132,255,0.2);
  border-radius: 32rpx 32rpx 0 0;
  padding: 28rpx 24rpx;
  padding-bottom: calc(28rpx + env(safe-area-inset-bottom));
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.transfer-show .transfer-sheet {
  transform: translateY(0);
}
.transfer-header {
  text-align: center;
  margin-bottom: 20rpx;
}
.transfer-kicker {
  font-size: 18rpx;
  color: rgba(10,132,255,0.72);
  letter-spacing: 4rpx;
  font-family: monospace;
}
.transfer-direction {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  margin-bottom: 24rpx;
  padding: 16rpx 0;
}
.transfer-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.transfer-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  border: 1rpx solid rgba(255,255,255,0.15);
}
.auto-avatar-sm {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(255,255,255,0.15);
}
.auto-avatar-char-sm {
  font-size: 24rpx;
  font-weight: 600;
  color: #fff;
}
.transfer-player-name {
  font-size: 22rpx;
  color: rgba(255,255,255,0.56);
  max-width: 120rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.transfer-arrow-wrap {
  display: flex;
  align-items: center;
  gap: 4rpx;
}
.transfer-arrow-line {
  width: 40rpx;
  height: 1rpx;
  background: rgba(10,132,255,0.4);
}
.transfer-arrow-head {
  font-size: 28rpx;
  color: #0A84FF;
}
.transfer-display {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 10rpx;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.05);
}
.transfer-display-value {
  font-size: 80rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #fff;
  letter-spacing: 2rpx;
}
.transfer-display-unit {
  font-size: 22rpx;
  color: rgba(255,255,255,0.3);
  align-self: flex-end;
  margin-bottom: 8rpx;
}

/* 实时预览 */
.transfer-preview {
  background: rgba(255,255,255,0.03);
  border: 1rpx solid rgba(255,255,255,0.06);
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 16rpx;
}
.tp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4rpx 0;
}
.tp-name {
  font-size: 24rpx;
  color: rgba(255,255,255,0.56);
}
.tp-score {
  font-size: 28rpx;
  font-weight: 700;
  font-family: "SF Mono", "Menlo", "Courier New", monospace;
  font-variant-numeric: tabular-nums;
}
.tp-divider {
  height: 1rpx;
  background: rgba(255,255,255,0.04);
  margin: 6rpx 0;
}

/* 数字键盘 */
.transfer-numpad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-bottom: 20rpx;
}
.transfer-key {
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.04);
  border: 1rpx solid rgba(255,255,255,0.06);
  border-radius: 14rpx;
  font-size: 40rpx;
  font-weight: 500;
  color: #fff;
  transition: all 0.15s ease;
}
.transfer-key:active {
  background: rgba(255,255,255,0.12);
  border-color: rgba(255,255,255,0.12);
}
.transfer-key-func {
  background: transparent;
  border-color: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.4);
  font-size: 32rpx;
}
.transfer-key-func:active {
  background: rgba(255,255,255,0.06);
}

/* 确认按钮：能量风格 */
.transfer-actions {
  margin-top: 4rpx;
}
.transfer-confirm {
  height: 96rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
  background: linear-gradient(135deg, rgba(0,191,255,0.15), rgba(0,120,255,0.08));
  border: 1rpx solid rgba(0,191,255,0.35);
  border-radius: 14rpx;
  position: relative;
  overflow: hidden;
  clip-path: polygon(12rpx 0, calc(100% - 12rpx) 0, 100% 12rpx, 100% calc(100% - 12rpx), calc(100% - 12rpx) 100%, 12rpx 100%, 0 calc(100% - 12rpx), 0 12rpx);
}
.transfer-confirm:active {
  background: linear-gradient(135deg, rgba(0,191,255,0.25), rgba(0,120,255,0.15));
  transform: scale(0.98);
}
.transfer-confirm::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(0,191,255,0.08), transparent);
  animation: transferSweep 4s ease-in-out infinite;
}
@keyframes transferSweep {
  0% { left: -100%; }
  50% { left: 100%; }
  100% { left: 100%; }
}
.transfer-confirm-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #00BFFF;
  letter-spacing: 4rpx;
  position: relative;
  z-index: 1;
}
.transfer-confirm-sub {
  font-size: 14rpx;
  color: rgba(0,191,255,0.4);
  letter-spacing: 3rpx;
  font-family: monospace;
  position: relative;
  z-index: 1;
}
```

- [ ] **Step 4: 验证**

进入房间，点击非自己的成员：
- 键盘底部弹出，标题显示 `TRANSFER TERMINAL`
- 显示 `A → B` 的头像和昵称
- 输入数字时，实时预览区显示双方新分数
- 确认按钮为切角能量风格
- 点击确认后正常提交计分
- 本局录入模式不受影响

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/room/room.wxml miniprogram/pages/room/room.wxss miniprogram/pages/room/room.js
git commit -m "feat(room): 数字键盘升级为 TRANSFER TERMINAL，新增实时预览"
```

---

### Task 5: FLOW LOG — 积分流时间轴

**目标:** 将积分记录从三列布局改为时间轴风格

**Files:**
- Modify: `miniprogram/pages/room/room.wxml:405-458`（积分记录区域 WXML）
- Modify: `miniprogram/pages/room/room.wxss:1861-1986`（积分记录样式）

- [ ] **Step 1: 替换积分记录 WXML**

找到 `<!-- 积分记录 -->` 注释（约第 405 行），将整个 `glass-card score-record-card` 块替换为：

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

  <view wx:if="{{groupedRecords.length === 0}}" class="fl-empty">
    <view class="icon-empty-doc"></view>
    <text class="fl-empty-text">{{filterMine ? '暂无与你相关的记录' : '暂无记录'}}</text>
  </view>

  <view wx:else class="fl-list">
    <block wx:for="{{groupedRecords}}" wx:key="timeKey">
      <view class="fl-time-header">{{item.timeDisplay}}</view>
      <view class="fl-item" wx:for="{{item.records}}" wx:for-item="rec" wx:key="id">
        <view class="fl-dot"></view>
        <view class="fl-content">
          <text class="fl-from-name">{{rec.fromName}}</text>
          <view class="fl-arrow-wrap">
            <view class="fl-arrow-line"></view>
            <text class="fl-amount {{rec.myRole === 'from' ? 'fl-amt-red' : rec.myRole === 'to' ? 'fl-amt-green' : 'fl-amt-white'}}">{{fmt.formatAmount(rec.amount)}}</text>
            <view class="fl-arrow-line"></view>
            <text class="fl-arrow-head">→</text>
          </view>
          <text class="fl-to-name">{{rec.toName}}</text>
        </view>
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

- [ ] **Step 2: 替换积分记录样式**

在 `room.wxss` 中，删除旧的积分记录样式（约第 1861-1986 行），替换为：

```css
/* ===== FLOW LOG 积分流 ===== */
.flow-log {
  padding: 24rpx;
  border: 1rpx solid rgba(255,255,255,0.08);
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
  color: rgba(255,255,255,0.85);
  letter-spacing: 2rpx;
}
.fl-en {
  font-size: 18rpx;
  color: rgba(255,255,255,0.2);
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
  border-radius: 32rpx;
  opacity: 0.4;
  transition: all 0.2s ease;
}
.fl-filter-on {
  opacity: 1;
  background: rgba(10,132,255,0.2);
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
  border-radius: 32rpx;
  transition: all 0.2s ease;
}
.fl-overview-btn:active {
  background: rgba(255,255,255,0.12);
}
.fl-divider {
  height: 1rpx;
  background: rgba(255,255,255,0.04);
  margin: 16rpx 0;
}
.fl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32rpx 0;
  gap: 8rpx;
}
.fl-empty-text {
  font-size: 24rpx;
  color: rgba(255,255,255,0.3);
}
.fl-list {
  display: flex;
  flex-direction: column;
}
.fl-time-header {
  position: sticky;
  top: 0;
  z-index: 5;
  padding: 12rpx 0 8rpx;
  font-size: 22rpx;
  color: rgba(255,255,255,0.3);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  background: rgba(18,18,18,0.92);
}
.fl-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid rgba(255,255,255,0.03);
}
.fl-item:last-child {
  border-bottom: none;
}
.fl-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: #0A84FF;
  box-shadow: 0 0 6rpx rgba(10,132,255,0.6);
  flex-shrink: 0;
}
.fl-content {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex: 1;
  min-width: 0;
}
.fl-from-name,
.fl-to-name {
  font-size: 24rpx;
  color: rgba(255,255,255,0.56);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
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
  background: rgba(10,132,255,0.3);
}
.fl-amount {
  font-size: 26rpx;
  font-weight: 700;
  font-family: "SF Mono", "Menlo", "Courier New", monospace;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.fl-arrow-head {
  font-size: 20rpx;
  color: #0A84FF;
}
.fl-amt-red {
  color: #FF5A5A;
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
  color: rgba(255,255,255,0.3);
}
```

- [ ] **Step 3: 验证**

进入房间，有积分记录后：
- 标题显示「积分流」+ `FLOW LOG` 双层标题
- 每条记录显示为：时间 → `● from名 ── amount ──→ to名`
- 金额颜色根据当前用户视角变化（出分红/入分绿/旁观白）
- 蓝色圆点和箭头正确显示
- 分页加载和「我」过滤功能正常
- 积分总览按钮可点击

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/room/room.wxml miniprogram/pages/room/room.wxss
git commit -m "feat(room): 积分记录升级为 FLOW LOG 时间轴布局"
```

---

### Task 6: 退出房间按钮迁移 + 集成验证

**目标:** 将退出按钮从已删除的顶部卡片迁移到底部操作区，并做完整集成验证

**Files:**
- Modify: `miniprogram/pages/room/room.wxml`（新增底部退出按钮）
- Modify: `miniprogram/pages/room/room.wxss`（新增底部按钮样式）

- [ ] **Step 1: 在 FLOW LOG 之后、scroll-view 关闭之前添加底部操作区**

在 `room.wxml` 中，找到 `</scroll-view>` 之前的 `</view>` （FLOW LOG 的结束标签之后），添加：

```xml
<!-- 底部操作区 -->
<view class="room-bottom-bar">
  <view class="rb-settle-btn" bindtap="quitRoom" wx:if="{{isOwner}}">
    <text class="rb-settle-text">结算并退出</text>
    <text class="rb-settle-sub">SETTLE & EXIT</text>
  </view>
  <view class="rb-quit-btn" bindtap="quitRoom" wx:else>
    <text class="rb-quit-text">退出房间</text>
  </view>
</view>
```

- [ ] **Step 2: 新增底部操作区样式**

在 `room.wxss` 中添加：

```css
/* ===== 底部操作区 ===== */
.room-bottom-bar {
  padding: 24rpx 0 16rpx;
}
.rb-settle-btn {
  height: 88rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
  background: rgba(10,132,255,0.12);
  border: 1rpx solid rgba(10,132,255,0.3);
  border-radius: 14rpx;
  transition: all 0.2s ease;
}
.rb-settle-btn:active {
  background: rgba(10,132,255,0.22);
  transform: scale(0.98);
}
.rb-settle-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #0A84FF;
  letter-spacing: 4rpx;
}
.rb-settle-sub {
  font-size: 14rpx;
  color: rgba(10,132,255,0.4);
  letter-spacing: 3rpx;
  font-family: monospace;
}
.rb-quit-btn {
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(255,69,58,0.24);
  border-radius: 14rpx;
  background: transparent;
  transition: all 0.2s ease;
}
.rb-quit-btn:active {
  background: rgba(255,69,58,0.08);
}
.rb-quit-text {
  font-size: 26rpx;
  color: rgba(255,69,58,0.86);
  letter-spacing: 2rpx;
}
```

- [ ] **Step 3: 清理无用样式**

删除 `room.wxss` 中不再使用的样式：
- `.qr-section`、`.qr-frame`、`.qr-image`（如果只在旧顶部卡片中使用）

检查方法：在 WXML 中搜索这些类名，确认是否还有其他引用。如果没有则删除。

- [ ] **Step 4: 完整集成验证**

在微信开发者工具中，逐一验证以下场景：

**自由流转模式：**
- [ ] 顶部 HUD 栏显示正确（房间号/成员数/模式/在线状态）
- [ ] 成员网格正确显示，积分颜色为绿/红/灰
- [ ] 点击成员弹出流转终端键盘，显示 A → B
- [ ] 输入数字时实时预览正确
- [ ] 确认后计分成功，粒子动画正常
- [ ] 积分记录正确更新为时间轴格式
- [ ] 分页加载和「我」过滤正常
- [ ] 积分总览弹窗正常
- [ ] 复制/邀请按钮正常
- [ ] 底部退出按钮正常（房主=结算并退出，非房主=退出房间）

**本局录入模式：**
- [ ] 顶部显示「本局录入」模式标签
- [ ] 录入本局按钮正常
- [ ] round-status-bar 组件正常
- [ ] 房主填写/成员自填弹窗正常
- [ ] 确认弹窗正常

**WS 实时同步：**
- [ ] 其他成员加入/离开时成员网格更新
- [ ] 收到 TRANSFER 消息时动画和数据更新正常
- [ ] 收到 SCORE_UPDATE 消息时正常

**结算流程：**
- [ ] 房主点击「结算并退出」→ 归档 → 结算弹层展示
- [ ] 非房主收到 SETTLE 通知 → 结算弹层展示
- [ ] 关闭结算弹层后回到房间列表

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/room/room.wxml miniprogram/pages/room/room.wxss
git commit -m "feat(room): 退出按钮迁移至底部操作区，完成 Phase 1 集成"
```
