# Phase 8 Prompt：profile 音频、Canvas 与资源治理

## 角色

你是微信小程序资源生命周期治理工程师。请修复 profile 音频预览、Canvas 海报/镜像卡、图片头像资源、缓存策略和页面卸载后的异步任务问题。

## 阶段目标

1. 修复 profile 音频上下文二次进入失效风险。
2. Canvas 任务延迟到用户明确触发后执行。
3. 统一图片、头像、二维码、海报资源缓存策略。
4. 页面卸载时取消未完成任务。
5. 降低指令页、镜像页、身份页切换时的资源压力。

## 重点文件

- `miniprogram/pages/profile/profile.js`
- `miniprogram/pages/fortune/fortune.js`
- `miniprogram/pages/mirror/index.js`
- 海报/卡片生成相关组件
- `miniprogram/utils/resource-cache.js` 或新建
- `miniprogram/utils/audio-manager.js` 或新建

## 任务一：音频上下文治理

当前风险：模块级 `audioCtx` 被 `destroy()` 后，页面重新进入时没有可靠重建。

请改为 audio-manager：

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

function destroyAudio() {
  if (audioCtx) {
    audioCtx.stop();
    audioCtx.destroy();
    audioCtx = null;
  }
}

module.exports = {
  getAudioCtx,
  playPreview,
  stopPreview,
  destroyAudio
};
```

页面：

- `onHide`：stop，不 destroy。
- `onUnload`：可 stop；如果是全局复用，不 destroy。
- 播放新音色前先 stop 旧音色。

## 任务二：Canvas 任务延迟执行

不要在页面 onLoad/onShow 自动生成海报或镜像卡。

规则：

- 用户点击“生成图片/保存/分享”后才初始化 Canvas。
- 生成前显示轻量 loading。
- 生成完成后释放临时状态。
- 页面 unload 时取消后续回调。

示例：

```js
async onExportPoster() {
  if (this._exporting) return;
  this._exporting = true;
  this.setData({ exporting: true });

  try {
    await this.ensureCanvasReady();
    const path = await this.drawPoster();
    if (this._destroyed) return;
    this.setData({ posterPath: path });
  } finally {
    this._exporting = false;
    if (!this._destroyed) this.setData({ exporting: false });
  }
}
```

## 任务三：图片资源缓存

新建 `utils/resource-cache.js`：

```js
const memoryCache = new Map();

function getCached(key) {
  return memoryCache.get(key) || wx.getStorageSync(key);
}

function setCached(key, value, ttlMs) {
  const payload = {
    value,
    expireAt: Date.now() + ttlMs
  };
  memoryCache.set(key, payload);
  wx.setStorage({ key, data: payload });
}

function isValid(payload) {
  return payload && payload.expireAt > Date.now();
}
```

适用资源：

- 用户头像
- 音色目录
- 指令结果背景图
- 镜像卡静态素材
- 二维码临时路径

## 任务四：图片懒加载

所有头像、列表图片增加：

```xml
<image lazy-load="true" src="{{avatarUrl}}" mode="aspectFill" />
```

对失败头像加默认图，避免重复请求错误资源。

## 任务五：异步任务清理

所有页面增加：

```js
onUnload() {
  this._destroyed = true;
  this.clearTimers && this.clearTimers();
}
```

异步回调里：

```js
if (this._destroyed) return;
```

## 输出格式

```md
# Phase 8 资源治理完成报告

## 音频生命周期修复

## Canvas 延迟执行改造

## 图片和素材缓存策略

## 页面卸载清理机制

## 真机测试结果

## 风险与回滚
```

## 验收标准

- 反复进入 profile 并试听音色，不出现失效或多音频叠播。
- 指令页/镜像页不在进入页面时立即执行重 Canvas 任务。
- 导出图片时有明确 loading，完成后资源释放。
- 页面退出后无异步 setData 报错。
- 头像和静态素材加载更稳定。
