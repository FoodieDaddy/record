# Phase 1 Prompt：基线审计与安全止血

## 角色

你是微信小程序 + Spring Boot 项目的高级全栈工程师。请先做“止血级修复”，不要进行大规模视觉重写。你的目标是消除最危险的安全问题，并建立后续性能优化的基线。

## 输入上下文

项目包含微信小程序前端和 Spring Boot 后端。重点关注：

前端：

- `miniprogram/pages/room/room.js`
- `miniprogram/pages/room/room.wxml`
- `miniprogram/pages/room/room.wxss`
- `miniprogram/pages/profile/profile.js`
- `miniprogram/utils/request.js`
- `miniprogram/utils/score-ws.js`
- `miniprogram/app.json`
- `miniprogram/project.config.json`
- `miniprogram/config.js`

后端：

- `backend/src/main/java/**/config/WebSocketConfig.java`
- `backend/src/main/java/**/websocket/ScoreWebSocket.java` 或相近命名文件
- `backend/src/main/java/**/controller/ScoreController.java`
- `backend/src/main/java/**/controller/RoomController.java`
- `backend/src/main/java/**/controller/StorageController.java`
- `backend/src/main/java/**/service/**/ScoreService*.java`
- `backend/src/main/java/**/service/**/RoomService*.java`
- `backend/src/main/resources/application-*.yml`
- `deploy.sh`

## 阶段目标

1. 建立当前性能与安全基线。
2. 移除仓库中的敏感配置和硬编码环境信息。
3. 补齐后端房间读接口与 WebSocket 的成员鉴权。
4. 为后续阶段加入最小可用的 trace/duration 埋点。
5. 产出明确的风险清单和下一阶段改动点。

## 必须执行的审计命令

请在项目根目录执行并记录结果：

```bash
# 统计 setData、定时器、动画、fixed 层、blur/filter 等高风险项
grep -R "setData" -n miniprogram/pages miniprogram/components | wc -l
grep -R "setTimeout\|setInterval" -n miniprogram/pages miniprogram/components | wc -l
grep -R "animation:" -n miniprogram/pages miniprogram/components | wc -l
grep -R "@keyframes" -n miniprogram/pages miniprogram/components | wc -l
grep -R "backdrop-filter\|filter:" -n miniprogram/pages miniprogram/components | wc -l
grep -R "position: fixed" -n miniprogram/pages miniprogram/components | wc -l

# 搜索潜在敏感信息
grep -R "secret\|accessKey\|access-key\|password\|passwd\|token\|private\|AKIA\|oss\|appid\|appsecret" -n . --exclude-dir=node_modules --exclude-dir=.git

# 搜索后端房间接口
grep -R "roomId" -n backend/src/main/java | head -200
```

## 代码修改要求

### 1. 敏感配置治理

请完成：

- 从仓库移除所有真实密钥、服务器 IP、SSH 私钥路径、OSS/LLM/微信平台密钥。
- 新增 `.env.example`，只保留变量名和示例占位。
- 修改 `application-local.yml` / `application-prod.yml`，改为环境变量读取。
- 修改前端 `config.js`，禁止通过手改源码切换环境，改为构建时或本地配置覆盖。
- 更新 `.gitignore`，忽略 `.env`、本地私钥、本地部署配置。

示例：

```yaml
oss:
  endpoint: ${OSS_ENDPOINT:}
  access-key-id: ${OSS_ACCESS_KEY_ID:}
  access-key-secret: ${OSS_ACCESS_KEY_SECRET:}

wechat:
  appid: ${WECHAT_APPID:}
  secret: ${WECHAT_SECRET:}
```

### 2. WebSocket 成员鉴权

在 WebSocket 握手成功前完成：

- 从 token 中解析 `userId`。
- 从 path/query 中解析 `roomId`。
- 调用 `roomService.isActiveRoomMember(roomId, userId)` 或等价方法。
- 非成员直接 close，不允许加入连接池。

示例：

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

### 3. 房间读接口统一鉴权

所有读取房间数据的接口必须携带当前用户 ID 并进行成员校验。

必须覆盖：

- `/score/room/{roomId}/ranking`
- `/score/room/{roomId}/chart`
- `/score/room/{roomId}/network`
- `/score/room/{roomId}/insight`
- `/score/transfer/room/{roomId}`
- `/room/{roomId}`

Controller 示例：

```java
@GetMapping("/room/{roomId}/ranking")
public Result<?> ranking(HttpServletRequest request, @PathVariable Long roomId) {
    Long userId = (Long) request.getAttribute("currentUserId");
    return Result.ok(scoreService.getRanking(userId, roomId));
}
```

Service 示例：

```java
private void assertRoomMember(Long roomId, Long userId) {
    if (roomId == null || userId == null || !roomService.isActiveRoomMember(roomId, userId)) {
        throw new BizException(403, "无权访问该编队");
    }
}
```

### 4. `/storage/presign` 鉴权

要求：

- `/storage/presign` 不允许匿名访问。
- 限制文件类型：只允许图片、音频或当前业务明确需要的类型。
- 限制 objectKey 前缀：如 `avatar/{userId}/`、`poster/{userId}/`。
- 限制 size。
- 返回值中加入 `expireAt`。

### 5. 前端最小性能埋点

在 `utils/request.js` 增加：

- requestId
- startTime / duration
- url / method
- success / fail
- errorCode

最小实现：

```js
function createRequestId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
```

请求结束时输出：

```js
console.log('[request:done]', {
  requestId,
  method,
  url,
  duration: Date.now() - start,
  statusCode: res.statusCode
});
```

## 输出格式要求

完成后必须输出：

```md
# Phase 1 完成报告

## 修改文件列表

| 文件 | 修改内容 | 风险 |
|---|---|---|

## 安全问题修复结果

- [ ] WebSocket 成员鉴权
- [ ] 房间读接口成员鉴权
- [ ] `/storage/presign` 鉴权
- [ ] 敏感配置移除

## 性能基线

| 指标 | 当前值 | 说明 |
|---|---:|---|

## 手动测试结果

## 风险与回滚方案
```

## 验收标准

- 非成员用户无法建立指定 roomId 的 WebSocket 连接。
- 非成员用户无法读取指定房间 ranking/chart/network/insight/transfer 数据。
- 未登录请求 `/storage/presign` 失败。
- 仓库不再包含真实密钥或本地部署路径。
- 前端请求日志能输出 requestId 和 duration。
