# 可复用补丁片段

本文件提供可复制到项目中的代码片段。请根据实际文件名、字段名和接口返回结构调整，不要机械粘贴。

## 1. requestId 生成

```js
function createRequestId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
```

## 2. request 去重骨架

```js
const inflight = new Map();

function buildRequestKey(options) {
  const method = (options.method || 'GET').toUpperCase();
  const data = options.data ? JSON.stringify(options.data) : '';
  return `${method}:${options.url}:${data}`;
}

function request(options) {
  const key = buildRequestKey(options);
  if (options.dedupe !== false && inflight.has(key)) {
    return inflight.get(key).promise;
  }

  const requestId = createRequestId();
  const start = Date.now();
  let task;

  const promise = new Promise((resolve, reject) => {
    task = wx.request({
      url: normalizeUrl(options.url),
      method: options.method || 'GET',
      data: options.data || {},
      timeout: options.timeout || 10000,
      header: {
        ...(options.header || {}),
        'X-Request-Id': requestId,
        Authorization: getToken() ? `Bearer ${getToken()}` : ''
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject({ type: 'HTTP_ERROR', statusCode: res.statusCode, data: res.data });
        }
      },
      fail(err) {
        reject({ type: 'NETWORK_ERROR', raw: err });
      },
      complete() {
        inflight.delete(key);
        console.log('[request]', {
          requestId,
          url: options.url,
          method: options.method || 'GET',
          duration: Date.now() - start
        });
      }
    });
  });

  inflight.set(key, { promise, task });
  return promise;
}
```

## 3. room patch 合批

```js
scheduleRoomPatch(patch, options = {}) {
  this._pendingRoomPatch = {
    ...(this._pendingRoomPatch || {}),
    ...patch
  };

  if (options.immediate) {
    this.flushRoomPatch();
    return;
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

  if (!patch || Object.keys(patch).length === 0 || this._destroyed) return;
  this.setData(patch);
}
```

## 4. 脉冲飞线 CSS 动画

```css
.pulse-flight-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 60;
}

.pulse-flight-dot {
  position: absolute;
  opacity: 0;
  transform: translate3d(0, 0, 0) scale(.96);
  will-change: transform, opacity;
}

.pulse-flight-dot.is-playing {
  animation: pulseFlightMove 680ms cubic-bezier(.18,.82,.22,1) forwards;
}

@keyframes pulseFlightMove {
  0% { opacity: 0; transform: translate3d(0, 0, 0) scale(.88); }
  12% { opacity: 1; }
  70% { opacity: 1; }
  100% { opacity: 0; transform: translate3d(var(--dx), var(--dy), 0) scale(1.08); }
}
```

## 5. relationMap 预聚合

```js
function buildRelationMap(records = []) {
  const map = {};
  for (const record of records) {
    const from = String(record.fromUserId || record.fromId || '');
    const to = String(record.toUserId || record.toId || '');
    const amount = Number(record.amount || record.score || 0);
    if (!from || !to) continue;
    const key = `${from}->${to}`;
    map[key] = (map[key] || 0) + amount;
  }
  return map;
}
```

## 6. WebSocket 心跳骨架

```js
const reconnectDelays = [500, 1000, 2000, 4000, 8000];

class ScoreWsClient {
  constructor() {
    this.socketTask = null;
    this.connected = false;
    this.reconnectIndex = 0;
    this.heartbeatTimer = null;
    this.listeners = [];
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.connected) {
        this.send({ type: 'PING', ts: Date.now() });
      }
    }, 25000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  scheduleReconnect() {
    const delay = reconnectDelays[Math.min(this.reconnectIndex, reconnectDelays.length - 1)];
    this.reconnectIndex += 1;
    setTimeout(() => this.connect(this.lastOptions), delay);
  }
}
```

## 7. 后端房间鉴权 Guard

```java
@Component
public class RoomAccessGuard {
    private final RoomMemberMapper roomMemberMapper;

    public RoomAccessGuard(RoomMemberMapper roomMemberMapper) {
        this.roomMemberMapper = roomMemberMapper;
    }

    public void assertRoomMember(Long roomId, Long userId) {
        if (roomId == null || userId == null) {
            throw new BizException(403, "无权访问该编队");
        }
        boolean exists = roomMemberMapper.existsActiveMember(roomId, userId);
        if (!exists) {
            throw new BizException(403, "无权访问该编队");
        }
    }
}
```

## 8. WebSocket room 鉴权

```java
@Override
public void afterConnectionEstablished(WebSocketSession session) throws Exception {
    Long userId = resolveUserId(session);
    Long roomId = resolveRoomId(session);

    if (userId == null || roomId == null) {
        session.close(CloseStatus.NOT_ACCEPTABLE.withReason("invalid auth context"));
        return;
    }

    if (!roomService.isActiveRoomMember(roomId, userId)) {
        session.close(CloseStatus.POLICY_VIOLATION.withReason("not room member"));
        return;
    }

    bindSession(roomId, userId, session);
}
```

## 9. 音频管理器

```js
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = wx.createInnerAudioContext();
    audioCtx.obeyMuteSwitch = false;
  }
  return audioCtx;
}

function playPreview(src) {
  const ctx = getAudioCtx();
  ctx.stop();
  ctx.src = src;
  ctx.play();
}

function stopPreview() {
  if (audioCtx) audioCtx.stop();
}

module.exports = {
  getAudioCtx,
  playPreview,
  stopPreview
};
```

## 10. 页面卸载防异步 setData

```js
onLoad() {
  this._destroyed = false;
},

safeSetData(patch, cb) {
  if (this._destroyed) return;
  this.setData(patch, cb);
},

onUnload() {
  this._destroyed = true;
  this.clearTimers && this.clearTimers();
}
```
