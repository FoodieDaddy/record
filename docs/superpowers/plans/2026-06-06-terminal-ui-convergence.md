# Smart Record 终端化收敛总计划

> 生成日期：2026-06-06  
> 范围：项目说明文档、微信小程序全部页面、共享组件、动效/样式/审核安全、微信开发者工具验收流程。  
> 定位：这是总收敛计划，不替代已有单页计划；执行时优先按本文 P0/P1/P2 排序，再引用已有 `room`、`oracle`、`identity`、`battle-report` 等细化计划。

## 0. 当前理解

Smart Record 当前已经从「Happy 记分器」演进为「脉冲终端」：一个多人实时协同记录与复盘的小程序，主线是「空间记录 -> 策略提示 -> 行为画像 -> 身份沉淀」。

当前实际架构是 Java 21 + Spring Boot 3.2.5 + MyBatis-Plus + MySQL + Redis/Redisson + WebSocket，前端是原生微信小程序。运行期数据已经 Redis 优先，但还不是纯 Redis 热路径：创建、加入、部分记分生效、轮次归档仍访问 MySQL。后续文档与实现都不能把「MySQL 零参与」写成已完成事实。

## 1. 微信开发者工具状态

已执行：

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli open --project /Users/happy/Documents/record/miniprogram --lang zh
```

结果：

- 微信开发者工具正在运行，项目已打开。
- IDE HTTP server 监听 `127.0.0.1:13481`。
- `cli auto --project ... --trust-project` 在 AppID/权限阶段超时，暂时无法启动自动化巡检。
- `mcp__computer_use.get_app_state` 受 macOS ScreenCaptureKit 权限影响失败。
- `agent-browser connect 13481` 失败，因为该端口不是标准 CDP `/json/version` / `/json/list` 端点。

验收策略：

- 现阶段可做：CLI 打开项目、静态审计、构建/预览命令、关键文件检索、后端编译与 API 校验。
- 需要用户授权后做：微信开发者工具截图巡检、模拟器逐页交互、动画/滚动/弹窗视觉检查。
- 如果需要完整自动化：退出 DevTools 后用远程调试参数重启 Electron，或在 DevTools 内启用自动化权限，再运行 `agent-browser` / DevTools automation。

## 2. P0 必修问题

### P0.1 文档事实同步

状态：已更新 `AGENTS.md` 与 `CLAUDE.md` 的项目摘要、当前架构事实、核心模块、10 张实体表、安全注意与全局约束区。

验收：

```bash
rg -n "Happy记分器|赛博运势|运势模块|纯 Redis 流转架构|打牌期间|数据库表（8 张）|# ⚡️" AGENTS.md CLAUDE.md
```

期望：无命中。

### P0.2 WebSocket 调试日志脱敏

问题：

- `miniprogram/utils/score-ws.js` 中 `DEBUG_WS = true`。
- `console.log('[score-ws] connect url:', wsUrl)` 会打印完整 token。

修改目标：

- 默认 `DEBUG_WS = false`。
- 如需调试，只打印 `roomId`、连接状态、重连次数，不打印 `token` 或完整 URL。
- 错误日志只输出事件名和简短错误，不输出敏感 query。

验收：

```bash
rg -n "connect url|token=|DEBUG_WS = true" miniprogram/utils/score-ws.js
```

期望：无命中。

### P0.3 空间二维码字段修复

问题：

- `miniprogram/utils/request.js` 在 `code === 200` 时 resolve `res.data.data`。
- `miniprogram/pages/room/room.js` 仍读取 `resp?.data?.qrCodeUrl`，会导致分享面板拿不到二维码。

修改目标：

- 改为 `resp?.qrCodeUrl || null`。
- 保留本地 `qr:${roomNo}` 一小时缓存。
- 打开分享面板时已有 `currentRoom.qrCodeUrl` 直接复用。

验收：

```bash
rg -n "resp\\?\\.data\\?\\.qrCodeUrl" miniprogram/pages/room/room.js
```

期望：无命中。

### P0.4 全局动效静默根节点补齐

问题：

- `miniprogram/pages/room/room.wxml` 根节点是 `room-page`，缺 `reduce-motion` 绑定。
- `miniprogram/pages/voice-select/voice-select.wxml` 根节点是 `page`，缺 `animationEnabled/reduce-motion`。
- `login` 页自定义动效多，但当前没有接入全局动效开关。

修改目标：

- `room` 根节点改为 `class="room-page {{!animationEnabled ? 'reduce-motion' : ''}}"`。
- `voice-select` 增加 `animationEnabled` data，`onLoad/onShow` 同步 `app.globalData.animationEnabled`，根节点绑定 `reduce-motion`。
- `login` 增加 reduce-motion 兼容：接入态动画可跳过，loading 仍保留静态反馈。
- `app.wxss` 增加全局 `.reduce-motion *` 兜底规则，避免只在页面局部写规则。

验收：

```bash
rg -n "class=.*reduce-motion" miniprogram/pages/*/*.wxml
rg -n "\\.reduce-motion \\*" miniprogram/app.wxss
```

期望：核心页面均命中，`app.wxss` 有全局兜底。

### P0.5 音色分类 Emoji 清理

问题：

- `backend/src/main/resources/voices.json` 分类 icon 使用 `👩`、`👨`、`😂`。
- `miniprogram/pages/voice-select/voice-select.wxml` 会渲染后端 icon，违反全站禁用彩色 Emoji 约束。

修改目标：

- 将 icon 改为纯文本代码，如 `F`、`M`、`FX`，或新增 `iconType` 供前端映射 CSS 线框图标。
- 前端不直接信任后端 icon 为可渲染字符，统一走 `voice-icon--female/male/fx` 样式。
- 身份页内嵌音色抽屉与 `voice-select` 页面保持同一套分类视觉。

验收：

```bash
rg -n "[\\x{1F300}-\\x{1FAFF}\\x{2600}-\\x{27BF}]" backend/src/main/resources miniprogram
```

期望：运行时文件无彩色 Emoji；`✓`、`✕` 这类符号如保留，需确认是单色文本且不承担复杂图标语义。

### P0.6 自动归档误判修复

问题：

- `backend/src/main/java/com/smartrecord/task/RoomTimeoutTask.java` 当前超时处理只检查批次，可能误判自由流转空间。

修改目标：

- 同时检查 `sr:room:{rid}:events` 与 `sr:room:{rid}:batches`。
- 如果空间有流向事件，则走归档/结算；无任何事件和批次才关闭或清理。
- 记录日志只包含 roomId/roomNo/计数，不输出用户敏感数据。

验收：

```bash
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q
```

补充用例：构造只有 `events` 无 `batches` 的空间，超时后应归档而不是直接解散。

### P0.7 洞察成员密度修复

问题：

- `ScoreServiceImpl.getRoomInsight` 用 `redisTemplate.opsForHash().size(metaKey)` 计算成员数，但 meta 包含 owner/status 等字段，会导致密度偏差。

修改目标：

- 成员数来源改为排行榜 ZSet size、成员列表、或明确的 member hash/set。
- insight 中 density、activeRatio 等指标只基于真实成员。

验收：

- 2 人空间不应因为 meta 字段被计算成 5+ 成员。
- 后端编译通过。

## 3. P1 页面级优化

### P1.1 全局视觉令牌收敛

目标：

- `app.wxss` 保留旧 `.glass-card` 兼容，但新页面优先使用 `sr-card`、`sr-section-head`、`sr-title`、`sr-kicker`、`sr-status`、`sr-button`。
- 减少每张卡片的 `backdrop-filter`、大 box-shadow、重复渐变。
- 统一 `#0A84FF`、`#00C8FF`、`#30D158`、`#FF453A` 的使用语义。

文件：

- `miniprogram/app.wxss`
- `miniprogram/pages/*/*.wxss`
- `miniprogram/components/*/*.wxss`

验收：

- 首页首屏不会读成单一蓝色发光模板。
- 普通列表滚动时不卡顿。
- 大数字、长昵称、长空间识别码不会撑破布局。

### P1.2 TabBar 图标统一

目标：

- 当前四个 Tab：空间、策略、镜像、身份。
- 图标全部使用同一风格：线框、圆角、低复杂度、24px 逻辑尺寸、未选中灰白、选中蓝色。
- 禁止混用拟物、填充、方块占位图。

文件：

- `miniprogram/app.json`
- `miniprogram/images/tab-*.png`

验收：

- 微信开发者工具模拟器中四个 Tab 大小一致，选中态色彩一致。
- `策略` 图标不要继续暗示玄学工具。

### P1.3 空间页

现状：

- 页面已大量重构为终端风，`room.wxss` 已达 2600+ 行，组件很多。
- 根节点 reduce-motion 缺失。
- 分享二维码字段读取错误。
- 动画很多，局部已写 reduce-motion，但缺全局兜底。

优化任务：

- 压缩首屏复杂度：未入空间态只展示「空间模式」「配置预览」「启动空间」「接入空间」四组，不堆叠过多说明。
- 已入空间态明确三层：顶部状态栏、成员/座位区、记录/流水区。
- 成员 4x4 网格必须配 `minmax(0,1fr)`、大数字格式化、昵称截断。
- 记分键盘 Loading/提交状态文本不抖动。
- WS 重连遮罩使用 `wx:if` 或低成本透明度切换，文案简短。
- 分享面板二维码加载失败要展示重试，不空白。

文件：

- `miniprogram/pages/room/room.wxml`
- `miniprogram/pages/room/room.wxss`
- `miniprogram/pages/room/room.js`
- `miniprogram/components/flow-log-panel/*`
- `miniprogram/components/space-scan-panel/*`
- `miniprogram/components/matrix-overview/*`

验收：

- 未登录、未入空间、自由流转、本局录入、分享面板、结算确认、WS 重连各状态均可见且不重叠。
- 16 人、大分数、长昵称场景不溢出。

### P1.4 策略页

现状：

- 已重写为策略核心状态机，`fortune.js` 有敏感词替换和长链 timer。
- `fortune.wxss` 动画密集，已有 reduce-motion 规则。

优化任务：

- 彻底将用户可见文案稳定在「策略/状态/风险/行动」体系。
- `generate` 流程超过 1.5 秒必须出现状态反馈，超过阈值可继续等待/重试。
- reduce-motion 下跳过日志打字机和 staged timeout，直接显示静态生成态或结果。
- 所有 timer 在 `onHide/onUnload` 清理。
- 分享策略卡不能出现敏感词；保存失败、授权失败要短提示。

文件：

- `miniprogram/pages/fortune/fortune.js`
- `miniprogram/pages/fortune/fortune.wxml`
- `miniprogram/pages/fortune/fortune.wxss`
- `backend/src/main/java/com/smartrecord/service/impl/FortuneServiceImpl.java`

验收：

- `rg` 用户可见 WXML/JS fallback 无高风险词。
- 强制 reduce-motion 后无打字机、扫描、呼吸持续动画。

### P1.5 镜像页与档案页

现状：

- `mirror/index`、`mirror-dossier` 已有 Persona Terminal 方向。
- 雷达图组件已有 `reduceMotion` 属性，部分 Canvas 守卫可继续强化。

优化任务：

- 镜像页回答「我是什么行为画像」，减少玄学或长篇人格判读。
- MBTI 测试、直接选择、档案生成三个入口层级清晰。
- 雷达锁定态解释控制在 1-2 句，样本不足时展示明确解锁条件。
- 档案页适合分享，但不要出现长段 AI 文案；每段判读 50 字内。
- `radar-chart` 在 `detached` 时同时清理 scan/pulse/tooltip timer。

文件：

- `miniprogram/pages/mirror/index.*`
- `miniprogram/pages/mirror-dossier/mirror-dossier.*`
- `miniprogram/components/radar-chart/*`
- `miniprogram/components/mbti-*/*`
- `miniprogram/components/mirror-mbti-card/*`
- `miniprogram/components/persona-signal/*`

验收：

- 未校准、已校准、样本不足、3+ 样本、档案分享五种状态均不空白。
- reduce-motion 下雷达图无持续扫描。

### P1.6 身份页、设置页、音色页

现状：

- 身份页已是身份终端方向，并内嵌声音协议抽屉。
- 设置页仍偏传统设置卡。
- `voice-select` 是独立音色页，根节点与 Emoji 需要修。

优化任务：

- 身份页首页只保留身份、等级、数据摘要、成就、系统控制入口。
- 设置页降级为二级「系统控制」，用协议行/状态点替代传统表单行。
- 音色页改成「声音协议」终端抽屉风：左侧分类、右侧音色列表、单例试听、当前选中态。
- `voice-select` 和身份页内嵌抽屉共用分类映射和样式思想。
- 试听音频使用单例 InnerAudioContext，离开页面停止播放。

文件：

- `miniprogram/pages/profile/profile.*`
- `miniprogram/pages/settings/settings.*`
- `miniprogram/pages/voice-select/voice-select.*`
- `miniprogram/utils/voice.js`
- `backend/src/main/resources/voices.json`

验收：

- 声音、动效、触感开关即时生效并防抖保存。
- 音色试听不会重复创建多个音频实例。
- 关闭声音协议后子项折叠不造成布局跳动。

### P1.7 结算页与日志页

优化任务：

- `settle` 保持任务档案感：摘要、排行、趋势、网络、人格信号。
- `score-records` 保持脉冲日志感：曲线、历史列表、空状态、加载态。
- 大样本下分页/下拉刷新不高频 setData 大对象。
- 图表组件要支持 reduce-motion 入参，入场动画可跳过。

文件：

- `miniprogram/pages/settle/*`
- `miniprogram/pages/score-records/*`
- `miniprogram/components/score-chart/*`
- `miniprogram/components/score-timeline/*`
- `miniprogram/components/yield-chart/*`

验收：

- 无历史数据、有历史数据、样本不足锁定、加载失败四种状态都完整。
- 低端机滚动不卡顿。

## 4. P2 共享组件与代码质量

### P2.1 Canvas reduce-motion 标准化

为所有 Canvas 组件统一属性：

```js
reduceMotion: { type: Boolean, value: false }
```

要求：

- reduce-motion 下 `_startEntryAnimation()` 直接 `_draw(1)`。
- 扫描/脉冲 timer 不启动。
- `detached` 清理 `requestAnimationFrame`、`setTimeout`、tooltip timer。

重点文件：

- `components/radar-chart/radar-chart.js`
- `components/score-chart/score-chart.js`
- `components/score-timeline/score-timeline.js`
- `components/trend-chart/trend-chart.js`
- `components/yield-chart/yield-chart.js`
- `components/force-graph/force-graph.js`

### P2.2 术语统一

目标：

- 运行时文案优先从 `miniprogram/utils/terminology.js` 取。
- 清理残留「房间号」「我的」「运势」等旧主线词；必要兼容字段名不改 API，但 UI 文案改为「空间识别码」「身份」「策略」。
- 后端 Prompt 和 fallback 也保持同一词库。

验收：

```bash
rg -n "房间号|我的|运势|占卜|塔罗|抽牌|赌博|筹码|赢钱|赚钱" miniprogram backend/src/main/java backend/src/main/resources
```

允许命中：敏感词过滤列表、开发注释、兼容 API 字段；不允许用户可见 WXML、fallback、分享文案命中。

### P2.3 样式体积治理

目标：

- `room.wxss`、`profile.wxss`、`fortune.wxss` 已超过 1000 行，后续逐步把重复按钮、卡片、状态点、抽屉样式沉到 `app.wxss` 或组件局部。
- 不做一次性大重构；每次只抽取已重复 3 次以上的模式。

验收：

- 抽取后视觉不变。
- 页面局部样式只保留页面特有布局。

## 5. 微信开发者工具巡检清单

待授权截图/自动化后，在 DevTools 模拟器逐页验证：

1. 登录页：未登录、授权中、接入完成、失败态。
2. 空间页：未入空间、创建配置、接入码输入、扫码接入、自由流转、本局录入、分享面板、WS 重连、结算确认。
3. 策略页：idle、generating、success、error、poster_generating、poster_preview。
4. 镜像页：未校准、测试弹窗、直接选择、雷达锁定、雷达解锁、档案页。
5. 身份页：未登录、已登录、编辑昵称头像、等级、成就、声音抽屉、退出确认。
6. 设置页：声音/动效/触感开关、保存失败。
7. 音色页：分类切换、试听、选中、返回。
8. 结算页：加载、空数据、完整档案。
9. 日志页：加载、下拉刷新、样本不足、历史列表。

每页验收项：

- 首屏无重叠、无横向溢出。
- 关键按钮中文明确，英文只作弱装饰。
- reduce-motion 开启后无持续动画。
- 1.5 秒以上等待有反馈。
- 不出现彩色 Emoji 和高风险词。
- 触感开关关闭时不会震动。
- 声音关闭时不会播放 TTS 或情绪音效。

## 6. 静态验证命令

```bash
# 文档旧事实
rg -n "Happy记分器|赛博运势|运势模块|纯 Redis 流转架构|打牌期间|数据库表（8 张）|# ⚡️" AGENTS.md CLAUDE.md

# 敏感词和 Emoji
rg -n "棋牌|赌博|赌|下注|押注|筹码|牌局|牌桌|打牌|麻将|扑克|德州|梭哈|赢钱|赚钱|发财|稳赚|必胜|翻本|追损|运势|算命|占卜|塔罗|抽牌|神谕|卦象|黄历|风水|开运|转运|改运|预测输赢|胜率提升" miniprogram backend/src/main/java backend/src/main/resources
rg -n "[\\x{1F300}-\\x{1FAFF}\\x{2600}-\\x{27BF}]" miniprogram backend/src/main/resources

# 动效与日志
rg -n "transition:\\s*all|requestAnimationFrame|setInterval|setTimeout|console\\.log|console\\.warn|console\\.error" miniprogram/pages miniprogram/components miniprogram/utils

# 后端编译
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q
```

## 7. 执行顺序建议

1. 先修 P0.2-P0.5 前端硬问题，马上降低泄密、失效和审核风险。
2. 再修 P0.6-P0.7 后端归档/洞察准确性，编译验证。
3. 进入 P1 页面级体验收敛，先空间页，再策略页，再身份/音色。
4. 最后做 P2 组件抽取与 Canvas reduce-motion 标准化。
5. 用户授权 DevTools 屏幕捕获或自动化后，按第 5 节做逐页截图巡检。
