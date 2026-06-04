# 二维码系统重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复二维码空白问题，改为异步生成 + 前端缓存 + OSS 清理

**Architecture:** 后端 `createRoom` 用虚拟线程池异步调用微信 API 生成小程序码，存入 Redis；前端打开分享面板时从缓存读取，未命中则指数退避重试 3 次；房间解散时清理 OSS 和 Redis。

**Tech Stack:** Spring Boot 虚拟线程池 (`CompletableFuture.runAsync`)、Redis、阿里云 OSS、微信小程序 Storage

---

### Task 1: 后端 — getRoomDetail/getMyRooms/getHistory 从 Redis 读取 QR URL

**Files:**
- Modify: `backend/src/main/java/com/smartrecord/service/impl/RoomServiceImpl.java`

- [ ] **Step 1: 添加私有方法 `getQrCodeUrlFromRedis`**

在 `RoomServiceImpl.java` 的 `generateQrCode` 方法前添加：

```java
private String getQrCodeUrlFromRedis(String roomNo) {
    return redisTemplate.opsForValue().get("sr:room:" + roomNo + ":qr");
}
```

- [ ] **Step 2: 修改 `getRoomDetail` 方法**

将第 255-256 行：
```java
// 构建二维码 URL（OSS 中的固定路径）
String qrCodeUrl = "https://" + ossConfig.getBucketName() + "." + ossConfig.getEndpoint() + "/qrcode/" + room.getRoomNo() + ".png";
```

改为：
```java
String qrCodeUrl = getQrCodeUrlFromRedis(room.getRoomNo());
```

- [ ] **Step 3: 修改 `getMyRooms` 方法**

将第 305 行：
```java
String qrCodeUrl = "https://" + ossConfig.getBucketName() + "." + ossConfig.getEndpoint() + "/qrcode/" + room.getRoomNo() + ".png";
```

改为：
```java
String qrCodeUrl = getQrCodeUrlFromRedis(room.getRoomNo());
```

- [ ] **Step 4: 修改 `getHistory` 方法**

将第 338 行：
```java
String qrCodeUrl = "https://" + ossConfig.getBucketName() + "." + ossConfig.getEndpoint() + "/qrcode/" + room.getRoomNo() + ".png";
```

改为：
```java
String qrCodeUrl = getQrCodeUrlFromRedis(room.getRoomNo());
```

- [ ] **Step 5: 验证编译通过**

```bash
cd /Users/happy/Documents/record/backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q
```

- [ ] **Step 6: 提交**

```bash
git add backend/src/main/java/com/smartrecord/service/impl/RoomServiceImpl.java
git commit -m "refactor: QR URL 改为从 Redis 读取，移除硬编码构造"
```

---

### Task 2: 后端 — createRoom 异步生成二维码

**Files:**
- Modify: `backend/src/main/java/com/smartrecord/service/impl/RoomServiceImpl.java`

- [ ] **Step 1: 修改 `createRoom` 方法**

将第 110-113 行：
```java
// 5. 生成专属小程序码
String qrCodeUrl = generateQrCode(roomNo);

return buildRoomResp(room, Collections.singletonList(member), qrCodeUrl);
```

改为：
```java
// 5. 异步生成专属小程序码
generateQrCodeAsync(roomNo);

return buildRoomResp(room, Collections.singletonList(member), null);
```

- [ ] **Step 2: 添加 `generateQrCodeAsync` 方法**

在 `generateQrCode` 方法前添加：

```java
private void generateQrCodeAsync(String roomNo) {
    CompletableFuture.runAsync(() -> {
        try {
            String url = generateQrCode(roomNo);
            if (url != null) {
                redisTemplate.opsForValue().set("sr:room:" + roomNo + ":qr", url, ROOM_EXPIRE_HOURS, TimeUnit.HOURS);
                log.info("异步生成二维码成功: roomNo={}", roomNo);
            } else {
                log.warn("异步生成二维码失败: roomNo={}", roomNo);
            }
        } catch (Exception e) {
            log.error("异步生成二维码异常: roomNo={}", roomNo, e);
        }
    }, asyncExecutor);
}
```

- [ ] **Step 3: 验证编译通过**

```bash
cd /Users/happy/Documents/record/backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q
```

- [ ] **Step 4: 提交**

