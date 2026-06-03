# 播报音色选择器重构 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Profile 页的"男声/女声"胶囊切换器重构为底部毛玻璃抽屉，支持 6 分类 105 种音色的左右联动选择和试听。

**Architecture:** 前端从 `/api/voice/catalog` 加载音色分类数据，选中后存储 `voiceId`/`voiceName`/`voice` 到 Storage；后端新增 `/api/voice/preview` 端点返回预录制试听音频；`voice.js` 的 TTS 请求拼入 `&voice=` 参数。

**Tech Stack:** 微信小程序原生 (WXML/WXSS/JS)、Spring Boot、edge-tts

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `backend/.../controller/VoiceController.java` | 修改 | 新增 `/preview` 端点 |
| `miniprogram/pages/profile/profile.wxml` | 修改 | 入口列表项 + 底部抽屉结构 |
| `miniprogram/pages/profile/profile.wxss` | 修改 | 抽屉样式、左右联动布局、声浪动画 |
| `miniprogram/pages/profile/profile.js` | 修改 | catalog 加载、抽屉开闭、试听逻辑 |
| `miniprogram/utils/voice.js` | 修改 | 适配新存储字段、TTS 拼入 voice 参数 |

---

### Task 1: 后端 — 新增音色预览端点

**Files:**
- Modify: `backend/src/main/java/com/smartrecord/controller/VoiceController.java`

- [ ] **Step 1: 添加 preview 端点**

在 `VoiceController.java` 中新增方法，读取 `static/voices/{file}` 返回音频流：

```java
@GetMapping("/preview")
@Operation(summary = "试听音色", description = "返回预录制的音色试听音频")
public void preview(@RequestParam String file, HttpServletResponse response) throws IOException {
    // 防止路径穿越
    if (file.contains("..") || file.contains("/") || file.contains("\\")) {
        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        return;
    }
    Resource resource = new ClassPathResource("static/voices/" + file);
    if (!resource.exists()) {
        response.setStatus(HttpServletResponse.SC_NOT_FOUND);
        return;
    }
    response.setContentType("audio/mpeg");
    response.setHeader("Cache-Control", "public, max-age=86400");
    try (InputStream is = resource.getInputStream()) {
        is.transferTo(response.getOutputStream());
    }
}
```

需要添加的 import：
```java
import org.springframework.core.io.Resource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.web.bind.annotation.RequestParam;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
```

- [ ] **Step 2: 验证编译**

```bash
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/smartrecord/controller/VoiceController.java
git commit -m "feat: 新增音色预览端点 /api/voice/preview"
```

---

### Task 2: 前端 — voice.js 适配新存储字段

**Files:**
- Modify: `miniprogram/utils/voice.js:106-119`

- [ ] **Step 1: 更新 getSettings 和 saveSettings**

将 `getSettings` 返回值从 `{ enabled, voiceType }` 改为 `{ enabled, voiceId, voiceName, voice }`：

```javascript
function getSettings() {
  const saved = wx.getStorageSync('voiceSettings');
  return {
    enabled: saved.enabled !== undefined ? saved.enabled : true,
    voiceId: saved.voiceId || 'std_01',
    voiceName: saved.voiceName || '晓晓',
    voice: saved.voice || 'zh-CN-XiaoxiaoNeural'
  };
}
```

- [ ] **Step 2: 更新 _speakOnce 拼入 voice 参数**

修改 `_speakOnce` 函数，从 settings 读取 voice 标识拼入 URL：

```javascript
function _speakOnce(text, onDone) {
  const settings = getSettings();
  const url = config.baseUrl + '/tts/audio?text=' + encodeURIComponent(text) + '&voice=' + encodeURIComponent(settings.voice);
  // ... 其余不变
}
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/utils/voice.js
git commit -m "feat: voice.js 适配新音色存储字段并传递 voice 参数"
```

---

### Task 3: 前端 — profile.wxml 入口改造 + 底部抽屉结构

**Files:**
- Modify: `miniprogram/pages/profile/profile.wxml:58-70`

- [ ] **Step 1: 替换音色选择区域**

将原来的胶囊切换器（第 58-70 行）替换为列表项入口 + 底部抽屉：

