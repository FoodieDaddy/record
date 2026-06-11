## 太空记分器系统深度审查 — 架构与功能改进建议

本文档基于对后端（Java 21 / Spring Boot 3.2.5）、小程序前端（原生 WXML/WXSS/JS）、管理后台（Vue 3 + TypeScript + Vite）、云函数、部署配置的全量代码审查，按优先级归纳出需要添加和改进的方面。

---

### 一、后端（Spring Boot）

#### 1.1 测试覆盖率严重不足 [P0]

当前全项目仅 16 个测试用例（10 单元 + 6 集成），核心业务逻辑几乎无覆盖。以下模块急需补充测试：

- `RoundRecordServiceImpl`：轮次状态机是整个系统中最复杂的业务逻辑（约 800 行，涵盖 start→submit→confirm→apply 的完整生命周期和超时、驳回、撤销等分支），目前零测试。
- `FortuneServiceImpl`：LLM 调用、兜底策略、敏感词过滤、用户标签计算、策略原型选取，全部无测试。
- `MirrorProfileServiceImpl` / `MirrorStatsServiceImpl`：MBTI 计算、五维雷达数据聚合无测试。
- `AchievementServiceImpl`：成就解锁条件判断、装备互斥逻辑无测试。
- `IdentityLevelServiceImpl`：等级计算公式无测试。
- 所有 10 个 Admin Controller 无测试，管理员认证（BCrypt + 独立 JWT）无测试。
- 已有测试质量也有限：`RoomServiceTest.testCreateRoom_Success` 用 `assertDoesNotThrow` 包裹 try-catch，可能静默吞异常；`ScoreServiceTest` 仅覆盖了异常路径。

建议：为核心 Service 补充 Mockito 单元测试，目标至少覆盖每个 Service 的正常路径 + 2-3 个异常路径。轮次状态机建议做参数化测试覆盖全部状态转换。

#### 1.2 Admin 层架构违规 [P1]

多个 Admin Controller 直接注入 Mapper 绕过 Service 层，违反项目自定义的"Controller 只做参数校验和转发"规则：

- `AdminAdminController` 直接使用 `AdminMapper` 做 CRUD（第 39/55/71 行）。
- `AdminFormationController`、`AdminMirrorController`、`AdminDirectiveController` 存在类似问题。

更严重的是，这些 Controller 直接将 Entity 作为 API 响应返回（`Admin`、`Room`、`RoomMember`、`UserMirrorProfile`、`FortuneLog`），导致数据库字段泄露到前端，包括 `openid`、`unionid`、`battle_persona_json` 等敏感信息。

建议：为每个 Admin 模块创建对应的 AdminXxxService 接口和实现，定义 AdminXxxResp DTO，禁止 Entity 直接暴露。

#### 1.3 Redis 与 MySQL 混合事务一致性 [P1]

`ScoreServiceImpl.undoLastScore`（约第 1606 行）声明了 `@Transactional`，但内部混合了 Redis 操作（读取/修改 ZSet）和 MySQL 操作（删除记录）。MySQL 事务回滚时 Redis 操作不会回滚，导致数据不一致。类注释已经明确说明"移除类级别的 @Transactional 声明"，但这个方法仍然使用了声明式事务。

同样的模式在 `doSettleRoom` 中已经正确处理（使用 `TransactionTemplate` 编程式事务），但 `undoLastScore` 和个别其他方法没有统一。

建议：统一改为编程式事务，Redis 反向操作放在事务提交成功后执行。

#### 1.4 封存操作性能瓶颈 [P1]

`ScoreServiceImpl.doSettleRoom`（第 337-602 行）在大编队（16 人 + 数百条转账事件）下延迟可能达到秒级，因为它在一个同步流程中执行了：多次 Redis 网络往返、全量 events JSON 解析、allRecord 大 JSON 序列化、编程式事务写 MySQL（archiveRoomRecord + N 次 member update）、Redis 清理、批量用户信息加载、双重循环 O(events × users) 的图表数据构建。

建议：将图表数据构建移到异步线程（已有 `asyncExecutor` 虚拟线程池），封存响应先返回核心数据，图表数据通过 WebSocket 推送或前端延迟拉取。

#### 1.5 代码重复 [P2]

以下模式在代码中出现了多处重复实现：

