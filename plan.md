# 计划

## 当前理解

- Redis 成员模型已从单一 `meta` Hash 拆分为 `members:active`（实时成员）+ `members:archive`（归档快照）双 Hash，兼容旧 `meta` 降级读取。
- 编队页 active 首屏已改为 `cockpit-shell-v2` 一屏驾驶舱，舷窗、驾驶台、终端屏和航程控制压缩到一个首屏主壳内。
- 后端编译通过，前端语法检查通过。
- 已修复两个用户反馈问题：中途退出成员黑匣子缺失、旧封存空间影响新房间创建/加入。
- Phase 1 安全修复已完成：WebSocket roomId 校验、读端点鉴权、presign 鉴权、密钥清理、请求追踪。

## 下一轮目标

rebuild_plan Phase 1-5 已完成，Phase 6 条件不满足暂缓，Phase 7-10 按需执行。

```text
Phase 1 (安全) ✅ -> Phase 2 (性能) + Phase 5 (API) ✅ -> Phase 3 (动画) + Phase 4 (状态) ✅ -> Phase 7-10 (按需)
```

Phase 6 子包拆分完成：主包 5 页（login/room/fortune/mirror/profile），子包 `pages-ext` 5 页（settings/voice-select/settle/score-records/level-archive）。

## Phase 1 安全修复（2026-06-09） ✅

- ✅ `application-local.yml` 密钥全部改为环境变量注入。
- ✅ `.gitignore` 新增 `application-local.yml` 防止密钥再提交。
- ✅ `.env.example` 创建环境变量模板。
- ✅ `deploy.sh` 服务器地址改为环境变量。
- ✅ `ScoreWebSocket` 新增 roomId 成员校验，非成员 4003 关闭。
- ✅ `RoomAccessGuard` 创建，统一编队访问校验。
- ✅ `RoomController.getRoomDetail` 加入成员校验。
- ✅ `ScoreController` 7 个读端点全部加入成员校验。
- ✅ `RoundRecordController.getPending` 加入成员校验。
- ✅ `StorageController.getPresignUrl` 要求登录。
- ✅ `WebMvcConfig` 移除 `/storage/presign` 免认证。
- ✅ `WebSocketConfig` CORS 从 `*` 收紧。
- ✅ `RequestIdFilter` 创建，请求追踪 ID。
- ⬜ 真机 WebSocket 连接测试。
- ⬜ 非成员 HTTP 读请求 403 测试。

## Phase 2 + Phase 5 性能与 API 层（2026-06-09） ✅

- ✅ `room-patch-scheduler.js` 创建，提供 scheduleRoomPatch/flushRoomPatch 批处理机制。
- ✅ `room.js` 引入 patch scheduler，通过 Object.assign 合并到 Page 定义。
- ✅ `buildMemberGrid` + `rebuildPulseStats` 合并为一次 setData 写入。
- ✅ `_calcPulseStatsPatch` 抽取为纯函数，返回 patch 对象而非直接 setData。
- ✅ `onUnload` 新增 `_destroyed` 标记和 `_roomPatchTimer` 清理。
- ✅ `request.js` 重写：GET 请求去重（inflight Map）、X-Request-Id 头、保持向后兼容。
- ✅ `services/room-service.js` 创建，封装 7 个房间 API。
- ✅ `services/score-service.js` 创建，封装 11 个记分 API。
- ✅ `room.js` 全量迁移到 service 层，25+ 处直接 API 调用替换为 `roomService`/`scoreService`/`roundService`。
- ⬜ 真机性能验证 setData 次数下降。

## Phase 3 动画系统重写（2026-06-09） ✅

- ✅ `motion.wxss` 创建，定义动效 token（时长/缓动/层级）和通用动画类。
- ✅ `app.wxss` 接入 `@import './styles/motion.wxss'`。
- ✅ 粒子动画 `_runParticleWithRects` 从 16ms setData 逐帧循环改为 CSS `@keyframes` + class toggle，setData 从每帧 20+ 次降到 2 次。
- ✅ `onParticleAnimEnd` 回调处理 `animationend` 事件，触发分数滚动动画。
- ✅ `flashTargetSeat` 接入 `motion-score-impact` CSS class，ship-craft 有独立 impact keyframe（保留 translate 居中）。
- ✅ WXML 粒子模板改为 CSS 自定义属性驱动（`--dx`/`--dy`/`--arc`），`bindanimationend` 回调。
- ✅ 所有新动画均有 `.reduce-motion` 兜底。
- ⬜ 微信开发者工具编译验证。
- ⬜ 真机验证粒子飞行流畅度和 impact 反馈。

