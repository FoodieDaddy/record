# UI 指南

## 视觉系统

统一黑底，允许极弱径向光：

```css
background:
  radial-gradient(circle at 20% 0%, rgba(10,132,255,0.12), transparent 32%),
  radial-gradient(circle at 90% 18%, rgba(94,92,230,0.08), transparent 30%),
  #0A0A0A;
```

主色令牌：

```css
--color-primary: #0A84FF;
--color-cyan: #00C8FF;
--color-purple: #5E5CE6;
--color-green: #30D158;
--color-orange: #FF9F0A;
--color-red: #FF453A;
--text-main: rgba(255,255,255,0.92);
--text-secondary: rgba(255,255,255,0.56);
--text-muted: rgba(255,255,255,0.38);
--text-disabled: rgba(255,255,255,0.24);
```

- 蓝色/青色只做主高亮、数据焦点、航行核心、指令投影和按钮焦点。
- 绿色只表达在线、已连接、同步完成等正向系统状态。
- 橙色只表达偏高、注意、边界、校准中。
- 红色只用于危险、退出、错误、失败，禁止用于分享按钮、普通状态 badge、非危险提示。
- 正文透明度不要低于 `0.40`；装饰性英文可低到 `0.24-0.28`，但不能承载关键含义。
- 普通页面不要大面积纯蓝、大面积渐变、全屏发光或单色系铺满。
- 旧 `.glass-card` 可以保留兼容，但新 UI 优先使用 `sr-*` 终端令牌；普通卡片不要全部 `backdrop-filter` 或全部 `box-shadow`。

推荐卡片：

```css
.sr-card {
  border-radius: 28rpx;
  border: 1rpx solid rgba(10,132,255,0.18);
  background: rgba(255,255,255,0.035);
}

.sr-card-secondary {
  border-radius: 24rpx;
  border: 1rpx solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.025);
}
```

舰载 HUD 核心框推荐：

```css
.sr-hud-panel {
  border: 1rpx solid rgba(0,200,255,0.22);
  background: rgba(3,10,18,0.64);
  clip-path: polygon(
    24rpx 0,
    calc(100% - 24rpx) 0,
    100% 24rpx,
    100% calc(100% - 24rpx),
    calc(100% - 24rpx) 100%,
    24rpx 100%,
    0 calc(100% - 24rpx),
    0 24rpx
  );
}
```

## 终端风格

舰载终端感来自克制层级，不来自堆砌发光元素。

允许：细描边、切角按钮、弱扫描线、HUD 小标签、状态点、数据条、甲板透视线、全息扫描环、极少量英文 kicker、数字等宽。

禁止：大面积发光、所有文字都变蓝、每个按钮都有光晕、持续粒子、控制台日志堆砌、大量英文缩写、AI 长段解释、模拟游戏战斗 UI。

中文标题字距要克制，不要过度拉开导致可读性下降；英文装饰可以拉开字距。

## 页面分工

### 空间页（驾驶舱）

负责启动空间、接入空间、空间配置、成员布局、数值记录、实时流水、封存归档。文案使用「空间」「识别码」「接入」「舰员席位」「记录脉冲」「封存」「黑匣子」，避免普通表单感。

视觉关键词：驾驶舱仪表、席位矩阵、实时脉冲轨迹、任务状态条、封存黑匣子。

### 策略页（起飞甲板）

负责今日状态、行动建议、风险提醒、策略卡分享的产品功能，但用户可见体验必须包装为「航行核心 / 今日指令投影」。展示内容必须是复盘建议、节奏提醒、状态管理、安全边界，不做结果预测，不承诺收益，不引导冒进。

视觉关键词：甲板透视线、航行核心、点火动画、指令投影、系统日志舱、低噪/中噪/高噪状态。

交互原则：

- 点击点火后，动画要从当前航行核心原地启动，避免突然黑屏或像普通 loading。
- 生成中如果等待较久，要有舰载 heartbeat 文案轮换，例如「指令投影展开中 / 推进节奏校准中 / 链路保持中 / 安全边界校准中」。
- 结果页优先展示「舰载指令」，再展示状态读数、推进节奏和安全边界。
- 重新点火确认后必须回到 launch 待机页，由用户再次点击「点火航行核心」，不要自动生成。
- 分享卡必须是独立海报排版，不要把页面截图缩小塞进预览。

