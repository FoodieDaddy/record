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

色彩规则：

- 蓝色/青色：主高亮、数据焦点、航行核心、指令投影、按钮焦点
- 绿色：在线、已连接、同步完成等正向状态
- 橙色：偏高、注意、边界、校准中
- 红色：仅危险/退出/错误/失败/解散/撤离；禁止用于分享按钮、普通 badge、非危险提示
- 正文透明度不低于 `0.40`；装饰英文可低至 `0.24-0.28`，不承载关键含义
- 不做大面积纯蓝/大面积渐变/全屏发光/单色系铺满
- 旧 `.glass-card` 保留兼容，新 UI 优先用 `sr-*` 终端令牌；普通卡片不全用 `backdrop-filter` 或 `box-shadow`

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

HUD 核心框：

```css
.sr-hud-panel {
  border: 1rpx solid rgba(0,200,255,0.22);
  background: rgba(3,10,18,0.64);
  clip-path: polygon(
    24rpx 0, calc(100% - 24rpx) 0, 100% 24rpx, 100% calc(100% - 24rpx),
    calc(100% - 24rpx) 100%, 24rpx 100%, 0 calc(100% - 24rpx), 0 24rpx
  );
}
```

## 终端风格

终端感来自克制层级，不来自堆砌发光元素。

允许：细描边、切角按钮、弱扫描线、HUD 小标签、状态点、数据条、甲板透视线、全息扫描环、极少量英文 kicker、数字等宽。

禁止：大面积发光、所有文字变蓝、按钮光晕、持续粒子、控制台日志堆砌、大量英文缩写、AI 长段解释、模拟游戏战斗 UI。

中文标题字距克制；英文装饰可拉开字距。

## 底部系统 Dock

舰载系统 Dock 风格，非普通微信 TabBar。

### 四个舱位插槽

| Tab | 舱位 | 英文装饰 | 图标隐喻 |
|---|---|---|---|
| 编队 | 驾驶舱 | COCKPIT | HUD 框 + 舰点 + 连接线 |
| 指令 | 导航舱 | NAV | 轨道环 + 核心点 + 航线 |
| 镜像 | 全息舱 | HOLO | 菱形投影框 + 扫描线 |
| 身份 | 识别舱 | IDENTITY | 四角扫描框 + 中心识别点 + 信息线 |

### Dock 容器规范

- 固定底部，适配 `env(safe-area-inset-bottom)`，基础高度 140rpx + 安全区
- 背景：`linear-gradient(180deg, rgba(4,12,24,0.98), rgba(0,0,0,0.98))`
- 顶部弱蓝线：`border-top: 1rpx solid rgba(10,132,255,0.18)`
- 中央能量轨：宽 65%，从透明到青蓝再到透明

### 舱位插槽规范

- 未选中：`border-color: rgba(255,255,255,0.44)`，文字 `rgba(255,255,255,0.55)`
- 选中：`border-color: rgba(0,200,255,0.88)`，高亮点 `#00C8FF`，底板 `rgba(10,132,255,0.08)`
- 选中显示舱位名和英文装饰；状态点 `#00C8FF` + 弱光晕；底部能量条青蓝渐变

### 图标实现要求

- 纯 CSS/WXML，不用 image/远程图片/Emoji；四图标须有明确形状差异
- 选中态像「舱位已接入」；不用 `transition: all`，仅 `opacity`/`border-color`/`background-color`/`transform`
- reduce-motion 兜底：`transition: none !important`

## 编队页 active 全局星空背景

- 首屏使用 `cockpit-main` 包裹 `cockpit-starry-shell`，不堆叠大型编队信息卡
- `cockpit-starry-shell` 比例 `690:940`，背景层为 `starry-bg` / `starry-nebula` / `starry-grid` / `starry-vignette`
- 动态覆盖层保持可点击可更新，外部航船 marker 由 WXML 生成在舷窗上半区
- 不引入远程图片/GIF/视频/高频动画；星空背景在 reduce-motion 下保持静态

