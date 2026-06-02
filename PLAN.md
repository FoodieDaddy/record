# PLAN.md — WebSocket 全局单例重构

## 问题根因

1. **回调泄漏**：`room.js` 注册时用 `this.onWsUpdate.bind(this)` 生成新函数引用，但 `offScoreUpdate(this.onWsUpdate)` 传的是原方法，`filter(fn !== callback)` 永远匹配不上 → 回调堆积
2. **连接泄漏**：`connectWS` 先调 `disconnectWS` → `ws.disconnect()` 销毁单例连接，随后 `connect()` 重建。频繁进入房间或热重载时，旧 socketTask 未完全释放就被新连接覆盖，撑爆微信 5 个 WebSocket 上限
3. **生命周期耦合**：页面 `onUnload` 直接断开全局单例连接，其他页面无法复用

## STEP 1：重写 score-ws.js — 全局单例 + 事件总线

### 设计要点

- **全局唯一实例**：模块顶层 `new ScoreWS()` 直接导出，不再用懒加载函数
- **状态锁**：`isConnected` + `isConnecting` 双状态，拦截并发 `connect()`
- **防御性关闭**：`connect()` 开头 `if (this.socketTask) this.socketTask.close()` 杀僵尸
- **事件总线**：内部 `Map<string, Set<Function>>` 按事件名注册/注销，支持多页面独立监听
- **自动重连**：`onClose`/`onError` 触发 3 秒延迟 `reconnect()`，`manualClose` 标记阻止手动断开后的重连
- **页面只订阅不控制连接**：页面调 `on('message', cb)` / `off('message', cb)`，不调 `connect()`/`disconnect()`

### 事件类型

| 事件名 | 触发时机 | 数据 |
|--------|----------|------|
| `message` | 收到任何 WebSocket 消息 | 解析后的 JSON 对象 |
| `open` | 连接建立 | 无 |
| `close` | 连接断开 | 无 |

### 导出 API

```js
const scoreWS = require('../../utils/score-ws');

// 连接（由 app.js 登录后调用）
scoreWS.connect(roomId);

// 断开（由 app.js 退出登录调用）
scoreWS.disconnect();

// 页面订阅
scoreWS.on('message', callback);
scoreWS.off('message', callback);

// 切换房间
scoreWS.switchRoom(newRoomId);
```

---

## STEP 2：app.js 挂载连接 + room.js 解耦

### app.js 改动

- `setLoginInfo` 成功后不立即连接（无 roomId）
- 新增 `connectWS(roomId)` / `disconnectWS()` 方法，供 room 页面调用
- `logout()` 时断开 WebSocket

### room.js 改动

- **移除** `connectWS()` / `disconnectWS()` 中对 `ws.connect()` / `ws.disconnect()` 的调用
- **改为**：`onShow` 时 `scoreWS.on('message', this._onWsMessage)`，`onUnload` 时 `scoreWS.off('message', this._onWsMessage)`
- **保存回调引用**：`this._onWsMessage = this.onWsMessage.bind(this)` 在 Page 外或 onLoad 中一次性创建，确保 on/off 用同一个引用
- 连接建立由 app 层或首次进入房间时触发

### 修改文件清单

| 文件 | 改动 |
|------|------|
| `utils/score-ws.js` | 完全重写：全局单例 + Map 事件总线 + 状态锁 + 防御性关闭 + 自动重连 |
| `pages/room/room.js` | 移除 connectWS/disconnectWS 中的连接控制；改为 on/off 订阅模式；修复回调引用 bug |
| `app.js` | 新增 connectWS/disconnectWS 方法；logout 时断开连接 |

---

**✅ STEP 1 + STEP 2 已完成。**

---

# 记分情绪驱动语音播报（已完成）

## STEP 1：后端情绪池结构与 DTO 改造

### 设计思路

记分提交后，根据提交者本人的分数变动（正/负），从预置音频池中随机抽取一条情绪音频 URL，放入 HTTP 响应返回给前端播放。其他玩家通过 WebSocket 推送接收各自的情绪音频。

### 新增文件