- **用户昵称加载**（至少 5 处）：`ScoreServiceImpl.getUserNickname`（第 290 行）、`batchLoadUsersByIds`（第 1417 行）、`loadNicknameMap`（第 1472 行）、`UserServiceImpl.getUserNickname`（第 618 行）、`RoundRecordServiceImpl.buildRespFromRedis` 内循环（第 688 行）。每处都是"Redis 缓存 → DB 降级"模式，但回写缓存的细节不一致。
- **封存逻辑**两套实现：`doSettleRoom`（第 337-602 行）和 `doSettleRoundRecordRoom`（第 607-790 行）的成员快照构建、Redis 清理、WebSocket 通知、图表数据构建几乎相同。
- **Redis TTL 刷新**分散在 4 处：`refreshRoomTtl`（第 1576 行）、`transferScore` 节流刷新（第 1231 行）、`initRoomRedis`、`applyRound`（第 510 行）。
- **JSON 解析**：`getRoomInsightFromDb` 和 `getRoomNetworkFromDb`（第 1026-1159 行）几乎相同的全量 JSON 解析逻辑。

建议：抽取 `UserNicknameResolver` 统一服务；封存流程抽取 `SettlePipeline` 模板方法；TTL 刷新集中到 `RoomTtlManager`。

#### 1.6 错误码重复 [P2]

`ErrorCode` 枚举中多个不同语义共用同一 code 值：4001 同时表示 `IDENTITY_NOT_FOUND`、`IDENTITY_EXPIRED`、`IDENTITY_NOT_RECOGNIZED`；4003 同时表示 `ACCOUNT_BANNED`、`ACCOUNT_LOGGED_OUT`、`ROOM_FULL`。前端无法通过 code 区分不同的业务场景。

建议：为每个语义分配独立的错误码。

#### 1.7 其他后端问题

- **魔法数字**：`ScoreServiceImpl.settleRoom` 使用 `room.getStatus() != 0` 判断（第 103 行），多处 `status == 0` / `status == 1`，应使用枚举常量。
- **FortuneServiceImpl.callLlm 使用 Hutool HttpRequest**（第 462 行）而非 Spring RestClient，不参与连接池管理、不参与 Micrometer 指标采集、不支持 Sentinel 熔断。
- **TTS 接口免认证**：`/tts/**` 在 JWT 白名单中（`WebMvcConfig` 第 38 行），任何人可免费调用消耗服务器资源。
- **系统健康检查硬编码**：`AdminSystemController.health`（第 37-69 行）WebSocket、CloudBase、TTS、导航引擎状态全部返回硬编码 "ok"。
- **告警系统空实现**：`AdminSystemController.alerts`（第 76-79 行）始终返回空列表。
- **RoomTimeoutTask 遗漏本局录模式**（第 65-76 行）：仅检查 Redis `events` ZSet，本局录模式（Mode 2）的编队如果事件存储在 MySQL `round_record` 表中，可能被误判为空编队而解散。
- **TransferScoreResp.amountDisplay 计算可疑**（第 1335 行）：`amount / 100.0` 暗示 amount 单位为"分"，但代码中没有相关说明。
- **getHistory N+1 查询**（`RoomServiceImpl` 第 436-509 行）：遍历成员时循环内可能触发 N 次 DB 查询。
- **getCareerCockpit 全量扫描**（`UserServiceImpl` 第 489-613 行）：查询用户所有历史记录 + 所有同局玩家，双重循环分析，无缓存。

---

### 二、小程序前端

#### 2.1 编队页（room）体积过大 [P0]

编队页是整个小程序最复杂的页面，JS 拆分为 8 个模块共约 2800 行，WXSS 拆为 9 个文件。虽然已经做过拆分重构，但以下问题仍然存在：

- **data 对象包含 130+ 字段**（`room.js` 第 48-264 行），意味着这个页面承载了远超合理范围的职责。封存结果数据（`settleNetworkNodes`、`settleNetworkLinks`、`settleInsight` 等）应该移入独立的 `settle-result` 组件。
- **状态清理代码重复 4+ 处**：相同的 25+ 字段重置模式出现在 `handleRoomNotFoundError`、`closeSettleOverlay`、`quitRoom` 的 owner 路径和 error 路径。应提取为 `resetRoomState()` 工具函数。
- **Timer 泄漏风险**（`room.js` 第 410-432 行）：`onUnload` 手动清理 6 个 timer 引用，但项目已有 `TimerManager` 工具（`utils/timer-manager.js`）却未被采用。
- **错误映射使用字符串匹配**（`pulse-handler.js` 第 26-33 行）：`msg.includes('已封存')` 这种模式脆弱且不可靠，应使用后端错误码。

#### 2.2 WebSocket Token 暴露 [P1]

`config.js` 第 104 行将 JWT token 放在 WebSocket URL 参数中：`url = ${base}/ws/score?roomId=${roomId}&token=${token}`。`score-ws.js` 第 8 行的注释声明应通过 `Sec-WebSocket-Protocol` header 传递，但实际实现仍使用 URL 参数。Token 可能出现在服务器访问日志、代理日志中。

