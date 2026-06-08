# 开发日志

## 2026-06-08 — active 背景切换为全局星空

### 变更原因

- 用户要求创建编队后的背景图改成全局星空背景。
- 上一版静态驾驶舱底图虽然统一了槽位，但整体仍偏“框架图”，不如全局星空背景与项目其他舱位一致。

### 变更文件

修改：
- `miniprogram/pages/room/room.wxml` — active 主容器从 `cockpit-image-shell` + `cockpit-bg` 改为 `cockpit-starry-shell` + `cockpit-starry-bg`，不再引用 `/assets/cockpit/cockpit-active.webp`。
- `miniprogram/pages/room/room.wxss` — 新增全局星空背景层、弱星点、弱网格、暗角和覆盖层可读性托底；动态覆盖层定位和交互保持不变。
- `CHANGELOG.md`、`docs/UI_GUIDELINES.md`、`docs/DEVELOPMENT_LOG.md` — 同步当前 active 背景规范。

### 实现方式

- 背景使用本地 CSS 渐变和星点纹理，沿用全局黑底、深蓝光晕和低亮青色网格，不引入远程图片、GIF、视频或高频动画。
- 编队码、成员数、外部航船、本舰脉冲、通讯链路、实时脉冲、轨迹和航程控制仍然由 WXML 动态覆盖层渲染。
- 仪表、终端和控制区只增加极轻暗底，确保星空背景上文字可读。

### 验证方式

- `node --check miniprogram/pages/room/room.js` 通过。
- `rg -n "房间|空间|舰员|转积分|积分|黑匣子|五维扫描|今日策略|预测|预知|运势|神谕|占卜|LLM|fallback|HIGH_RISK" miniprogram/pages/room miniprogram/components miniprogram/utils` 无命中。
- `rg -n "transition:\\s*all|setInterval|requestAnimationFrame" miniprogram/pages/room miniprogram/app.wxss miniprogram/custom-tab-bar` 无命中。

### 未验证项

- 微信开发者工具中 active 态因当前创建请求超时，尚未进入创建后的页面做完整截图复核。

## 2026-06-08 — 驾驶舱 active 静态底图重构

### 变更原因

- 上一版 active 态虽然已经收敛成一屏，但页面观感仍然偏“多层卡片叠放”，没有真正形成统一驾驶舱外壳。
- 航程控制和终端信息需要更稳定的空间参照，改成静态底图后，舷窗、仪表槽、终端槽和控制槽的位置会更固定。
- 外部航船、本舰脉冲、实时脉冲和轨迹仍要继续动态更新，因此只适合把“壳”静态化，把“内容层”留给 WXML。

### 变更文件

修改：
- `miniprogram/assets/cockpit/cockpit-active.webp` — 新增静态驾驶舱底图，黑底深蓝、青色细描边、弱星点和弱网格，预留舷窗、仪表槽、终端槽和控制槽。
- `miniprogram/pages/room/room.wxml` — active 态改为 `cockpit-image-shell` + `cockpit-bg` + `overlay-readout` / `overlay-ships` / `overlay-gauge` / `overlay-terminal` / `overlay-control`；移除原先多层 cockpit-shell-v2 / cockpit-deck-v2 结构。
- `miniprogram/pages/room/room.wxss` — 新增静态底图覆盖层样式：690:940 舞台比例、百分比定位、窄幅终端区、紧凑控制区和 overlay 版按钮样式。
- `miniprogram/pages/room/room.js` — 外部航船坐标收紧到舷窗上半区，1-3 人布局改为 50/34、34/36 + 68/28、26/38 + 50/26 + 74/36，安全区上限收紧到 y=44。
- `CHANGELOG.md`、`docs/UI_GUIDELINES.md` — 同步新的静态底图规范。

### 实现方式

- 用单张 `cockpit-active.webp` 统一承载外壳空间，图片只画结构和槽位，不画任何实时数值。
- 所有实时数据继续留在 WXML 覆盖层：编队码、成员数、外部航船、本舰脉冲、通讯链路、实时脉冲、轨迹和控制按钮都还保留交互。
- 控制区继续放在底图内，底部保留足够间距，避免被 Dock 挡住。

### 验证方式

- `node --check miniprogram/pages/room/room.js` 通过。
- `rg -n "房间|空间|舰员|转积分|积分|黑匣子|五维扫描|今日策略|预测|预知|运势|神谕|占卜|LLM|fallback|HIGH_RISK" miniprogram/pages/room miniprogram/components miniprogram/utils` 无命中。
- `rg -n "transition:\\s*all|setInterval|requestAnimationFrame" miniprogram/pages/room miniprogram/app.wxss miniprogram/custom-tab-bar` 无命中。
- `miniprogram/assets/cockpit/cockpit-active.webp` 已生成，文件大小约 45KB，非 GIF。

### 未验证项

- 微信开发者工具中 active 页的实际编译与首屏布局尚未重新复核。
- 不同机型上的控制区和轨迹区视觉间距仍需要在真机/开发者工具里再看一遍。

## 2026-06-08 — 驾驶舱 active 首屏 v2 一屏重构

### 变更原因

- 前几轮 active 态仍在旧结构上微调，首屏继续表现为舷窗、仪表、实时脉冲、航程控制等卡片堆叠。
- 舷窗和驾驶台高度失控，航程控制在小屏上容易被底部 Dock 遮挡。
- 外部成员仍像头像圆环，轨迹预览空态信息量不足，需要重建为真正的「上方舷窗 + 下方驾驶台」驾驶舱。

### 变更文件

修改：
- `miniprogram/pages/room/room.wxml` — active 态主骨架重写为 `cockpit-main` + `cockpit-shell-v2` + `voyage-control-panel-v2`；舷窗、外部航船、本舰仪表、终端屏、轨迹预览全部收进 800rpx 驾驶舱外壳；删除 cockpit-shell 外部的独立封存区和展开图表。
- `miniprogram/pages/room/room.wxss` — 新增 v2 固定尺寸样式：`cockpit-shell-v2` 800rpx、`cockpit-window-v2` 430rpx、`cockpit-deck-v2` 370rpx、`self-gauge-compact` 360rpx × 150rpx、`deck-terminal` 218rpx；新增 `ship-craft` 小航船样式和 `voyage-control-panel-v2`。
- `miniprogram/pages/room/room.js` — `deriveFormationShips()` 改为按外部航船数量输出固定坐标和 `sizeClass`；sparkline 生成收敛为 5-8 个点并将空态点阵固定为 5 点；新增 `openPulseRecorder`、`openBeacon`、`handleSettle` 作为 v2 控制面板入口。
- `miniprogram/pages/room/room.wxs`、`miniprogram/components/*`、`miniprogram/utils/*` — 清理本次旧词扫描命中的注释、题面和内部映射直写噪声，保证扫描命令只反映真实风险。
- `CHANGELOG.md`、`PLAN.md`、`docs/UI_GUIDELINES.md`、`docs/DEVELOPMENT_LOG.md` — 同步记录本轮驾驶舱 v2 规范和验证结果。

### 实现方式

- active 首屏只保留一层 `cockpit-shell-v2`，舷窗高度 430rpx，驾驶台高度 370rpx，总高度固定 800rpx，不再由内部模块撑高。
- 编队状态行、实时脉冲、最近流向和轨迹预览合并进 `deck-terminal`，`cockpit-shell-v2` 下方不再放大型编队信息、实时脉冲或轨迹卡片。
- 外部航船使用 `ship-craft-body` 结构：机鼻、左右翼、核心识别徽标、护盾环、在线点，头像只作为 38rpx 中心识别徽标。
- 1-4 艘外部航船使用固定坐标：1 艘居中偏上，2 艘左右错开，3 艘三角排布，4 艘分散到上半舷窗；所有 y 坐标限制在 42% 内。
- 轨迹预览有数据时按本舰序列采样 5-8 个点并归一到 18%-82%；无数据时使用固定 5 点空态，并显示「等待更多脉冲写入」。
- 航程控制紧贴 cockpit-shell-v2，下方主按钮为「记录脉冲 / 展开信标」，封存入口留在同一控制面板中，不再单独占用一块首屏高度。

### 验证方式

- `node --check miniprogram/pages/room/room.js` 通过。
- `node --check miniprogram/utils/mirror-sanitize.js` 通过。
- `node --check miniprogram/components/mbti-swipe-test/mbti-swipe-test.js` 通过。
- 旧词扫描无命中：`rg -n "房间|空间|舰员|转积分|积分|黑匣子|五维扫描|今日策略|预测|预知|运势|神谕|占卜|LLM|fallback|HIGH_RISK" miniprogram/pages/room miniprogram/components miniprogram/utils`。
- 动效扫描无命中：`rg -n "transition:\s*all|setInterval|requestAnimationFrame" miniprogram/pages/room miniprogram/app.wxss miniprogram/custom-tab-bar`。