```xml
      <!-- 播报音色入口 -->
      <view class="setting-row" wx:if="{{voiceEnabled}}" bindtap="openVoiceSheet">
        <view class="setting-info">
          <text class="setting-label">播报音色</text>
        </view>
        <view class="setting-value-row">
          <text class="setting-value">{{voiceName}}</text>
          <text class="setting-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 音色选择抽屉 -->
    <view class="voice-sheet-mask {{voiceSheetVisible ? 'show' : ''}}" bindtap="closeVoiceSheet"></view>
    <view class="voice-sheet {{voiceSheetVisible ? 'show' : ''}}">
      <view class="voice-sheet-handle"></view>
      <view class="voice-sheet-title">选择音色</view>
      <view class="voice-sheet-body">
        <!-- 左侧分类 -->
        <scroll-view class="voice-cat-list" scroll-y enhanced show-scrollbar="{{false}}">
          <view
            class="voice-cat-item {{activeCatIndex === index ? 'active' : ''}}"
            wx:for="{{voiceCategories}}"
            wx:key="id"
            data-index="{{index}}"
            bindtap="onCatTap"
          >{{item.name}}</view>
        </scroll-view>
        <!-- 右侧音色列表 -->
        <scroll-view
          class="voice-list"
          scroll-y
          enhanced
          show-scrollbar="{{false}}"
          scroll-into-view="{{scrollToCat}}"
          scroll-with-animation
        >
          <block wx:for="{{voiceCategories}}" wx:key="id" wx:for-item="cat" wx:for-index="catIdx">
            <view class="voice-group-header" id="cat-{{cat.id}}">{{cat.name}}</view>
            <view
              class="voice-item {{item.id === selectedVoiceId ? 'active' : ''}} {{playingVoiceId === item.id ? 'playing' : ''}}"
              wx:for="{{cat.voices}}"
              wx:key="id"
              data-voice="{{item}}"
              data-cat-index="{{catIdx}}"
              bindtap="onVoiceTap"
            >
              <view class="voice-item-info">
                <text class="voice-item-name">{{item.name}}</text>
                <text class="voice-item-desc">{{item.desc}}</text>
              </view>
              <view class="voice-item-right">
                <view class="voice-wave" wx:if="{{playingVoiceId === item.id}}">
                  <view class="wave-bar"></view>
                  <view class="wave-bar"></view>
                  <view class="wave-bar"></view>
                </view>
                <text class="voice-check" wx:elif="{{item.id === selectedVoiceId}}">✓</text>
              </view>
            </view>
          </block>
        </scroll-view>
      </view>
    </view>
```

注意：需要将 `</view>` 闭合标签调整好，确保 settings-section 的闭合在抽屉之前。

- [ ] **Step 2: Commit**

```bash
git add miniprogram/pages/profile/profile.wxml
git commit -m "feat: 播报音色入口改为列表项 + 底部抽屉结构"
```

---

### Task 4: 前端 — profile.wxss 毛玻璃抽屉样式

**Files:**
- Modify: `miniprogram/pages/profile/profile.wxss`

- [ ] **Step 1: 添加入口样式**

```css
/* ===== 音色入口 ===== */
.setting-value-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.setting-value {
  font-size: 26rpx;
  color: var(--text-tertiary);
}

.setting-arrow {
  font-size: 28rpx;
  color: var(--text-tertiary);
  font-weight: 300;
}
```

- [ ] **Step 2: 添加抽屉蒙层和容器样式**

```css
/* ===== 音色抽屉 ===== */
.voice-sheet-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s, visibility 0.3s;
}

.voice-sheet-mask.show {
  opacity: 1;
  visibility: visible;
}

.voice-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 70vh;
  z-index: 1000;
  background: rgba(20, 20, 20, 0.85);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border-radius: 32rpx 32rpx 0 0;
  transform: translateY(100%);
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  display: flex;
  flex-direction: column;
}

.voice-sheet.show {
  transform: translateY(0);
}

.voice-sheet-handle {
  width: 56rpx;
  height: 8rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4rpx;
  margin: 20rpx auto 0;
  flex-shrink: 0;
}

.voice-sheet-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  padding: 20rpx 0 16rpx;
  flex-shrink: 0;
}
```

- [ ] **Step 3: 添加左右联动布局样式**