## 品牌标识

统一使用「太空记分器 / Space Scorekeeper」。中文主名优先，英文只作弱装饰。

海报标识：`SPACE SCOREKEEPER · <BAY>`。不再使用 SMART RECORD 或 PULSE TERMINAL。

## 页面分工

### 编队页（驾驶舱）

负责创建编队、加入编队、编队配置、成员布局、脉冲记录、实时流水、封存归档。

驾驶舱主视觉规范：

- 一体化外壳（cockpit-shell）：舷窗（cockpit-window）+ 驾驶台（cockpit-deck）构成连续空间，八角切角，驾驶台向上偏移 40rpx 与舷窗底部融合
- 第一人称本舰视角，本舰不作为头像大卡片出现在主视觉中心
- 本舰脉冲用半圆仪表盘（外弧+内弧+刻度+标签+数值+状态+底座），嵌入驾驶台顶部，向上偏移 90rpx
- 编队成员 = 飞船目标标记（ship-target）：三角机鼻+双翼条+核心识别徽标+护盾环+链路灯+HUD 标签，不用头像大图/Emoji/远程图片
- 舷窗角落只留轻量数值读数，底部角落读数用更低透明度（`vch-value--faint`）
- 终端屏幕（terminal-screen）通过中轴线（deck-spine）与仪表连接，包含编队信息行、实时脉冲行、最近流向和轨迹预览行
- 编队码/成员数/模式/阶段/链路状态集中在终端屏幕内，不做普通信息卡片
- 航迹档案在驾驶舱只保留轻量入口，引导进入全息舱

HUD 展示：任务编队、外部航船、编队位、本舰脉冲、目标门限（自航推进，未实现）、脉冲轨迹、记录协议、航程阶段、链路状态。

控制台主操作：展开信标 / 复制编队码 / 航迹档案 / 封存航程。

记录行为按协议变化：脉冲流向→点击外部航船；自航推进→点击推进控件（未实现）；主控同步→主控打开同步面板（未实现）；航段写入→进入航段写入流程。不推荐常驻「记录脉冲」按钮。

控制台放 HUD 下方，尽量薄；HUD 空间优先展示更多成员和编队结构。

Active 态星空规范要点：

- 本舰仪表 `overlay-gauge`：宽约 340rpx，高约 144rpx，数值字号 54rpx-64rpx
- 终端屏 `overlay-terminal`：集中展示编队码/复制/成员数/模式/阶段/实时脉冲/最近流向/轨迹预览
- 外部航船 `ship-craft`：机鼻+翼+识别徽标+护盾环+在线点必须真实存在；头像仅 34rpx-40rpx 识别徽标
- 外部航船固定坐标：1 艘 `(50,34)`；2 艘 `(34,36)/(68,28)`；3 艘 `(26,38)/(50,26)/(74,36)`；4 艘 `(24,38)/(44,24)/(64,26)/(82,38)`；y≤44%
- 轨迹预览：有数据时 5-8 点 x 均匀 y 归一 18%-82%；无数据时 5 点空态 +「等待更多脉冲写入」
- `overlay-control` 放星空舞台底部，至少完整露出「展开信标/封存航程」

信标规则：顶部邀请/分享/扫码统一称「信标」；6 位短码称「编队码」；不退回成「二维码/分享链接」。

封存/解散视觉：封存用主流程按钮（橙色或弱红描边，不做大面积红底）；解散/撤离用透明底+红色细描边。

### 指令页（导航舱）

负责今日状态、行动建议、安全边界、指令卡分享。包装为「导航舱 / 今日指令投影」——展示复盘建议、节奏提醒、状态管理、安全边界，不做预测，不承诺收益。

交互原则：

