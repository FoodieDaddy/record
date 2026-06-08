# Phase 3 Prompt：动画系统重写

## 角色

你是移动端动效工程师，熟悉微信小程序渲染模型。请把当前高成本动画重写为低成本、可降级、可复用的动效系统。

## 阶段目标

1. 脉冲飞线改为 CSS transform/opacity 驱动。
2. 数字滚动改为轻量差值反馈，不再逐帧 setData。
3. 弹层转场统一为 180~280ms。
4. 建立 motion tokens：时长、缓动、层级、降级开关。
5. 所有动画受全局 `animationEnabled` 控制。

## 重点文件

- `miniprogram/pages/room/room.js`
- `miniprogram/pages/room/room.wxml`
- `miniprogram/pages/room/room.wxss`
- `miniprogram/styles/motion.wxss` 或新建
- `miniprogram/utils/motion.js` 或新建
- `miniprogram/app.js`

## 动效预算

请按以下预算重写：

| 类型 | 时长 | 实现方式 | 允许频率 |
|---|---:|---|---|
| 按钮按下 | 120~180ms | CSS transform/opacity | 高频 |
| 弹层进入 | 180~280ms | CSS transform/opacity | 中频 |
| 脉冲飞线 | 520~760ms | CSS keyframes | 中频 |
| 成员加入 | 240~360ms | CSS transform/opacity | 低频 |
| 结算完成 | 600~900ms | CSS / Lottie 可选 | 低频 |
| 背景氛围 | 慎用 | 静态渐变优先 | 极低 |

禁止：

- JS 逐帧 setData
- 大面积 backdrop-filter 常驻
- 多个 fixed 背景层同时动
- 每个卡片都独立呼吸动画

## 任务一：新增 motion token

新建 `miniprogram/styles/motion.wxss`：

```css
:root {
  --motion-fast: 160ms;
  --motion-normal: 240ms;
  --motion-slow: 520ms;
  --ease-out: cubic-bezier(.18,.82,.22,1);
  --ease-soft: cubic-bezier(.2,.8,.2,1);
}

.motion-fade-in {
  animation: motionFadeIn var(--motion-normal) var(--ease-soft) both;
}

.motion-slide-up {
  animation: motionSlideUp var(--motion-normal) var(--ease-out) both;
}

@keyframes motionFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes motionSlideUp {
  from { opacity: 0; transform: translate3d(0, 24rpx, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
```

在全局或页面 WXSS 引入。

## 任务二：重写脉冲飞线

### WXML 示例

```xml
<view wx:if="{{pulseFlight.visible}}" class="pulse-flight-layer">
  <view
    class="pulse-flight-dot {{pulseFlight.playing ? 'is-playing' : ''}}"
    style="left: {{pulseFlight.fromX}}px; top: {{pulseFlight.fromY}}px; --dx: {{pulseFlight.dx}}px; --dy: {{pulseFlight.dy}}px;"
    bindanimationend="onPulseFlightEnd"
  >
    <view class="pulse-flight-core"></view>
    <text class="pulse-flight-value">{{pulseFlight.value}}</text>
  </view>
</view>
```

### WXSS 示例

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

### JS 示例

```js
playPulseFlightAnimation(payload) {
  if (!this.isAnimationEnabled()) {
    this.flashTargetSeat(payload.toUserId);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const query = wx.createSelectorQuery().in(this);
    query
      .select(`#seat-${payload.fromUserId}`).boundingClientRect()
      .select(`#seat-${payload.toUserId}`).boundingClientRect()
      .exec((res) => {
        const fromRect = res && res[0];
        const toRect = res && res[1];
        if (!fromRect || !toRect) {
          this.flashTargetSeat(payload.toUserId);
          resolve();
          return;
        }

        const fromX = fromRect.left + fromRect.width / 2;
        const fromY = fromRect.top + fromRect.height / 2;
        const toX = toRect.left + toRect.width / 2;
        const toY = toRect.top + toRect.height / 2;

        this._pulseFlightResolve = resolve;
        this._pulseFlightTarget = payload.toUserId;

        this.setData({
          pulseFlight: {
            visible: true,
            playing: true,
            fromX,
            fromY,
            dx: toX - fromX,
            dy: toY - fromY,
            value: payload.amount || payload.value || ''
          }
        });
      });
  });
},

onPulseFlightEnd() {
  const resolve = this._pulseFlightResolve;
  const target = this._pulseFlightTarget;
  this._pulseFlightResolve = null;
  this._pulseFlightTarget = null;

  this.setData({
    pulseFlight: {
      visible: false,
      playing: false,
      fromX: 0,
      fromY: 0,
      dx: 0,
      dy: 0,
      value: ''
    }
  });

  if (target) this.flashTargetSeat(target);
  if (resolve) resolve();
}
```

## 任务三：数字变化反馈

不要做逐帧滚动数字。改为：

- 旧分数 → 新分数直接变更。
- 目标座位闪烁一次。
- 数字 `scale(1.06)` + 高亮 220ms。
- 正负变化显示 `+N` / `-N` 小浮层 500ms。

示例：

```xml
<text class="seat-score {{item.scoreChanged ? 'is-score-changed' : ''}}">
  {{item.score}}
</text>
<text wx:if="{{item.deltaVisible}}" class="seat-score-delta">
  {{item.deltaText}}
</text>
```

```css
.seat-score.is-score-changed {
  animation: scoreImpact 220ms cubic-bezier(.2,.8,.2,1) both;
}

@keyframes scoreImpact {
  0% { transform: scale(1); }
  45% { transform: scale(1.08); }
  100% { transform: scale(1); }
}
```

## 任务四：弹层转场统一

所有弹层使用统一结构：

```xml
<view wx:if="{{visible}}" class="overlay-root" catchtouchmove="noop" bindtap="onMaskTap">
  <view class="overlay-panel motion-slide-up" catchtap="noop">
    <slot />
  </view>
</view>
```

关闭时不做复杂延迟。需要离场动画时最多保留 180ms，然后卸载。

## 任务五：全局动效开关

在 `app.globalData` 或用户配置中已有动画开关时复用。没有就新增：

```js
globalData: {
  animationEnabled: true,
  lowMotionMode: false
}
```

低性能设备或用户关闭动画时：

- 不播放飞线，仅目标闪光。
- 不播放背景动画。
- 弹层只 fade。

## 输出格式

```md
# Phase 3 动画系统重写完成报告

## 新增 motion token

## 被替换的 JS 动画

## 新动画实现说明

## 动画开关与降级策略

## 真机对比结果

## 风险与回滚
```

## 验收标准

- 不存在 JS 逐帧飞线动画。
- 记录脉冲时 `setData` 次数显著减少。
- 弹层进入/退出统一且不拖沓。
- 关闭动画开关后功能仍完整可用。
- 低端真机上体感更顺滑。
