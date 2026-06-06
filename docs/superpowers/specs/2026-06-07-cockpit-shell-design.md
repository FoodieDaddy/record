# 空间页驾驶舱改造 Phase 1 — 基础壳

## 目标

将空间页从"创建房间/成员列表/记录流水"的工具页，升级为「脉冲方舟驾驶舱」体验。Phase 1 只做基础壳，复杂功能（靶向环、数字键盘、本局录入流程、封存弹层详情）后续 Phase 2 融入。

## 范围

### Phase 1 包含

| 状态 | 内容 |
|---|---|
| `idle` | 启动核心 HUD + 启动空间/接入空间按钮 + 接入弹窗 |
| `active` | 空间识别卡 + 舰员席位矩阵(4x4) + 脉冲控制区 + 脉冲轨迹 + 底部操作栏 |
| `sealing` | 黑匣子写入中 HUD overlay + heartbeat 文案 |
| `sealed` | 保持现有封存弹层入口不变 |

### Phase 1 不包含（后续 Phase 2）

- 自由流转靶向选择环 + 数字键盘 + 流向动画
- 本局录入 start/submit/confirm/cancel 流程
- 封存弹层（雷达图/网络图/洞察/排名）
- 得分记录列表 + 空间扫描面板 + 矩阵概览
- 二维码分享

## 改造策略

保留现有 JS 业务逻辑，替换 WXML 外层结构和 WXSS 视觉。

- **WXML**：按 `cockpitState` 重新组织模板，idle/active/sealing 各自独立区域
- **WXSS**：新增 HUD 面板、席位矩阵、脉冲控制、轨迹样式，保留现有功能样式
- **JS**：新增 `cockpitState` 字段和 cockpit 辅助方法，保留所有现有业务逻辑
- **timer 修复**：补齐 `_autoJoinTimer` 和粒子动画的 onUnload 清理，新增 onHide

## 状态机

```
cockpitState: 'idle' | 'active' | 'sealing' | 'sealed'
```

- `idle`：无 currentRoom，显示启动核心
- `active`：有 currentRoom，显示驾驶舱主界面
- `sealing`：封存进行中，显示黑匣子写入 overlay
- `sealed`：封存完成，跳转现有封存弹层

## WXML 结构

### 根节点

```xml
<view class="room-page cockpit-page {{!animationEnabled ? 'reduce-motion' : ''}}">
```

### 1. 顶部 HUD Header

```xml
<view class="cockpit-header">
  <view class="header-kicker">COCKPIT ONLINE</view>
  <view class="header-main">
    <view>
      <view class="page-title">驾驶舱</view>
      <view class="page-subtitle">启动空间，记录脉冲</view>
    </view>
    <view class="sync-chip">
      <view class="status-dot"></view>
      <text>{{wsConnected ? '链路在线' : '链路待接入'}}</text>
    </view>
  </view>
</view>
```

### 2. idle 状态：启动核心

```xml
<view wx:if="{{cockpitState === 'idle'}}" class="launch-deck sr-hud-panel">
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
  <view class="launch-actions">
    <button class="sr-btn sr-btn-primary" bindtap="handleStartSpace">启动空间</button>
    <button class="sr-btn sr-btn-secondary" bindtap="openJoinPanel">接入空间</button>
  </view>
</view>
```

### 3. 接入弹窗

识别码输入面板，大号等宽字体，自动转大写，6 位限制。

### 4. active 状态：驾驶舱主界面

四块组成：

**A. 空间识别卡** — roomNo、舰员数、模式、状态
**B. 舰员席位矩阵** — 4x4 grid，helmet-avatar + 名称 + 脉冲值 + 在线状态
**C. 脉冲控制区** — 选舰员 + 输入数值 + 写入按钮
**D. 脉冲轨迹** — scroll-view 实时事件流

### 5. 底部操作栏

```xml
<view class="bottom-command-bar">
  <button class="sr-btn sr-btn-secondary" bindtap="handleShareSpace">发送识别码</button>
  <button class="sr-btn sr-btn-danger-outline" bindtap="openSealConfirm">封存航程</button>
</view>
```

### 6. 封存确认弹窗 + sealing overlay

确认弹窗展示舰员数和轨迹数。确认后进入 sealing 状态，展示黑匣子写入中 HUD + heartbeat 文案轮换。

## WXSS 核心样式

- `.sr-hud-panel`：切角 HUD 面板，`clip-path: polygon(...)` + 青色细描边
- `.sr-btn` 系列：切角按钮，primary/secondary/danger-outline 三态
- `.crew-grid`：`grid-template-columns: repeat(4, 1fr)`，14rpx gap
- `.crew-seat`：切角卡片，active/empty/self 三态
- `.pulse-control`：输入行 + 步进按钮 + 提交按钮
- `.trace-list`：垂直时间线样式，青色渐变连接线
- `.launch-core`：双环 + 中心区域，点火时 is-igniting 动画
- `.seal-panel`：确认弹窗 HUD 面板
- `.sealing-overlay`：黑匣子写入中全屏遮罩

