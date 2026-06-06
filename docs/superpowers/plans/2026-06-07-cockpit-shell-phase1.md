# 空间页驾驶舱改造 Phase 1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将空间页从工具表单升级为「脉冲方舟驾驶舱」体验，Phase 1 完成 idle/active/sealing 基础壳。

**Architecture:** 保留现有 JS 业务逻辑（创建/加入/转账/封存），替换 WXML 外层结构为 cockpitState 状态机驱动的 HUD 布局，新增 WXSS HUD 样式。新增 cockpit 辅助方法（buildSeatList、formatCrewName、formatPulseValue），补齐 timer 清理和 onHide 生命周期。

**Tech Stack:** 原生微信小程序（WXML/WXSS/JS），现有组件 helmet-avatar / flow-log-panel / space-scan-panel / round-status-bar 等保留引用。

**Spec:** `docs/superpowers/specs/2026-06-07-cockpit-shell-design.md`

---

## 文件影响

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `miniprogram/pages/room/room.js` | Modify | 新增 cockpitState + 辅助方法 + timer 修复 + onHide |
| `miniprogram/pages/room/room.wxml` | Modify | 按 cockpitState 重构模板结构 |
| `miniprogram/pages/room/room.wxss` | Modify | 新增 HUD 面板/席位/脉冲/轨迹样式 |

---

### Task 1: room.js — 新增 cockpitState data 字段和辅助方法

**Files:**
- Modify: `miniprogram/pages/room/room.js:11-114` (data 字段区)
- Modify: `miniprogram/pages/room/room.js` (新增方法区)

- [ ] **Step 1: 在 data 中新增 cockpit 相关字段**

在 `room.js` 第 113 行 `toastType: 'success'` 之后、`}` 之前，新增以下字段：

```js
    // ===== 驾驶舱 Phase 1 =====
    cockpitState: 'idle',       // 'idle' | 'active' | 'sealing' | 'sealed'
    wsConnected: false,
    seatList: [],
    selectedCrew: null,
    pulseValue: '',
    pulseTraces: [],
    traceAnchor: '',
    joinPanelVisible: false,
    joinCode: '',
    launching: false,
    submittingPulse: false,
    sealConfirmVisible: false,
    sealing: false,
    sealHeartbeatText: '脉冲轨迹封装中',
```

- [ ] **Step 2: 在 onShow 中初始化 cockpitState 和 wsConnected**

在 `room.js` `onShow()` 方法中（第 116 行），在现有的 `this.setData({...})` 调用中追加：

```js
      wsConnected: scoreWS.isConnected,
```

在 `onShow` 末尾（`this.loadRecentRooms()` 之后）追加：

```js
    this.updateCockpitState();
```

修改 WS open/close 回调（第 133-134 行）以同时更新 wsConnected：

```js
    if (!this._onWsClose) {
      this._onWsClose = () => this.setData({ wsReconnecting: true, wsConnected: false });
      this._onWsOpen = () => this.setData({ wsReconnecting: false, wsConnected: true });
    }
```

- [ ] **Step 3: 新增 updateCockpitState 方法**

在 `room.js` 的 `goLogin()` 方法之前（约第 177 行），新增：

```js
  updateCockpitState() {
    if (!this.data.currentRoom) {
      this.setData({ cockpitState: 'idle' });
    } else if (this.data.sealing) {
      this.setData({ cockpitState: 'sealing' });
    } else {
      this.setData({ cockpitState: 'active' });
    }
  },
```

- [ ] **Step 4: 新增 buildSeatList / formatCrewName / formatPulseValue 辅助方法**

在 `updateCockpitState` 方法之后新增：

```js
  buildSeatList(members = []) {
    const safeMembers = (members || []).slice(0, 16).map(m => ({
      userId: m.userId || m.id,
      nickname: m.nickname,
      avatarUrl: m.avatarUrl || '',
      score: m.score || 0,
      displayName: this.formatCrewName(m.nickname),
      scoreText: this.formatPulseValue(m.score),
      active: true,
      seatKey: String(m.userId || m.id),
      isSelf: String(m.userId || m.id) === String(this.data.myUserId),
      isHost: m.isHost || false
    }));
    const emptySeats = Array.from({ length: Math.max(0, 16 - safeMembers.length) }, (_, i) => ({
      seatKey: `empty-${i}`,
      active: false,
      displayName: '空席',
      scoreText: '',
      isSelf: false,
      isHost: false
    }));
    return [...safeMembers, ...emptySeats];
  },

  formatCrewName(name = '') {
    const text = String(name || '舰员').trim();
    return text.length > 6 ? text.slice(0, 6) : text;
  },

  formatPulseValue(value = 0) {
    const num = Number(value || 0);
    if (Math.abs(num) >= 100000) return `${(num / 10000).toFixed(1)}w`;
    return `${num}`;
  },
```

- [ ] **Step 5: 新增 cockpit 交互方法**

在辅助方法之后新增：

