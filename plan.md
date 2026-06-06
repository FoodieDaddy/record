# Smart Record 第 2 轮全量测试与优化计划

生成时间：2026-06-06 19:12 CST
前置快照：`fbeae95 test: 第2轮迭代前置快照 [2026-06-06 18:47]`
执行边界：本文件写入后由 Claude Code 执行改动；当前 Computer Use Agent 不直接模拟 Claude 子 Agent。

## 1. 当前基线

### 1.1 已验证事实

- 基础设施：MySQL `13306`、Redis `16379` 已运行；后端 `18080` 可访问。
- 微信开发者工具：项目 `miniprogram/` 已加载，当前基础库 `3.16.1`，模拟器为 iPhone 14 Pro Max。
- 页面清单来自 `miniprogram/app.json`，共 10 个页面：
  - `pages/login/login`
  - `pages/room/room`
  - `pages/fortune/fortune`
  - `pages/mirror/index`
  - `pages/mirror-dossier/mirror-dossier`
  - `pages/profile/profile`
  - `pages/settings/settings`
  - `pages/voice-select/voice-select`
  - `pages/settle/settle`
  - `pages/score-records/score-records`
- 四个主 Tab 已通过 DevTools 截图审查：
  - 空间：6 人房 `R94MXA` 显示在线、成员网络、流向日志、空间扫描、断开空间。
  - 策略：结果态显示主题、洞察、行动优势、风险提示、重新推演、发送策略卡、倒计时。
  - 镜像：空态显示人格协议、任务镜像锁定、可信度、人格偏差、系统判读、信号、演化；直接选择可打开 MBTI 矩阵编辑器。
  - 身份：显示身份档案、数据矩阵、等级、成就、声音/动效/触感协议；音色选择抽屉可打开并切换分类。
- API 多账号矩阵 `/tmp/smart-record-round2-matrix.json`：
  - 1-12 人场景均通过，`failureCount = 0`。
  - 16 人加入通过；第 17 人返回 `4003`；重复加入返回 `4009`。
  - 排名总和为 0，Redis scores/events 与接口返回一致。
- DevTools 多账号房间 `/tmp/smart-record-devtools-users.json`：
  - `roomId=321603091865296896`，`roomNo=R94MXA`。
  - API 初始流向：`D1 -> D2 21`。
  - DevTools UI 流向：`冷光复盘 -> D5 7`。
  - UI 显示 6 / 16 成员、两条流向日志；接口排名 6 人、总和 0；Redis `events=2`；MySQL 活跃房间 status=0，成员 6，未结算成员 `final_score/quit_time` 为空。

### 1.2 当前风格基线

- 主视觉：深空黑底、霓虹青/蓝、弱紫光、终端面板、数据分区，整体已接近「赛博朋克 × 太空飞行器」。
- 已满足项：
  - 运行时页面未扫描到 AGENTS 禁止的高风险词。
  - `room.wxml`、`voice-select.wxml`、`profile.wxml`、`settings.wxml`、`fortune.wxml`、`mirror`、`settle`、`score-records` 均有 reduce-motion 根绑定或组件级绑定。
  - `backend/src/main/resources/voices.json` 分类 icon 为 `F/M/FX`，无原生彩色 Emoji。
  - `miniprogram/utils/score-ws.js` 的 `DEBUG_WS=false`，没有主动打印完整 WS URL。
  - `RoomTimeoutTask` 已同时检查 `events` 与 `batches`。
  - `ScoreServiceImpl.getRoomInsight` 当前按事件参与用户计算密度，不再直接使用 meta `HLEN`。

## 2. 目标

### 2.1 必须达成

- 所有页面维持黑底、霓虹青 `#00FFFF`、电光紫 `#8B00FF`、深空黑、荧光橙点缀的终端风格，不出现普通扁平表单页。
- 所有主流程可验证：创建空间 -> 进入空间 -> 成员互动 -> 积分变动 -> 图表/日志显示 -> 退出/解散或封存。
- 前端显示、接口返回、Redis 运行期数据、MySQL 归档/成员状态一致；不一致标记 Critical。
- 2-5 人必须在微信开发者工具「工具 -> 多账号调试」内复测；6 人 DevTools 原生界面因工具限制标记待人工确认，API 矩阵继续覆盖 6-12 人。
- Critical Issue 清零后提交；若存在 Critical，进入下一轮，最多 5 轮。

