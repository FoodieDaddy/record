# 架构

执行任何开发任务前，先区分三类信息：

- **当前事实**：代码已经具备的行为。
- **硬约束**：本次改动必须遵守的边界。
- **收敛目标**：后续优化方向，不能在文档、注释、提交说明中写成已完成能力。

## 当前事实

- 一个编队 = 一次任务航程记录。工程层仍使用 `room` 表；没有 session 表。封存时把运行期数据归档到 `room.all_record`，成员最终值写入 `room_member.final_score`，`quit_time` 标记历史样本。
- 双记录模式：Mode 1 自由流转；Mode 2 本局录入，流程为 start -> submit -> confirm/reject/cancel/apply，支持主控填写和成员自填。
- Redis 优先但不是纯 Redis：运行期分数、成员元信息、流向事件、待处理本局录、总览缓存都在 Redis；当前实现仍会在创建、加入、记分、轮次生效时访问 MySQL。
- WebSocket `/ws/score` 以编队为广播单位，推送 `TRANSFER`、`SCORE_UPDATE`、`MEMBER_JOIN`、`MEMBER_LEAVE`、`PRESENCE_UPDATE`、`ROUND_*`、`SETTINGS_CHANGED`、`SETTLE` 等事件。
- 创建编队、成员关系、用户设置、镜像档案、指令日志、授权等级进入 MySQL；封存和本局录生效会写 MySQL；趋势、身份、镜像主要从历史归档数据计算。
- 航迹样本在工程层主要对应 `room.all_record`、`room_member.final_score`、历史归档、趋势统计和指令/镜像/身份的输入样本。
- 后端签发 OSS 预签名 PUT URL；前端压缩后直传；本地默认头像和 `helmet-avatar` 组件负责头像终端化展示。
- 所有实体 ID 由 `SnowflakeIdGenerator` 生成，禁止依赖数据库自增。
- `spring.threads.virtual.enabled=true`，异步任务复用 `asyncExecutor` 虚拟线程池。
- `CacheWarmUpRunner` 会从 MySQL 活跃编队重建 Redis 元信息、房间号映射和排行榜。
- `RoomTimeoutTask` 每 5 分钟扫描 3 小时无活动编队。

## 硬约束

- 后端按 2 核 2G 容器预算设计。
- 严禁引入高频全编队轮询、无差别广播、阻塞式批量计算、运行期大对象 JSON 反复序列化等 CPU/内存放大逻辑。
- 编队成员数严格限制 `MAX_MEMBERS = 16`。
- 加入编队前必须先做 Redis 侧容量校验，超过阈值立即 fail-fast。
- 前端必须用温和提示承接业务错误码，不能把异常堆栈或服务端错误直接暴露给用户。
- 新增运行期功能必须优先使用 Redis Hash/ZSet/List 与 Lua 原子操作。
- 运行期频繁变化状态不得新增 MySQL 读写依赖。
- Redis 连接失败、脚本失败、锁失败必须被业务层捕获，统一返回 `Result` 结构和可识别 code。
- WebSocket 必须维持全局单例与稳定回调引用。
- 页面只订阅/取消事件，不在普通页面生命周期里反复销毁连接。
- 自动封存/解散必须同时识别 `events` 与 `batches`，自由流转模式不能因为没有批次记录就被误判为空编队。

## 收敛目标

- MySQL 热路径只能作为待收敛技术债处理，不能描述成已经实现的「MySQL 零参与」。
- 后续优先收敛创建、加入、部分记分生效和归档链路中的热路径 MySQL 访问。
- WebSocket 鉴权后续优先使用 `Sec-WebSocket-Protocol: access_token.<jwt>`，当前仍可通过 query token 兼容旧客户端。

## 核心模块

### 编队模块：驾驶舱 / 任务记录系统

- 创建/加入编队：`POST /room`、`POST /room/join`，编队码由 Redis `SETNX` 预占生成，成员上限 16。
- 自由流转：`POST /score/transfer`，Lua 原子更新 `sr:room:{rid}:scores`，流向事件写入 `sr:room:{rid}:events`，WebSocket 推送双方最新分数。
- 常用数值推荐：`GET /score/room/{rid}/transfer-amount-suggestions`，读取 Redis 小排行 `sr:room:{rid}:transfer:amount:user:{uid}` 与 `sr:room:{rid}:transfer:amount:all`，数据不足时随机补齐。
- 本局录入：`POST /round/start`、`/round/submit`、`/round/confirm`、`/round/cancel`，待处理状态在 Redis，生效后写 `round_record` 与 `round_record_detail`。
- 封存归档：`POST /score/room/{rid}/settle`，归档 `room.all_record`，更新 `room_member.final_score` 和 `quit_time`，清理运行期 Redis key，广播 `SETTLE`。
- 复盘数据：`/score/room/{rid}/chart`、`/score/room/{rid}/insight`、`/score/room/{rid}/network`、`/score/trend`、`/score/yield-log`。