### 未验证项

- 微信开发者工具编译未在 CLI 环境中执行。
- 真机首屏高度、底部 Dock 遮挡、2 人/3 人航船标签间距和轨迹点阵视觉效果仍需人工确认。

---

## 2026-06-08 — 驾驶舱上窗下台重构

### 变更原因

- 驾驶舱此前仍为三卡叠放（舷窗 + 半圆仪表卡 + 实时脉冲卡片），需要改为真正的「上方舷窗 + 下方驾驶台」一体化结构。
- 飞船标记使用旧 ship-body 球形包裹，需要改为 CSS-only 飞船剪影（三角机鼻 + 双翼条 + 护盾环）。
- 编队信息区（formation-info-bar）独立于驾驶台之外，需要整合进终端屏幕。

### 变更文件

修改：
- `miniprogram/pages/room/room.wxml` — 活跃驾驶舱区域整体重写：formation-info-bar 移除，编队码+芯片行移入 terminal-screen 内的 terminal-meta-row；formation-layer 改为 ship-field；ship-body 改为 ship-silhouette（ship-core + ship-shield-ring + ship-nose + ship-wing）；self-gauge-track 改为 gauge-arc--outer/gauge-arc--inner；terminal-core 改为 terminal-screen；terminal-header 改为 terminal-pulse-row；formation-control 改为 voyage-control-panel；bottom-danger-zone 改为 voyage-seal-zone；新增 window-corner/window-bottom-readout/terminal-trajectory-row/spark-dot。
- `miniprogram/pages/room/room.wxss` — 重写驾驶舱 CSS：删除 formation-info-bar 及其子类（约 75 行）；self-gauge-track/track-inner/ticks/tick/inner/label/value/status/stand 改为 gauge-arc/ticks/tick/title/value/link/stand；terminal-core/header/title/badges/event/events 改为 terminal-screen/pulse-row/pulse-title/pulse-badges/last-event；ship-body/body-ring/body-shield/body-core/target-label/target-name/target-pulse 改为 ship-silhouette/shield-ring/core/label/name/pulse；formation-control 改为 voyage-control-panel；bottom-danger-zone 改为 voyage-seal-zone；新增 window-corner/window-bottom-readout/deck-depth-lines/terminal-meta-row/terminal-room-code/terminal-copy-btn/terminal-chip-row/terminal-chip/terminal-trajectory-row/trajectory-sparkline/spark-dot/spark-base-line/trajectory-action/gauge-link-dot。
- `miniprogram/pages/room/room.js` — FORMATION_POSITIONS 安全区扩展（x: 18-82%, y: 18-48%）；buildCockpitView 新增 roomNo/memberCountText/modeText/stageText/linkText/transferCount/totalPulse/lastPulseText/lastPulseAmount/sparklinePoints/hasTrajectory 字段；rebuildPulseStats 新增 cockpitView 路径更新；新增 goPulseTrajectory/handleTapShip 方法。

### 实现方式

- cockpit-shell 保持 clip-path 八角切角，cockpit-window（560rpx）+ cockpit-deck（360rpx）通过 deck-lip 连接。
- self-gauge-module 内部结构简化：gauge-arc--outer/inner 直接定位在模块内，gauge-title/gauge-value/gauge-link 用 absolute 定位居中。
- terminal-screen 包含 terminal-meta-row（编队码+芯片）、terminal-pulse-row（标题+徽章）、terminal-last-event（最近流向）、terminal-trajectory-row（sparkline+操作按钮）。
- ship-silhouette 为 CSS-only 飞船形状：48rpx 圆形核心 + -8rpx 三角机鼻 + 左右翼条 + 外扩 4rpx 护盾环。
- voyage-seal-zone 底部安全间距增至 360rpx。

### 验证方式

- `node --check miniprogram/pages/room/room.js` 语法检查通过
- 旧类名扫描无命中（formation-info-bar/formation-control/bottom-danger-zone/ship-body/terminal-core 等）
- `transition: all` / `setInterval` / `requestAnimationFrame` 扫描无命中
- 所有动画均有 reduce-motion 守卫

---

## 2026-06-08 — 驾驶舱控制台二轮优化（6 项）

### 变更原因

- 控制台初版仍有「两个卡片叠在一起」的感觉：半圆仪表有独立边框和背景，与实时脉冲终端之间有明显分隔。
- 轨迹入口只有一个展开按钮，空状态下轨迹区域无信息量。
- 航船标记的呼号和脉冲值文字偏大，与 3D 球形 marker 比例不协调。

### 变更文件

修改：
- `miniprogram/pages/room/room.wxss` — 新增 .self-semi-gauge--embed 嵌入式变体（移除独立边框，背景渐变融入舷窗）；.cockpit-console margin-top 从 -80rpx 加深至 -120rpx；.console-connector 从 2rpx×20rpx 垂直线改为 40% 宽水平渐变线；.live-pulse-terminal 移除 clip-path 改用 border-radius:0 0 16rpx 16rpx，背景透明度从 0.88 降至 0.82；新增 .lp-sparkline/.lp-sparkline-dot/.lp-sparkline-baseline 样式；.ship-hud-name 从 18rpx 降至 16rpx；.ship-hud-pulse 从 20rpx 降至 18rpx；.vch-value 从 22rpx 降至 20rpx
- `miniprogram/pages/room/room.js` — rebuildPulseStats 新增 traceChartSparkline 计算：取本舰序列最后 12 点，归一化到 0-100% 垂直位置，同时计算均匀分布的水平百分比
- `miniprogram/pages/room/room.wxml` — sparkline dot 新增 left 内联样式使用 item.x 百分比定位

### 实现方式

- 嵌入式仪表：.self-semi-gauge--embed 移除独立 border-top，左右和底部保留弱描边，background 从双层渐变改为单层（从 20% 透明到 92% 深色），视觉上像从舷窗底部自然长出。
- 控制台融合：margin-top -120rpx 加深重叠，连接器改为水平渐变线（从透明到青蓝到透明），暗示仪表和终端是同一块面板的两个区域。
- 迷你轨迹：traceChartSparkline 数组每个元素包含 x（水平百分比）和 y（垂直百分比），WXML 用 inline style 定位，CSS 只提供 dot 大小和颜色。transform:translateX(-50%) 保证点居中对齐。
- 文字收紧：航船 marker 的呼号和脉冲值各减 2rpx，透明度同步降低，整体更像轻量 HUD 读数。

### 验证方式

- `node --check miniprogram/pages/room/room.js` 语法检查通过
- 禁用词扫描无命中
- `transition: all` / `setInterval` / `requestAnimationFrame` 扫描无命中

### 未验证项

- 微信开发者工具编译是否无报错
- 嵌入式仪表在不同机型上与舷窗的融合效果
- 迷你轨迹在数据点不足 2 个时是否正确隐藏
- 航船标记文字缩小后在小屏设备上的可读性

---

## 2026-06-08 — 驾驶舱控制台重构（3 项）

### 变更原因

- 驾驶舱页面需要从「悬浮 HUD 页面」转变为「飞船控制台」：舷窗上方看外部编队，舷窗下沿嵌入本舰半圆仪表，仪表下面接实时脉冲终端。
- 外部成员标记需要从「头像卡片」改为「仿 3D 圆形航船 marker」，更像舷窗外的小飞船目标。
- 实时脉冲和本舰仪表需要连成一整块终端机，不再分散为独立卡片。

### 变更文件

修改：
- `miniprogram/pages/room/room.wxml` — active 驾驶舱重构：新增 cockpit-shell 包裹层；舷窗移除 sr-hud-panel（避免 clip-path 裁切控制台）；移除 viewport-pulse-center 悬浮圆环；新增 cockpit-console（self-semi-gauge + console-connector + live-pulse-terminal）；ship-marker 改为 orbital-ship-marker（ship-orb + ship-hud-tag）；移除 ownship-bar 和独立 pulse-overview/trace-preview；角落 HUD 简化为纯数值
- `miniprogram/pages/room/room.wxss` — 新增 .cockpit-shell/.cockpit-console/.self-semi-gauge/.semi-gauge-arc/.semi-gauge-ticks/.semi-gauge-value/.console-connector/.live-pulse-terminal 样式；新增 .orbital-ship-marker/.ship-orb/.ship-orb-shadow/.ship-orb-ring/.ship-orb-core/.ship-orb-highlight/.ship-hud-tag 仿 3D 样式；viewport min-height 从 780rpx 降至 620rpx；formation-layer bottom 从 180rpx 降至 60rpx
- `miniprogram/pages/room/room.js` — deriveFormationShips 新增 orbSizeClass 字段；formatCallSign 长度限制从 8 改为 5

