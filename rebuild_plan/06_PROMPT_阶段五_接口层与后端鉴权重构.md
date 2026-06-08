# Phase 5 Prompt：接口层与后端鉴权重构

## 角色

你是小程序后端与前端接口层治理工程师。请统一前端 request/service 层，并补齐后端房间权限、安全边界和接口可观测性。

## 阶段目标

1. 前端 `utils/request.js` 支持去重、取消、超时、错误分类、traceId。
2. 建立 `services/` 目录，避免页面直接拼接口。
3. 后端统一 `assertRoomMember`。
4. WebSocket 来源白名单和 room 鉴权完善。
5. 所有关键响应包含 requestId/serverTime/durationMs 或可在日志追踪。

## 前端重点文件

- `miniprogram/utils/request.js`
- `miniprogram/services/room-service.js`
- `miniprogram/services/score-service.js`
- `miniprogram/services/profile-service.js`
- `miniprogram/services/storage-service.js`
- 所有直接调用 `request({ url: ... })` 的页面

## 后端重点文件

- `ScoreController.java`
- `RoomController.java`
- `StorageController.java`
- `ScoreServiceImpl.java`
- `RoomServiceImpl.java`
- `WebSocketConfig.java`
- `ScoreWebSocket.java`
- JWT 拦截器 / Filter
- 全局异常处理器

## 任务一：前端 request 去重与 abort

实现：

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
      header: buildHeaders(options.header, requestId),
      success(res) {
        handleResponse(res, resolve, reject);
      },
      fail(err) {
        reject(normalizeError(err));
      },
      complete() {
        inflight.delete(key);
        reportRequestPerf({
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

request.abort = function(key) {
  const item = inflight.get(key);
  if (item && item.task) item.task.abort();
  inflight.delete(key);
};
```

## 任务二：建立 service 层

页面不直接拼 URL。改成：

```js
// services/score-service.js
const request = require('../utils/request');

function getRoomRanking(roomId) {
  return request({
    url: `/score/room/${roomId}/ranking`,
    method: 'GET',
    dedupe: true
  });
}

function getRoomSnapshot(roomId) {
  return request({
    url: `/room/${roomId}/snapshot`,
    method: 'GET',
    dedupe: true
  });
}

module.exports = {
  getRoomRanking,
  getRoomSnapshot
};
```

要求：

- `room.js` 只能调用 service，不直接写 URL。
- service 层负责接口路径和参数。
- request 层负责 token、错误、trace、去重。
- 页面层只负责业务动作和视图状态。

## 任务三：后端统一 RoomAccessGuard

新增或整理：

```java
@Component
public class RoomAccessGuard {
    private final RoomMemberMapper roomMemberMapper;

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

所有房间读写接口在 service 入口调用。

## 任务四：后端响应追踪

新增 Filter：

```java
String requestId = Optional.ofNullable(request.getHeader("X-Request-Id"))
    .orElse(UUID.randomUUID().toString());
MDC.put("requestId", requestId);
response.setHeader("X-Request-Id", requestId);
```

统一日志输出：

- requestId
- userId
- path
- method
- durationMs
- status
- errorCode

## 任务五：CORS / WebSocket origin 收紧

将：

```java
setAllowedOrigins("*")
```

改为配置化白名单：

```yaml
security:
  allowed-origins:
    - https://your-prod-domain.com
    - https://servicewechat.com
```

注意：微信小程序 WebSocket origin 行为需实际测试。不要盲目上线，必须灰度验证。

## 任务六：修复 N+1 风格查询

检查 `getMyRooms` 是否循环调用 `getRoomDetail`。

改为：

- 批量查询 roomIds。
- 批量查询 room members。
- 批量查询最后活跃/统计信息。
- 在内存中组装 DTO。

## 输出格式

```md
# Phase 5 接口层与后端鉴权完成报告

## 前端 request 层变化

## service 层拆分结果

## 后端鉴权覆盖接口

## requestId / duration 日志说明

## N+1 修复结果

## 安全测试结果

## 风险与回滚
```

## 验收标准

- 页面不再直接散落大量 URL 字符串。
- 相同 GET 请求在进行中可复用，不重复打后端。
- 可取消页面卸载后的无意义请求。
- 非成员无法读任何 room 数据。
- 后端日志可通过 requestId 关联前端请求。
- `getMyRooms` 不再按房间数量线性触发大量详情查询。