### 2.2 风格量化验收

- 每页第一屏必须出现至少 3 个终端信号：HUD 标题、数据编号/状态码、细描边面板、扫描线/网格、仪表盘式数据密度。
- 主按钮高度保持 72rpx-88rpx；危险操作透明底红色细描边。
- 普通正文透明度不得低于 0.40；关键中文文案必须可读。
- reduce-motion 关闭后无持续扫描、粒子、打字机、Canvas 脉冲、长链 timer 残留。
- 所有正负分数只显示一个符号：正数 `+7`，负数 `-7`，零 `0`。

## 3. 页面级检查清单

| 页面 | 功能检查 | 布局检查 | 风格检查 | 数据检查 |
|---|---|---|---|---|
| `pages/login/login` | 登录按钮、授权态、失败 toast、加载步骤 | iPhone 14 Pro Max 与窄屏无溢出 | 终端启动感、无普通授权页感 | 登录后 `app.globalData.token/userInfo` 有效，不打印 token |
| `pages/room/room` | 创建、接入、扫码、复制识别码、成员选择、数值键盘、提交、退出、分享面板、封存弹窗 | 1-16 人成员布局不遮挡；正负分不溢出；抽屉懒渲染 | 航空仪表盘密度、金属边框、玻璃面板、扫描线克制 | 接口 ranking/chart/insight/network 与 Redis/MySQL 一致 |
| `pages/fortune/fortune` | 生成策略、超时等待/重试、重新推演、发送策略卡、保存/关闭海报 | idle/generating/success/error/poster 五态无遮挡 | 去除卡牌/抽取隐喻，改为策略核心/飞控推演 | `fortune/today` 缓存/force 行为一致，敏感词 fallback 生效 |
| `pages/mirror/index` | 20 题校准、直接选择、同步人格、生成档案 | MBTI 编辑器按钮触达面积足够，底部按钮不被 Tab 遮挡 | 矩阵式 HUD、雷达/信号克制 | profile/stats 返回与页面锁定态一致 |
| `pages/mirror-dossier/mirror-dossier` | 生成档案卡、复制、预览、保存相册、关闭 | 图片预览不裁切；空态/加载态清楚 | 行为画像档案感，不写长段鸡汤 | 3+ 封存后解锁条件与 API 一致 |
| `pages/profile/profile` | 昵称/头像、本地乐观更新、防抖保存、日志入口、音色抽屉、开关、断开终端 | 成就网格、控制区、音色抽屉无重叠 | 身份终端，避免普通设置页 | `/user/me`、`/user/detail`、`/identity-level` 与显示一致 |
| `pages/settings/settings` | 声音/动效/触感开关、音色选择、抽屉关闭 | 开关文字 ACTIVE/OFF 不抖动 | 航电式开关，线框图标 | Storage 与 `/user/detail` 延迟保存一致 |
| `pages/voice-select/voice-select` | 加载目录、切换分类、试听、选择、关闭返回 | 底部抽屉在 reduce-motion 下不滑动残留 | 分类图标 CSS 线框，无 Emoji | 单例音频 stop -> src -> play，销毁后可再次进入 |
| `pages/settle/settle` | 加载结算、排名、返回、异常 toast | 冠军/排名/成员分数不遮挡 | 封存报告终端感 | `room.all_record`、`room_member.final_score/quit_time` 与页面一致 |
| `pages/score-records/score-records` | 日志加载、趋势/收益曲线、返回 | 图表空态、锁定态、滚动无错位 | 复盘数据终端，不做营销卡片 | `/score/trend`、`/score/yield-log` 与历史归档一致 |

## 4. 1-12 人多账号联调计划

### 4.1 DevTools 多账号调试