```css
.voice-sheet-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  padding-bottom: env(safe-area-inset-bottom);
}

.voice-cat-list {
  width: 30%;
  background: rgba(255, 255, 255, 0.02);
  height: 100%;
}

.voice-cat-item {
  padding: 28rpx 24rpx;
  font-size: 26rpx;
  color: var(--text-tertiary);
  transition: color 0.2s, font-weight 0.2s;
  position: relative;
}

.voice-cat-item.active {
  color: #fff;
  font-weight: 600;
}

.voice-cat-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 6rpx;
  background: var(--accent);
  border-radius: 0 3rpx 3rpx 0;
}

.voice-list {
  width: 70%;
  height: 100%;
  padding: 0 24rpx;
}

.voice-group-header {
  padding: 24rpx 0 12rpx;
  font-size: 22rpx;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 2rpx;
}
```

- [ ] **Step 4: 添加音色行和声浪动画样式**

```css
.voice-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 20rpx;
  border-radius: 16rpx;
  margin-bottom: 8rpx;
  transition: background 0.15s;
}

.voice-item:active {
  background: rgba(255, 255, 255, 0.06);
}

.voice-item.active {
  background: rgba(79, 140, 255, 0.1);
}

.voice-item-info {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.voice-item-name {
  font-size: 28rpx;
  color: var(--text-primary);
  font-weight: 500;
}

.voice-item.active .voice-item-name {
  color: var(--accent);
}

.voice-item-desc {
  font-size: 22rpx;
  color: var(--text-tertiary);
}

.voice-item-right {
  width: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.voice-check {
  font-size: 32rpx;
  color: var(--accent);
  font-weight: 600;
}

/* 声浪波纹动画 */
.voice-wave {
  display: flex;
  align-items: center;
  gap: 4rpx;
  height: 32rpx;
}

.wave-bar {
  width: 6rpx;
  background: var(--accent);
  border-radius: 3rpx;
  animation: waveAnim 0.6s ease-in-out infinite alternate;
}

.wave-bar:nth-child(1) {
  height: 12rpx;
  animation-delay: 0s;
}

.wave-bar:nth-child(2) {
  height: 20rpx;
  animation-delay: 0.2s;
}

.wave-bar:nth-child(3) {
  height: 12rpx;
  animation-delay: 0.4s;
}

@keyframes waveAnim {
  0% { height: 8rpx; }
  100% { height: 28rpx; }
}

.voice-item.playing .voice-item-name {
  color: var(--accent);
}
```

- [ ] **Step 5: 删除旧的胶囊切换器样式**

删除 `.voice-type-group` 和 `.voice-type-btn` 相关样式（profile.wxss 第 193-211 行）。

- [ ] **Step 6: Commit**

```bash
git add miniprogram/pages/profile/profile.wxss
git commit -m "feat: 毛玻璃音色抽屉样式及声浪动画"
```

---

### Task 5: 前端 — profile.js 抽屉逻辑与试听

**Files:**
- Modify: `miniprogram/pages/profile/profile.js`

- [ ] **Step 1: 更新 data 字段**

替换 `voiceType` 为新字段，新增抽屉相关状态：

```javascript
data: {
  isLoggedIn: false,
  nickname: '',
  avatarUrl: '',
  avatarColor: '',
  avatarChar: '',
  voiceEnabled: true,
  voiceName: '晓晓',
  selectedVoiceId: 'std_01',
  animationEnabled: true,
  saving: false,
  // 音色抽屉
  voiceSheetVisible: false,
  voiceCategories: [],
  activeCatIndex: 0,
  scrollToCat: '',
  playingVoiceId: ''
},
```

- [ ] **Step 2: 创建音频单例**

在 Page 外层作用域创建单例：

```javascript
const { get, put } = require('../../utils/request');
const { getColor, getFirstChar } = require('../../utils/avatar');
const { generateNickname } = require('../../utils/nickname');
const { getSettings, saveSettings } = require('../../utils/voice');
const config = require('../../config');
const app = getApp();

// 音频单例 — 全局唯一，避免内存泄漏和重叠播放
const audioCtx = wx.createInnerAudioContext();
audioCtx.obeyMuteSwitch = false;
```

- [ ] **Step 3: 更新 loadVoiceSettings**

```javascript
loadVoiceSettings() {
  const settings = getSettings();
  this.setData({
    voiceEnabled: settings.enabled,
    voiceName: settings.voiceName,
    selectedVoiceId: settings.voiceId
  });
},
```

- [ ] **Step 4: 新增 loadVoiceCatalog**