## Phase 4 WebSocket 治理（2026-06-09） ✅

- ✅ `score-ws.js` 新增心跳检测：25s 间隔检查，40s 无消息判定断线并自动重连。
- ✅ `_startHeartbeat`/`_stopHeartbeat` 生命周期管理：onOpen 启动、onClose/disconnect 停止。
- ✅ `room.js` 前后台切换恢复策略：`onHide` 记录时间戳，`onShow` 按离线时长决定恢复（<30s 静默、30s-5min 刷新数据、>5min 强制重连）。
- ⬜ room-store.js 状态管理（后续优化）。

## 编队页 active 首屏 v2 重构（2026-06-08） ✅

- ✅ `cockpit-shell-v2` 固定为 800rpx 一屏外壳，内部不再堆叠大型卡片。
- ✅ 舷窗高度 430rpx、驾驶台高度 370rpx，舷窗 + 驾驶台 + 终端屏构成连续一体化驾驶舱。
- ✅ 外部航船改为 `ship-craft` 小型航船标记，1-4 人编队使用固定坐标。
- ✅ 终端屏内保留编队码、成员数、模式、阶段、实时脉冲、最近流向和点阵轨迹预览。
- ✅ 航程控制压缩为 `voyage-control-panel-v2`，`记录脉冲 / 展开信标` 完整可见。
- ✅ 静态检查通过：`node --check miniprogram/pages/room/room.js`、`node --check miniprogram/utils/mirror-sanitize.js`、`node --check miniprogram/components/mbti-swipe-test/mbti-swipe-test.js`、旧词扫描、动效扫描。
- ⬜ 微信开发者工具编译验证。
- ⬜ 真机验证首屏高度、底部 Dock 遮挡、2 人 / 3 人航船间距和轨迹点阵显示。

## 编队页第一人称驾驶舱重构（2026-06-08） ✅

- ✅ 编队页首屏改为第一人称驾驶舱舷窗：深空外景、静态星点、HUD 网格、前方编队视图。
- ✅ 编队成员从头像卡片主视觉改为外部航船 marker / 编队位 / 呼号 / 脉冲值 / 链路状态。
- ✅ 外部航船 marker 按编队人数分为 hero / large / normal 档位，少人编队下呼号和脉冲读数显著放大。
- ✅ 本舰不再作为舷窗前方的大头像卡片出现，仅在 HUD 中展示本舰呼号、本舰脉冲、链路状态和主控身份。
- ✅ 编队码、成员数、记录模式、航程阶段、链路状态改为舷窗 HUD 读数。
- ✅ 航迹档案观测降级为轻量入口，详细航迹映射进入全息舱查看。
- ✅ 保留创建编队、加入编队、展开信标、复制编队码、记录脉冲、本局录入、封存航程、退出/解散编队、WebSocket 同步和 reduce-motion 兜底。
- ✅ 静态检查通过：`node --check`、旧词扫描、`transition: all` 扫描、`setInterval/requestAnimationFrame` 扫描。
- ⬜ 微信开发者工具编译验证。
- ⬜ 真机验证舷窗航船 marker、底部安全区、信标弹层和本局录入弹窗。

## 全局产品语言重构（2026-06-08） 🔄