### 指令模块：导航舱 / 导航核心系统

- 今日指令投影：主引擎 + 静态兜底双引擎，结合历史行为标签与时间意象，但输出必须是状态管理、推进节奏、安全边界和舰载指令。
- 用户标签：连胜、连败、高风险、稳健四类在工程层影响指令原型；运行时展示必须转换为安全、克制、非结果承诺的表达。
- 缓存与刷新：Redis 4 小时 TTL，`?force=true` 可绕过缓存重新生成。
- 安全过滤：主引擎输出命中敏感词必须丢弃并使用备用指令；前端展示层、海报 Canvas、分享标题也要做二次替换。
- API：`GET /fortune/today`。

### 身份模块：识别舱 / 身份认证系统

- 本舰档案：本舰呼号、识别徽标、授权等级、航行经验、稳定读数、本地乐观更新与防抖保存。
- 装备协议：通讯协议、通讯音色、视觉协议、触感协议和断开终端。
- 航程徽章：成就系统，基于封存次数、数值、正馈等维度计算解锁状态。
- API：`/user/me`、`/user/detail`、`/user/identity-level`。

### 镜像模块：全息舱 / 行为镜像系统

- 人格协议：MBTI 校准（20 题测试或手动选择）、协议状态、协议编号。
- 镜像投影：五维全息扫描（推进倾向、舰体稳定、接入频率、回稳能力、场域控制）、协议一致率、协议偏移、系统判读、信号标签、协议演化。
- 航迹档案：航迹摘要（已写入样本、最近航程、封存时间）、航迹回放入口。
- 镜像卡：Canvas 绘制的镜像档案卡，支持保存和分享。
- API：`/mirror/profile`、`/mirror/mbti/test`、`/mirror/mbti/direct`、`/mirror/stats`、`/score/yield-log`。

### 语音/TTS 系统

- TTS：Edge-TTS CLI 主引擎，MiMo TTS API 副引擎，ffmpeg 后处理为 44.1kHz 128kbps MP3。
- 语音播报：自由流转接收方听到 TTS 播报，`utils/voice.js` 队列防重叠。
- 情绪音效：记分或本局录生效时为对应用户播放情绪音频。
- 音色目录：`voices.json` 启动加载，支持分类、试听、rate/pitch 配置。
- API：`/tts/audio`、`/tts/benchmark`、`/voice/catalog`、`/voice/preview`。

## 非显而易见的工程模式

- 房间号生成：Redis `SETNX`，字符集去 O/0/I/L，6 位，碰撞重试最多 10 次。用户可见称为「编队码」；二维码、分享入口和扫码加入称为「信标」。
- 运行期锁：`sr:room:{rid}:lock`，Redisson `tryLock(5s, 30s)`；自由流转核心扣加分走 Lua。
- Redis key：`sr:room:{rid}:meta`、`scores`、`batches`、`batch:{ts}`、`events`、`overview`、`roundConfig`、`round`、`round:details`、`round:members`、`round:confirms`、`sr:room_no:{roomNo}`、`sr:user:rooms:{uid}`、`sr:user:{uid}`、`sr:fortune:{uid}:{date}`、`sr:fortune:lock:{uid}:{date}`（并发生成短锁，TTL 12s）。
- 得分聚合：进行中优先读 Redis ZSet / events；已封存读 `room.all_record` 与 `room_member.final_score`。
- 小程序码：后端调微信 `getUnlimited` API -> 字节流 -> OSS PUT -> 返回访问 URL。
- 前端设置防抖：本舰呼号、识别徽标、语音、动效、触感统一 2 秒防抖 + onHide 刷盘，本地缓存即时生效，服务端延迟持久化。
- 震动守卫：所有 `wx.vibrateShort` 通过 `utils/haptic.js` 封装，`vibrateEnabled=false` 时跳过。
- 动效守卫：页面根节点必须绑定 `reduce-motion`，JS 动画和定时器必须先判断 `app.globalData.animationEnabled`。
- WebSocket：前端 `utils/score-ws.js` 是全局单例事件总线；页面只订阅/取消，不随页面销毁断开连接。`PRESENCE_UPDATE` 用于同步编队成员在线状态。
- 镜像缓存：profile 30 分钟 Redis TTL，stats 24 小时 TTL。
- 策略缓存：4 小时 Redis TTL，`?force=true` 绕过。
- TTS 队列：前端 `voice.js` 维护播放队列，防止多条播报重叠。