- 页面标题「导航舱」，kicker「NAV BAY ONLINE」；主按钮「开始导航计算」，kicker「PRESS TO CALC」
- 点击计算后动画从导航核心原地启动，避免突然黑屏；生成中导航核心保持可见
- 生成中文案：航迹协议已同步 / 航迹样本已接入 / 安全边界生成中 / 导航核心校准中 / 指令投影校准中 / 备用导航准备中
- 结果页优先展示「今日指令」，再展示状态读数/推进节奏/安全边界
- 重新计算确认后回到 launch 待机页，由用户再次点击，不自动生成
- 分享卡必须独立海报排版，不做页面截图缩小；海报标识 `SPACE SCOREKEEPER · NAV BAY`
- 底部状态用「航迹协议」，不用「成员协议」

### 镜像页（全息舱）

负责 MBTI 协议、历史画像、人格一致性、全息扫描、航迹档案/回放、画像分享。判读必须短、冷静、数据感，不写 AI 心理鸡汤。

信息四层（首屏只展示一级）：

1. 全息总览 — 镜像投影、协议一致率、航迹样本、全息扫描图
2. 协议行动 — 协议状态卡
3. 协议分析 — 系统判读、信号标签、协议偏移、协议演化（默认折叠）
4. 航迹档案 — 航迹摘要、航迹回放入口

固定操作栏（底部导航上方）：生成镜像图片（主操作，蓝/青强调）、重新校准、修改协议。`position: fixed`，bottom 基于 tabbar 高度计算（`calc(140rpx + env(safe-area-inset-bottom))`），z-index 低于 tabbar。

页面根容器 `padding-bottom` 预留操作栏 + tabbar + safe-area 总高度。

镜像图片：独立 Canvas 绘制，非页面截图，一次性绘制不循环重绘，Canvas 文案须 sanitize，海报标识 `SPACE SCOREKEEPER · HOLO BAY`。预览弹窗：保存镜像卡、发送给朋友、关闭预览。

### 身份页（识别舱）

负责本舰识别、授权等级、航行经验、稳定读数、装备协议、断开终端。航迹数据分析归全息舱。

四层架构：①本舰档案（识别徽标+呼号+授权等级+航行经验）②授权状态（航行经验+稳定读数）③装备协议（通讯/视觉/触感）④终端控制（断开终端）。

底部安全区：根容器 `padding-bottom` 至少 `calc(200rpx + env(safe-area-inset-bottom))`；「断开终端」流式布局不用 fixed/sticky，透明底+红色细描边；退出确认弹窗按钮完整显示不被 Home Indicator 遮挡。

呼号校准弹窗：居中悬浮 overlay（z-index > tabbar 999）；输入框 `type="text"` 不用 `type="nickname"`；键盘弹出时 `transform` 上移；按钮文案「写入呼号」（主）/「取消」（次）；不出现「昵称/用户名」。

## 组件与布局规范

- 按钮：主按钮高 72rpx-88rpx（不超过 96rpx），优先细描边/切角/状态点，不做传统大圆角纯蓝按钮
- 异步按钮：文本绝对居中 + 图标/Loading 绝对定位，Loading 状态文字不抖动
- 危险操作：透明底 + 红色细描边，不做大红底按钮
- 分享/保存：用蓝色/青色，不用红色
- 线框图标：全站禁止原生彩色 Emoji，用纯色线框/CSS icon/SVG path/图标字体
- 成员简易模式：16 人内 4x4 矩阵网格 + `scroll-view`，`max-height: 600rpx`，大数字格式化防溢出
- 座位模式：绝对定位舞台，成员通过 `pos-top/bottom/left/right` 环绕排布
- 弹窗：`wx:if` 懒渲染；底部抽屉/确认弹窗/选择器须支持 reduce-motion 静默展开
- 底部安全区：Tab 页内容区预留 180rpx-240rpx（含自定义 tabbar + safe-area）
- 海报预览：独立排版保证核心信息可读，不做页面截图缩略图

### AR 悬浮操作面板（ar-action-pad）

驾驶舱控制台的全息按钮面板，HUD 下方操作区。