```js
  // ===== 驾驶舱交互 =====

  handleStartSpace() {
    if (this.data.launching) return;
    this.setData({ launching: true });
    // 复用现有 createRoom 逻辑，但由 cockpitState 驱动
    this.createRoom().finally(() => {
      this.setData({ launching: false });
      this.updateCockpitState();
    });
  },

  openJoinPanel() {
    this.setData({ joinPanelVisible: true, joinCode: '' });
  },

  closeJoinPanel() {
    this.setData({ joinPanelVisible: false, joinCode: '' });
  },

  onJoinCodeInput(e) {
    const value = String(e.detail.value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    this.setData({ joinCode: value });
  },

  async handleJoinSpace() {
    const code = this.data.joinCode.trim();
    if (!code || code.length < 6 || this.data.joining) return;
    this.setData({ joining: true });
    try {
      await this.joinByRoomNo(code);
      this.closeJoinPanel();
      this.updateCockpitState();
    } catch (err) {
      // joinByRoomNo 内部已有 showToast 错误处理
    } finally {
      this.setData({ joining: false });
    }
  },

  handleSelectCrew(e) {
    const userId = e.currentTarget.dataset.userId;
    if (!userId) return;
    const seat = this.data.seatList.find(s => String(s.userId) === String(userId));
    if (!seat || !seat.active) return;
    const isSelected = this.data.selectedCrew && String(this.data.selectedCrew.userId) === String(userId);
    this.setData({
      selectedCrew: isSelected ? null : seat
    });
    vibrateShort('light');
  },

  onPulseValueInput(e) {
    const value = String(e.detail.value || '').replace(/[^0-9\-]/g, '').slice(0, 7);
    this.setData({ pulseValue: value });
  },

  decreasePulse() {
    const cur = parseInt(this.data.pulseValue, 10) || 0;
    this.setData({ pulseValue: String(Math.max(cur - 1, -99999)) });
  },

  increasePulse() {
    const cur = parseInt(this.data.pulseValue, 10) || 0;
    this.setData({ pulseValue: String(Math.min(cur + 1, 99999)) });
  },

  async handleSubmitPulse() {
    if (!this.data.selectedCrew) {
      this.showToast('请选择舰员席位', 'error');
      return;
    }
    const amount = parseInt(this.data.pulseValue, 10);
    if (!amount || amount === 0) {
      this.showToast('请输入脉冲值', 'error');
      return;
    }
    if (this.data.submittingPulse) return;
    this.setData({ submittingPulse: true });
    try {
      // 复用现有 transfer 逻辑
      this.setData({ transferTo: this.data.selectedCrew.userId });
      await this.submitTransfer(amount);
      // 添加轨迹
      const traces = this.data.pulseTraces.slice();
      const fromName = '我';
      const toName = this.data.selectedCrew.displayName;
      traces.push({
        id: Date.now(),
        title: `${fromName} → ${toName}`,
        desc: `脉冲 ${amount > 0 ? '+' : ''}${amount} 已写入缓冲区`,
        valueText: `${amount > 0 ? '+' : ''}${amount}`,
        valueClass: amount < 0 ? 'is-negative' : '',
        isNew: true
      });
      this.setData({
        pulseTraces: traces,
        pulseValue: '',
        traceAnchor: `trace-${traces[traces.length - 1].id}`
      });
      // 3s 后移除 isNew 标记
      const traceId = traces[traces.length - 1].id;
      setTimeout(() => {
        const current = this.data.pulseTraces.map(t =>
          t.id === traceId ? { ...t, isNew: false } : t
        );
        this.setData({ pulseTraces: current });
      }, 3000);
    } catch (err) {
      // submitTransfer 内部已有错误处理
    } finally {
      this.setData({ submittingPulse: false });
    }
  },

  openSealConfirm() {
    this.setData({ sealConfirmVisible: true });
  },

  closeSealConfirm() {
    this.setData({ sealConfirmVisible: false });
  },

  async handleSealRoom() {
    this.closeSealConfirm();
    this.setData({ sealing: true, cockpitState: 'sealing' });
    this.startSealHeartbeat();
    try {
      await this.quitRoom();
    } catch (err) {
      this.showToast('封存失败，请重试', 'error');
    } finally {
      this.stopSealHeartbeat();
      this.setData({ sealing: false });
      this.updateCockpitState();
    }
  },

  startSealHeartbeat() {
    const texts = [
      '脉冲轨迹封装中',
      '舰员终值校准中',
      '航程样本写入中',
      '黑匣子索引生成中'
    ];
    let idx = 0;
    this._sealHeartbeatTimer = setInterval(() => {
      idx = (idx + 1) % texts.length;
      this.setData({ sealHeartbeatText: texts[idx] });
    }, 3000);
  },

  stopSealHeartbeat() {
    if (this._sealHeartbeatTimer) {
      clearInterval(this._sealHeartbeatTimer);
      this._sealHeartbeatTimer = null;
    }
  },
```

- [ ] **Step 6: 在 createRoom / joinByRoomNo / quitRoom 成功后调用 updateCockpitState**

在 `createRoom()` 方法（第 776 行）的 `this.connectWS(room.roomId)` 之后追加：

```js
      this.updateCockpitState();
```

在 `joinByRoomNo()` 方法（第 813 行）的 `this.connectWS(room.roomId)` 之后追加：

```js
      this.updateCockpitState();
```

在 `loadMyRooms()` 方法（第 202 行）中，`this.connectWS(room.roomId)` 之后追加：

```js
      this.updateCockpitState();
```

在 `loadMyRooms` 的 else 分支（清空状态）中也调用 `this.updateCockpitState()`。

- [ ] **Step 7: 在 onWsMessage 中处理 TRANSFER 事件添加轨迹**

在 `onWsMessage` 方法中，找到处理 `SCORE_UPDATE` / `MEMBER_UPDATE` / `TRANSFER` 的分支（约第 566 行），在 TRANSFER 事件处理中追加轨迹写入逻辑：

```js
      if (data.type === 'TRANSFER' && data.payload) {
        const p = data.payload;
        const fromMember = (this.data.currentRoom.members || []).find(m => String(m.userId) === String(p.fromUserId));
        const toMember = (this.data.currentRoom.members || []).find(m => String(m.userId) === String(p.toUserId));
        if (fromMember && toMember) {
          const traces = this.data.pulseTraces.slice();
          traces.push({
            id: Date.now() + Math.random(),
            title: `${this.formatCrewName(fromMember.nickname)} → ${this.formatCrewName(toMember.nickname)}`,
            desc: `脉冲 ${p.amount > 0 ? '+' : ''}${p.amount} 已写入缓冲区`,
            valueText: `${p.amount > 0 ? '+' : ''}${p.amount}`,
            valueClass: p.amount < 0 ? 'is-negative' : '',
            isNew: true
          });
          this.setData({ pulseTraces: traces, traceAnchor: `trace-${traces[traces.length - 1].id}` });
          const traceId = traces[traces.length - 1].id;
          setTimeout(() => {
            const current = this.data.pulseTraces.map(t =>
              t.id === traceId ? { ...t, isNew: false } : t
            );
            this.setData({ pulseTraces: current });
          }, 3000);
        }
      }
```

注意：这段逻辑需要放在现有 TRANSETER 处理的开头，根据实际 onWsMessage 结构调整位置。

- [ ] **Step 8: Commit**

```bash
git add miniprogram/pages/room/room.js
git commit -m "feat(room): 驾驶舱 Phase 1 — JS cockpitState + 辅助方法 + timer 修复"
```

---

### Task 2: room.js — timer 清理和 onHide 生命周期

**Files:**
- Modify: `miniprogram/pages/room/room.js:157-175` (onUnload)
- Modify: `miniprogram/pages/room/room.js` (新增 onHide)