### 实现方式

- 驾驶舱外壳：.cockpit-shell 包裹 viewport + console，margin-bottom:24rpx。
- 舷窗：active 状态移除 sr-hud-panel（避免 clip-path 裁切溢出的控制台），直接使用 .cockpit-viewport 带 border + background。idle/connecting 保留 sr-hud-panel。
- 控制台：.cockpit-console margin-top:-80rpx 使控制台与舷窗重叠，视觉上从舷窗下沿嵌入。
- 半圆仪表：.semi-gauge-arc 280rpx×140rpx overflow:hidden 容器；.semi-gauge-track 280rpx 圆 bottom:-140rpx + clip-path:inset(0 0 50% 0) 只显示上半弧；.semi-gauge-tick 11 个静态刻度 transform-origin:center 140rpx 旋转分布。
- 正负色：.is-positive 青绿（48,209,88）、.is-negative 橙色（255,159,10），不使用红色。
- 仿 3D 航船：.ship-orb 圆形容器 + .ship-orb-shadow（径向渐变仿球面）+ .ship-orb-ring（外环）+ .ship-orb-core（头像徽标）+ .ship-orb-highlight（顶部高光）。orbSizeClass 按成员数分级：hero 84rpx / large 76rpx / normal 68rpx / compact 56rpx。
- 实时脉冲终端：.live-pulse-terminal 与 .self-semi-gauge 共用深色底、弱描边，通过 .console-connector 细线连接。
- 角落 HUD：移除 .vch-label 标签，只保留 .vch-value 数值读数，减少与下方信息区的重复。

### 验证方式

- `node --check miniprogram/pages/room/room.js` 语法检查通过
- 禁用词扫描无命中（WXML 用户可见文案无禁用词）
- `transition: all` / `setInterval` / `requestAnimationFrame` 扫描无命中
- 所有动画绑定 animationEnabled 守卫（半圆仪表为静态 CSS，无动画）
- reduce-motion 下无持续动画

### 未验证项

- 微信开发者工具编译是否无报错
- 真机上半圆仪表视觉效果（刻度对齐、数值显示）
- 仿 3D 航船 marker 在不同成员数下的视觉表现
- 控制台与舷窗重叠区域在不同机型上的渲染一致性
- 展开轨迹按钮交互是否正常

---

## 2026-06-08 — 驾驶舱视觉/交互升级（6 项）

### 变更原因

- 驾驶舱页面需要更像「太空驾驶舱」：第一人称舷窗视角、外部编队航船、本舰 HUD 仪表、启动过渡动画、实时脉冲感。
- 在不新增后端接口、不改数据库、不新增 WebSocket 事件的前提下完成视觉/交互/动效升级。

### 变更文件

修改：
- `miniprogram/pages/room/room.js` — handleStartSpace()/handleJoinSpace()/enterRoom() 增加三阶段启动过渡动画（linking→window→hud）；新增 isLaunching/launchPhase/showPulsePanel 数据字段；新增 _clearTransitionTimers()/togglePulsePanel() 方法；onHide/onUnload 清理过渡定时器
- `miniprogram/pages/room/room.wxml` — idle 页增加启动过渡层 WXML；active 页增加实时脉冲概览卡片和脉冲轨迹预览区块；舷窗增加角落 HUD 标签和第二层星点；ship-marker 改为飞船轮廓 + 小徽标结构
- `miniprogram/pages/room/room.wxss` — 激活 btnEnergy 动画；新增 secondaryGlow 呼吸动画；新增 .sr-btn:active 缩放态；新增 .launch-transition 启动过渡层样式；新增 .starfield--layer2 第二层星点；新增 .viewport-corner-hud 角落 HUD 标签；ship-marker 重写为飞船轮廓（.ship-hull/.ship-bridge/.ship-wing-l/.ship-wing-r）+ .ship-id-badge 小徽标 + .ship-link-dot 状态点；transfer-sheet 强化扫描线、数字键盘切角、显示器角标；新增 .pulse-overview 和 .trace-preview 样式
- `miniprogram/pages/room/room.json` — 注册 score-timeline 组件

### 实现方式

- 启动过渡：handleStartSpace() 设置 isLaunching:true, launchPhase:'linking'，400ms→'window'，800ms→'hud'，1100ms→执行 createRoom()。handleJoinSpace() 同理。enterRoom() 使用更短过渡（300ms→'hud'，600ms→执行）。
- 过渡定时器管理：_transitionTimers 数组 + _clearTransitionTimers()，在 onHide/onUnload 中清理。
- 按钮动效：.btn-energy 激活已有 btnEnergy keyframes（3s infinite）；.sr-btn-secondary 增加 secondaryGlow 呼吸动画（4s infinite）；.sr-btn:active scale(0.97)。
- 飞船标记：.ship-hull（40rpx×48rpx）= .ship-bridge（三角舰桥）+ .ship-wing-l/r（矩形机翼）；.ship-id-badge 32rpx 圆形小徽标；.ship-link-dot 8rpx 状态点。
- 舷窗增强：.starfield--layer2 使用 6 个不同位置的径向渐变叠加，opacity:0.6。
- 角落 HUD：.viewport-corner-hud 绝对定位四角，.vch-label 小字标签 + .vch-value 等宽数值。
- 记录面板终端化：transfer-sheet::before 改为全宽扫描线 + scanLineMove 动画；::after 增加次级弱线；.transfer-display-compact 增加 ::before/::after 角标；.transfer-key 改为 clip-path 切角。
- 脉冲概览：.pulse-overview sr-hud-panel，显示 pulseStats.transferCount/totalAmount，最近 3 条 pulseTraces。
- 脉冲轨迹：.trace-preview sr-hud-panel，可展开 score-timeline 组件（timestamps + series[0].scores，canvasHeight 300）。

### 验证方式

- `node --check miniprogram/pages/room/room.js` 语法检查通过
- 禁用词扫描无命中
- `transition: all` / `setInterval` / `requestAnimationFrame` 扫描无命中
- 所有动画绑定 animationEnabled 守卫
- 所有 timer 在 onHide/onUnload 中清理

### 未验证项

- 微信开发者工具编译是否无报错
- 真机启动过渡动画流畅度
- score-timeline 组件在驾驶舱中的渲染效果

---

## 2026-06-08 — 驾驶舱页面视频复盘修复（10 项）

### 变更原因

- 视频复盘发现驾驶舱页面存在 10 项 UI/交互问题：航船标记被裁切、底部 Dock 遮挡控制区、编队信息区拥挤、记录面板用词过时、封存后仍可打开记录面板、错误提示通用化、Toast 被遮挡、状态标题不清晰、危险按钮风格不符、动效/性能待验证。

### 变更文件

修改：
- `miniprogram/pages/room/room.js` — FORMATION_POSITIONS 安全区调整、新增 clampFormationPosition()、buildCockpitView() 状态副标题、新增 canRecordPulse() 预校验、新增 normalizeRoomActionError() 错误映射、openTransferPad() 增加状态守卫、submitTransfer() 错误处理改用终端文案、createRoom()/copyRoomNo() 改用页面顶部 Toast
- `miniprogram/pages/room/room.wxml` — 状态栏新增 statusSubtitle 显示、编队信息区改为两行 HUD 布局、记录面板文案更新（记录脉冲/确认记录/清空）、发送方信息改为接收方
- `miniprogram/pages/room/room.wxss` — cockpit-page 和 room-page 底部间距增至 320rpx、formation-info-bar 改为两行布局 CSS、transfer-sheet 改为终端浮动记录器风格（bottom: calc(140rpx + env(safe-area-inset-bottom)), max-height: 62vh）、新增 status-bar__sub 样式、sr-btn-danger-outline 改为透明底、bottom-danger-zone 底部间距增至 180rpx

### 实现方式

- 舷窗航船标记：FORMATION_POSITIONS y 值下限从 14 提升至 20，新增 clampFormationPosition() 函数在 deriveFormationShips() 中对坐标做边界限制。
- 编队信息区：从单行 4 列网格改为两行结构——第一行编队码 + 水平复制按钮，第二行 4 列 HUD 读数（成员/模式/阶段/链路），使用 formation-info-code-row 和 formation-info-hud-row 类名。
- 记录面板：transfer-sheet 底部从 bottom:0 改为 bottom:calc(140rpx + env(safe-area-inset-bottom))，max-height:62vh，背景改为 rgba(6,10,18,0.96)，描边改为青蓝，新增顶部弱扫描线伪元素。
- 状态守卫：canRecordPulse(targetUserId) 检查编队是否存在、是否已封存、目标是否有效，返回 {ok, reason}；openTransferPad() 调用守卫后决定是否打开面板。
- 错误映射：normalizeRoomActionError(err) 将后端错误码映射为终端风格中文文案（编队链路已断开/目标航船不在编队中/航程已封存 等）。
- Toast 系统：createRoom() 和 copyRoomNo() 从 wx.showToast 改为 this.showToast()，使用页面顶部自定义 Toast 避免被视口遮挡。
- 状态副标题：buildCockpitView() 计算 externalShips 后，在编队态附加 statusSubtitle = `${externalShips.length} 艘航船在线`。
- 危险按钮：sr-btn-danger-outline background 从 rgba(255,69,58,0.035) 改为 transparent；bottom-danger-zone padding-bottom 增至 calc(180rpx + env(safe-area-inset-bottom))。