## JS 改动

### 新增 data 字段

```js
cockpitState: 'idle',    // 'idle' | 'active' | 'sealing' | 'sealed'
wsConnected: false,
seatList: [],
selectedCrew: null,
pulseValue: '',
pulseTraces: [],
traceAnchor: '',
joinPanelVisible: false,
joinCode: '',
joining: false,
launching: false,
submittingPulse: false,
sealConfirmVisible: false,
sealing: false,
sealHeartbeatText: '脉冲轨迹封装中',
sealTimer: null,
_autoJoinTimer: null,
_particleTimer: null,
```

### 新增方法

- `buildSeatList(members)` — 生成 16 人席位数组
- `formatCrewName(name)` — 昵称截断 6 字符
- `formatPulseValue(value)` — 数值格式化（>=10w 显示 w）
- `handleStartSpace()` — 启动空间（调用现有创建逻辑）
- `openJoinPanel()` / `closeJoinPanel()` — 接入弹窗
- `onJoinCodeInput(e)` — 识别码输入（大写+过滤）
- `handleJoinSpace()` — 接入空间（调用现有加入逻辑）
- `handleSelectCrew(e)` — 选中舰员席位
- `handleSubmitPulse()` — 写入脉冲（调用现有 transfer 逻辑）
- `openSealConfirm()` / `closeSealConfirm()` — 封存确认弹窗
- `handleSealRoom()` — 封存航程（调用现有 settle 逻辑）
- `startSealHeartbeat()` / `stopSealHeartbeat()` — sealing 状态文案轮换

### cockpitState 驱动逻辑

```js
updateCockpitState() {
  if (!this.data.currentRoom) {
    this.setData({ cockpitState: 'idle' })
  } else if (this.data.sealing) {
    this.setData({ cockpitState: 'sealing' })
  } else {
    this.setData({ cockpitState: 'active' })
  }
}
```

在 `onShow`、WS 事件回调、创建/加入/封存成功后调用。

### timer 修复

- `_autoJoinTimer`：在 onUnload 中 clearTimeout
- `_particleTimer`：粒子动画句柄，在 onUnload 中 clearTimeout
- 新增 `onHide` 生命周期，清理非关键 timer

### WS 连接状态

在 WS `open`/`close` 事件中更新 `wsConnected`。

## 脉冲轨迹数据结构

从 WS `TRANSFER` 事件构建：

```js
{
  id: eventId,
  title: `${fromName} → ${toName}`,
  desc: `脉冲 ${value > 0 ? '+' : ''}${value} 已写入缓冲区`,
  valueText: `${value > 0 ? '+' : ''}${value}`,
  valueClass: value < 0 ? 'is-negative' : '',
  isNew: true  // 3s 后变 false
}
```

## 文案规范

| 旧词 | 新词 |
|---|---|
| 创建房间 | 启动空间 |
| 加入房间 | 接入空间 |
| 房间号 | 识别码 / 空间识别码 |
| 成员 | 舰员 / 舰员席位 |
| 分数 | 脉冲值 / 数值流向 |
| 流水 | 脉冲轨迹 |
| 结算 | 封存航程 |
| 提交 | 写入脉冲轨迹 |

禁止运行时出现技术穿帮词和审核高风险词（见 CLAUDE.md）。

## 验收标准

1. 空间页不像普通创建房间表单
2. 页面第一眼有驾驶舱/HUD/舰员席位感
3. 用户能清楚看到空间识别码
4. 舰员席位最多 16 人，4x4 布局不溢出
5. 昵称最多展示 6 个字符，不挤压布局
6. 记录脉冲入口明确
7. 封存航程有确认和黑匣子写入仪式
8. 全部主操作是中文，英文只弱装饰
9. 无原生彩色 Emoji
10. 无敏感词和技术穿帮词
11. 红色只用于封存等危险操作
12. reduce-motion 开启后无循环动画
13. onHide/onUnload 清理所有 timer/interval/raf
14. 不新增高频轮询
15. 不打印 token、完整 WS URL、OSS 签名 URL

## 文件影响

| 文件 | 改动类型 |
|---|---|
| `miniprogram/pages/room/room.wxml` | 重构模板结构 |
| `miniprogram/pages/room/room.wxss` | 新增 ~800 行 HUD 样式 |
| `miniprogram/pages/room/room.js` | 新增 cockpitState + 辅助方法 + timer 修复 |
| `miniprogram/pages/room/room.json` | 可能微调组件引用 |