- [ ] **Step 1: 扩展 onUnload 清理所有 timer**

将现有 `onUnload` 方法（第 157-175 行）替换为：

```js
  onUnload() {
    // 仅取消订阅，不销毁全局连接
    if (this._onWsMessage) {
      scoreWS.off('message', this._onWsMessage);
    }
    if (this._onWsClose) {
      scoreWS.off('close', this._onWsClose);
      scoreWS.off('open', this._onWsOpen);
    }
    // 清理所有定时器
    if (this._rollTimer) {
      clearTimeout(this._rollTimer);
      this._rollTimer = null;
    }
    if (this._toastTimer) {
      clearTimeout(this._toastTimer);
      this._toastTimer = null;
    }
    if (this._autoJoinTimer) {
      clearTimeout(this._autoJoinTimer);
      this._autoJoinTimer = null;
    }
    if (this._particleTimer) {
      clearTimeout(this._particleTimer);
      this._particleTimer = null;
    }
    this.stopSealHeartbeat();
  },
```

- [ ] **Step 2: 新增 onHide 生命周期**

在 `onUnload` 之后新增：

```js
  onHide() {
    // 切走时清理非关键 timer
    if (this._autoJoinTimer) {
      clearTimeout(this._autoJoinTimer);
      this._autoJoinTimer = null;
    }
    this.stopSealHeartbeat();
  },
```

- [ ] **Step 3: 在粒子动画中保存 timer 引用**

找到 `_runParticleWithRects` 方法中的递归 `setTimeout(animate, 16)` 调用（约第 1748 行），将 `setTimeout` 的返回值保存到 `this._particleTimer`：

```js
    const animate = () => {
      // ... 现有动画逻辑 ...
      this._particleTimer = setTimeout(animate, 16);
    };
```

同样，在 `_autoJoinTimer` 的 setTimeout 调用处（约第 725 行），确保赋值给 `this._autoJoinTimer`。

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/room/room.js
git commit -m "fix(room): 补齐 timer 清理和 onHide 生命周期"
```

---

### Task 3: room.wxml — 按 cockpitState 重构模板结构

**Files:**
- Modify: `miniprogram/pages/room/room.wxml` (全文重构)

这是最大的改动。当前 WXML 有 822 行，需要按 cockpitState 重新组织。

- [ ] **Step 1: 更新根节点 class**

将第 3 行：
```xml
<view class="room-page {{!animationEnabled ? 'reduce-motion' : ''}}">
```
替换为：
```xml
<view class="room-page cockpit-page {{!animationEnabled ? 'reduce-motion' : ''}}">
```

- [ ] **Step 2: 保留 WS 断线遮罩（不变）**

第 5-10 行的 WS 断线遮罩保持原样。

- [ ] **Step 3: 保留未登录状态（不变）**

第 12-19 行的未登录状态保持原样。

- [ ] **Step 4: 替换「已登录无房间」为驾驶舱 idle 状态**

将第 22-297 行（`<view wx:elif="{{!currentRoom}}" class="empty-room">` 整个块）替换为：

```xml
  <!-- 驾驶舱 Header（已登录时显示） -->
  <view wx:if="{{isLoggedIn}}" class="cockpit-header">
    <view class="header-kicker">COCKPIT ONLINE</view>
    <view class="header-main">
      <view>
        <view class="page-title">驾驶舱</view>
        <view class="page-subtitle">启动空间，记录脉冲</view>
      </view>
      <view class="sync-chip">
        <view class="status-dot {{wsConnected ? 'status-dot--on' : ''}}"></view>
        <text>{{wsConnected ? '链路在线' : '链路待接入'}}</text>
      </view>
    </view>
  </view>

  <!-- idle 状态：启动核心 -->
  <view wx:if="{{isLoggedIn && cockpitState === 'idle'}}" class="launch-deck sr-hud-panel">
    <view class="deck-grid"></view>

    <view class="launch-core {{launching ? 'is-igniting' : ''}}">
      <view class="core-ring core-ring-outer"></view>
      <view class="core-ring core-ring-inner"></view>
      <view class="core-center">
        <view class="core-label">MISSION SPACE</view>
        <view class="core-title">任务空间待机</view>
        <view class="core-desc">接入舰员后开始记录脉冲轨迹</view>
      </view>
    </view>

    <!-- 空间模式选择 -->
    <view class="launch-config">
      <view class="config-kicker">SPACE MODE</view>
      <view class="config-chips">
        <view class="config-chip {{scoreMode === 1 ? 'config-chip--on' : ''}}" bindtap="selectScoreMode" data-mode="1">
          <view class="chip-dot {{scoreMode === 1 ? 'chip-dot--on' : ''}}"></view>
          <text>自由流转</text>
        </view>
        <view class="config-chip {{scoreMode === 2 ? 'config-chip--on' : ''}}" bindtap="selectScoreMode" data-mode="2">
          <view class="chip-dot {{scoreMode === 2 ? 'chip-dot--on' : ''}}"></view>
          <text>本局录入</text>
        </view>
      </view>
    </view>

    <view class="launch-actions">
      <button class="sr-btn sr-btn-primary {{launching ? 'sr-btn--loading' : ''}}" bindtap="handleStartSpace">
        <text class="btn-text">启动空间</text>
      </button>
      <button class="sr-btn sr-btn-secondary" bindtap="openJoinPanel">
        <text class="btn-text">接入空间</text>
      </button>
    </view>
  </view>

  <!-- 接入空间弹窗 -->
  <view wx:if="{{joinPanelVisible}}" class="cockpit-mask" bindtap="closeJoinPanel">
    <view class="join-panel sr-hud-panel" catchtap="preventClose">
      <view class="panel-head">
        <view>
          <view class="panel-kicker">ACCESS CODE</view>
          <view class="panel-title">接入空间</view>
        </view>
        <view class="panel-close" bindtap="closeJoinPanel">
          <view class="icon-close"></view>
        </view>
      </view>

      <view class="code-input-wrap">
        <input
          class="code-input"
          value="{{joinCode}}"
          maxlength="6"
          placeholder="输入 6 位识别码"
          placeholder-class="input-placeholder"
          bindinput="onJoinCodeInput"
        />
      </view>

      <button class="sr-btn sr-btn-primary {{joining ? 'sr-btn--loading' : ''}}" bindtap="handleJoinSpace">
        <text class="btn-text">确认接入</text>
      </button>
    </view>
  </view>