| 文件 | 说明 |
|------|------|
| `common/EmotionType.java` | 情绪枚举：`WIN`（赢分装逼）、`LOSE`（输分悲伤） |
| `service/EmotionAudioPool.java` | 音频池接口：按情绪类型随机获取音频 URL |
| `service/impl/EmotionAudioPoolImpl.java` | 实现：从 `application.yml` 配置加载音频 URL 列表，内存随机抽取 |
| `dto/score/ScoreSubmitResp.java` | 记分提交响应 DTO，包含 `emotionAudioUrl` 字段 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `controller/ScoreController.java` | `submitScore` 返回值从 `Result<Void>` 改为 `Result<ScoreSubmitResp>` |
| `service/ScoreService.java` | `submitScore` 返回值从 `void` 改为 `ScoreSubmitResp` |
| `service/impl/ScoreServiceImpl.java` | 注入 `EmotionAudioPool`，记分后为提交者计算情绪并抽音频；WebSocket 推送中增加每个玩家的 `emotionAudioUrl` |
| `application.yml` | 新增 `emotion.audio.win-urls` 和 `emotion.audio.lose-urls` 配置项 |

### 关键设计决策

1. **音频池存储**：用内存 List（从 yml 配置加载），不走 Redis。原因：音频 URL 是静态预置数据，无并发写入，内存随机 O(1) 最轻量。
2. **提交者情绪计算**：在 `submitScore` 方法中，从 `req.getScores()` 里找到提交者自己的 `scoreChange`，正→WIN、负→LOSE、零→不返回音频。
3. **WebSocket 推送扩展**：在现有 `SCORE_UPDATE` 推送的 Map 中，为每个玩家增加 `emotionAudioUrl` 字段，前端按自己的 userId 匹配取用。

### DTO 结构

```java
// EmotionType.java
public enum EmotionType {
    WIN,   // 赢分 → 装逼/炫耀
    LOSE   // 输分 → 悲伤/卖惨
}

// ScoreSubmitResp.java
@Data @Builder
@Schema(description = "记分提交响应")
public class ScoreSubmitResp {
    @Schema(description = "提交者的情绪音频 URL（null 表示无分数变动或音效已关闭）")
    private String emotionAudioUrl;
}
```

### application.yml 配置结构

```yaml
emotion:
  audio:
    win-urls:
      - https://minio-host/bucket/emotion/win_01.mp3
      - https://minio-host/bucket/emotion/win_02.mp3
    lose-urls:
      - https://minio-host/bucket/emotion/lose_01.mp3
      - https://minio-host/bucket/emotion/lose_02.mp3
```

---

## STEP 2：后端业务逻辑实现 ✅

已在 STEP 1 中一并完成：
- `EmotionAudioPoolImpl` — 从 yml 加载 URL 列表，`ThreadLocalRandom` 随机抽取
- `ScoreServiceImpl.submitScore` — 提交者 scoreChange > 0 → WIN 池、< 0 → LOSE 池、= 0 → null
- WebSocket `SCORE_UPDATE` 推送扩展：每项 scores 增加 `emotionAudioUrl`

---

## STEP 3：前端播放管理器与极简 UI ✅

### 新增文件

| 文件 | 说明 |
|------|------|
| `miniprogram/utils/audio-manager.js` | 单例音频管理器：防重叠播放、实例复用/释放 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `miniprogram/pages/room/room.js` | 记分成功后从响应取 `emotionAudioUrl` 播放；WebSocket 收到 `SCORE_UPDATE` 时按 userId 匹配播放；新增 `toggleAudioSwitch` 方法 |
| `miniprogram/pages/room/room.wxml` | 记分表单卡片角落增加音效开关 Toggle |
| `miniprogram/pages/room/room.wxss` | 音效开关样式（毛玻璃质感） |
| `miniprogram/app.js` | globalData 新增 `audioEnabled: true` 全局状态 |

### AudioPlayerManager 核心设计

```
策略：打断并播放最新音频（推荐）
理由：
1. 线下场景中，最新记分的情绪反应最重要——旧的已被新的覆盖
2. "丢弃新音频"会导致用户刚扣完分却听不到反馈，体验断裂
3. 快速连续记分时，只保留最后一个情绪反应，避免积压

流程：
play(url) →
  if 当前有音频在播 → stop() + destroy()
  创建新 InnerAudioContext → src = url → play()
  onEnded → destroy() + 清空引用
  onError → destroy() + 清空引用
```

### 音效开关 Toggle 设计

- 位置：记分表单卡片标题行右侧
- 状态：`app.globalData.audioEnabled`（默认 true）
- 样式：毛玻璃圆形按钮，开=蓝色音波图标，关=灰色静音图标
- 点击切换 + `wx.vibrateShort` 触感反馈

---

**请确认 STEP 3 设计，确认后输出完整前端代码。**