- ✅ 底部导航从「空间/策略/镜像/身份」改为「编队/指令/镜像/身份」。
- ✅ 创建舰载系统 Dock 自定义 TabBar（纯 CSS 图标）。
- ✅ 舱位体系：驾驶舱 / 导航舱 / 全息舱 / 识别舱。
- ✅ 「黑匣子」→「航迹档案」，「五维扫描」→「全息扫描」，「航行核心」→「导航核心」。
- ✅ 用户称呼体系：「舰员代号」→「本舰呼号」，「头盔识别」→「识别徽标」，「身份等级」→「授权等级」。
- ✅ 身份图标从芯片卡重新设计为四角扫描框 + 中心识别点。
- ✅ 底部导航只显示一行主文案（编队/指令/镜像/身份），不显示舱位名和英文装饰。
- ✅ 所有运行时用户可见文案替换完成。
- ✅ sanitize 规则同步更新。
- ✅ 文档同步更新。
- ⬜ 微信开发者工具编译验证。
- ⬜ 底部 Dock 渲染和安全区验证。

## 最新完成项

### 驾驶舱视觉层级与转积分面板重构（2026-06-08） ✅

- ✅ 舷窗外部航船改用真实头像（`helmet-avatar` 组件），替代几何航船轮廓。
- ✅ `FORMATION_POSITIONS` 改为角落/边缘分布，2 人和 3 人编队不再重叠。
- ✅ 外部航船标记层级：头像环 > 呼号 > 脉冲点 > 状态点。
- ✅ 驾驶舱脉冲 HUD 环居中显示（`viewport-pulse-center`），编队码/成员数/模式/阶段/链路移至边缘。
- ✅ 转积分面板精简：仅显示发送方头像和呼号，移除接收方信息，数字键盘和确认按钮并排。
- ✅ 移除全部英文 kicker（COCKPIT ONLINE、FORWARD VIEW、FORMATION CORE、ACCESS CODE、FLOW SHIFT、FLOW PRESET 等）。
- ✅ `buildCockpitView()` 移除 kicker 字段，`deriveFormationShips()` 新增 `avatarUrl`/`avatarChar`。
- ✅ 旧航船轮廓样式（ship-beam/ship-glyph/ship-label 等）已清除。
- ✅ 静态检查通过：`node --check`、英文 kicker 扫描、kicker 引用残留扫描。
- ⬜ 微信开发者工具验证：2 人 / 3 人编队不重叠、小屏幕转积分面板完整可见、reduce-motion 脉冲静默。

### 指令页（导航舱）文案收敛与世界观重构（2026-06-08） ✅

- ✅ 页面标题「导航核心」→「导航舱」，kicker「DECK ONLINE」→「NAV BAY ONLINE」。
- ✅ 主按钮 kicker「PRESS TO IGNITE」→「PRESS TO CALC」。
- ✅ 结果区「舰载指令」→「今日指令」。
- ✅ 操作按钮「生成指令图」→「生成指令卡」，kicker「REIGNITE」→「RECALCULATE」。
- ✅ 弹窗副标题「REIGNITE NAV CORE」→「RECALCULATE DIRECTIVE」，正文精简。
- ✅ 生成中日志「成员协议已同步」→「航迹协议已同步」。
- ✅ 长等待文案「主引擎链路保持中」→「导航核心校准中」等。
- ✅ 海报标识「NAV CORE」→「NAV BAY」。
- ✅ sanitize 映射扩展覆盖「策略 / 黑匣子 / 重新点火 / 预知 / 神谕」等旧词。
- ✅ 文档同步更新（CHANGELOG / DEVELOPMENT_LOG / PRODUCT_LANGUAGE / UI_GUIDELINES / CONTENT_SAFETY / ACCEPTANCE_CHECKLIST）。
- ⬜ 微信开发者工具编译验证。
- ⬜ 真机运行验证。

### 策略页体验修复第二轮（2026-06-08） ✅

- ✅ 重新点火确认后立即回到完整待机态（`firstEnter` 标记跳过入场动画）。
- ✅ 结果页顶部核心压缩为 80rpx 最小占位，投影线隐藏，首屏优先展示指令。
- ✅ 海报弹层调用 `wx.hideTabBar` 覆盖原生 TabBar，关闭时恢复。
- ✅ 海报预览图宽度增至 600rpx，移除「发送给朋友」按钮。
- ✅ `_clearGeneratingVisualState` 新增 `logs` 清理。
- ✅ 海报 Canvas 布局与页面结果投影完全一致：包含 HUD 芯片、状态胶囊、标签、推进节奏/安全边界列表，新增 `_drawSectionHead`/`_drawCardBg`/`_drawHudChips`/`_drawTagPill`/`_drawListItem` 辅助方法，Canvas 高度调整为 1300px。
- ✅ 修复海报弹层打开时切换 Tab 导致 TabBar 图标消失：`onHide`/`onUnload`/`onShow`/`onConfirmRegenerate`/`_abortCurrentFlight` 均恢复 TabBar。
- ⬜ 人工复测视频验证。