```

- [ ] **Step 5: 替换「已有房间快捷入口」为驾驶舱 idle 状态下的重入提示**

将第 300-332 行（`<view wx:elif="{{!viewingRoom}}" class="has-room">` 块）替换为：

```xml
  <!-- idle 状态：已有空间快捷入口 -->
  <view wx:if="{{isLoggedIn && cockpitState === 'idle' && currentRoom && !viewingRoom}}" class="reentry-card sr-card">
    <view class="reentry-head">
      <view class="reentry-kicker">MISSION ACTIVE</view>
      <view class="reentry-title">进行中的任务空间</view>
    </view>
    <view class="reentry-info">
      <view class="reentry-code">SR-{{currentRoom.roomNo}}</view>
      <view class="reentry-meta">
        <text>{{currentRoom.members ? currentRoom.members.length : 0}} 名舰员</text>
        <text>{{currentRoom.scoreMode === 1 ? '自由流转' : '本局录入'}}</text>
      </view>
    </view>
    <view class="reentry-actions">
      <button class="sr-btn sr-btn-primary" bindtap="enterRoom">
        <text class="btn-text">进入空间</text>
      </button>
    </view>
  </view>
```

- [ ] **Step 6: 替换「在房间中」为驾驶舱 active 状态**

将第 335-627 行（`<view wx:else class="room-content">` 整个块）替换为：

```xml
  <!-- active 状态：驾驶舱主界面 -->
  <view wx:if="{{isLoggedIn && cockpitState === 'active'}}" class="cockpit-active">
    <!-- 顶部提示 -->
    <view class="top-toast {{toastMsg ? 'top-toast-show' : ''}} {{toastType === 'error' ? 'top-toast-error' : ''}}" wx:if="{{toastMsg}}">
      <text>{{toastMsg}}</text>
    </view>

    <scroll-view scroll-y class="cockpit-scroll" style="height:100vh;">

      <!-- A. 空间识别区 -->
      <view class="space-status-card sr-card">
        <view class="space-id-block">
          <view class="label">空间识别码</view>
          <view class="space-code">{{currentRoom.roomNo}}</view>
        </view>
        <view class="space-meta">
          <view class="meta-item">
            <text class="meta-label">舰员</text>
            <text class="meta-value">{{seatList.length ? seatList.filter(s => s.active).length : memberGrid.length}}/16</text>
          </view>
          <view class="meta-item">
            <text class="meta-label">模式</text>
            <text class="meta-value">{{currentRoom.scoreMode === 1 ? '自由流转' : '本局录入'}}</text>
          </view>
          <view class="meta-item">
            <text class="meta-label">状态</text>
            <text class="meta-value">航程中</text>
          </view>
        </view>
        <view class="space-actions">
          <view class="icon-btn" bindtap="copyRoomNo">
            <view class="icon-clip"></view>
          </view>
          <view class="icon-btn" bindtap="openShareSheet">
            <view class="icon-share"></view>
          </view>
        </view>
      </view>

      <!-- B. 舰员席位矩阵 -->
      <view class="crew-section">
        <view class="section-head">
          <view>
            <view class="section-kicker">CREW MATRIX</view>
            <view class="section-title">舰员席位</view>
          </view>
          <view class="section-count">{{memberGrid.length}}/16</view>
        </view>

        <view class="crew-grid">
          <view
            wx:for="{{seatList}}"
            wx:key="seatKey"
            class="crew-seat {{item.active ? 'is-active' : 'is-empty'}} {{item.isSelf ? 'is-self' : ''}} {{selectedCrew.userId === item.userId ? 'is-selected' : ''}}"
            bindtap="handleSelectCrew"
            data-user-id="{{item.userId}}"
          >
            <view class="seat-corner"></view>
            <view class="seat-avatar-wrap">
              <helmet-avatar
                wx:if="{{item.active}}"
                src="{{item.avatarUrl || ''}}"
                size="sm"
                active="{{selectedCrew.userId === item.userId}}"
                controller="{{item.isHost}}"
                showStatus="{{false}}"
                reduceMotion="{{!animationEnabled}}"
              />
              <view wx:else class="empty-seat-mark"></view>
            </view>

            <view class="seat-name">{{item.displayName}}</view>
            <view class="seat-score" wx:if="{{item.active}}">{{item.scoreText}}</view>
            <view class="seat-state">
              <view class="seat-dot"></view>
              <text>{{item.active ? '在线' : '待接入'}}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- C. 记录脉冲控制区 -->
      <view class="pulse-control sr-hud-panel">
        <view class="section-head">
          <view>
            <view class="section-kicker">PULSE CONTROL</view>
            <view class="section-title">记录脉冲</view>
          </view>
          <view class="target-chip" wx:if="{{selectedCrew}}">
            指向 {{selectedCrew.displayName}}
          </view>
        </view>

        <view class="pulse-input-row">
          <button class="pulse-step" bindtap="decreasePulse">
            <text>−</text>
          </button>
          <input
            class="pulse-input"
            type="number"
            value="{{pulseValue}}"
            bindinput="onPulseValueInput"
            placeholder="0"
            placeholder-class="input-placeholder"
          />
          <button class="pulse-step" bindtap="increasePulse">
            <text>＋</text>
          </button>
        </view>

        <button
          class="sr-btn sr-btn-primary pulse-submit {{!selectedCrew || !pulseValue ? 'sr-btn--disabled' : ''}} {{submittingPulse ? 'sr-btn--loading' : ''}}"
          bindtap="handleSubmitPulse"
        >
          <text class="btn-text">写入脉冲轨迹</text>
        </button>
        <view class="pulse-hint" wx:if="{{!selectedCrew}}">
          请选择舰员席位
        </view>
      </view>

      <!-- D. 脉冲轨迹 -->
      <view class="trace-section sr-card">
        <view class="section-head">
          <view>
            <view class="section-kicker">BLACK BOX BUFFER</view>
            <view class="section-title">脉冲轨迹</view>
          </view>
          <view class="trace-status">
            <view class="status-dot status-dot--on"></view>
            <text>实时写入</text>
          </view>
        </view>

        <scroll-view scroll-y class="trace-list" scroll-into-view="{{traceAnchor}}" style="max-height:520rpx;">
          <view
            wx:for="{{pulseTraces}}"
            wx:key="id"
            id="trace-{{item.id}}"
            class="trace-item {{item.isNew ? 'is-new' : ''}}"
          >
            <view class="trace-line"></view>
            <view class="trace-main">
              <view class="trace-title">{{item.title}}</view>
              <view class="trace-desc">{{item.desc}}</view>
            </view>
            <view class="trace-value {{item.valueClass}}">{{item.valueText}}</view>
          </view>

          <view wx:if="{{!pulseTraces.length}}" class="trace-empty">
            <view class="empty-title">暂无脉冲轨迹</view>
            <view class="empty-desc">记录后的数值流向会写入这里</view>
          </view>
        </scroll-view>
      </view>

      <!-- 本局录入状态条（保留现有组件） -->
      <round-status-bar
        wx:if="{{currentRoom.scoreMode === 2 && roundRecord}}"
        round="{{roundRecord}}"
        is-owner="{{isOwner}}"
        bind:tap="onRoundStatusTap"
        bind:cancel="onRoundCancel"
      />

      <!-- 录入本局按钮 -->
      <view class="round-start-wrap" wx:if="{{currentRoom.scoreMode === 2 && !roundRecord && isOwner}}">
        <view class="round-start-btn" bindtap="startRound">
          <text class="round-start-text">录入本局</text>
        </view>
      </view>

      <!-- 底部操作栏 -->
      <view class="bottom-command-bar">
        <button class="sr-btn sr-btn-secondary" bindtap="copyRoomNo">
          <text class="btn-text">发送识别码</text>
        </button>
        <button class="sr-btn sr-btn-danger-outline" bindtap="openSealConfirm" wx:if="{{isOwner}}">
          <text class="btn-text">封存航程</text>
        </button>
        <button class="sr-btn sr-btn-danger-outline" bindtap="quitRoom" wx:else>
          <text class="btn-text">断开空间</text>
        </button>
      </view>

    </scroll-view>

    <!-- 封存确认弹窗 -->
    <view wx:if="{{sealConfirmVisible}}" class="cockpit-mask">
      <view class="seal-panel sr-hud-panel">
        <view class="seal-core">
          <view class="seal-ring"></view>
          <view class="seal-title">确认封存航程</view>
          <view class="seal-desc">
            当前脉冲轨迹将写入黑匣子，封存后不可继续记录。
          </view>
        </view>

        <view class="seal-meta">
          <view class="meta-item">
            <text class="meta-label">舰员</text>
            <text class="meta-value">{{memberGrid.length}}</text>
          </view>
          <view class="meta-item">
            <text class="meta-label">轨迹</text>
            <text class="meta-value">{{pulseTraces.length}}</text>
          </view>
        </view>

        <view class="seal-actions">
          <button class="sr-btn sr-btn-secondary" bindtap="closeSealConfirm">
            <text class="btn-text">继续航程</text>
          </button>
          <button class="sr-btn sr-btn-danger-outline" bindtap="handleSealRoom">
            <text class="btn-text">确认封存</text>
          </button>
        </view>
      </view>
    </view>

    <!-- 流转终端（保留现有 numpad overlay，Phase 2 替换） -->
    <view class="transfer-overlay {{showNumpad ? 'transfer-show' : ''}}" catchtap="closeNumpad">
      <view class="transfer-sheet" catchtap="preventClose">
        <!-- 保留现有流转终端内容 -->
      </view>
    </view>

  </view>

  <!-- sealing 状态：黑匣子写入中 -->
  <view wx:if="{{cockpitState === 'sealing'}}" class="sealing-overlay">
    <view class="blackbox-write sr-hud-panel">
      <view class="write-beam"></view>
      <view class="write-title">黑匣子写入中</view>
      <view class="write-desc">{{sealHeartbeatText}}</view>
    </view>
  </view>

  <!-- 结算弹层（保留现有组件，Phase 2 重新设计） -->
  <view wx:if="{{showSettleOverlay}}" class="settle-overlay-mask">
    <!-- 保留现有结算弹层内容 -->
  </view>
