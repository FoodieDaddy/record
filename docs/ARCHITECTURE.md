# 架构

产品用户可见名称为「太空记分器 / Space Scorekeeper」。
工程代号、包名、数据库表名、API 路径保留 smartrecord、room、score、transfer 等既有命名，不为品牌改名强行修改底层协议。

执行任何开发任务前，先区分三类信息：

- **当前事实**：代码已经具备的行为。
- **硬约束**：本次改动必须遵守的边界。
- **收敛目标**：后续优化方向，不能写成已完成能力。

## 当前事实

- 一个编队 = 一次任务航程记录。工程层仍用 `room` 表；无 session 表。封存时归档到 `room.all_record`，成员最终值写入 `room_member.final_score`，`quit_time` 标记历史样本。
- 双记录模式：Mode 1 自由流转（脉冲流向）；Mode 2 本局录入（航段写入），流程 start → submit → confirm/reject/cancel/apply。自航推进、主控同步未实现，只写为后续可扩展的产品协议。
- Redis 优先但非纯 Redis：运行期分数、成员元信息、流向事件、待处理本局录、总览缓存都在 Redis；创建/加入/记分/轮次生效时仍访问 MySQL。
- WebSocket `/ws/score` 按编队广播，推送 `TRANSFER`、`SCORE_UPDATE`、`MEMBER_JOIN`、`MEMBER_LEAVE`、`PRESENCE_UPDATE`、`ROUND_*`、`SETTINGS_CHANGED`、`SETTLE` 等事件。
- MySQL 持久化：用户、编队元数据、成员关系、设置、镜像档案、指令日志、授权等级、封存归档、管理/审计。趋势/身份/镜像主要从历史归档计算。
- ID 策略：全局 `SnowflakeIdGenerator`，禁止数据库自增。
- 虚拟线程：`spring.threads.virtual.enabled=true`，异步复用 `asyncExecutor`。
- 缓存预热：`CacheWarmUpRunner` 从 MySQL 重建 Redis 活跃编队元信息、房间号映射和排行榜。
- 超时清理：`RoomTimeoutTask` 每 5 分钟扫描 3 小时无活动编队。
- Sentinel 熔断限流：微信登录 `wx-login`、OSS 预签名 `oss-presign`、TTS `tts-synthesize` 各自 `@SentinelResource` 保护；全局 200 QPS + 各资源独立规则。
- WebSocket：每 25s Ping，60s 无响应关闭僵尸连接。
- 日志：结构化 JSON（logstash-logback-encoder），prod 按天轮转 100MB/30 天/2GB，ERROR 独立文件 50MB/30 天/1GB。
- 监控：Prometheus `/actuator/prometheus`；MySQL 慢查询阈值 1s；Redis AOF `appendfsync everysec`；OpenTelemetry 链路追踪通过 micrometer-otel 桥接。
- CI/CD：GitHub Actions（单元 → 集成 → Docker 构建）；集成测试 `@Tag("integration")`；Docker 非 root `appuser`。
- 生产配置：Swagger 禁用、MyBatis SQL 日志关闭、优雅关闭 30s、HikariCP 20 连接、Redis Lettuce 16 连接、CORS `/api/**` 凭据 1h 预检、Gzip 压缩 1KB 阈值、Jackson Long→String / LocalDateTime 格式 / 忽略未知。
- MySQL 8.0，Flyway V1–V5 管理 schema。

## 产品层映射

| 工程层 | 产品层 | 说明 |
|---|---|---|
| `room` | 编队 / 任务编队 | 为完成短程任务临时组成的航行单元 |
| `score` | 脉冲 / 任务读数 | 任务航程中的核心读数单位 |
| `transfer` | 脉冲流向 | 成员之间互相写入数值流向 |
| `round` | 航段写入 | 一轮结束后统一录入 |
| `settle` | 封存航程 | 正常结束任务并写入航迹档案 |
| `quit` | 撤离编队（普通成员）/ 解散编队（主控） | 离开或终止当前编队 |

脉冲记录协议实现状态：脉冲流向（Mode 1，已实现）、航段写入（Mode 2，已实现）、自航推进/主控同步（未实现，后续可扩展）。

## 硬约束

- 2 核 2G 容器预算；严禁高频全编队轮询、无差别广播、阻塞式批量计算、运行期大对象 JSON 反复序列化。
- 编队成员上限 `MAX_MEMBERS = 16`，加入前 Redis 侧容量校验 fail-fast。
- 前端温和提示承接业务错误码，不暴露异常堆栈或服务端错误。
- 新增运行期功能优先 Redis Hash/ZSet/List + Lua 原子操作；不得新增 MySQL 热路径读写。
- Redis/脚本/锁失败由业务层捕获，统一返回 `Result` + 可识别 code。
- WebSocket 全局单例，页面只订阅/取消，不随页面销毁断开连接。
- 自动封存/解散必须同时识别 `events` 与 `batches`，自由流转模式不能因无批次被误判空编队。
- 封存航程（settle）是正常结束唯一主流程；解散编队是危险管理动作。

## 收敛目标