### 验证方式

- `node --check miniprogram/pages/room/room.js` 语法检查通过
- 禁用词扫描（转积分/房间/空间/舰员/黑匣子/五维扫描/人格测试/行为画像/预测/预知/运势/神谕 等）无命中
- `transition: all` 扫描无命中
- `setInterval` / `requestAnimationFrame` 扫描无命中
- 动画函数（playPulseFlightAnimation、playScoreRollAnimation）均有 animationEnabled 守卫
- 所有 timer 在 onUnload/onHide 中清理

### 未验证项

- 微信开发者工具编译是否无报错
- 真机航船标记是否完全不被裁切
- 脉冲记录面板在不同机型上底部是否完整显示
- 状态副标题在小屏机型上是否换行

---

## 2026-06-08 — 识别舱呼号校准弹窗优化

### 变更原因

- 呼号校准弹窗为底部抽屉样式，缺少识别舱飞船科技终端感。
- 输入框使用 `type="nickname"` 触发微信白色系统昵称建议条，破坏黑底蓝光世界观。
- 弹窗底部被自定义 TabBar 区域遮挡，视觉拥挤。

### 变更文件

修改：
- `miniprogram/pages/profile/profile.wxml` — 底部抽屉改为居中悬浮 overlay 终端面板，输入框 `type="nickname"` 改为 `type="text"`，移除 `focus` 自动聚焦，新增键盘高度 `bindkeyboardheightchange`，按钮文案改为「写入呼号」
- `miniprogram/pages/profile/profile.wxss` — 旧 `.drawer-mask` / `.nickname-drawer` 样式替换为 `.callsign-overlay` / `.callsign-float` 居中悬浮面板样式，新增 `.is-keyboard` 键盘弹出位移，reduce-motion 规则同步更新
- `miniprogram/pages/profile/profile.js` — 新增 `callsignKeyboardHeight` data 字段、`noop()` 空函数、`onCallsignKeyboardHeightChange` 键盘高度监听，`closeNicknameDrawer` 清理键盘状态，`onHide` 关闭弹窗，成功 HUD 文案改为「本舰呼号已同步」

### 实现方式

- 弹窗从 `position: fixed; bottom: 0` 改为 `position: fixed; inset: 0` + flex 居中，面板悬浮在屏幕中央。
- 面板使用深黑蓝半透明背景 + 青蓝细描边，保持终端风格。
- 输入框改为 `type="text"` 避免触发微信原生昵称建议条；移除 `focus` 属性避免弹窗打开时自动弹出系统键盘建议。
- 键盘弹出时通过 `transform: translateY(-120rpx)` 上移面板，确保输入框和按钮不被键盘遮挡。
- overlay z-index 1000 高于 custom-tab-bar（z-index 999），弹窗居中不贴底，不存在 TabBar 遮挡问题。

### 验证方式

- `node --check` 语法检查通过
- 旧词扫描（保存昵称/修改昵称/昵称已保存/用户名/舰员代号/头盔识别）无命中
- `transition: all` 扫描无命中
- `setInterval` / `requestAnimationFrame` 扫描无命中

### 未验证项

- 微信开发者工具编译是否无报错
- 真机键盘弹出后面板位移是否合适
- 微信昵称建议条是否完全不触发（`type="text"` 理论上不触发，需真机确认）

---

## 2026-06-08 — 全息舱信息架构精简与底部按钮修复

### 变更原因

- 全息舱顶部仍有「全息舱」标题和「HOLO BAY」英文 kicker，应精简为仅状态指示。
- 状态摘要中航迹样本显示「/ 3」后缀冗余；协议一致率使用 `personaConfidence`（返回 0%）而分析区使用 `personaMatch.matchPercentage`（返回 100%），数据源不一致。
- 「协议状态」卡片（协议编号、来源、状态）为不重要数据，应删除。
- 协议分析折叠入口显示的一致率和偏移百分比与全息图下方重复，且一致率数据源不同。
- 协议分析应为独立卡片，放在航迹档案下方。
- 重新校准和修改协议流程中底部按钮被导航栏遮挡。

### 变更文件

修改：
- `miniprogram/pages/mirror/index.wxml` — 移除 bay-title-row（标题+kicker）；hero-summary 改用 `personaMatch.matchPercentage`（绿色）和 `battlePersona.sampleSize`（橙色，无 / 3）；移除协议状态卡；协议分析改为航迹档案下方独立 sr-card；analysis-toggle 移除摘要行
- `miniprogram/pages/mirror/index.wxss` — 新增 `.summary-val--match`（绿色）和 `.summary-val--sample`（橙色）；`.mirror-analysis` 改为 `.analysis-card`；`.analysis-toggle` 移除 border-bottom；新增 `.analysis-section`/`.analysis-section-header`/`.analysis-section-title`/`.analysis-section-kicker` 样式；移除 `.analysis-toggle-summary`
- `miniprogram/pages/mirror/index.js` — `baySubtitle` 从 '全息舱在线' 改为 '已接入'，默认值从 '接入人格协议以启动镜像' 改为 '等待接入'
- `miniprogram/components/mbti-swipe-test/mbti-swipe-test.wxss` — `.swipe-overlay` 从 `position: fixed; inset: 0` 改为 `position: relative; width: 100%; height: 100%`
- `miniprogram/components/mbti-picker-modal/mbti-picker-modal.wxml` — 确认按钮从滚动区移至固定 `.apply-dock`
- `miniprogram/components/mbti-picker-modal/mbti-picker-modal.wxss` — `.picker-body` padding-bottom 从 `calc(200rpx + env(safe-area-inset-bottom))` 改为 `32rpx`；新增 `.apply-dock` 样式
- `CHANGELOG.md` — 记录修复项

### 实现方式

- 不新增后端接口、Redis/MySQL 读写或 WebSocket 事件。
- 不新增 timer / interval / requestAnimationFrame。
- 协议一致率改用 `personaMatch.matchPercentage` 替代 `personaConfidence`，统一数据源。
- 重新校准流程：swipe-overlay 改为 `position: relative`，在 calibration-shell 的 flex 布局中自然填充 cal-test-wrap（flex: 1），swipe-actions 的 safe-area padding 保证按钮可见。
- 修改协议流程：确认按钮移至 `.apply-dock`（picker-overlay 底部），使用 `calc(24rpx + env(safe-area-inset-bottom))` 避开 Home Indicator。
- Canvas 海报绘制中的 'HOLO BAY' 标识保留（海报独立排版）。
- `transition: all` 未使用；reduce-motion 兜底保留。

### 验证方式

- `node --check miniprogram/pages/mirror/index.js` 通过
- `node --check miniprogram/components/mbti-swipe-test/mbti-swipe-test.js` 通过
- `node --check miniprogram/components/mbti-picker-modal/mbti-picker-modal.js` 通过
- grep 扫描确认 WXML 中无 `personaConfidence`、`/ 3`、`全息舱在线`、`HOLO BAY`（海报除外）
- grep 扫描确认无 `transition: all`、`setInterval`、`requestAnimationFrame`

### 未验证项

- 微信开发者工具编译和真机运行未在 CLI 环境中完成，需人工验收。
- 重新校准底部操作按钮与 Home Indicator 的精确间距需真机确认。
- 修改协议确认按钮与自定义 tabbar 的精确间距需真机确认。
- 协议一致率百分比数值准确性需与后端确认。

---

## 2026-06-08 — 驾驶舱 HUD 沉浸感与状态切换优化

### 变更原因

- 左上角「驾驶舱」标题与身份页「识别舱已接入 + 在线亮点」风格不统一。
- 待机态和编队态 HUD 框视觉割裂，创建编队后缺少平滑过渡。
- 本舰脉冲圆环占据舷窗中心，挤压外部航船显示空间。
- 编队码/成员数/模式/阶段塞在 HUD 内，舷窗过于拥挤。
- 驾驶舱出现「航迹档案」块，不属于当前编队职责。
- 转积分输入面板太小，按钮可能被底部导航遮挡。
- 新成员加入时无头像/识别徽标显示和接入动画。

### 变更文件