```

注意：上述 WXML 中的流转终端（transfer-overlay）和结算弹层（settle-overlay-mask）需要保留现有代码的完整内容。在实际编辑时，将现有 transfer-overlay 的完整内容（第 478-627 行）和结算弹层内容原封不动地粘贴到对应位置。

- [ ] **Step 7: Commit**

```bash
git add miniprogram/pages/room/room.wxml
git commit -m "refactor(room): 驾驶舱 Phase 1 — WXML 按 cockpitState 重构"
```

---

### Task 4: room.wxss — 新增 HUD 面板、席位矩阵、脉冲控制、轨迹样式

**Files:**
- Modify: `miniprogram/pages/room/room.wxss` (文件末尾追加)

- [ ] **Step 1: 在 room.wxss 末尾追加驾驶舱样式**

在 `room.wxss` 文件末尾追加以下样式：

```css
/* ============================================================
   驾驶舱 Phase 1 — HUD 样式
   ============================================================ */

/* === 页面根节点 === */
.cockpit-page {
  padding: 32rpx 28rpx calc(220rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  color: var(--text-primary);
  background:
    radial-gradient(circle at 20% 0%, rgba(10,132,255,0.12), transparent 32%),
    radial-gradient(circle at 90% 18%, rgba(94,92,230,0.08), transparent 30%),
    #0A0A0A;
}

/* === 驾驶舱 Header === */
.cockpit-header {
  margin-bottom: 32rpx;
}

.header-kicker {
  font-size: 20rpx;
  letter-spacing: 4rpx;
  color: rgba(0,200,255,0.46);
  font-family: 'DIN Alternate', Menlo, monospace;
  margin-bottom: 8rpx;
}

.header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-title {
  font-size: 40rpx;
  font-weight: 700;
  color: rgba(226,242,255,0.96);
  letter-spacing: 2rpx;
}

.page-subtitle {
  font-size: 24rpx;
  color: rgba(226,242,255,0.46);
  margin-top: 4rpx;
}

.sync-chip {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 16rpx;
  border: 1rpx solid rgba(255,255,255,0.08);
  border-radius: 20rpx;
  font-size: 20rpx;
  color: rgba(226,242,255,0.56);
}

.status-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: rgba(226,242,255,0.22);
}