### 镜像档案卡三次修复（2026-06-08） ✅

- ✅ 重写 `_drawCrewIdentity`：`fillRect`/`strokeRect` 替代 `_roundRect` + `fill`，身份条始终可见。
- ✅ `_drawAvatarFallback` 绘制后重置 `textAlign`/`textBaseline`，不影响后续文字。
- ✅ `_drawContent` 起始重置文本状态，使用 `d.radarLocked` 保持一致。
- ✅ `_ensureCrewProfile` 放宽缓存命中条件，不再要求 `userId` 非空。
- ✅ 校准提交面板重构：`_buildCalibrationSubmitSteps()` + pending/active/done 三态。
- ✅ `handleMbtiComplete` 步骤 1→2→3→4 逐级推进，每步有展示时间。
- ✅ 雷达组件 `locked` 独立观察者 + `_redraw()` 方法。
- ✅ 新增 `console.log` 诊断 crew profile 和 avatarTempPath。
- ⬜ 微信开发者工具 / 真机验收。

### 策略页体验修复（2026-06-08） ✅

- ✅ 空间页 `onHide` 清理所有 fixed 叠加层，各 Tab 页 `onShow` 同步 `activeTabKey`。
- ✅ 策略页生成等待统一由 `generationStatusText` 渲染，不再 heartbeat + engineWaitText 叠加。
- ✅ 接入日志 2.4s 后自动收缩为小型完成态。
- ✅ `pageReady` 立即为 true，航行核心和点火控制台同步出现。
- ✅ 海报弹层 z-index 99999 + `catchtouchmove` 阻止背景滚动。
- ✅ 四段式进度条（3 段），4s/12s/20s 阶段切换时更新。
- ✅ API 返回后统一清理等待态。
- ⬜ 人工复测视频验证。

## 执行顺序

### 1. 后端数据闭环验收 ✅

- ✅ 验证封存后 `room_member.final_score` 与 `quit_time` 保留，已结束空间再次退出不会删除历史成员记录。
- ✅ 验证封存后会异步重算身份等级，并清理 `sr:mirror:stats:{uid}` 与 `sr:fortune:{uid}:{date}`。
- ✅ 验证 `/score/trend`、`/score/yield-log`、`/room/history` 对同一封存空间返回口径一致（`YieldLogResp` 含 `myRank`/`memberCount`）。
- ✅ 验证 `YieldLogResp` 新结构 `myRank/memberCount` 与前端 `score-records`、身份页黑匣子摘要兼容。

### 2. 技术债状态校准 ✅

- ✅ 将已确认完成的技术债从 `docs/TECH_DEBT.md` 勾选（11 项完成）。
- ✅ 保留策略页穿帮词巡检和分享海报验证为未完成（需真机确认）。

### 3. 文案和世界观收口 ✅

- ✅ 把 `miniprogram/utils/domain-display.js` 中 `HIGH_RISK -> 高风险` 改为「偏高」。
- ✅ 将镜像页用户可见「风险」标签收敛为「边界」。
- ✅ 将登录页「策略终端 / 策略模块」收敛到「航行核心 / 指令投影」体系。
- ✅ 巡检分享标题、Canvas 海报、Toast、弹窗正文，代码级未发现 `LLM`、`fallback`、`LOW-NOISE`、`HIGH_RISK` 等穿帮词。

### 4. 小程序端运行风险检查 ✅

- ✅ `profile.wxml` 中 `Math.min` 已移至 JS 计算，通过 `setData` 输出。
- ✅ `level-archive` 已在 `app.json` 注册。
- ✅ 无 `transition: all`，所有核心页面根节点绑定 `reduce-motion`。
- ✅ 敏感日志：`DEBUG_WS = false`，token 不在 URL 中，无 JWT/code/OSS 签名泄露。