- 入口：微信开发者工具 -> 工具 -> 多账号调试。
- 已观察限制：界面提示只能同时选择 4 个测试号；主模拟器 + 4 个虚拟账号最多形成 5 个 UI 账号。
- 必须执行：
  - 2 人：主账号创建空间，测试号接入，双方各记录 1 次，校验日志和分数。
  - 3-4 人：主账号创建空间，多测试号接入，检查成员网格、目标选择、分数总和 0。
  - 5 人：主账号 + 4 测试号，检查成员状态、流向日志、空间扫描和接口一致性。
- 6 人：DevTools 原生 UI 无法一次选择 5 个测试号，标记 `待人工确认：需要第二台设备/真机/工具突破限制`；不得在 changelog 中写成 DevTools 6 人已通过。

### 4.2 API/数据层覆盖

- 1 人：创建、空封存、MySQL status/final/quit_time 验证。
- 2 人：双向流向，排名总和 0，events 数量正确。
- 3-4 人：链式流向、重复操作、权限校验。
- 5-8 人：批量加入、并发 transfer、图表/网络密度。
- 9-12 人：成员列表滚动、排行榜排序、Redis/MySQL 一致。
- 16 人：上限通过。
- 17 人：加入失败，返回 `4003`，前端温和 toast。
- 重复加入：返回 `4009`，前端不重复插入成员。

## 5. 问题清单

| ID | 页面/模块 | 复现步骤 | 实际结果 | 预期结果 | 影响 | 优先级 | 修复建议 | 验收 |
|---|---|---|---|---|---|---|---|---|
| R2-01 | `miniprogram/pages/room/room.wxml:421` 与 `room.wxs:5-20` | 6 人房内执行正向流向，观察成员分数 | 正数显示 `++7`、`++21` | 正数只显示 `+7`、`+21` | 分数视觉与数据格式不一致，影响核心记录可信度 | Critical | 删除 WXML 额外 `+`，统一由 `fmt.formatScore` 负责符号；补充 `displayScore` 正/负/零验收 | DevTools 与 accessibility tree 均无 `++` |
| R2-02 | DevTools 多账号 | 工具 -> 多账号调试，尝试选择 5 个测试号形成 6 人 UI | 工具限制只能选择 4 个测试号 | 2-6 人均通过 DevTools 多账号 | 6 人 UI 联调无法自动确认 | P0 待人工确认 | changelog 明确写工具限制；API 覆盖 6-12；若可用真机或第二 DevTools 会话再补 6 人截图 | 不得声称 DevTools 6 人通过；6-12 API 必须通过 |
| R2-03 | `miniprogram/pages/fortune/fortune.*` | 打开策略页，进入 success 态 | 第一屏仍有卡牌/抽取感，如 `card-inner`、`终审者 THE JUDGE`，信息密度偏低 | 策略核心/飞控推演面板，避免卡牌隐喻 | 风格偏离「太空飞行器策略终端」 | P1 | 将 idle/generating/success 改为 avionics core、航段状态、风险矩阵；替换卡牌命名和视觉 | 第一屏有策略主题、风险、行动参数，无遮挡 |
| R2-04 | `miniprogram/utils/score-ws.js:53` | 建立房间 WS 连接 | token 位于 query，虽然 DEBUG 关闭但仍有被工具地址/异常捕捉风险 | 优先使用更安全传输或至少全链路脱敏 | 安全技术债 | P1 | 检查后端是否支持 `Sec-WebSocket-Protocol: access_token.<jwt>`；若支持前端改 protocol；若暂不支持，新增脱敏注释和失败日志屏蔽 | 前端不打印 token，日志/错误无完整 URL |
| R2-05 | `miniprogram/pages/voice-select/voice-select.js:27-33,47-50,103-104` | 关闭动效后进入/关闭独立音色页 | 仍用固定 `setTimeout` 滑入/返回，未保存 timer，module 级 audioCtx 销毁后重入需复核 | reduce-motion 下直接显示/返回；timer 可清理；音频单例可重入 | 动效静默与稳定性风险 | P1 | 保存 `_sheetTimer/_backTimer/_confirmTimer`，onUnload 清理；reduce-motion 下直接执行；检查 audioCtx 生命周期 | 关闭动效后无滑动动画，重复进入可试听 |
| R2-06 | `miniprogram/pages/profile/profile.*` | 打开音色抽屉切换 STANDARD/MALE/SPECIAL | 分类切换正常，但试听/选择回写未完成本轮 UI 取证 | 试听、选择、保存、Storage/API 回写全部可验 | 设置数据一致性风险 | P2 | Agent D 补测试听和选择；Agent C 校验 `/user/detail` 保存 | 选择后 profile 显示新音色，刷新后仍保留 |
| R2-07 | `miniprogram/components/radar-chart/*`、`score-timeline/*`、`fortune.js` | reduce-motion=false/true 切换后进入镜像/记录页 | 已有部分守卫，但 Canvas/timer 需逐项验证 onHide/onUnload 清理 | 所有动画受全局开关约束且可清理 | 性能与静默风险 | P2 | Agent D 用设置页关闭动效后巡检；Agent A/B 只修确认失败项 | Console 无新增 timer/Canvas 异常 |
| R2-08 | DevTools Console | 页面切换后观察 Console | 存在基础库灰度、合法域名警告、`WAServiceMainContext` timeout | 区分工具噪声与应用错误 | 测试判断风险 | P2 | 只将带项目文件栈的错误列为应用问题；保留工具噪声说明 | changelog 不把基础库噪声误报为 app bug |