.status-dot--on {
  background: rgba(48,209,88,0.88);
  box-shadow: 0 0 8rpx rgba(48,209,88,0.4);
}

/* === HUD 面板 === */
.sr-hud-panel {
  position: relative;
  border: 1rpx solid rgba(0,200,255,0.22);
  background: rgba(3,10,18,0.64);
  clip-path: polygon(
    24rpx 0,
    calc(100% - 24rpx) 0,
    100% 24rpx,
    100% calc(100% - 24rpx),
    calc(100% - 24rpx) 100%,
    24rpx 100%,
    0 calc(100% - 24rpx),
    0 24rpx
  );
  padding: 32rpx;
  margin-bottom: 24rpx;
}

/* === 通用卡片 === */
.sr-card {
  border-radius: 28rpx;
  border: 1rpx solid rgba(10,132,255,0.18);
  background: rgba(255,255,255,0.035);
  padding: 28rpx;
  margin-bottom: 24rpx;
}

/* === 通用按钮 === */
.sr-btn {
  position: relative;
  height: 82rpx;
  border-radius: 0;
  padding: 0 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
  background: rgba(255,255,255,0.025);
  color: var(--text-primary);
  border: 1rpx solid rgba(10,132,255,0.26);
  clip-path: polygon(
    18rpx 0,
    100% 0,
    100% calc(100% - 18rpx),
    calc(100% - 18rpx) 100%,
    0 100%,
    0 18rpx
  );
  transition: opacity .18s, transform .18s, border-color .18s, background-color .18s;
}

.sr-btn::after {
  display: none;
}

.sr-btn-primary {
  border-color: rgba(0,200,255,0.48);
  background: linear-gradient(90deg, rgba(10,132,255,0.20), rgba(0,200,255,0.10));
  color: rgba(226,242,255,0.96);
}

.sr-btn-secondary {
  border-color: rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.035);
}

.sr-btn-danger-outline {
  border-color: rgba(255,69,58,0.42);
  color: rgba(255,126,118,0.96);
  background: rgba(255,69,58,0.035);
}

.sr-btn--disabled {
  opacity: 0.38;
  pointer-events: none;
}

.sr-btn--loading {
  opacity: 0.64;
}

.btn-text {
  position: relative;
  z-index: 1;
}

/* === 启动核心 === */
.launch-deck {
  text-align: center;
  padding: 48rpx 32rpx;
  overflow: hidden;
}

.deck-grid {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(0,200,255,0.03) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(0,200,255,0.03) 1rpx, transparent 1rpx);
  background-size: 48rpx 48rpx;
  opacity: 0.6;
  pointer-events: none;
}

.launch-core {
  position: relative;
  width: 280rpx;
  height: 280rpx;
  margin: 40rpx auto;
}

.core-ring {
  position: absolute;
  border-radius: 50%;
  border: 1rpx solid rgba(0,200,255,0.22);
}

.core-ring-outer {
  inset: 0;
  animation: coreRotate 12s linear infinite;
}

.core-ring-inner {
  inset: 30rpx;
  border-color: rgba(0,200,255,0.14);
  animation: coreRotate 8s linear infinite reverse;
}

@keyframes coreRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.launch-core.is-igniting .core-ring {
  border-color: rgba(0,200,255,0.56);
  box-shadow: 0 0 24rpx rgba(0,200,255,0.2);
}

.core-center {
  position: absolute;
  inset: 60rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.core-label {
  font-size: 18rpx;
  letter-spacing: 4rpx;
  color: rgba(0,200,255,0.46);
  font-family: 'DIN Alternate', Menlo, monospace;
}

.core-title {
  font-size: 30rpx;
  font-weight: 600;
  color: rgba(226,242,255,0.92);
  margin-top: 8rpx;
}

.core-desc {
  font-size: 22rpx;
  color: rgba(226,242,255,0.46);
  margin-top: 8rpx;
}

/* === 启动配置 === */
.launch-config {
  margin: 32rpx 0;
  text-align: left;
}

.config-kicker {
  font-size: 18rpx;
  letter-spacing: 3rpx;
  color: rgba(0,200,255,0.38);
  font-family: 'DIN Alternate', Menlo, monospace;
  margin-bottom: 12rpx;
}

.config-chips {
  display: flex;
  gap: 16rpx;
}

.config-chip {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 16rpx 20rpx;
  border: 1rpx solid rgba(255,255,255,0.08);
  border-radius: 12rpx;
  font-size: 24rpx;
  color: rgba(226,242,255,0.56);
  transition: border-color .18s, background-color .18s;
}

.config-chip--on {
  border-color: rgba(0,200,255,0.34);
  background: rgba(0,200,255,0.06);
  color: rgba(226,242,255,0.92);
}

.chip-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  border: 1rpx solid rgba(226,242,255,0.22);
}

.chip-dot--on {
  background: rgba(0,200,255,0.88);
  border-color: rgba(0,200,255,0.88);
}

/* === 启动按钮区 === */
.launch-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 32rpx;
}

/* === 接入弹窗 === */
.cockpit-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.72);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
}

.join-panel {
  width: 100%;
  max-width: 600rpx;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 32rpx;
}

.panel-kicker {
  font-size: 18rpx;
  letter-spacing: 3rpx;
  color: rgba(0,200,255,0.46);
  font-family: 'DIN Alternate', Menlo, monospace;
  margin-bottom: 6rpx;
}

.panel-title {
  font-size: 32rpx;
  font-weight: 600;
  color: rgba(226,242,255,0.96);
}

.panel-close {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(226,242,255,0.46);
}

.icon-close {
  width: 24rpx;
  height: 24rpx;
  position: relative;
}

.icon-close::before,
.icon-close::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24rpx;
  height: 2rpx;
  background: currentColor;
}

.icon-close::before { transform: translate(-50%, -50%) rotate(45deg); }
.icon-close::after { transform: translate(-50%, -50%) rotate(-45deg); }

.code-input-wrap {
  margin-bottom: 24rpx;
}

.code-input {
  width: 100%;
  height: 96rpx;
  text-align: center;
  font-size: 48rpx;
  font-family: 'DIN Alternate', Menlo, monospace;
  letter-spacing: 12rpx;
  color: rgba(0,200,255,0.92);
  background: rgba(255,255,255,0.035);
  border: 1rpx solid rgba(0,200,255,0.22);
  border-radius: 12rpx;
  caret-color: rgba(0,200,255,0.88);
}

