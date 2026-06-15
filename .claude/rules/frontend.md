# 前端规则

## WXML / WXSS

- WXML/WXSS 使用 2 空格缩进。
- 运行时用户可见文案优先集中映射，不要在多个页面散落硬编码旧词。
- 全站 WXML/WXSS/运行时数据禁止原生彩色 Emoji。
- 图标使用纯色线框、CSS icon、SVG path 或图标字体。
- WXSS 禁止 `transition: all;`，改成明确属性。

## 动效静默

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

## 交互与状态

- 异步按钮必须使用「文本绝对居中 + 图标/Loading 绝对定位」结构，Loading 状态文字位置不能抖动。
- 危险操作使用透明底 + 红色细描边，不做大红底按钮。
- 分享、保存、发送给朋友使用蓝色/青色，不使用红色。
- Tab 页面内容区必须考虑自定义 tabbar 与 `env(safe-area-inset-bottom)`。
- 底部抽屉、确认弹窗、选择器必须支持 reduce-motion 的静默展开。
- 在自定义沉浸式导航栏（"navigationStyle": "custom"）页面中，弹窗/浮层的内容顶部千万不能高过/盖过系统的原有标题栏与胶囊按钮。必须利用 JS 动态算得并绑定 `customNavHeight` 传给组件，以此来动态控制弹窗的最外层容器的 `padding-top: {{customNavHeight + 16}}px;`，绝不直接使用 `env(safe-area-inset-top)` 作为唯一计算变量，以防其失效归零。
- 对于重新校准测验终端，显示题目的屏幕卡片在页面垂直方向上必须居中对齐（使用 `justify-content: center` 且不使用内联 `padding-top` 避让）。底部的倾向水晶按键必须明确显示中文字样：“是”和“否”。题目生成时，屏幕中只展示当前一题，切换题目时必须清屏，使每一题文字始终从第一行第一个字符起流式打字输出，禁止文字发生“向上滚动”或向上抖动跳跃。题目内容只包含题目文本，不允许出现题号前缀（如 `[01/20]`）、系统日志字样 and 选择答案尾缀。顶部进度条使用 20 段精密倾斜切角的能量格子式进度条进行步进呈现。
- 对于协议修改校准终端（mbti-picker-modal），其整体布局要求与重新校准终端类似：显示分析结果的屏幕卡片（.ar-floating-screen）在页面垂直方向上必须完美居中对齐，内部不能存在多余的嵌套小卡片（即去除 .ar-hud-panel 边框、背景及盒子阴影）；四个倾向维度切换按钮（.ar-floating-controllers）与底部确认写入水晶按键（.ar-console-bottom-hardware）必须平级移出主屏幕 console，统一使用绝对定位组合推向页面最底部以防劫持与拥挤。当初始化或用户频繁切换选项时，中间大段飞船适性说明文字（.ar-profile-desc）必须执行清空并开始一字一字流式打字输出，并伴随闪烁光标（.term-cursor），并在 reduceMotion 为 true 时瞬间渲染且光标不闪烁。此外，当修改后的协议值与初始值不一致时，主卡片底部系统定位文本后必须额外以琥珀色高亮对比显示原有协议值 `(原: {{originalType}})`。

## 性能与工具封装

- 页面滚动时不 `setData`。
- 触摸绘图必须节流到一帧一次。
- `setData` 只写必要字段，避免整块 `room`、大数组、图表数据在高频事件里反复写入。
- 长等待 heartbeat 文案轮换不得高频 setData，建议 3 秒以上间隔。
- Canvas 组件必须在不可见或 reduce-motion 时停止扫描/脉冲动画。
- 分享海报 Canvas 应一次性绘制，避免在页面滚动或动画中反复重绘。
- 所有 `wx.vibrateShort` 通过 `utils/haptic.js` 封装，`vibrateEnabled=false` 时跳过。
- 音色试听维护单例 `InnerAudioContext`，执行 `stop() -> src 替换 -> play()`，禁止重复创建实例。
- `utils/score-ws.js` 是全局单例事件总线；页面只订阅/取消，不随页面销毁断开连接。