修改：
- `miniprogram/pages/room/room.js` — `FORMATION_POSITIONS` 改为上半区分布；新增 `connecting` 状态；`buildCockpitView` 新增 `statusDot`/`isConnecting`；`handleStartSpace`/`handleJoinSpace`/`enterRoom` 使用 connecting 过渡；`deriveFormationShips` 新增 `isNew`；新增 `_markNewShips` 方法；MEMBER_JOIN WS 处理中标记新航船动画
- `miniprogram/pages/room/room.wxml` — Header 改为 `status-bar` 结构（● 驾驶舱已接入）；新增 connecting 状态舷窗；active 态 HUD 内移除编队码/成员数/模式/阶段，新增 `formation-info-bar` 集中信息区；脉冲圆环标记保留在 HUD 内但 CSS 下移；移除 `trace-dock` 航迹档案入口；航程控制按钮从 3 列改为 2 列
- `miniprogram/pages/room/room.wxss` — 新增 `.status-bar`/`.status-bar__dot`/`.status-bar__label` 匹配身份页样式；`.cockpit-viewport` min-height 从 680rpx 增至 780rpx；新增 `.cockpit-viewport--connecting`；`.viewport-pulse-center` top 从 50% 改为 66%；新增 `.formation-info-bar`/`.formation-info-row`/`.formation-info-item` 样式；`.transfer-sheet` min-height 增至 50vh，z-index 增至 998，padding-bottom 增大；`.transfer-key` height 从 48rpx 增至 64rpx；新增 `.ship-marker--new` 接入动画（0.45s）；`.control-actions` 改为 2 列；`.room-page` padding-bottom 改为 `calc(240rpx + env(safe-area-inset-bottom))`

### 验证方式

- `node --check miniprogram/pages/room/room.js` 通过
- `grep -R "创建房间|加入房间|房间号|舰员|舰员席位|舰员接入|黑匣子" miniprogram/pages/room` 无匹配
- `grep -R "transition: all" miniprogram/pages/room miniprogram/app.wxss` 无匹配
- `grep -R "setInterval|requestAnimationFrame" miniprogram/pages/room` 无匹配

### 未验证项

- 微信开发者工具编译和真机渲染未执行
- 2 人 / 3 人编队下外部航船是否不重叠
- 小屏幕设备转积分面板完整可见性
- reduce-motion 下接入动画是否正确静默
- connecting → active 过渡的视觉流畅度

---

## 2026-06-08 — 修改协议流程精简与底部安全区修复

### 变更原因

- 修改协议（mbti-picker-modal）页面标题仍为「协议快速接入」并带有英文 kicker「QUICK SYNC」，应简化为「修改协议」。
- 维度选择区标题为「人格矩阵」，应改为「协议维度」以贴合世界观。
- 确认按钮默认文案为「写入人格协议」，应改为「确认接入」。
- 退出确认弹窗文案为「退出校准 / 当前人格协议尚未同步」，应改为「退出修改 / 当前协议修改尚未写入」。
- `.picker-body` 底部 padding 仅 120rpx，未考虑自定义底部导航（140rpx + safe-area）和 Home Indicator，确认按钮可能被遮挡。

### 变更文件

修改：
- `miniprogram/components/mbti-picker-modal/mbti-picker-modal.wxml` — 移除头部英文 kicker，标题改为「修改协议」，hint 精简，维度区标题改为「协议维度」，移除 MATRIX/SELECTION kicker，确认按钮改为「确认接入」，退出弹窗文案更新
- `miniprogram/components/mbti-picker-modal/mbti-picker-modal.wxss` — `.picker-body` padding-bottom 从 120rpx 改为 `calc(200rpx + env(safe-area-inset-bottom))`，CSS 注释更新
- `CHANGELOG.md` — 记录修复项
- `docs/DEVELOPMENT_LOG.md` — 本条记录

### 实现方式

- 不新增后端接口、Redis/MySQL 读写或 WebSocket 事件。
- 不新增 timer / interval / requestAnimationFrame。
- picker-overlay z-index 保持 1000（高于 tabbar 999，低于 calibration-shell 1001 和 terminal-popup 9999）。
- `.picker-body` padding-bottom `calc(200rpx + env(safe-area-inset-bottom))` 确保确认按钮在滚动底部时高于自定义 tabbar + Home Indicator。
- 保留 `/mirror/mbti/direct` API 调用和 4 维度选择逻辑不变。
- 保留退出确认弹窗（dirty 检测）逻辑不变。
- `transition: all` 未使用；reduce-motion 兜底保留。

### 验证方式

- `node --check miniprogram/components/mbti-picker-modal/mbti-picker-modal.js` 通过
- grep 扫描确认无旧词残留（QUICK SYNC / 协议快速接入 / 写入人格协议 / 人格矩阵 / 退出校准）
- grep 扫描确认无 `transition: all`、`setInterval`、`requestAnimationFrame`

### 未验证项

- 微信开发者工具编译和真机运行未在 CLI 环境中完成，需人工验收。
- 确认按钮与自定义 tabbar 的精确间距需真机确认。
- 退出确认弹窗在刘海屏上的完整显示需真机确认。

---

## 2026-06-08 — 协议校准流程层级修复与文案收敛

### 变更原因

- 校准面板（calibration-shell）z-index 为 500，低于自定义底部导航（z-index: 999），提交面板被底部导航遮挡。
- mbti-swipe-test 底部操作按钮（不符合/跳过/符合）缺少安全区 padding，被 Home Indicator 遮挡。
- 校准流程副标题仍为「协议同步中」，应为「协议校准」。
- 提交成功 Toast 为「协议已同步」，应为「校准已完成」。
- 提交失败文案为「协议写入失败，请重试」，应为「校准失败，请稍后重试」。

### 变更文件

修改：
- `miniprogram/pages/mirror/index.wxss` — calibration-shell z-index 从 500 提升至 1001
- `miniprogram/pages/mirror/index.js` — handleMbtiComplete toast 改为「校准已完成」，错误文案改为「校准失败，请稍后重试」
- `miniprogram/components/mbti-swipe-test/mbti-swipe-test.wxml` — 副标题从「协议同步中」改为「协议校准」
- `miniprogram/components/mbti-swipe-test/mbti-swipe-test.wxss` — swipe-actions padding 增加 env(safe-area-inset-bottom)
- `CHANGELOG.md` — 记录修复项

### 实现方式

- 不新增后端接口、Redis/MySQL 读写或 WebSocket 事件。
- 不新增 timer / interval / requestAnimationFrame。
- calibration-shell z-index 1001 高于 tab-bar 999，swipe-overlay z-index 1000 在 shell 内部创建的层叠上下文中仍可见。
- terminal-popup z-index 9999 高于 shell，退出确认弹窗正确显示。
- mbti-swipe-test 组件保留现有滑动答题交互和动画逻辑。
- 保留 `/mirror/mbti/test` API 调用和 20 题答案收集逻辑。
- reduce-motion 兜底已存在于组件中（动画禁用、过渡禁用）。

### 验证方式

- `node --check miniprogram/pages/mirror/index.js` 通过
- `node --check miniprogram/components/mbti-swipe-test/mbti-swipe-test.js` 通过
- grep 扫描确认无旧词残留（人格测试/测试完成/MBTI 测试/退出测试/提交测试）
- grep 扫描确认无 `transition: all`、`setInterval`、`requestAnimationFrame`

### 未验证项

- 微信开发者工具编译和真机运行未在 CLI 环境中完成，需人工验收。
- 校准面板与底部导航的精确间距需真机确认。
- 底部操作按钮与 Home Indicator 的间距需真机确认。
- 退出确认弹窗在刘海屏上的完整显示需真机确认。

---

## 2026-06-08 — 全息舱星图式全息图与信息层级优化

### 变更原因

- 全息扫描图仍为五角星雷达风格，与世界观中「星图式全息图」定位不符。
- 核心标签（信号标签）藏在协议分析折叠内，需要额外点击才能看到。
- 顶部缺少状态点指示器，与驾驶舱/导航舱/识别舱风格不一致。
- 协议分析折叠入口只显示标题和展开按钮，缺少内容摘要。

### 变更文件

修改：
- `miniprogram/components/radar-chart/radar-chart.js` — `_drawGrid` 替换为 `_drawOrbitalRings`（同心圆轨道），新增 `_drawStarPoints`（散射星点），`_drawLockedStatic`/`_drawLockedAnimated`/`_drawFull` 去掉五角星连线、轴线和填充多边形，改为轨道节点+弧线连接+中心投影点
- `miniprogram/pages/mirror/index.wxml` — bay-header 新增状态点行，核心标签移至全息图下方，协议分析 toggle 新增摘要行
- `miniprogram/pages/mirror/index.wxss` — 新增 bay-status-dot/styles-signal/styles-analysis-summary 样式
- `CHANGELOG.md` — 记录修复项