.input-placeholder {
  color: rgba(226,242,255,0.24);
  letter-spacing: 4rpx;
  font-size: 28rpx;
}

/* === 重入卡片 === */
.reentry-card {
  margin-top: 16rpx;
}

.reentry-head {
  margin-bottom: 16rpx;
}

.reentry-kicker {
  font-size: 18rpx;
  letter-spacing: 3rpx;
  color: rgba(0,200,255,0.46);
  font-family: 'DIN Alternate', Menlo, monospace;
  margin-bottom: 4rpx;
}

.reentry-title {
  font-size: 28rpx;
  font-weight: 600;
  color: rgba(226,242,255,0.92);
}

.reentry-code {
  font-size: 36rpx;
  font-family: 'DIN Alternate', Menlo, monospace;
  color: rgba(0,200,255,0.92);
  letter-spacing: 4rpx;
  margin-bottom: 8rpx;
}

.reentry-meta {
  display: flex;
  gap: 24rpx;
  font-size: 22rpx;
  color: rgba(226,242,255,0.46);
  margin-bottom: 20rpx;
}

.reentry-actions {
  margin-top: 8rpx;
}

/* === 空间识别卡 === */
.space-status-card {
  position: relative;
}

.space-id-block {
  margin-bottom: 16rpx;
}

.space-id-block .label {
  font-size: 20rpx;
  color: rgba(226,242,255,0.38);
  letter-spacing: 2rpx;
  margin-bottom: 4rpx;
}

.space-code {
  font-size: 40rpx;
  font-family: 'DIN Alternate', Menlo, monospace;
  color: rgba(0,200,255,0.92);
  letter-spacing: 6rpx;
  font-weight: 600;
}

.space-meta {
  display: flex;
  gap: 32rpx;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.meta-label {
  font-size: 20rpx;
  color: rgba(226,242,255,0.38);
}

.meta-value {
  font-size: 24rpx;
  color: rgba(226,242,255,0.82);
  font-family: 'DIN Alternate', Menlo, monospace;
}

.space-actions {
  position: absolute;
  top: 28rpx;
  right: 28rpx;
  display: flex;
  gap: 12rpx;
}

.icon-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(255,255,255,0.08);
  border-radius: 12rpx;
  color: rgba(226,242,255,0.46);
  transition: border-color .18s;
}

/* === Section 通用 === */
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.section-kicker {
  font-size: 18rpx;
  letter-spacing: 3rpx;
  color: rgba(0,200,255,0.38);
  font-family: 'DIN Alternate', Menlo, monospace;
  margin-bottom: 4rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: rgba(226,242,255,0.92);
}

.section-count {
  font-size: 24rpx;
  font-family: 'DIN Alternate', Menlo, monospace;
  color: rgba(0,200,255,0.64);
}

/* === 舰员席位矩阵 === */
.crew-section {
  margin-bottom: 24rpx;
}

.crew-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14rpx;
}

.crew-seat {
  min-height: 168rpx;
  padding: 16rpx 10rpx;
  box-sizing: border-box;
  border: 1rpx solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.025);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  clip-path: polygon(
    14rpx 0,
    100% 0,
    100% calc(100% - 14rpx),
    calc(100% - 14rpx) 100%,
    0 100%,
    0 14rpx
  );
  transition: border-color .18s, background-color .18s;
}

.crew-seat.is-active {
  border-color: rgba(0,200,255,0.24);
  background: rgba(0,200,255,0.04);
}

.crew-seat.is-self {
  border-color: rgba(48,209,88,0.34);
}

.crew-seat.is-selected {
  border-color: rgba(0,200,255,0.56);
  background: rgba(0,200,255,0.08);
}

.seat-corner {
  position: absolute;
  top: 0;
  left: 0;
  width: 14rpx;
  height: 14rpx;
  border-top: 1rpx solid rgba(0,200,255,0.34);
  border-left: 1rpx solid rgba(0,200,255,0.34);
}

.crew-seat.is-empty .seat-corner {
  border-color: rgba(255,255,255,0.06);
}

.seat-avatar-wrap {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-seat-mark {
  width: 40rpx;
  height: 40rpx;
  border: 1rpx dashed rgba(226,242,255,0.14);
  border-radius: 50%;
}

.seat-name {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: rgba(226,242,255,0.82);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.crew-seat.is-empty .seat-name {
  color: rgba(226,242,255,0.24);
}

.seat-score {
  margin-top: 4rpx;
  font-family: 'DIN Alternate', Menlo, monospace;
  font-size: 26rpx;
  color: rgba(0,200,255,0.92);
  text-align: center;
}

.seat-state {
  margin-top: 8rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6rpx;
  font-size: 18rpx;
  color: rgba(226,242,255,0.46);
}

.crew-seat.is-empty .seat-dot {
  background: rgba(226,242,255,0.22);
  box-shadow: none;
}

/* === 脉冲控制 === */
.pulse-control {
  margin-bottom: 24rpx;
}

.target-chip {
  font-size: 22rpx;
  color: rgba(0,200,255,0.72);
  padding: 6rpx 14rpx;
  border: 1rpx solid rgba(0,200,255,0.22);
  border-radius: 16rpx;
}

.pulse-input-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin: 20rpx 0;
}

.pulse-step {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(0,200,255,0.22);
  border-radius: 12rpx;
  background: rgba(255,255,255,0.025);
  color: rgba(0,200,255,0.82);
  font-size: 32rpx;
  font-weight: 600;
  padding: 0;
  line-height: 1;
}

.pulse-step::after {
  display: none;
}

.pulse-input {
  flex: 1;
  height: 72rpx;
  text-align: center;
  font-size: 40rpx;
  font-family: 'DIN Alternate', Menlo, monospace;
  color: rgba(0,200,255,0.92);
  background: rgba(255,255,255,0.035);
  border: 1rpx solid rgba(0,200,255,0.18);
  border-radius: 12rpx;
  caret-color: rgba(0,200,255,0.88);
}

.pulse-submit {
  margin-top: 16rpx;
}

.pulse-hint {
  text-align: center;
  font-size: 22rpx;
  color: rgba(226,242,255,0.38);
  margin-top: 12rpx;
}

/* === 脉冲轨迹 === */
.trace-section {
  margin-bottom: 24rpx;
}

.trace-status {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 20rpx;
  color: rgba(226,242,255,0.46);
}

.trace-list {
  margin-top: 20rpx;
}

.trace-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 18rpx 0 18rpx 22rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.06);
}

