# 二维码系统重构设计

## 问题

当前二维码显示为空白图片。根因：
- `generateQrCode()` 可能失败返回 `null`，但 `getRoomDetail`/`getMyRooms`/`getHistory` 总是硬编码构造 OSS URL
- 前端拿到不存在的 OSS URL，加载失败显示空白
- 房间解散不清理 OSS 二维码文件
- 前端无缓存，每次从 OSS 请求

## 方案：异步生成 + 前端缓存 + OSS 清理

### 后端

#### 新增 Redis key

`sr:room:{roomNo}:qr` → 存储完整 OSS URL（String），TTL 24 小时

#### createRoom 改动

- 移除同步调用 `generateQrCode(roomNo)`
- 返回 `qrCodeUrl: null`
- 异步调用生成：

```java
CompletableFuture.runAsync(() -> {
    String url = generateQrCode(roomNo);
    if (url != null) {
        redisTemplate.opsForValue().set("sr:room:" + roomNo + ":qr", url, 24, TimeUnit.HOURS);
    }
}, asyncExecutor);
```

复用已有 `AsyncConfig` 的虚拟线程池 `asyncExecutor`。

#### getRoomDetail / getMyRooms / getHistory 改动

- 移除硬编码 URL 构造
- 改为从 Redis `sr:room:{roomNo}:qr` 读取
- 无值则 `qrCodeUrl = null`

#### dissolveRoom 改动

新增清理：
- `storageService.deleteObjectAsync("qrcode/" + roomNo + ".png")`
- `redisTemplate.delete("sr:room:" + roomNo + ":qr")`

### 前端

#### 新增工具函数

**`retryWithBackoff(fn, retries, baseDelay)`**
- 通用指数退避重试
- 参数：重试次数 3、基础延迟 1000ms
- 退避序列：1s → 2s → 4s

**`getQrCodeUrl(roomNo)`**
1. 查 Storage 缓存 `qr:{roomNo}` → 命中且未过期（1小时） → 返回
2. 调 getRoomDetail API → 有 qrCodeUrl → 缓存 + 返回
3. 无值 → retryWithBackoff(3次) → 仍无 → 返回 null

#### 分享面板 openShareSheet 改动

- 调用 `getQrCodeUrl(roomNo)`
- 有值 → `setData({ qrCodeUrl })`
- null → `setData({ qrCodeUrl: '' })`，显示房间号占位

#### 占位 UI

已有实现，`qrCodeUrl` 为空时显示房间号大字 + "房间号 XXXX" 文字。

### 数据流

```
createRoom → 返回 room (qrCodeUrl=null)
          → CompletableFuture.runAsync: getunlimited → OSS → Redis

前端打开分享面板 → 查 Storage 缓存
  → 命中 → 显示
  → 未命中 → getRoomDetail → 查 Redis
    → 有值 → 显示 + 缓存
    → null → retry(1s) → retry(2s) → retry(4s)
      → 仍 null → 显示房间号占位

dissolveRoom → 删除 OSS 文件 + Redis key
```

### 涉及文件

**后端：**
- `RoomServiceImpl.java` — createRoom、getRoomDetail、getMyRooms、getHistory、dissolveRoom
- `StorageService.java` / `StorageServiceImpl.java` — 复用 deleteObjectAsync

**前端：**
- `miniprogram/utils/retry.js` — 新增 retryWithBackoff 工具函数
- `miniprogram/pages/room/room.js` — openShareSheet、getQrCodeUrl、缓存逻辑