### 5. 静态验收与代码审查 ✅

- ✅ 策略页穿帮词验收：`fortune.js` 中 `STRATEGY_TEXT_REPLACEMENTS` 覆盖全部禁词，所有用户可见字段均经过 `sanitizeStrategyText()` 处理。HUD 芯片标签均有专用映射函数，不泄漏原始枚举值。分享标题使用已 sanitize 的 `s.tag`。
- ✅ 分享海报验收：策略页和镜像页 Canvas 海报均为独立排版（非页面截图），文字经过 sanitize，深色背景无白底，分享/保存按钮使用蓝/青色，reduce-motion 下无持续动画。
- ✅ 四条主链路静态回归：空间、策略、镜像、身份页面代码结构完整，无穿帮词泄漏。
- ⬜ 微信开发者工具真机渲染验收仍需人工确认（CLI 环境无法启动微信开发者工具）。

### 7. 死代码清理与接口文档 ✅

- ✅ `terminology.js` 旧世界观术语已更新为新术语（`oracleCore: '航行核心'`、`strategyCard: '指令投影'`、`riskNotice: '安全边界'`、`createSpace: '启动空间'`）。文件未被 import，保留为集中映射备用。
- ✅ 创建 `docs/API.md`，记录 32 个核心接口契约。

### 6. 文档同步 ✅

- ✅ 更新 `docs/TECH_DEBT.md` 的 checklist 状态。
- ✅ 更新 `docs/DEVELOPMENT_LOG.md`，记录本轮验收、修补文件、验证结果和剩余风险。
- ✅ 更新 `PLAN.md`。
- ✅ 更新 `CHANGELOG.md`。
- 保持所有 Markdown 文档中文书写。

## 本轮不做

- 不继续扩大 UI 重构范围。
- 不宣称 MySQL 热路径已完全收敛。
- 不新增高频轮询、无差别广播或运行期大对象反复序列化。
- 不把策略/镜像内容改成预测、收益承诺或娱乐化测试。

### 8. 策略页点火到结果投影体验优化 ✅

- ✅ 重构 `_tryFinishCalc` 流程：先准备完整 viewState，再进入 projecting 阶段，消除空壳投影。
- ✅ 点火控制台退场：新增 `--hidden` 状态类，`animation: none !important` 防止入场动画残留。
- ✅ 航行核心 done 态不再 `height: 0`，改用平滑淡出 + `min-height` 保留占位。
- ✅ 日志舱从独立终端卡片改为轻量 chip 接入条（3 条日志，总高 ~100rpx）。
- ✅ 投影线动画从 `width` 改为 `scaleX` transform，避免重排。
- ✅ 前端逻辑加固：`_runId` 防晚到覆盖、统一清理方法 `_abortCurrentFlight`、`_isMotionEnabled()` 统一判断。
- ✅ 海报错误态改为 `phase: 'poster_error'`，错误态可见。
- ✅ 分享按钮改为 `open-type="share"`，`onShareAppMessage` 标题经 sanitize。
- ✅ `solarTerm` 映射补齐 `CALIBRATE/CRUISE/DEBRIEF`。
- ✅ 后端：Redis 操作全部 try-catch 降级保护；并发生成短锁 `sr:fortune:lock:{uid}:{date}`；新增 `nextRefreshAtEpochMs` 字段。
- ✅ 前端倒计时优先使用 `nextRefreshAtEpochMs`，解决跨天倒计时错误。
- ✅ 点火控制器逐阶段渐隐（arming→0.86、fading→0.38、hidden→0），不再瞬间消失。
- ✅ 核心上浮幅度收窄（lifting→-24rpx、syncing→-36rpx、projecting→-52rpx、done→-64rpx），避免大面积留白。
- ✅ 日志接入条紧贴核心下方（margin-top: -4rpx、宽度 400rpx）。
- ✅ 结果投影新增 `projectionVisible` 延迟 80ms 展开，结果卡片从核心位置平滑展开。
- ✅ 恢复「生成指令图」为主按钮（`bindtap="onTapGeneratePoster"`），替代无法使用的 `open-type="share"`。
- ✅ 「发送给朋友」移至海报弹层内，需 `canUseWxShare` 能力检测。
- ✅ `onConfirmRegenerate` 同时重置海报和投影可见性状态。