## 6. 执行方案

### 6.1 Agent A：UI/样式修复

- 负责路径：
  - `miniprogram/pages/room/room.wxml`
  - `miniprogram/pages/room/room.wxss`
  - `miniprogram/pages/fortune/fortune.wxml`
  - `miniprogram/pages/fortune/fortune.wxss`
  - `miniprogram/pages/profile/profile.wxss`
  - `miniprogram/pages/voice-select/voice-select.wxss`
- 依赖：
  - 不改变 API 字段名。
  - 与 Agent B 的 room 分数格式修复同步。
- 改动范围：
  - 修复 `++` 符号。
  - 策略页去卡牌隐喻，改为飞控策略核心。
  - 保持主色：霓虹青 `#00FFFF`、电光紫 `#8B00FF`、深空黑、荧光橙点缀；可兼容现有 `#0A84FF/#00C8FF/#5E5CE6` token，但不得退回普通卡片页。

### 6.2 Agent B：功能逻辑修复

- 负责路径：
  - `miniprogram/pages/room/room.js`
  - `miniprogram/pages/room/room.wxs`
  - `miniprogram/pages/fortune/fortune.js`
  - `miniprogram/pages/voice-select/voice-select.js`
  - `miniprogram/utils/score-ws.js`
- 依赖：
  - 与 Agent C 确认 WS 鉴权兼容。
  - 与 Agent D 确认 UI 操作不破坏已通过的空间流向。
- 改动范围：
  - 分数符号只保留一处格式化。
  - 音色页 timer 清理与 reduce-motion 守卫。
  - WS token 传输/日志脱敏方案。
  - 所有新增注释使用中文，只解释改动原因。

### 6.3 Agent C：数据层检查

- 负责路径：
  - `backend/src/main/java/com/smartrecord/task/RoomTimeoutTask.java`
  - `backend/src/main/java/com/smartrecord/service/impl/ScoreServiceImpl.java`
  - `backend/src/main/java/com/smartrecord/config/WebSocketConfig.java`
  - `backend/src/main/java/com/smartrecord/service/impl/ws/ScoreWebSocket.java`
  - `backend/src/main/resources/voices.json`
  - 相关 Mapper/DTO 仅在必要时触碰
- 依赖：
  - 与 Agent B 确认 WS 鉴权方式。
  - 与 Agent D 共享 1-12 人测试数据。
- 改动范围：
  - 验证 events/batches 自动结算逻辑保持正确。
  - 验证 insight 密度、network、chart、ranking 对自由流转一致。
  - 验证 voice catalog icon 无 Emoji。
  - 若无法安全改 WS protocol，标记 `待人工确认` 并保留 query 兼容。