### 镜像页（全息观测舱）

负责 MBTI 协议、历史表现画像、人格一致性、五维扫描、画像分享。镜像判读必须短、冷静、数据感，不写大段 AI 心理鸡汤。

视觉关键词：全息投影、扫描环、人格协议、协议偏移、五维扫描、黑匣子样本读取。

### 身份页（舰员档案舱）

负责用户身份、权限等级、总积分、样本数、成就、设置入口、声音/动效/触感协议。首页只放高频身份信息，详细开关进入二级设置或折叠区域。

视觉关键词：舰员铭牌、头盔识别、权限等级、数据矩阵、装备槽位、通讯/视觉/触感协议。

## 组件与布局规范

- 按钮：主按钮高度 72rpx-88rpx，不超过 96rpx。优先细描边、切角、状态点，不做传统大圆角纯蓝按钮。
- 异步按钮：必须使用「文本绝对居中 + 图标/Loading 绝对定位」结构，Loading 状态文字位置不能抖动。
- 危险操作：退出、删除、解散、断开终端使用透明底 + 红色细描边，不做大红底按钮。
- 分享/保存操作：分享、保存、发送给朋友使用蓝色/青色，不使用红色。
- 线框图标：全站 WXML/WXSS/运行时数据禁止原生彩色 Emoji。图标使用纯色线框、CSS icon、SVG path 或图标字体。
- 成员简易模式：16 人以内使用 4x4 矩阵网格，配合 `scroll-view` 和 `max-height: 600rpx`，大数字必须格式化并防溢出。
- 座位模式：使用绝对定位舞台，中央仅作为空间参考点，成员通过 `pos-top` / `pos-bottom` / `pos-left` / `pos-right` 环绕排布。
- 弹窗：用 `wx:if` 懒渲染；底部抽屉、确认弹窗、选择器必须支持 reduce-motion 的静默展开。
- 底部安全区：Tab 页面内容区必须考虑自定义 tabbar 与 `env(safe-area-inset-bottom)`，结果页、长列表、底部按钮至少预留 180rpx-240rpx。
- 海报预览：分享海报不是页面缩略图，必须做独立排版，保证主指令/核心信息可读。

## 动效静默管理

- 全局开关为 `animationEnabled`，状态来自 `app.globalData` 与 Storage。
- 核心页面根节点必须绑定 `reduce-motion`：

```xml
<view class="page-container {{!animationEnabled ? 'reduce-motion' : ''}}">
```

- `app.wxss` 必须提供全局兜底：

```css
.reduce-motion * {
  animation: none !important;
  transition: none !important;
}
```

- JS 动画、Canvas 动画、分数滚动、雷达扫描、点火动画、打字机日志、heartbeat 文案轮换、粒子、`requestAnimationFrame`、长链 `setTimeout` 执行前必须判断 `app.globalData.animationEnabled`。
- reduce-motion 下可以切换静态状态和文字，但不得运行长动画、循环旋转、持续光束、粒子或扫描。
- 所有 timer / interval / animation frame 必须在 `onHide` 或 `onUnload` 清理。
- 动效允许轻微渐入、短扫描线、按钮按压、数值滚动、短点火序列。
- 禁止持续强发光、复杂滚动联动、长时间 loading、无法跳过的打字动画。
- 等待时间超过 6 秒的页面必须提供克制的状态反馈，不能让页面长时间完全静止。

## 前端性能

- 音色试听维护单例 `InnerAudioContext`，执行 `stop() -> src 替换 -> play()`，禁止重复创建实例。
- 页面滚动时不 `setData`，触摸绘图必须节流到一帧一次。
- WXSS 禁止 `transition: all;`，改成明确属性：`transition: opacity .2s, transform .2s, background-color .2s;`。
- Canvas 组件必须在不可见或 reduce-motion 时停止扫描/脉冲动画。
- 普通卡片不用 blur 和阴影；仅主视觉卡、抽屉、浮层允许少量模糊。
- `setData` 只写必要字段，避免整块 `room`、大数组、图表数据在高频事件里反复写入。
- 长等待 heartbeat 文案轮换不得高频 setData，建议 3 秒以上间隔。
- 分享海报 Canvas 应一次性绘制，避免在页面滚动或动画中反复重绘。