```bash
git add backend/src/main/java/com/smartrecord/service/impl/RoomServiceImpl.java
git commit -m "feat: createRoom 二维码改为异步生成，使用虚拟线程池"
```

---

### Task 3: 后端 — dissolveRoom 清理 OSS 和 Redis

**Files:**
- Modify: `backend/src/main/java/com/smartrecord/service/impl/RoomServiceImpl.java`

- [ ] **Step 1: 修改 `dissolveRoom` 方法**

在第 400 行 `redisTemplate.delete("sr:room_no:" + room.getRoomNo());` 之后添加：

```java
// 清理二维码
storageService.deleteObjectAsync("qrcode/" + room.getRoomNo() + ".png");
redisTemplate.delete("sr:room:" + room.getRoomNo() + ":qr");
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /Users/happy/Documents/record/backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q
```

- [ ] **Step 3: 提交**

```bash
git add backend/src/main/java/com/smartrecord/service/impl/RoomServiceImpl.java
git commit -m "feat: dissolveRoom 清理 OSS 二维码文件和 Redis 缓存"
```

---

### Task 4: 前端 — 新增 retryWithBackoff 工具函数

**Files:**
- Create: `miniprogram/utils/retry.js`

- [ ] **Step 1: 创建 `retry.js`**

```javascript
/**
 * 指数退避重试
 * @param {Function} fn - 异步函数，返回 truthy 值时停止重试
 * @param {number} retries - 最大重试次数
 * @param {number} baseDelay - 基础延迟（毫秒）
 * @returns {Promise<*>} fn 的返回值，或 null（全部失败）
 */
function retryWithBackoff(fn, retries = 3, baseDelay = 1000) {
  return new Promise((resolve) => {
    let attempt = 0;

    function tryFn() {
      fn().then((result) => {
        if (result) {
          resolve(result);
        } else if (attempt < retries) {
          const delay = baseDelay * Math.pow(2, attempt);
          attempt++;
          setTimeout(tryFn, delay);
        } else {
          resolve(null);
        }
      }).catch(() => {
        if (attempt < retries) {
          const delay = baseDelay * Math.pow(2, attempt);
          attempt++;
          setTimeout(tryFn, delay);
        } else {
          resolve(null);
        }
      });
    }

    tryFn();
  });
}

module.exports = { retryWithBackoff };
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/utils/retry.js
git commit -m "feat: 新增 retryWithBackoff 指数退避重试工具函数"
```

---

### Task 5: 前端 — 分享面板集成缓存 + 重试逻辑

**Files:**
- Modify: `miniprogram/pages/room/room.js`

- [ ] **Step 1: 引入 retryWithBackoff**

在文件顶部 require 区域添加：

```javascript
const { retryWithBackoff } = require('../../utils/retry');
```

- [ ] **Step 2: 添加 `getQrCodeUrl` 方法**

在 `openShareSheet` 方法前添加：

```javascript
async getQrCodeUrl(roomNo, roomId) {
  const cacheKey = `qr:${roomNo}`;
  const cached = wx.getStorageSync(cacheKey);
  if (cached && Date.now() - cached.ts < 3600000) {
    return cached.url;
  }

  const fetchUrl = async () => {
    const resp = await get(`/room/${roomId}`);
    return resp?.data?.qrCodeUrl || null;
  };

  const url = await retryWithBackoff(fetchUrl, 3, 1000);
  if (url) {
    wx.setStorageSync(cacheKey, { url, ts: Date.now() });
  }
  return url;
},
```

- [ ] **Step 3: 修改 `openShareSheet` 方法**

将：
```javascript
openShareSheet() {
  this.setData({ showShareSheet: true });
},
```

改为：
```javascript
async openShareSheet() {
  const roomNo = this.data.currentRoom?.roomNo;
  const roomId = this.data.currentRoom?.roomId;
  if (!roomNo || !roomId) return;

  this.setData({ showShareSheet: true });

  // 已有二维码则跳过
  if (this.data.currentRoom.qrCodeUrl) return;

  const url = await this.getQrCodeUrl(roomNo, roomId);
  if (url) {
    this.setData({ 'currentRoom.qrCodeUrl': url });
  }
},
```

- [ ] **Step 4: 验证微信开发者工具中分享面板功能**

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/room/room.js
git commit -m "feat: 分享面板集成 QR 缓存 + 指数退避重试"
```