.trace-item.is-new {
  background: rgba(0,200,255,0.04);
}

.trace-line {
  width: 2rpx;
  align-self: stretch;
  background: linear-gradient(to bottom, rgba(0,200,255,0.0), rgba(0,200,255,0.6), rgba(0,200,255,0.0));
}

.trace-main {
  flex: 1;
  min-width: 0;
}

.trace-title {
  font-size: 25rpx;
  color: rgba(226,242,255,0.88);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trace-desc {
  margin-top: 6rpx;
  font-size: 21rpx;
  color: rgba(226,242,255,0.46);
}

.trace-value {
  font-family: 'DIN Alternate', Menlo, monospace;
  font-size: 26rpx;
  color: rgba(0,200,255,0.92);
  flex-shrink: 0;
}

.trace-value.is-negative {
  color: rgba(255,159,10,0.92);
}

.trace-empty {
  text-align: center;
  padding: 48rpx 0;
}

.trace-empty .empty-title {
  font-size: 26rpx;
  color: rgba(226,242,255,0.46);
  margin-bottom: 8rpx;
}

.trace-empty .empty-desc {
  font-size: 22rpx;
  color: rgba(226,242,255,0.24);
}

/* === 底部操作栏 === */
.bottom-command-bar {
  display: flex;
  gap: 16rpx;
  padding: 24rpx 0;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}

.bottom-command-bar .sr-btn {
  flex: 1;
}

/* === 封存确认弹窗 === */
.seal-panel {
  width: 100%;
  max-width: 600rpx;
  text-align: center;
}

.seal-core {
  margin-bottom: 24rpx;
}

.seal-ring {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 1rpx solid rgba(255,69,58,0.34);
  margin: 0 auto 20rpx;
  position: relative;
}

.seal-ring::before {
  content: '';
  position: absolute;
  inset: 16rpx;
  border-radius: 50%;
  border: 1rpx solid rgba(255,69,58,0.18);
}

.seal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: rgba(255,126,118,0.96);
  margin-bottom: 12rpx;
}

.seal-desc {
  font-size: 24rpx;
  color: rgba(226,242,255,0.56);
  line-height: 1.6;
}

.seal-meta {
  display: flex;
  justify-content: center;
  gap: 48rpx;
  margin-bottom: 24rpx;
}

.seal-meta .meta-label {
  text-align: center;
}

.seal-meta .meta-value {
  text-align: center;
  font-size: 28rpx;
}

.seal-actions {
  display: flex;
  gap: 16rpx;
}

.seal-actions .sr-btn {
  flex: 1;
}

/* === 黑匣子写入中 === */
.sealing-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.88);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.blackbox-write {
  text-align: center;
  width: 400rpx;
}

.write-beam {
  width: 4rpx;
  height: 80rpx;
  background: linear-gradient(to bottom, rgba(0,200,255,0.0), rgba(0,200,255,0.8), rgba(0,200,255,0.0));
  margin: 0 auto 24rpx;
  animation: beamPulse 1.5s ease-in-out infinite;
}

@keyframes beamPulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

.write-title {
  font-size: 30rpx;
  font-weight: 600;
  color: rgba(0,200,255,0.92);
  margin-bottom: 12rpx;
}

.write-desc {
  font-size: 24rpx;
  color: rgba(226,242,255,0.56);
  animation: textFade 3s ease-in-out infinite;
}

@keyframes textFade {
  0%, 100% { opacity: 0.56; }
  50% { opacity: 0.92; }
}

/* === 本局录入（保留） === */
.round-start-wrap {
  display: flex;
  justify-content: center;
  padding: 16rpx 0;
}

.round-start-btn {
  padding: 14rpx 32rpx;
  border: 1rpx solid rgba(0,200,255,0.34);
  border-radius: 12rpx;
  background: rgba(0,200,255,0.06);
  transition: opacity .18s;
}

.round-start-text {
  font-size: 26rpx;
  color: rgba(0,200,255,0.92);
}

/* === reduce-motion === */
.reduce-motion .core-ring-outer,
.reduce-motion .core-ring-inner,
.reduce-motion .write-beam,
.reduce-motion .write-desc,
.reduce-motion .deck-grid {
  animation: none !important;
}
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/pages/room/room.wxss
git commit -m "feat(room): 驾驶舱 Phase 1 — HUD 面板/席位/脉冲/轨迹样式"
```

---

### Task 5: 验收自检

**Files:**
- 无文件改动，纯检查

- [ ] **Step 1: 在微信开发者工具中预览空间页**

打开微信开发者工具，导入 `miniprogram/` 目录，进入空间页，检查：

1. 未登录时显示「终端未接入」
2. 登录后 idle 状态显示启动核心 HUD + 启动空间/接入空间按钮
3. 点击「接入空间」弹出识别码输入面板
4. 输入 6 位识别码自动大写
5. 启动空间后进入 active 状态
6. active 状态显示空间识别卡 + 舰员席位矩阵 + 脉冲控制 + 脉冲轨迹
7. 席位矩阵 4x4 布局，空席显示占位
8. 昵称最多 6 字符不溢出
9. 选中席位后可输入脉冲值并写入
10. 封存航程弹出确认弹窗
11. 确认封存后显示黑匣子写入中 overlay
12. 全部主操作是中文，英文只弱装饰
13. 无原生彩色 Emoji
14. reduce-motion 开启后无循环动画

- [ ] **Step 2: 检查文案合规**

在开发者工具中搜索以下禁词，确认不出现：

- 房间号 / 房间（用户可见）
- 用户 / 成员（用户可见）
- 分数 / 结算 / 提交 / 流水（用户可见）
- LLM / LOW-NOISE / HIGH_RISK / fallback / fortune
- 原生彩色 Emoji

- [ ] **Step 3: 检查 timer 清理**

在开发者工具 Console 中：
1. 进入空间页，触发一些操作
2. 切换到其他 Tab
3. 切回来确认无报错
4. 退出页面确认无 "setData on unmounted page" 警告

- [ ] **Step 4: 最终 Commit（如有修复）**

```bash
git add -A
git commit -m "fix(room): 驾驶舱 Phase 1 验收修复"
```