### 实现方式

- 不新增后端接口、Redis/MySQL 读写或 WebSocket 事件。
- 不新增 timer / interval / requestAnimationFrame。
- radar-chart 组件继续使用 canvas.requestAnimationFrame，detached 时正确取消。
- 全息图绘制改为：2-3 层同心弱轨道圈 + 散射星点 + 轨道节点 + 相邻节点弧线连接 + 中心投影点。
- 状态点使用 CSS 动画（1.5s 脉冲），reduce-motion 下禁用。
- 核心标签复用 personaSignals 数据，展示在全息图下方、状态摘要上方。
- 协议分析折叠入口使用 personaMatch 数据展示一致率和偏移百分比摘要。

### 验证方式

- `node --check miniprogram/pages/mirror/index.js` 通过
- `node --check miniprogram/components/radar-chart/radar-chart.js` 通过
- grep 扫描确认无旧词残留
- grep 扫描确认无 `transition: all`、`setInterval`、`requestAnimationFrame`

### 未验证项

- 微信开发者工具编译和真机运行未在 CLI 环境中完成，需人工验收。
- 星图式全息图的视觉效果需真机确认轨道圈、星点和弧线的比例和间距。
- 核心标签在数据不足时的空态展示需真机确认。
- 状态点指示器在同步中的脉冲效果需真机确认。

---

## 2026-06-08 — 驾驶舱视觉层级与转积分面板重构

### 变更原因

- 用户反馈：舷窗外部航船使用几何轮廓不够直观，希望改为真实头像。
- 2 人和 3 人编队场景下航船 marker 位置重叠，需要分散到角落/边缘。
- 驾驶舱存在大量英文 kicker 文字（COCKPIT ONLINE、FORWARD VIEW 等），与舰载终端世界观不符。
- 转积分面板显示接收方信息冗余，且数字键盘和确认按钮不在同一视野内。

### 变更文件

修改：
- `miniprogram/pages/room/room.js` — `FORMATION_POSITIONS` 改为角落分布；`buildCockpitView()` 移除 kicker 字段；`deriveFormationShips()` 新增 `avatarUrl`/`avatarChar`
- `miniprogram/pages/room/room.wxml` — 移除 header-kicker、FORWARD VIEW、FORMATION CORE、ACCESS CODE 等英文元素；外部航船 marker 改为头像环结构；新增居中 `viewport-pulse-center`；转积分面板重构为紧凑布局（仅发送方 + 并排数字键盘/确认）
- `miniprogram/pages/room/room.wxss` — `.formation-layer` inset 调整；移除旧航船轮廓样式（ship-beam/ship-glyph/ship-label 等）；新增 `.ship-avatar-ring`/`.ship-avatar-img`/`.ship-status-dot`；新增 `.viewport-pulse-center`/`.vpulse-ring` 居中脉冲环；转积分面板样式重写
- `docs/DEVELOPMENT_LOG.md` — 本条记录
- `CHANGELOG.md` — 记录用户可感知变化

### 验证方式

- `node --check miniprogram/pages/room/room.js`
- `rg -n "COCKPIT ONLINE|FORWARD VIEW|FORMATION CORE|ACCESS CODE|FLOW SHIFT|FLOW PRESET" miniprogram/pages/room` — 确认英文 kicker 已移除
- `rg -n "kicker" miniprogram/pages/room` — 确认无 kicker 引用残留

### 未验证项

- 微信开发者工具和真机渲染：2 人 / 3 人编队下头像 marker 是否不重叠
- 小屏幕设备上转积分数字键盘和确认按钮是否完整可见
- `reduce-motion` 下脉冲环动画是否正确静默

---

## 2026-06-08 — 驾驶舱外部航船可读性调整

### 变更原因

- 真机截图反馈：舷窗中其他玩家的航船标记过小，呼号和脉冲读数不够清晰。

### 变更文件

修改：
- `miniprogram/pages/room/room.js` — 根据外部航船数量生成 `hero / large / normal` 尺寸档位
- `miniprogram/pages/room/room.wxml` — 航船 marker 改为更清晰的呼号卡标结构
- `miniprogram/pages/room/room.wxss` — 放大少人编队下的航船轮廓、呼号、脉冲读数和可点击区域
- `docs/DEVELOPMENT_LOG.md` — 本条记录
- `CHANGELOG.md` — 记录用户可感知变化
- `PLAN.md` — 更新验收进度

### 验证方式

- `node --check miniprogram/pages/room/room.js`
- `rg -n "transition:\\s*all" miniprogram/pages/room miniprogram/app.wxss miniprogram/custom-tab-bar`
- `rg -n "房间|创建房间|加入房间|舰员|黑匣子|五维扫描" miniprogram/pages/room`
- `rg -n "setInterval|requestAnimationFrame" miniprogram/pages/room`

### 未验证项

- 微信开发者工具和真机渲染尚未执行，需要人工确认不同编队人数下 marker 是否仍不遮挡 HUD。

---

## 2026-06-08 — 识别舱底部安全区修复与信息架构收敛

### 变更原因

- 识别舱页面 `padding-bottom` 仅 `32rpx + safe-area`，远不足以覆盖自定义底部导航（约 140rpx + safe-area），导致「断开终端」按钮被 TabBar 遮挡。
- 识别舱「本舰状态」区块标题偏数据分析，应改为「授权状态」以贴合识别舱定位。
- 「断开终端」缺少「终端控制 / TERMINAL CONTROL」区块标题，与其他模块风格不一致。
- 代码注释中仍有「舰员铭牌」「舰员代号」等旧词残留。
- 登录页底部信息区域（BUILD 1.0.0 / PULSE TERMINAL）使用 `bottom: 60rpx` 绝对定位，未考虑 Home Indicator 安全区。

### 变更文件

修改：
- `miniprogram/pages/profile/profile.wxml` — 注释更新（舰员铭牌→本舰档案、舰员代号校准→本舰呼号校准）；「本舰状态」改为「授权状态 / IDENTITY STATUS」；断开终端包裹「终端控制 / TERMINAL CONTROL」区块；章节编号统一
- `miniprogram/pages/profile/profile.wxss` — 根容器 `padding-bottom` 从 `32rpx` 增至 `200rpx`（+ safe-area）；注释更新；新增 `.terminal-control` 样式
- `miniprogram/pages/profile/profile.js` — 注释更新（舰员代号→本舰呼号、退出登录→断开终端）
- `miniprogram/pages/login/login.wxss` — `.bottom-info` 的 `bottom` 从 `60rpx` 改为 `calc(60rpx + env(safe-area-inset-bottom))`
- `CHANGELOG.md` — 记录修复项
- `docs/DEVELOPMENT_LOG.md` — 本条记录

### 实现方式

- 不新增后端接口、Redis/MySQL 读写或 WebSocket 事件。
- 不新增 timer / interval / requestAnimationFrame。
- `terminal-page` 的 `padding-bottom: calc(200rpx + env(safe-area-inset-bottom))` 确保内容底部高于自定义 tabbar（140rpx + safe-area + 装饰线）。
- `terminal-control` 使用 `position: relative; z-index: 1` 流式布局，不使用 fixed/sticky，避免与 tabbar 层叠冲突。
- 登录页 `.bottom-info` 使用 `calc(60rpx + env(safe-area-inset-bottom))` 避开 Home Indicator。
- `transition: all` 未使用；reduce-motion 兜底保留。

### 验证方式

- `node --check miniprogram/pages/profile/profile.js` 通过
- `node --check miniprogram/pages/login/login.js` 通过
- grep 扫描确认无旧词残留（舰员档案/舰员代号/头盔识别/数据矩阵/退出登录/个人中心/船坞/船籍舱/档案舱）
- grep 扫描确认无 `transition: all`、`setInterval`、`requestAnimationFrame`

### 未验证项

- 微信开发者工具编译和真机运行未在 CLI 环境中完成，需人工验收。
- 断开终端按钮与自定义 tabbar 的精确间距需真机确认。
- 登录页底部信息在刘海屏上的精确位置需真机确认。

---

## 2026-06-08 — 全息舱信息架构重排与底部安全区修复

### 变更原因

- 全息舱页面内容从全息扫描、协议状态、系统判读、信号标签、协议偏移、协议演化到航迹档案一路堆叠，阅读压力大。
- 「重新校准」「修改协议」按钮位于协议状态卡底部，被自定义底部导航（z-index: 999, 140rpx + safe-area）遮挡。
- 「生成镜像图片」入口缺失或被底部遮挡。
- 页面标题仍为「全息观测舱」，应为「全息舱」。
- 校准流程标题为「镜像舱」，应为「协议校准」。