建议：微信小程序的 `wx.connectSocket` 支持 `protocols` 参数，应将 token 放入 `Sec-WebSocket-Protocol: access_token.<jwt>`。

#### 2.3 Canvas 绘制代码重复 [P2]

`_fillLetterSpaced`、`_roundRect`、`_wrapText`、`_drawCorner` 等 Canvas 绘制方法在 `fortune.js` 和 `mirror/index.js` 中有完全相同的实现。

建议：提取 `utils/canvas-helpers.js` 共享模块。

#### 2.4 内容净化规则分散 [P2]

`fortune.js` 维护了独立的 `STRATEGY_TEXT_REPLACEMENTS`（第 5-40 行，35+ 条规则），`mirror-sanitize.js` 维护了 `MIRROR_TEXT_REPLACEMENTS`（40+ 条规则），两者有大量重叠但不统一。

建议：合并为一个可配置的净化模块 `utils/content-sanitizer.js`，按上下文（指令/镜像/通用）选择规则集。

#### 2.5 请求去重 inflight Map 无过期 [P2]

`request.js` 第 199 行的 inflight Map 用于 GET 请求去重，但如果某个请求的 Promise 永不 resolve（网络中断、服务端挂起），该 key 会永久存在，导致后续相同 URL 的请求永远被阻塞。

建议：为 inflight 条目设置最大 TTL（如 30s），超时自动清除。

#### 2.6 其他前端问题

- **voice.js 使用旧词**（第 84 行）：`speakTransfer` 中使用"分"而非"脉冲"，违反产品语言规则。
- **behavior-logger.js 的 setInterval 无清理**（第 154-157 行）：定时器在 app 生命周期内永远运行，`onHide` 时不清理。
- **audio-manager.js 每次创建新 InnerAudioContext**（第 24 行）：文档描述是"stop → 换 src → play"，但代码每次创建新实例，可能造成资源泄漏。
- **login 页无重试机制**（`login.js` 第 41-44 行）：登录失败仅弹 toast，网络错误时无重试。
- **fortune 页无错误重试 UI**（第 630-648 行）：`_failCalc` 后页面复位到发射态但无可见的重试按钮。
- **room 页 6 秒安全定时器**（第 819-824 行）：用固定超时隐藏 loading 是 API 超时处理不完善的补丁。
- **project.config.json 安全设置**：`urlCheck: false`（第 15 行）和 `uploadWithSourceMap: true`（第 28 行）不适合生产环境。
- **订阅消息模板为空数组**：`room-action-handler.js` 第 13 行 `SUBSCRIBE_MESSAGE_TEMPLATES = []`，导致 `requestSubscribePermission` 始终立即 resolve，订阅消息功能实际不工作。

---

### 三、管理后台（admin-web）

#### 3.1 主题系统不一致 [P1]

`tokens.css` 定义了完整的深色/浅色变量体系，但 `components.css` 中大量使用硬编码的 `rgba(255,255,255,...)` 颜色值，绕过了变量系统。这意味着切换到深色模式时，许多组件仍会显示浅色背景，破坏整体视觉效果。

建议：全面审查 `components.css`，将所有硬编码颜色值替换为 CSS 变量引用。

#### 3.2 DataPagination Bug [P1]

`DataPagination.vue` 第 10 行的 `totalPages` 不是响应式的（使用了普通变量而非 computed），导致数据变化时分页器不更新。这是一个用户可见的实际 Bug。

#### 3.3 i18n locale 加载时序 [P2]

`main.ts` 中 locale 加载发生在 `app.mount()` 之后，首屏可能短暂显示翻译 key 而非翻译文本。

建议：将 locale 加载改为 `await` 阻塞挂载。

#### 3.4 useIdleDetection 死代码 [P3]

`useIdleDetection` composable 已完整实现但从未被任何组件调用，属于死代码。

#### 3.5 其他管理后台问题

- **缺少 403/401 统一处理**：API 层没有全局的认证失败拦截器，Token 过期时各页面独立处理。
- **缺少路由级 loading 状态**：页面切换时无全局加载指示。
- **ECharts 实例泄漏风险**：HudChart 组件在 unmount 时调用 `dispose()`，但如果父组件使用 `v-if` 快速切换，可能在 dispose 前触发新的 render。

---

### 四、基础设施和部署

#### 4.1 CI/CD 不完善 [P1]

当前 GitHub Actions 仅运行测试和 Docker 构建验证，缺少：

- 代码质量扫描（无 SonarQube / SpotBugs / ESLint CI 检查）
- 前端构建产物自动部署
- 小程序代码自动上传
- 数据库迁移验证
- 安全漏洞扫描（依赖项 CVE 检查）

#### 4.2 Docker 配置改进 [P2]

