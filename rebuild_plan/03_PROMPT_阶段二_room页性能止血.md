# Phase 2 Prompt：room 页性能止血

## 角色

你是微信小程序真机性能优化工程师。请集中修复 `pages/room/room` 的卡顿、重绘、重复 setData 和隐藏弹层常驻问题。不要大改视觉风格，只做止血和结构性降载。

## 阶段目标

1. 降低 `room.js` 的高频 `setData`。
2. 删除或降级 active 驾驶舱中的常驻高耗动画。
3. 关闭弹层时彻底卸载 overlay，而不是仅隐藏。
4. 合并 WebSocket 消息引发的重复刷新。
5. 保持当前功能不丢失。

## 重点文件

- `miniprogram/pages/room/room.js`
- `miniprogram/pages/room/room.wxml`
- `miniprogram/pages/room/room.wxss`
- `miniprogram/components/matrix-overview/*`
- `miniprogram/utils/score-ws.js`

## 分析步骤

### Step 1：标记所有高频 setData

搜索并分类：

```bash
grep -n "setData" miniprogram/pages/room/room.js
grep -n "setTimeout\|setInterval" miniprogram/pages/room/room.js
grep -n "buildMemberGrid\|updateAllData\|loadRanking\|loadScoreRecords\|reloadRoomInfo" miniprogram/pages/room/room.js
```

分类为：

- 页面初始化类
- WebSocket 消息类
- 动画类
- 弹层开关类
- 表单输入类
- 数据刷新类

只允许动画开始和结束时 setData，不允许逐帧 setData。

### Step 2：添加 room patch 合批机制

在 `room.js` 中新增：

```js
scheduleRoomPatch(patch, options = {}) {
  this._pendingRoomPatch = {
    ...(this._pendingRoomPatch || {}),
    ...patch
  };

  if (options.immediate) {
    return this.flushRoomPatch();
  }

  if (this._roomPatchTimer) return;

  this._roomPatchTimer = setTimeout(() => {
    this.flushRoomPatch();
  }, options.delay || 50);
},

flushRoomPatch() {
  if (this._roomPatchTimer) {
    clearTimeout(this._roomPatchTimer);
    this._roomPatchTimer = null;
  }

  const patch = this._pendingRoomPatch;
  this._pendingRoomPatch = null;

  if (!patch || Object.keys(patch).length === 0) return;

  this.setData(patch);
}
```

然后把连续的 `this.setData({ ... })` 合并成 `scheduleRoomPatch`。

### Step 3：WebSocket 消息降噪

处理规则：

- `PRESENCE_UPDATE`：只 patch `onlineUserMap`，不要立即全量刷新。
- `MEMBER_JOIN`：只 patch 成员列表和局部派生，不要全量 `updateAllData`。
- `TRANSFER`：如果消息中包含新分数，直接 patch 本地 ranking/memberGrid；不要马上连发 `loadRanking + loadScoreRecords + reloadRoomInfo`。
- `SETTLE`：可以拉一次 HTTP 快照，但必须防抖。
- `RECONNECT_SUCCESS`：只拉一次 room snapshot，不要多处重复触发。

示例：

```js
handleTransferMessage(payload) {
  const nextRanking = this.patchRankingByTransfer(this.data.ranking, payload);
  const nextRecords = [payload.record, ...(this.data.scoreRecords || [])].filter(Boolean).slice(0, 50);

  this.scheduleRoomPatch({
    ranking: nextRanking,
    scoreRecords: nextRecords,
    lastTransferAt: Date.now()
  });

  this.playPulseFlightAnimation(payload);
  this.scheduleSnapshotRefresh({ reason: 'transfer', delay: 1200 });
}
```

### Step 4：overlay 按需挂载

检查所有 overlay：

- 分享面板
- 封存确认
- 数字键盘
- 本局录入弹窗
- 数值总览
- 结算浮层
- 加入房间面板
- 创建/进入过渡层

要求：

- 关闭时使用 `wx:if="{{visible}}"` 卸载。
- 不允许长期保留透明 fixed 层。
- catchtouchmove 只在弹层可见时存在。
- 弹层关闭必须清理计时器、动画状态、输入状态。

WXML 示例：

```xml
<room-overlays
  wx:if="{{overlayVisible}}"
  visible="{{overlayVisible}}"
  type="{{overlayType}}"
  bind:close="onOverlayClose"
/>
```

### Step 5：常驻动画降级

在 active room 状态中：

必须删除或降级：

- 大面积 `backdrop-filter`
- 多层 `box-shadow` 呼吸
- 背景扫描线常驻动画
- 多个同时运行的 keyframes
- 无交互意义的粒子流

保留：

- 按钮点击 120~180ms 反馈
- 脉冲成功 300~700ms 反馈
- 成员加入 300ms 入场
- 结算完成 600ms 以内反馈

## 代码级验收

必须满足：

```bash
# room.js 中不再出现 16ms 逐帧动画计时器
! grep -n "setTimeout(.*16\|setInterval(.*16" miniprogram/pages/room/room.js

# 动画相关 setData 次数明显下降
# 手工检查 playPulseFlightAnimation / playScoreRollAnimation 不再递归 setData
```

## 输出格式

完成后输出：

```md
# Phase 2 room 性能止血完成报告

## 删除或降级的动画

## 合并的 setData 列表

## WebSocket 消息处理变化

## overlay 卸载策略

## 真机测试记录

## 仍需 Phase 3 处理的问题
```

## 验收标准

- 连续记录 5 次脉冲，页面不出现明显卡顿。
- 打开/关闭数值总览，不出现触摸遮罩残留。
- WebSocket 收到连续消息时，Network 不再出现明显重复请求风暴。
- active room 常驻动画数量明显减少。
- 功能行为与原来一致。
