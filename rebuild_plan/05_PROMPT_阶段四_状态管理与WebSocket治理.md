# Phase 4 Prompt：状态管理与 WebSocket 治理

## 角色

你是实时协作类小程序架构工程师。请重构房间页的数据流，使 WebSocket、HTTP、页面派生状态之间的职责清晰，避免重复请求、状态闪烁和重连后数据错乱。

## 阶段目标

1. 建立 room store / room state 模型。
2. WebSocket 增量消息只做 patch，不随意全量刷新。
3. HTTP snapshot 只用于初始化、重连后和兜底校准。
4. 增加 WebSocket 心跳、前后台恢复、指数退避重连。
5. 保证页面卸载时清理监听器、计时器和连接状态。

## 重点文件

- `miniprogram/utils/score-ws.js`
- `miniprogram/pages/room/room.js`
- `miniprogram/utils/room-store.js` 或新建
- `miniprogram/services/room-service.js` 或新建
- `miniprogram/services/score-service.js` 或新建

## 当前问题

当前 `room.js` 同时负责：

- HTTP 请求
- WebSocket 连接和消息处理
- 页面状态 setData
- 成员网格构建
- 分数统计派生
- 动画触发
- 弹层状态

这会导致：

- 消息一多就重复 `buildMemberGrid`。
- `TRANSFER` 后可能重复拉 ranking、records、roomInfo。
- 重连后多处触发刷新。
- 页面 hide/unload 后可能仍有异步回调写 setData。

## 目标状态模型

新增一个简单 room state：

```js
const roomState = {
  roomInfo: null,
  members: [],
  ranking: [],
  scoreRecords: [],
  onlineUserMap: {},
  relationMap: {},
  wsStatus: 'idle',
  lastSnapshotAt: 0,
  lastTransferAt: 0
};
```

派生函数必须纯函数化：

```js
function deriveMemberGrid({ members, ranking, onlineUserMap }) {}
function deriveRelationMap(records) {}
function patchRankingByTransfer(ranking, payload) {}
function patchMembersByPresence(members, payload) {}
```

## 任务一：封装 room-store

新建 `utils/room-store.js` 或 `stores/room-store.js`。

必须包含：

- `getState()`
- `setSnapshot(snapshot)`
- `applyWsEvent(event)`
- `subscribe(listener)`
- `reset()`
- `deriveViewModel()`

示例：

```js
function createRoomStore() {
  let state = createInitialState();
  const listeners = [];

  function emit() {
    const viewModel = deriveViewModel(state);
    listeners.forEach(fn => fn(viewModel, state));
  }

  return {
    getState: () => state,
    setSnapshot(snapshot) {
      state = normalizeSnapshot(snapshot);
      emit();
    },
    applyWsEvent(event) {
      state = reduceWsEvent(state, event);
      emit();
    },
    subscribe(fn) {
      listeners.push(fn);
      return () => {
        const idx = listeners.indexOf(fn);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    },
    reset() {
      state = createInitialState();
      emit();
    }
  };
}
```

## 任务二：WebSocket 心跳与重连

修改 `utils/score-ws.js`：

必须支持：

- `connect({ roomId, token })`
- `disconnect(reason)`
- `sendHeartbeat()`
- `scheduleReconnect()`
- `onMessage(fn)`
- `onStatusChange(fn)`
- `resetReconnect()`

重连策略：

```js
const reconnectDelays = [500, 1000, 2000, 4000, 8000];
```

前后台：

- `App.onHide` 或页面 `onHide`：停止心跳，可选择保持连接或标记 suspended。
- `App.onShow` 或页面 `onShow`：检查连接状态，必要时重连并拉一次 snapshot。

心跳示例：

```js
startHeartbeat() {
  this.stopHeartbeat();
  this.heartbeatTimer = setInterval(() => {
    if (this.socketOpen) {
      this.send({ type: 'PING', ts: Date.now() });
    }
  }, 25000);
}
```

## 任务三：HTTP snapshot 兜底

新增 `loadRoomSnapshot(roomId)`，聚合：

- roomInfo
- members
- ranking
- latestRecords
- onlineUserIds
- insightLite 可选

如果后端暂时没有聚合接口，前端可以并发请求，但要统一入口。

要求：

- 页面进入只调用一次 snapshot。
- WebSocket 重连成功后只调用一次 snapshot。
- 触发 TRANSFER 后不立即 snapshot；延迟校准即可。

示例：

```js
scheduleSnapshotRefresh({ reason, delay = 1500 }) {
  if (this._snapshotTimer) clearTimeout(this._snapshotTimer);
  this._snapshotTimer = setTimeout(() => {
    this.loadRoomSnapshot({ reason });
  }, delay);
}
```

## 任务四：页面订阅 store

`room.js` 不再到处 `buildMemberGrid()`，改为订阅 store：

```js
onLoad(options) {
  this.roomStore = createRoomStore();
  this.unsubscribeRoomStore = this.roomStore.subscribe((vm) => {
    this.scheduleRoomPatch(vm);
  });
}

onUnload() {
  if (this.unsubscribeRoomStore) this.unsubscribeRoomStore();
  this.clearRoomTimers();
  scoreWs.disconnect('page unload');
}
```

## 任务五：清理异步写入

所有异步回调写 setData 前必须检查：

```js
if (this._destroyed) return;
```

在 `onUnload`：

```js
this._destroyed = true;
this.clearRoomTimers();
```

## 输出格式

```md
# Phase 4 状态与 WebSocket 治理完成报告

## 新状态模型

## WebSocket 生命周期变化

## HTTP snapshot 调用点

## 被删除的重复刷新逻辑

## 弱网/前后台测试结果

## 风险与回滚
```

## 验收标准

- 弱网断开后能自动恢复。
- 前后台切换后不会出现重复连接或重复消息监听。
- WebSocket 连续 TRANSFER 不触发请求风暴。
- 页面卸载后无异步 setData 报错。
- room 页数据不闪烁、不回跳。