- `Dockerfile` 未使用多阶段构建优化镜像大小（可以直接用 eclipse-temurin:21-jre 运行而非 jdk）。
- `docker-compose.yml` 中 MySQL 和 Redis 端口直接暴露到宿主机（13306、16379），生产环境应仅对内网开放。
- 缺少 Docker health check 配置（虽然 deploy.sh 有应用层健康检查，但容器级别没有）。
- 缺少日志收集配置（已集成 logstash-logback-encoder 输出 JSON 日志，但没有 Filebeat/Fluentd 收集）。

#### 4.3 缺少环境隔离 [P2]

`switch-env.sh` 通过修改配置文件切换环境，但没有真正的环境隔离：

- 开发环境和生产环境共用同一个微信小程序 AppID
- 没有 staging 环境
- 数据库迁移（Flyway）在生产环境自动执行，风险较高

#### 4.4 云函数安全 [P2]

`aiProxy/index.js` 云函数直接转发请求到 LLM API，需要确认：
- 是否有调用频率限制
- 是否有请求内容大小限制
- API Key 是否通过环境变量注入而非硬编码

---

### 五、架构层面建议

#### 5.1 缺乏统一的领域事件处理 [P1]

项目已有 Spring 事件机制（`RoomSettledEvent`、`RoomClosedEvent`、`SecurityActionEvent` 等），但使用不一致。部分后续处理（如成就扫描、等级计算）在事件监听器中异步执行，部分仍在主流程中同步调用。

建议：将所有非核心路径的后续处理统一为领域事件监听器，确保主流程的快速返回。

#### 5.2 缺少 API 版本管理 [P2]

当前所有 API 在 `/api` 前缀下，没有版本号。当需要做不兼容的接口变更时（比如小程序版本升级），无法平滑过渡。

建议：引入 `/api/v1` 前缀，为后续版本迭代预留空间。

#### 5.3 缺少结构化日志和可观测性 [P2]

虽然已集成 logstash-logback-encoder、Micrometer + Prometheus、OpenTelemetry，但：
- 缺少统一的日志聚合和告警（仅输出 JSON 日志，无 ELK/Loki 配置）
- Prometheus 指标没有 Grafana Dashboard 配置
- OpenTelemetry 配置存在但没有 trace 后端（Jaeger/Zipkin）配置
- 缺少业务级别的关键指标（活跃编队数、日活用户、脉冲记录量、封存次数等）

#### 5.4 数据库索引优化 [P2]

Flyway 迁移 V5 添加了部分性能索引，但以下查询路径仍可能全表扫描：
- `room_member` 按 `user_id + quit_time IS NOT NULL` 查询历史编队
- `fortune_log` 按 `user_id + created_at` 范围查询
- `behavior_log` 按 `room_id + created_at` 范围查询

#### 5.5 缓存策略统一 [P2]

当前缓存策略分散：
- JetCache 用于 Fortune（4h TTL）和 Achievement（1h TTL）
- 手动 Redis 操作用于用户信息、编队数据
- 无统一缓存失效策略

建议：定义统一的缓存策略层，包括 TTL 标准、失效模式（Cache-Aside / Write-Through）、缓存预热规则。

---

### 六、功能完整性

#### 6.1 未实现的功能

以下功能在文档中有定义但代码中未实现或仅有空壳：

- 自航推进协议和主控同步协议（`PRODUCT_LANGUAGE.md` 明确标注"未实现"）
- 告警系统（Admin API 返回空列表）
- COS 存储 provider（配置存在但未实现）
- 航迹回放可视化（仅有页面跳转，无可视化）
- 微信订阅消息（模板数组为空，实际不工作）
- 浅色主题（小程序端 app.wxss 仅有深色主题定义）

#### 6.2 缺失的运维功能

- 没有管理后台的操作日志查看（审计日志只记录不分析）
- 没有在线用户实时列表
- 没有 WebSocket 连接数监控
- 没有 Redis 内存使用监控
- 没有错误率告警
- 没有用户反馈收集入口

---

### 七、优先执行建议

**第一梯队（安全 + 正确性）**：WebSocket token 暴露修复、Admin Entity 泄露修复、错误码去重、DataPagination Bug 修复、project.config.json 安全设置。

**第二梯队（稳定性 + 可维护性）**：核心 Service 测试补充（轮次状态机优先）、封存逻辑去重和异步化、room 页 data 拆分和状态清理统一、主题 CSS 变量一致性。

**第三梯队（性能 + 体验）**：封存操作异步化、getHistory N+1 修复、Canvas 工具提取、内容净化统一、请求去重 TTL、管理后台 i18n 时序修复。

**第四梯队（工程化）**：CI/CD 完善（代码质量扫描 + 自动部署）、API 版本管理、可观测性完善、缓存策略统一、数据库索引补充。