### 9. 镜像模块体验优化 ✅

- ✅ 引入 `mirrorPhase` 统一状态机，替换分散的 boolean 标志。
- ✅ `loadProfile` 支持 initial/silent 模式，首次显示 skeleton，后台刷新不闪烁。
- ✅ profile + stats 并行请求，一次 setData 落态，消除二次跳变。
- ✅ runId 防止晚到请求覆盖新状态。
- ✅ 校准层从主页面暗化后展开，不再硬切全屏。
- ✅ 校准完成停留在写入层，不回主页面 loading。
- ✅ MBTI 双卡栈，下一题提前出现在后方，消除空白断层。
- ✅ 快速接入由父页面 API 结果驱动，组件不再假装成功。
- ✅ 镜像卡生成改为中央扫描匣，不再全屏黑切。
- ✅ timer 全量清理，reduce-motion 覆盖所有组件。
- ✅ 后端 sanitize 规则补充（推进倾向/接入频率/回稳能力等）。
- ✅ 修复 personaConfidence MBTI 重复加权。
- ✅ 避免无变化 UPDATE。
- ✅ 封存时同时清理 profile 和 stats 缓存。
- ✅ 后端 stats 维度标签更新。

### 10. 策略页体验修复（跨 Tab 穿帮 / 重新点火 / 长等待 / 分享入口）

- ✅ 跨 Tab 穿帮修复：`onShow` 先设 `pageReady=false` + `setNavigationBarTitle('起飞甲板')`，150ms 骨架屏遮罩后显示内容。
- ✅ 重新点火原子化复位：`onConfirmRegenerate` 一次性 reset 所有状态（strategy/logs/heartbeat/engineWait/projection/poster），控制台通过 `--entered` 类保持可见。
- ✅ 长等待守卫（配合后端 25s LLM 上限）：4s「主引擎链路保持中」→ 12s「指令投影仍在校准」→ 20s「备用指令准备中」→ 30s 前端兜底失败。前端 request timeout 30s，不提前中断。
- ✅ `_tryFinishCalc` 不被动画拖住：API 完成 + 1200ms 最短展示 + (动画完成 || 2400ms) 即进入投影。API 在 1200ms 内返回时设置短 timer 等待最短展示时间。
- ✅ 隐藏未认证微信分享：`app.globalData.enableWechatShare` 默认 false，`_initShareCapability` 检查配置 + API 支持，海报弹层只显示「保存图片 / 关闭」。
- ✅ 海报按钮布局：未认证时两按钮 grid 布局，认证后三按钮 flex 布局。
- ✅ `request.js` 的 `get` 函数支持 `opts` 参数，可传递 `timeout`。

### 11. 镜像档案卡舰员头像与代号接入

- ✅ `mirror-api.js` 新增 `getCurrentUser()` 调用 `/user/me`。
- ✅ `mirror-sanitize.js` 新增 `sanitizeCrewName()` 和 `truncateCanvasText()`。
- ✅ `index.js` 新增 `crewProfile` 状态和加载链路（globalData → storage → API → 默认值）。
- ✅ 头像远程下载 → `wx.downloadFile` 转本地临时路径 → `canvas.createImage()` 异步加载。
- ✅ Canvas 顶部身份条：圆形头像 + 舰员代号 + CREW ID 副标 + 状态点。
- ✅ 头像加载失败降级：渐变圆 + 首字占位。
- ✅ 昵称为空降级：「未命名舰员」。
- ✅ 扫描匣文案改为「镜像档案封装中」+ 三步骤。
- ✅ 预览弹窗宽度 710rpx，图片 max-height 76vh。
- ✅ `onShareAppMessage` 标题包含舰员代号和 MBTI。
- ✅ `onUnload` 递增 runId 防止卸载后 setData。
- ⬜ 微信开发者工具 / 真机验收：头像下载、Canvas 绘制、保存相册、分享。

### 12. 镜像档案卡二次修复