### 变更文件

修改：
- `miniprogram/pages/mirror/index.json` — navigationBarTitleText 改为「全息舱」
- `miniprogram/pages/mirror/index.wxml` — 信息架构重排为四层（全息总览/协议行动/协议分析/航迹档案），协议分析默认折叠，操作栏移至 tabbar 上方
- `miniprogram/pages/mirror/index.wxss` — 新增 `.mirror-action-dock`（fixed, bottom: 140rpx + safe-area, z-index: 900），根容器 padding-bottom 增至 308rpx + safe-area，新增 `.analysis-toggle` 和 `.analysis-body` 折叠样式
- `miniprogram/pages/mirror/index.js` — 新增 `analysisExpanded` 数据和 `toggleAnalysis` 方法，更新 baySubtitle/Canvas/toast 文案
- `miniprogram/utils/mirror-sanitize.js` — 新增 7 条替换规则（五维图谱/人格测试/行为画像/预测/预知/运势/神谕）
- `CHANGELOG.md` — 记录用户可感知变化
- `docs/PRODUCT_LANGUAGE.md` — 更新全息舱职责描述
- `docs/UI_GUIDELINES.md` — 新增全息舱信息层级和操作栏规范
- `docs/CONTENT_SAFETY.md` — 新增镜像页运行时禁词
- `docs/ACCEPTANCE_CHECKLIST.md` — 更新镜像页验收清单
- `docs/DEVELOPMENT_LOG.md` — 本条记录

### 实现方式

- 不新增后端接口、Redis/MySQL 读写或 WebSocket 事件。
- 不新增 timer / interval / requestAnimationFrame。
- 操作栏使用 `position: fixed; bottom: calc(140rpx + env(safe-area-inset-bottom)); z-index: 900`，位于自定义 tabbar（z-index: 999）正上方。
- 根容器 `padding-bottom: calc(env(safe-area-inset-bottom) + 308rpx)` = 148rpx（tabbar）+ 12rpx（gap）+ 112rpx（dock）+ 32rpx（安全空白）。
- 协议分析区使用 `wx:if="{{analysisExpanded}}"` 折叠，不依赖 CSS max-height 动画。
- 校准 shell padding-bottom 增加 `env(safe-area-inset-bottom)`。
- 预览弹窗新增「关闭预览」按钮。
- Canvas 海报标识更新为「HOLO BAY」。
- `transition: all` 未使用；reduce-motion 兜底保留。

### 验证方式

- `node --check miniprogram/pages/mirror/index.js` 通过
- grep 扫描确认无旧词残留（全息观测舱/黑匣子/五维扫描/五维投影/雷达图/人格测试/预测/预知/运势/神谕）
- grep 扫描确认无 `transition: all`、`setInterval`、`requestAnimationFrame`

### 未验证项

- 微信开发者工具编译和真机运行未在 CLI 环境中完成，需人工验收。
- 底部操作栏与自定义 tabbar 的精确间距需真机确认。
- Canvas 海报生成需真机验证头像加载和图片保存。

### 变更原因

- 编队页仍偏房间管理、成员卡片和数据面板，首屏没有形成「本舰驾驶舱透过舷窗观察外部编队」的体验。
- 最新设定要求每个用户是一架个人航船，多人任务是任务编队，驾驶舱主视觉应展示外部航船和 HUD 仪表，而不是自己的头像大卡片。

### 变更文件

修改：
- `miniprogram/pages/room/room.js` — 新增 `cockpitView` 派生数据、固定编队坐标、外部航船投影和记录入口；同步 WS 成员更新到 HUD
- `miniprogram/pages/room/room.wxml` — 重构 Header、待机舷窗、进行中舷窗、HUD 仪表组、航程控制和轻量航迹入口
- `miniprogram/pages/room/room.wxss` — 新增深空舷窗、静态星点、HUD 网格、航船 marker、本舰脉冲仪表和控制台样式
- `CHANGELOG.md` — 记录用户可感知的驾驶舱重构
- `docs/PRODUCT_LANGUAGE.md` — 补充个人航船、任务编队、第一人称驾驶舱和外部航船表达
- `docs/UI_GUIDELINES.md` — 补充驾驶舱舷窗、航船 marker、HUD 仪表和禁止头像大卡片规则
- `docs/ACCEPTANCE_CHECKLIST.md` — 更新编队页验收口径
- `docs/DEVELOPMENT_LOG.md` — 本条记录
- `PLAN.md` — 更新当前任务进度

### 实现方式

- 不新增后端接口、Redis/MySQL 读写或 WebSocket 事件；所有驾驶舱数据来自现有 `currentRoom`、`memberGrid`、`ranking` 和在线状态。
- `externalShips` 由成员列表排除本舰后生成，坐标使用固定数组，最多展示 15 艘外部航船。
- 本舰呼号、本舰脉冲、角色和链路状态以 HUD 小块展示，不再作为主视觉头像卡片。
- 编队码、成员数、记录模式、航程阶段和链路状态移动到舷窗 HUD 读数。
- 航迹档案观测降级为轻量入口，引导进入全息舱查看航迹映射，驾驶舱不再展开历史总览和图表。
- 新增视觉全部使用静态 CSS 背景、线框和短过渡，不新增 `setInterval`、`requestAnimationFrame` 或 Canvas 动画。

### 验证方式

- `node --check miniprogram/pages/room/room.js`
- `rg -n "transition:\\s*all" miniprogram/pages/room miniprogram/app.wxss miniprogram/custom-tab-bar`
- `rg -n "setInterval|requestAnimationFrame" miniprogram/pages/room`
- `rg -n "房间|创建房间|加入房间|舰员|黑匣子|五维扫描" miniprogram/pages/room`

### 未验证项

- 微信开发者工具编译和真机渲染尚未执行。
- 需要在微信开发者工具中人工确认舷窗航船 marker 的层级、底部自定义 TabBar 安全区、信标弹层和本局录入弹窗显示。

---

## 2026-06-08 — 指令页（导航舱）文案收敛与世界观重构

### 变更原因

指令页仍残留「策略 / 点火 / 航行核心 / 舰载指令」等旧体系表达，需要全面收敛为「指令 / 导航舱 / 导航计算 / 今日指令」世界观。同时生成中存在长黑场问题，需要改善等待体验。

### 变更文件

修改：
- `miniprogram/pages/fortune/fortune.wxml` — 页面标题、按钮、结果区、弹窗、海报标识等文案全面替换
- `miniprogram/pages/fortune/fortune.js` — sanitize 映射扩展、日志文案、长等待文案、海报绘制文案、错误信息更新
- `CHANGELOG.md` — 记录用户可感知变化
- `docs/DEVELOPMENT_LOG.md` — 本条记录
- `docs/PRODUCT_LANGUAGE.md` — 术语表和页面推荐表达更新
- `docs/UI_GUIDELINES.md` — 导航舱视觉规范补充
- `docs/CONTENT_SAFETY.md` — 指令页禁词和映射更新
- `docs/ACCEPTANCE_CHECKLIST.md` — 验收项更新

### 实现方式

WXML：
- 页面标题「导航核心」→「导航舱」，英文 kicker「DECK ONLINE」→「NAV BAY ONLINE」
- 重置状态条「导航核心待机 · 点击计算」→「导航舱待机 · 点击开始计算」
- 主按钮 kicker「PRESS TO IGNITE」→「PRESS TO CALC」
- 底部状态「成员协议」→「航迹协议」
- 结果区「舰载指令」→「今日指令」
- 操作按钮「生成指令图」→「生成指令卡」，kicker「REIGNITE」→「RECALCULATE」
- 弹窗副标题「REIGNITE NAV CORE」→「RECALCULATE DIRECTIVE」
- 弹窗正文精简为「当前指令投影将被收起。确认后返回导航待机，由你重新开始导航计算。」
- 底部说明「接入成员协议与航迹样本」→「接入航迹协议与航迹样本」

JS：
- CALC_LOG_LINES「成员协议已同步」→「航迹协议已同步」
- HEARTBEAT_LINES「链路保持中」→「导航核心校准中」
- 长等待文案「主引擎链路保持中」→「导航核心校准中」，「指令投影仍在校准」→「指令投影校准中」，「备用指令准备中」→「备用导航准备中」
- 错误信息「连接中断」→「导航链路中断」，「导航核心响应超时」→「导航计算响应超时」
- 倒计时「可校准」→「可计算」
- 海报绘制「舰载指令」→「今日指令」，「NAV CORE」→「NAV BAY」，「SMART RECORD · NAV CORE」→「SMART RECORD · NAV BAY」
- sanitize 映射新增：今日策略→今日指令、生成策略→生成今日指令、策略卡→指令卡、策略→指令、黑匣子样本→航迹样本、黑匣子→航迹档案、重新点火→重新计算、点火航行核心→开始导航计算、预知→校准、神谕→指令、占卜→推演、算命→推演、校准者→今日指令