```css
.ar-action-row {
  display: flex;
  gap: 20rpx;
  justify-content: center;
  padding: 0 24rpx;
}
.ar-action-pad {
  position: relative;
  flex: 1;
  max-width: 200rpx;
  height: 84rpx;                /* 容许 76rpx-92rpx */
  background: rgba(3, 12, 24, 0.62);
  border: 1rpx solid rgba(0, 200, 255, 0.18);
  clip-path: polygon(
    12rpx 0, calc(100% - 12rpx) 0, 100% 12rpx, 100% calc(100% - 12rpx),
    calc(100% - 12rpx) 100%, 12rpx 100%, 0 calc(100% - 12rpx), 0 12rpx
  );
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}
```

规范：纯 CSS/WXML 图标；中文主文案 + 弱英文装饰（opacity 0.28-0.32）；能量线（底部青色弱光条）；状态点（右上角青色圆点）；按压反馈 `border-color` 0.18→0.55 不做 scale；reduce-motion `transition: none !important`；按钮数量 2 个并排等宽。

### AR 脉冲写入面板（pulse-vr-cluster）

脉冲流向协议的浮空数字输入面板，AR 全息风格。

```css
.pulse-vr-overlay {
  position: fixed;
  inset: 0;
  z-index: 1010;
  background: radial-gradient(ellipse at 50% 35%, rgba(2,10,28,0.42), rgba(0,0,0,0.62));
}
.pulse-vr-cluster {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(170rpx + env(safe-area-inset-bottom));
  width: calc(100vw - 96rpx);
  max-width: 620rpx;
  background: rgba(3, 12, 24, 0.74);
  border: 1rpx solid rgba(0, 200, 255, 0.18);
  clip-path: polygon(
    16rpx 0, calc(100% - 16rpx) 0, 100% 16rpx, 100% calc(100% - 16rpx),
    calc(100% - 16rpx) 100%, 16rpx 100%, 0 calc(100% - 16rpx), 0 16rpx
  );
  backdrop-filter: blur(8rpx);
}
```

规范：遮罩用径向暗化保留驾驶舱可见性；面板底部左 X（关闭）右发射（提交）；不展示推荐值/标题/清除按钮；数字按键玻璃/金属 HUD 风格；扫描线+四角装饰增强 AR 感；底部间距确保不被 Dock 遮挡。

## 动效静默管理

- 全局开关 `animationEnabled`，来自 `app.globalData` 与 Storage
- 核心页面根节点绑定 `reduce-motion`：

```xml
<view class="page-container {{!animationEnabled ? 'reduce-motion' : ''}}">
```

- `app.wxss` 全局兜底：

```css
.reduce-motion * { animation: none !important; transition: none !important; }
```

- JS/Canvas/分数滚动/雷达扫描/点火/打字机/heartbeat 轮换/粒子/rAF/长链 setTimeout 执行前须判断 `animationEnabled`
- reduce-motion 下可切换静态状态和文字，不运行长动画/循环旋转/持续光束/粒子/扫描
- 所有 timer/interval/rAF 须在 `onHide`/`onUnload` 清理
- 允许：轻微渐入、短扫描线、按钮按压、数值滚动、短点火序列
- 禁止：持续强发光、复杂滚动联动、长时间 loading、无法跳过的打字动画
- 等待超过 6 秒须提供克制状态反馈

## 前端性能

- 音色试听维护单例 `InnerAudioContext`，`stop() → src 替换 → play()`，禁止重复创建
- 页面滚动时不 `setData`，触摸绘图节流到一帧一次
- WXSS 禁止 `transition: all;`，改成明确属性
- Canvas 不可见或 reduce-motion 时停止扫描/脉冲动画
- 普通卡片不用 blur 和阴影；仅主视觉卡/抽屉/浮层允许少量模糊
- `setData` 只写必要字段，避免整块大对象/大数组高频写入
- 长等待 heartbeat 文案轮换间隔 ≥3 秒
- 分享海报 Canvas 一次性绘制

## 登录页底部安全区

无 tabbar，底部信息区须考虑 Home Indicator。`.bottom-info` 使用 `bottom: calc(60rpx + env(safe-area-inset-bottom))`。