### 6.4 Agent D：测试验证

- 负责路径：
  - `plan.md`
  - `/tmp/smart-record-round2-matrix.json`
  - `/tmp/smart-record-devtools-users.json`
  - `changelog.md`
- 依赖：
  - 等待 A/B/C 完成后回归。
- 必跑命令：
  - `docker ps`
  - `curl -s -o /dev/null -w "%{http_code}" http://localhost:18080/swagger-ui/index.html`
  - `cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q`
  - 重新执行 1-12 人 API 矩阵，输出 failureCount。
  - DevTools 多账号 2-5 人 UI 复测；6 人按工具限制标记待人工确认。
- 记录要求：
  - 每个失败项写页面、步骤、实际/预期、影响、优先级。
  - `changelog.md` 必须包含改动文件清单、Before/After、测试结果、未解决问题。

## 7. 数据一致性验收

- 进行中房间：
  - `/score/room/{roomId}/ranking` 总和为 0。
  - `/score/transfer/room/{roomId}` 最新流水与 UI FLOW LOG 一致。
  - Redis `sr:room:{rid}:scores` 与 ranking 一致。
  - Redis `sr:room:{rid}:events` 数量与流水一致。
  - MySQL `room.status=0` 时成员 `quit_time` 为空。
- 结算房间：
  - `room.status=1` 或对应封存状态正确。
  - `room.all_record` 包含 transferEvents 或 round records。
  - `room_member.final_score` 与结算页排名一致。
  - `room_member.quit_time` 已写入。
- 边界：
  - 16 人加入成功。
  - 17 人返回 `4003`。
  - 重复加入返回 `4009`。
  - 极端值 `99999999` 可提示/限制；超出值不写入。
  - 无权限退出/解散/确认返回业务 code，不暴露堆栈。

## 8. 回归测试清单

- [ ] 前置确认：当前分支有前置快照提交，工作区允许修改。
- [ ] 页面巡检：10 个页面均截图或 accessibility tree 取证。
- [ ] 空间主流程：创建 -> 接入 -> 记录 -> 日志 -> insight/network/chart -> 退出/封存。
- [ ] 多账号：DevTools 2、3-4、5 人通过；6 人若仍受工具限制，写 `待人工确认`。
- [ ] API：1-12 人矩阵 `failureCount=0`。
- [ ] 上限：16 人通过、17 人失败、重复加入失败。
- [ ] 视觉：无 `++`，无普通扁平页，无彩色 Emoji，无卡牌抽取隐喻。
- [ ] 动效：关闭动效后所有页面无持续扫描/Canvas/timer 残留。
- [ ] 安全：Console/日志不输出 JWT、微信 code、完整 WS URL、OSS 签名 query。
- [ ] 编译：后端 Maven compile 通过。
- [ ] changelog：Claude Code 生成 `changelog.md` 且包含测试结果和未解决问题。

## 9. Claude Code 启动指令

请阅读根目录 `plan.md`，并由 Claude Code 执行，不要由当前 Computer Use Agent 自己直接调用或模拟子 Agent。

在 Claude Code 内开启 4 个并行子任务：

- Agent A：UI/样式修复，确保赛博朋克 × 太空飞行器风格。
- Agent B：功能逻辑修复，处理积分、房间、权限。
- Agent C：数据层检查，处理数据库读写、边界、并发一致性。
- Agent D：测试验证，执行 `plan.md` 测试用例并记录结果。

每个子任务执行前必须确认：

- 负责模块的文件路径。
- 与其他模块的依赖关系。
- 改动影响范围。

所有改动必须：

- 添加必要中文代码注释说明改动原因。
- 不破坏已通过功能。
- 符合赛博朋克 × 太空飞行器视觉规范。
- 无法自动确认的问题标记 `待人工确认`。

全部完成后，由 Claude Code 汇总生成 `changelog.md`，包含：

- 改动文件清单。
- 每项改动 Before/After 描述。
- 测试结果。
- 未解决问题清单。