### 验证方式

- `node --check miniprogram/pages/fortune/fortune.js` 语法检查通过
- `grep` 确认 WXML 模板文本无旧词残留
- 确认无 `transition: all`
- 确认无新增 `setInterval` / `requestAnimationFrame`

### 未验证项

- 微信开发者工具编译和真机运行需要人工验证
- 海报 Canvas 绘制效果需要真机验证
- 生成中等待体验改善效果需要真机验证

---

## 2026-06-08 — 识别舱/全息舱信息架构调整

### 摘要

- 识别舱职责收敛：移除「数据矩阵」和「航迹档案摘要」，不再承担航迹分析功能。
- 识别舱保留：本舰档案、本舰呼号、识别徽标、授权等级、航行经验、稳定读数（轻量「本舰状态」）、装备协议、断开终端。
- 全息舱新增「航迹档案」模块：航迹摘要（已写入样本、最近航程、封存时间）+ 航迹回放入口。
- 「身份档案」更名为「识别档案」，「身份经验」更名为「航行经验」。

### 变更文件

修改：
- `miniprogram/pages/profile/profile.wxml` — 移除数据矩阵和航迹档案摘要，新增本舰状态
- `miniprogram/pages/profile/profile.js` — 移除 loadScoreStats、loadBlackboxSummary 和相关数据字段
- `miniprogram/pages/profile/profile.wxss` — 替换数据矩阵和黑匣子样式为本舰状态样式
- `miniprogram/pages/mirror/index.wxml` — 新增航迹档案卡片
- `miniprogram/pages/mirror/index.js` — 新增 _fetchBlackboxSummary、goScoreRecords，导入 request.get
- `miniprogram/pages/mirror/index.wxss` — 新增航迹档案样式
- `miniprogram/pages/level-archive/level-archive.json` — 导航标题改为「识别档案」
- `miniprogram/pages/level-archive/level-archive.wxml` — 标题和经验文案更新
- `docs/PRODUCT_LANGUAGE.md` — 术语表和页面推荐表达更新
- `docs/UI_GUIDELINES.md` — 页面分工描述更新
- `docs/ACCEPTANCE_CHECKLIST.md` — 新增验收项
- `docs/DEVELOPMENT_LOG.md` — 本条记录
- `changelog.md` — 记录用户可感知变化

### 验证方式

- 识别舱页面不出现「数据矩阵」和「航迹档案摘要」
- 识别舱页面展示「本舰状态」（航行经验 + 稳定读数）
- 全息舱页面展示「航迹档案」卡片（已写入样本、最近航程、封存时间）
- 全息舱航迹档案卡片可点击跳转航迹回放
- 识别档案页面标题显示「识别档案」
- 识别档案页面「航行经验」文案正确

### 后续事项

- 无

---

## 2026-06-08

### 摘要

- 全局产品语言重构：底部导航从「空间/策略/镜像/身份」改为「编队/指令/镜像/身份」。
- 创建舰载系统 Dock 自定义 TabBar，纯 CSS 四舱位插槽图标。
- 统一「黑匣子」→「航迹档案」，「五维扫描」→「全息扫描」，「航行核心」→「导航核心」。
- 用户称呼体系重构：「舰员代号」→「本舰呼号」，「头盔识别」→「识别徽标」，「身份等级」→「授权等级」。
- 身份图标从芯片卡重新设计为四角扫描框 + 中心识别点。
- 同步更新所有运行时用户可见文案、sanitize 规则和文档。

### 世界观映射

- 编队 = 驾驶舱（COCKPIT）
- 指令 = 导航舱（NAV）
- 镜像 = 全息舱（HOLO）
- 身份 = 识别舱（IDENTITY）

### 变更文件

新建：
- `miniprogram/custom-tab-bar/index.js`
- `miniprogram/custom-tab-bar/index.wxml`
- `miniprogram/custom-tab-bar/index.wxss`

修改：
- `miniprogram/app.json` — tabBar 文案
- `miniprogram/app.js` — activeTabKey 初始值
- `miniprogram/utils/terminology.js` — 全局术语参考
- `miniprogram/utils/domain-display.js` — 展示适配层
- `miniprogram/utils/mirror-sanitize.js` — 新增航迹/全息扫描替换规则
- `miniprogram/pages/room/room.json` — 导航标题
- `miniprogram/pages/room/room.wxml` — 编队/航迹档案文案
- `miniprogram/pages/room/room.js` — Toast/heartbeat 文案 + activeTabKey
- `miniprogram/pages/fortune/fortune.json` — 导航标题
- `miniprogram/pages/fortune/fortune.wxml` — 导航舱/计算文案
- `miniprogram/pages/fortune/fortune.js` — Toast/nav title + activeTabKey
- `miniprogram/pages/mirror/index.wxml` — 航迹样本文案
- `miniprogram/pages/mirror/index.js` — 航迹样本/全息扫描文案 + activeTabKey
- `miniprogram/pages/profile/profile.json` — 导航标题
- `miniprogram/pages/profile/profile.wxml` — 识别舱文案
- `miniprogram/pages/profile/profile.js` — activeTabKey
- `miniprogram/pages/login/login.wxml` — 编队/导航核心文案
- `miniprogram/pages/login/login.js` — 导航引擎文案
- `miniprogram/pages/score-records/score-records.json` — 航迹回放标题
- `miniprogram/pages/score-records/score-records.wxml` — 航迹回放文案
- `miniprogram/pages/score-records/score-records.js` — console 文案
- `miniprogram/pages/level-archive/level-archive.js` — 指令执行者徽章
- `miniprogram/components/battle-insight/battle-insight.wxml` — 编队洞察
- `miniprogram/components/battle-summary/battle-summary.wxml` — 编队
- `miniprogram/components/space-scan-panel/space-scan-panel.wxml` — 编队扫描

文档：
- `docs/PRODUCT_LANGUAGE.md` — 全面重写
- `docs/UI_GUIDELINES.md` — 补充 Dock 规范
- `docs/CONTENT_SAFETY.md` — 指令页禁止表达
- `docs/ARCHITECTURE.md` — 模块描述更新
- `docs/ACCEPTANCE_CHECKLIST.md` — 新增验收项
- `CHANGELOG.md` — 记录变更
- `PLAN.md` — 标记进度

### 验证

- 微信开发者工具编译待验证
- 关键词搜索验证待执行
- 底部导航渲染待验证

### 后续事项

- 微信开发者工具中验证底部 Dock 渲染效果
- 真机验证安全区适配
- 确认 Canvas 海报文案无遗漏

## 2026-06-07

### 摘要

- 将过长的根目录 `CLAUDE.md` 拆分为精简入口文档、聚焦的 `docs/` 项目知识文件和 `.claude/rules/` 执行规则。

### 变更文件

- `CLAUDE.md`
- `PLAN.md`
- `CHANGELOG.md`
- `docs/PROJECT_OVERVIEW.md`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCT_LANGUAGE.md`
- `docs/UI_GUIDELINES.md`
- `docs/CONTENT_SAFETY.md`
- `docs/DEVELOPMENT_LOG.md`
- `docs/TECH_DEBT.md`
- `docs/ACCEPTANCE_CHECKLIST.md`
- `docs/DATABASE.md`
- `.claude/rules/backend.md`
- `.claude/rules/frontend.md`
- `.claude/rules/documentation.md`
- `.claude/rules/performance.md`
- `.claude/rules/security.md`
- `.gitignore`

### 实现说明

- 保留根目录 `CLAUDE.md` 作为项目入口、命令参考、文档索引和高层工作规则。
- 将项目概述、架构事实、产品语言、UI 规则、内容安全、数据库说明、技术债和验收清单拆入独立文件。
- 增加后端、前端、文档、性能和安全执行规则文件。
- 收窄 `.claude/` 忽略规则，让 `.claude/rules/*.md` 可以被版本控制追踪，同时继续忽略本地 Claude 设置和技能文件。
- 增加 Markdown 文档强制中文规则；代码标识符、路径、API 路径、命令、表名、字段名、配置键和专有库名可以保留原文。
- 基于当前代码、技术债清单和工作区改动，重写 `PLAN.md` 为下一轮稳定化验收计划。

### 验证

- 本次为纯文档变更，无需运行后端或前端测试。
- 生成下一步计划前，已执行后端编译命令 `JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn -q -DskipTests compile`，结果通过。

### 后续事项

- 确认此前已删除的小写 `changelog.md`、`plan.md` 与 `codex-changelog.md` 是否应继续移除。
- 后续记录或修改接口契约时，补充 `docs/API.md`。