在 `onShow` 中调用，从后端加载音色目录并缓存：

```javascript
async loadVoiceCatalog() {
  if (this.data.voiceCategories.length > 0) return; // 已缓存
  try {
    const res = await new Promise((resolve, reject) => {
      wx.request({
        url: config.baseUrl + '/voice/catalog',
        success: resolve,
        fail: reject
      });
    });
    if (res.statusCode === 200 && res.data && res.data.data) {
      this.setData({ voiceCategories: res.data.data.categories || [] });
    }
  } catch (e) {
    console.error('加载音色目录失败', e);
  }
},
```

- [ ] **Step 5: 新增抽屉开闭方法**

```javascript
openVoiceSheet() {
  this.loadVoiceCatalog();
  this.setData({ voiceSheetVisible: true });
},

closeVoiceSheet() {
  this.setData({ voiceSheetVisible: false });
  // 关闭时停止试听
  audioCtx.stop();
  this.setData({ playingVoiceId: '' });
},
```

- [ ] **Step 6: 新增分类点击联动**

```javascript
onCatTap(e) {
  const index = e.currentTarget.dataset.index;
  const cat = this.data.voiceCategories[index];
  this.setData({
    activeCatIndex: index,
    scrollToCat: 'cat-' + cat.id
  });
},
```

- [ ] **Step 7: 新增音色点击试听 + 选中**

```javascript
onVoiceTap(e) {
  const voice = e.currentTarget.dataset.voice;
  const catIndex = e.currentTarget.dataset.catIndex;

  // 更新选中状态并持久化
  this.setData({
    selectedVoiceId: voice.id,
    voiceName: voice.name
  });
  saveSettings({
    voiceId: voice.id,
    voiceName: voice.name,
    voice: voice.voice
  });

  // 试听：stop → src → play，严格顺序
  audioCtx.stop();
  this.setData({ playingVoiceId: voice.id });
  audioCtx.src = config.baseUrl + '/voice/preview?file=' + encodeURIComponent(voice.file);
  audioCtx.play();

  // 播放结束清除状态
  audioCtx.offEnded();
  audioCtx.onEnded(() => {
    this.setData({ playingVoiceId: '' });
  });
},
```

- [ ] **Step 8: 更新 onVoiceToggle 清理旧字段**

```javascript
onVoiceToggle(e) {
  const enabled = e.detail.value;
  this.setData({ voiceEnabled: enabled });
  saveSettings({ enabled });
  app.globalData.audioEnabled = enabled;
  wx.setStorageSync('audioEnabled', enabled);
},
```

- [ ] **Step 9: 删除 setVoiceType 方法**

删除原来的 `setVoiceType` 方法（profile.js 第 100-104 行），不再需要。

- [ ] **Step 10: 添加 onUnload 清理**

```javascript
onUnload() {
  audioCtx.stop();
  audioCtx.destroy();
},
```

- [ ] **Step 11: 更新 onShow 调用链**

```javascript
onShow() {
  const loggedIn = !!app.globalData.token;
  this.setData({ isLoggedIn: loggedIn });
  if (loggedIn) {
    this.loadUserInfo();
    this.loadVoiceSettings();
    this.setData({ animationEnabled: app.globalData.animationEnabled });
  }
},
```

- [ ] **Step 12: Commit**

```bash
git add miniprogram/pages/profile/profile.js
git commit -m "feat: 音色抽屉交互逻辑及音频单例试听"
```

---

### Task 6: 集成验证

- [ ] **Step 1: 启动后端验证预览端点**

```bash
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run
# 另一终端测试
curl -o /dev/null -w "%{http_code}" "http://localhost:18080/api/voice/preview?file=std_01_xiaoxiao.mp3"
# 预期: 200
```

- [ ] **Step 2: 微信开发者工具验证**

1. 打开"我的"页面，确认音色入口显示当前音色名
2. 点击入口，抽屉从底部滑出
3. 左侧点击分类，右侧跳转到对应分组
4. 点击音色行，听到试听音频，声浪动画播放
5. 选中后显示蓝色高亮 + ✓
6. 关闭抽屉，再次打开，选中态保持
7. 在房间内计分，确认 TTS 使用选中的音色

- [ ] **Step 3: 最终 Commit**

```bash
git add -A
git commit -m "feat: 播报音色选择器重构完成"
```