- ✅ 头像加载增强：`_prepareAvatarForCanvas` 优先 `wx.getImageInfo`，失败后 `wx.downloadFile` 兜底。
- ✅ 用户信息 multi-source 读取：globalData → storage（userInfo/user_info/profile）→ API，字段兼容 nickName/avatar/headUrl。
- ✅ 卡片五维扫描占位：样本不足时绘制幽灵五边形 + "五维扫描采集中" + 样本计数 + 解锁提示。
- ✅ 页面五维扫描修正：雷达组件 `_drawLabels` 锁定态显示 "--" 而非 0。
- ✅ Canvas 文字透明度提升：主文字 0.92、副文字 0.68。
- ✅ 扫描匣步骤状态：pending(灰) / active(青) / done(绿) 三态。
- ✅ 底部安全区增加至 260rpx。
- ✅ 身份页 NaN 防御：日期 `isNaN` 校验、stability `Number.isFinite` 校验、score `Number()` 包裹。
- ⬜ 微信开发者工具 / 真机验收：真实头像下载、幽灵雷达、扫描步骤颜色、身份页 NaN 场景。

### 13. 镜像档案卡三次修复

- ✅ 重写 `_drawCrewIdentity`：背景矩形改用 `fillRect`/`strokeRect` 替代 `_roundRect` + `fill`，确保身份条始终可见。
- ✅ 头像 fallback 重置 `textAlign`/`textBaseline`：`_drawAvatarFallback` 绘制后恢复 `left`/`alphabetic`，避免影响后续文字。
- ✅ `_drawContent` 起始重置文本状态，避免受 `_drawCrewIdentity` 的 `textAlign` 影响。
- ✅ `_drawContent` 使用 `d.radarLocked` 而非重新计算，保持与页面状态一致。
- ✅ `_ensureCrewProfile` 放宽缓存命中条件：不再要求 `userId` 非空，避免 API 未返回 userId 时反复重fetch。
- ✅ `_drawPersonaCard` 新增 `console.log` 诊断 crew profile 和 avatarTempPath。
- ✅ `_doDrawCard` 新增 `console.log` 诊断 crew 数据和头像路径。
- ✅ 校准提交面板重构：新增 `_buildCalibrationSubmitSteps()` 生成 pending/active/done 三态步骤视图。
- ✅ `handleMbtiComplete` 重写：步骤 1→2→3→4 逐级推进，每步有 600ms/500ms 展示时间（reduce-motion 下跳过）。
- ✅ 校准提交 WXML 改用 `calibrationSubmitStepViews` + `cal-status-dot` 结构，与扫描匣风格统一。
- ✅ 校准提交 CSS 重写：新增 `.cal-submit-terminal`、`.cal-status-dot`、`.cal-line-text` 和 pending/active/done 三态样式。
- ✅ 雷达组件新增 `locked` 独立观察者和 `_redraw()` 方法，确保 `locked` 属性变更触发重绘。
- ✅ 雷达组件 `_drawLabels` 新增 `locked=true` 日志。
- ⬜ 微信开发者工具 / 真机验收：身份条可见性、头像 fallback、校准步骤进度、雷达锁定态 "--" 显示。

## 后续事项

- 微信开发者工具或真机渲染验收（代码级审查已通过，需人工确认运行时渲染）。
- 镜像档案卡三次修复验收：身份条可见性（fillRect 背景 + 文字）、头像 fallback 渐变圆 + 首字、校准步骤 4 步逐级推进、雷达锁定态 "--" 显示。
- 镜像档案卡真机验收：头像下载（需配置 OSS 域名白名单）、Canvas 绘制圆形头像、幽灵雷达显示、扫描步骤颜色、保存相册、分享标题。
- 身份页黑匣子摘要 NaN 真机验证。
- 策略页跨 Tab 过渡、重新点火复位、长等待文案（4s/12s/20s）、超时降级（30s）、海报分享入口验收。
- 关闭动效后复测核心链路。
- `terminology.js` 未被 import，可考虑后续接入或删除。
- 后端 overview 聚合接口（中长期）。
- 黑匣子 summary 收敛（中长期）。