- MySQL 热路径为技术债，不可描述为已完成的「MySQL 零参与」；优先收敛创建/加入/部分记分生效/归档链路。
- WebSocket 鉴权优先 `Sec-WebSocket-Protocol: access_token.<jwt>`，当前仍兼容 query token。
- 自航推进和主控同步未实现，不可写成已实现。

## 核心模块

### 编队模块：驾驶舱 / 任务记录系统

- 创建/加入编队：`POST /room`、`POST /room/join`，编队码 Redis `SETNX` 预占，上限 16。
- 自由流转（脉冲流向）：`POST /score/transfer`，Lua 原子更新 `sr:room:{rid}:scores` + events，WS 推送双方分数。
- 推荐数值：`GET /score/room/{rid}/transfer-amount-suggestions`，读 Redis `sr:room:{rid}:transfer:amount` ZSet。
- 本局录入（航段写入）：`POST /round/start`、`/round/submit`、`/round/confirm`、`/round/cancel`，待处理在 Redis，生效写 `round_record` + `round_record_detail`。
- 封存归档：`POST /score/room/{rid}/settle`，归档 `room.all_record`，更新 `final_score` / `quit_time`，清理 Redis，广播 `SETTLE`。
- 撤离编队：`DELETE /room/{roomId}/quit`，普通成员离开；主控退出 = 解散编队。
- 复盘数据：`/score/room/{rid}/chart|insight|network`、`/score/trend`、`/score/yield-log`。

### 指令模块：导航舱 / 导航核心系统

- 双引擎（主引擎 + 静态兜底），输出为状态管理/推进节奏/安全边界/舰载指令。
- 用户标签（连胜/连败/高风险/稳健）影响指令原型，展示必须转换为安全克制非承诺表达。
- 缓存 4h TTL，`?force=true` 绕过；命中敏感词丢弃并使用备用指令；前端二次 sanitize。
- API：`GET /fortune/today`。

### 身份模块：识别舱 / 身份认证系统

- 本舰档案：呼号、徽标、授权等级、航行经验、稳定读数、本地乐观更新 + 防抖保存。
- 装备协议：通讯/音色/视觉/触感/断开终端。
- 航程徽章：基于封存次数/数值/正馈等维度解锁。
- API：`/user/me`、`/user/detail`、`/user/identity-level`。

### 镜像模块：全息舱 / 行为镜像系统

- MBTI 校准（20 题测试或手动选择）、协议状态/编号。
- 镜像投影：五维全息扫描 + 协议一致率 + 协议偏移 + 系统判读 + 信号标签 + 协议演化。
- 航迹档案：摘要（样本数/最近航程/封存时间）+ 回放入口。
- 镜像卡：Canvas 绘制，支持保存/分享。
- API：`/mirror/profile|mbti/test|mbti/direct|stats`、`/score/yield-log`。

### 语音/TTS 系统

- Edge-TTS CLI 主引擎 + MiMo TTS 副引擎，ffmpeg 后处理 44.1kHz 128kbps MP3。
- 语音播报：流转接收方 TTS 播报，`voice.js` 队列防重叠。
- 情绪音效：记分/本局录生效时播放。
- 音色目录：`voices.json` 启动加载。
- API：`/tts/audio|benchmark`、`/voice/catalog|preview`。

## 非显而易见的工程模式

- 房间号：Redis `SETNX`，字符集去 O/0/I/L，6 位，碰撞重试 10 次。编队码 = 用户可见短码；信标 = 邀请/分享/扫码入口。
- 运行期锁：`sr:room:{rid}:lock`，Redisson `tryLock(5s, 30s)`；自由流转核心扣加分走 Lua。
- Redis key：`sr:room:{rid}:data`（Hash，含 `a:`/`r:`/`round:`/overview/qr 前缀字段）、`scores`（ZSet）、`events`（ZSet）、`round:data`（Hash）、`transfer:amount`（ZSet）、`sr:room_no:{roomNo}`（String）、`sr:user:rooms:{uid}`（Set）、`sr:user:{uid}`（Hash，info/mirror:profile/mirror:stats）、`sr:fortune:{uid}:{date}`、`sr:fortune:lock:{uid}:{date}`（TTL 12s）。
- 得分聚合：进行中读 Redis ZSet/events；已封存读 `room.all_record` + `room_member.final_score`。
- 识别徽标存储：`storage.provider` 控制（aliyun/cloudbase/cos）。cloudbase 前端 `wx.cloud.uploadFile` 直传，`cloud://` fileID 异步解析为 https URL；aliyun/cos 走后端 presign。`avatar-storage.js` 封装 `uploadAvatar()` / `resolveAvatarSrc()`。
- 前端设置防抖：呼号/徽标/语音/动效/触感 2s 防抖 + onHide 刷盘，本地缓存即时生效。
- 震动守卫：`wx.vibrateShort` 通过 `utils/haptic.js` 封装。
- 动效守卫：页面根节点绑定 `reduce-motion`，JS 动画/定时器先判断 `animationEnabled`。
- WebSocket：`score-ws.js` 全局单例事件总线；`PRESENCE_UPDATE` 同步编队成员在线状态。
- 缓存 TTL：镜像 profile 30min / stats 24h；指令 4h。
- TTS 队列：`voice.js` 播放队列防重叠。
