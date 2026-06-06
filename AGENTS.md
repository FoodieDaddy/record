# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 项目概述

脉冲终端（Smart Record）是一个多人实时协同记录与复盘微信小程序。产品主线是「空间记录 → 策略提示 → 行为画像 → 身份沉淀」：用户在空间中记录数值流向，结算后进入档案和趋势复盘；策略页提供冷静的状态/行动建议；镜像页呈现 MBTI 校准与行为画像；身份页管理玩家档案、等级、成就、声音、动效与触感协议。

当前技术栈：后端 Java 21 + Spring Boot 3.2.5 + MyBatis-Plus + MySQL + Redis/Redisson + WebSocket；前端为原生微信小程序，视觉定位为黑底、蓝光、克制的数据终端。

## 启动命令

```bash
# 基础设施（MySQL 13306, Redis 16379）
docker-compose up -d

# 后端（端口 18080，需指定 Java 21）
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run

# 前端：微信开发者工具导入 miniprogram/ 目录
```

## 当前架构事实

- **一个空间 = 一次任务/对局记录**：没有 session 表；结算时把运行期数据归档到 `room.all_record`，成员最终值写入 `room_member.final_score`，`quit_time` 标记历史样本。
- **双记录模式**：Mode 1 自由流转（成员之间直接记录数值流向）；Mode 2 本局录入（start → submit → confirm/reject/cancel/apply，支持主控填写和成员自填）。
- **Redis 优先但不是纯 Redis**：运行期分数、成员元信息、流向事件、待处理本局录、总览缓存都在 Redis；当前实现仍会在创建/加入/记分/轮次生效时访问 MySQL。不要把「MySQL 零参与」描述成既成事实，后续只能作为性能收敛目标。
- **实时推送**：WebSocket `/ws/score` 以房间为广播单位，推送 `TRANSFER`、`SCORE_UPDATE`、`MEMBER_JOIN/LEAVE`、`ROUND_*`、`SETTINGS_CHANGED`、`SETTLE` 等事件。
- **持久化边界**：创建空间、成员关系、用户设置、镜像档案、策略日志、身份等级进入 MySQL；结算和本局录生效会写 MySQL；趋势/身份/镜像主要从历史归档数据计算。
- **图片与头像**：后端签发 OSS 预签名 PUT URL；前端压缩后直传；本地默认头像和 `helmet-avatar` 组件负责头像终端化展示。
- **雪花 ID**：所有实体 ID 由 `SnowflakeIdGenerator` 生成，禁止依赖数据库自增。
- **虚拟线程**：`spring.threads.virtual.enabled=true`，异步任务复用 `asyncExecutor` 虚拟线程池。
- **启动恢复**：`CacheWarmUpRunner` 会从 MySQL 活跃空间重建 Redis 元信息、房间号映射和排行榜。
- **超时任务**：`RoomTimeoutTask` 每 5 分钟扫描 3 小时无活动空间。当前自由流转模式主要写 `events`，自动结算逻辑必须同时检查 `events` 与 `batches`，不能只看批次列表。

## 核心模块

### 空间与记录系统

- **创建/接入空间**：`POST /room`、`POST /room/join`，房间号由 Redis `SETNX` 预占生成，成员上限 16。
- **自由流转**：`POST /score/transfer`，Lua 原子更新 `sr:room:{rid}:scores`，流向事件写入 `sr:room:{rid}:events`，WS 推送双方最新分数。
- **本局录入**：`POST /round/start`、`/round/submit`、`/round/confirm`、`/round/cancel`，待处理状态在 Redis，生效后写 `round_record` 与 `round_record_detail`。
- **结算归档**：`POST /score/room/{rid}/settle`，归档 `room.all_record`，更新 `room_member.final_score/quit_time`，清理运行期 Redis key，广播 `SETTLE`。
- **复盘数据**：`/score/room/{rid}/chart`、`/score/room/{rid}/insight`、`/score/room/{rid}/network`、`/score/trend`、`/score/yield-log`。

### 镜像模块 (Mirror)

- **人格协议**：20 题滑动测试或直接选择 16 种 MBTI 类型。
- **任务镜像**：基于历史归档样本生成战绩人格、人格可信度、人格偏差和系统判读。
- **五维雷达图**：进攻性、稳定性、参局率、回稳力、控场力，3+ 场封存后解锁。
- API：`/mirror/profile`、`/mirror/mbti/test`、`/mirror/mbti/direct`、`/mirror/stats`

### 策略模块 (Fortune / Oracle Core)

- **今日策略**：LLM 主引擎 + 静态兜底双引擎，结合历史行为标签、农历/节气意象，但输出必须是状态管理、行动建议、风险控制。
- **用户标签**：连胜、连败、高风险、稳健四类影响策略原型。
- **缓存与刷新**：Redis 4 小时 TTL，`?force=true` 可绕过缓存重新生成。
- **安全过滤**：LLM 输出命中敏感词必须丢弃并使用 fallback；前端展示层也要做二次替换。
- API：`GET /fortune/today`

### 语音/TTS 系统

- **TTS**：Edge-TTS CLI 主引擎，MiMo TTS API 副引擎，ffmpeg 后处理为 44.1kHz 128kbps MP3。
- **语音播报**：自由流转接收方听到 TTS 播报，`utils/voice.js` 队列防重叠。
- **情绪音效**：记分或本局录生效时为对应用户播放情绪音频。
- **音色目录**：`voices.json` 启动加载，支持分类、试听、rate/pitch 配置。分类图标不得使用原生彩色 Emoji，必须用线框图标或纯文本代码。
- API：`/tts/audio`、`/tts/benchmark`、`/voice/catalog`、`/voice/preview`

### 身份终端

 - **身份档案**：昵称、头像、成员代号、本地乐观更新与防抖保存。
 - **数据矩阵**：趋势、净数值、样本数、稳定性、成就。
 - **系统控制**：声音协议、音色模块、动效协议、触感协议和断开终端。
 - API：`/user/me`、`/user/detail`、`/user/identity-level`

## 数据库表（当前实体 10 张）

| 表 | 用途 |
|---|---|
| `user` | 用户基本信息（openid/nickname/avatarUrl） |
| `user_detail` | 用户设置（语音/动画/震动开关） |
| `room` | 空间（含 scoreMode、roundInputMethod、trustMode、zeroSumRequired、allRecord JSON 归档） |
| `room_member` | 房间成员（含 quit_time、final_score） |
| `round_record` | 本局录记录（状态机：pending_member_input / pending_confirm / applied / rejected / cancelled） |
| `round_record_detail` | 本局录明细（每用户得分） |
| `user_mirror_profile` | 镜像档案（MBTI + 战斗人格 + 综合解读，PK=userId） |
| `mirror_birth_profile` | 出生档案（预留，不在当前主流程展示） |
| `fortune_log` | 策略生成日志（prompt、响应、source、耗时、错误） |
| `user_identity_level` | 身份等级、经验、稳定度 |

## 代码规范

- Java 使用 Lombok（@Data, @Slf4j, @RequiredArgsConstructor），不要手写 getter/setter
- 统一返回结构 `Result<T>`，业务异常用 `BizException`
- Controller 只做参数校验和转发，业务逻辑在 Service 层
- 所有 DTO 必须有 `@Schema` 注解和 `example` 示例值
- 前端 WXML/WXSS 使用 2 空格缩进
- 代码注释使用中文

## 非显而易见的模式

- 房间号生成：Redis `SETNX`，字符集去 O/0/I/L，6 位，碰撞重试最多 10 次
- 运行期锁：`sr:room:{rid}:lock`，Redisson `tryLock(5s, 30s)`；自由流转核心扣加分走 Lua。
- Redis key：`sr:room:{rid}:meta`、`scores`、`batches`、`batch:{ts}`、`events`、`overview`、`roundConfig`、`round`、`round:details`、`round:members`、`round:confirms`、`sr:room_no:{roomNo}`、`sr:user:rooms:{uid}`、`sr:user:{uid}`、`sr:fortune:{uid}:{date}`。
- 得分聚合：进行中优先读 Redis ZSet / events；已结算读 `room.all_record` 与 `room_member.final_score`。
- 小程序码：后端调微信 `getUnlimited` API → 字节流 → OSS PUT → 返回访问 URL
- 前端设置防抖：昵称/头像/语音/动画/震动统一 2 秒防抖 + onHide 刷盘，本地缓存即时生效，服务端延迟持久化
- 震动守卫：所有 `wx.vibrateShort` 通过 `utils/haptic.js` 封装，`vibrateEnabled=false` 时跳过
- 动效守卫：页面根节点必须绑定 `reduce-motion`，JS 动画和定时器必须先判断 `app.globalData.animationEnabled`
- WebSocket：前端 `utils/score-ws.js` 是全局单例事件总线；页面只订阅/取消，不随页面销毁断开连接
- 镜像缓存：profile 30 分钟 Redis TTL，stats 24 小时 TTL
- 策略缓存：4 小时 Redis TTL，`?force=true` 绕过
- TTS 队列：前端 `voice.js` 维护播放队列，防止多条播报重叠

## 安全注意

- `application.yml` 中的密码和密钥仅用于本地开发，生产环境必须替换
- 不要将 `target/` 目录提交到版本控制
- JWT secret 至少 256 位
- 禁止在 console、日志、错误提示中输出 JWT、微信 code、OSS 签名 URL 的敏感 query
- WebSocket 可以通过 query token 兼容旧客户端，但前端不得打印完整连接 URL；后续优先使用 `Sec-WebSocket-Protocol: access_token.<jwt>`
- 运行时页面、Prompt、fallback、分享文案不得出现审核高风险词；文档可以列出禁词用于约束，但不得复制到用户可见页面

## 端口规划（避开常用端口）

| 服务 | 端口 |
|---|---|
| 后端 API | 18080 |
| MySQL | 13306 |
| Redis | 16379 |

# Smart Record 全局工程架构与 UI 约束宪法 (Master Prompt)

执行任何开发任务前，先区分三类信息：**当前事实** 是代码已经具备的行为；**硬约束** 是本次改动必须遵守的边界；**收敛目标** 是后续优化方向，不能在文档、注释、提交说明中写成已完成能力。

## 1. 运行边界与架构约束

- **2C2G 极限环境**：后端按 2 核 2G 容器预算设计，严禁引入高频全房间轮询、无差别广播、阻塞式批量计算、运行期大对象 JSON 反复序列化等 CPU/内存放大逻辑。
- **成员上限**：空间成员数严格限制 `MAX_MEMBERS = 16`。加入空间前必须先做 Redis 侧容量校验，超过阈值立即 fail-fast，前端用温和提示承接业务错误码，不能把异常堆栈或服务端错误直接暴露给用户。
- **Redis 优先，逐步收敛**：当前实现已经把分数、成员元信息、流向事件、待处理本局录、总览缓存放在 Redis，但创建、加入、部分记分生效和归档仍会访问 MySQL。新增运行期功能必须优先使用 Redis Hash/ZSet/List 与 Lua 原子操作；MySQL 热路径只能作为待收敛技术债处理。
- **持久化边界**：MySQL 负责用户、空间元数据、成员关系、用户设置、镜像档案、策略日志、身份等级、结算归档。运行期频繁变化状态不得新增 MySQL 读写依赖。
- **Redis 降级**：Redis 连接失败、脚本失败、锁失败必须被业务层捕获，统一返回 `Result` 结构和可识别 code；页面只展示简短状态提示，不展示堆栈、类名、连接串。
- **实时同步**：WebSocket 必须维持全局单例与稳定回调引用。页面只订阅/取消事件，不在普通页面生命周期里反复销毁连接。任何调试日志都不能打印 JWT、完整 WS URL、微信 code 或 OSS 签名 query。
- **超时归档**：自动结算/解散必须同时识别 `events` 与 `batches`，自由流转模式不能因为没有批次记录就被误判为空空间。

## 2. 产品定位

Smart Record 不是普通表单工具，也不是传统娱乐小程序。它的主体验是：

```text
空间记录 -> 策略提示 -> 行为画像 -> 身份沉淀
```

整体气质：

```text
黑底、蓝光、克制、冷静、数据感、终端感、策略感、身份感、复盘感
```

四个主 Tab 的职责：

| Tab | 定位 | 主要体验 |
|---|---|---|
| 空间 | 记录终端 | 启动空间、接入空间、记录数值流向、结算归档 |
| 策略 | 策略终端 | 生成今日状态提示、行动建议、风险提醒、策略卡 |
| 镜像 | 行为画像 | MBTI 校准、历史表现画像、人格一致性、雷达图 |
| 身份 | 身份终端 | 用户档案、等级、成就、声音、动效、触感、设置入口 |

禁止把产品做成：微信默认表单页、传统设置页、娱乐押注工具、玄学工具、儿童化游戏界面、大红大金视觉、满屏营销卡片。

## 3. 视觉系统

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

- 蓝色只做主高亮和数据焦点；绿色只表达在线、成功、已连接；红色只用于危险、退出、错误。
- 正文透明度不要低于 `0.40`；装饰性英文可低到 `0.28`，但不能承载关键含义。
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

## 4. 终端风格细节

赛博终端感来自克制层级，不来自堆砌发光元素。

允许：细描边、切角按钮、弱扫描线、HUD 小标签、状态点、数据条、极少量英文 kicker、数字等宽。

禁止：大面积发光、所有文字都变蓝、每个按钮都有光晕、持续粒子、控制台日志堆砌、大量英文缩写、AI 长段解释。

所有关键功能必须使用中文。英文只能作为弱装饰、副标题或状态标签：

```text
空间模式          SPACE MODE
人格档案          PERSONA PROFILE
```

不要出现纯英文主按钮。主操作使用「启动空间 / 接入空间 / 生成策略 / 更新协议 / 封存结果」这类中文动词。

## 5. 页面分工

### 空间页（记录终端）

负责创建空间、接入空间、空间配置、成员布局、数值记录、实时流水、结算归档。文案使用「空间」「识别码」「接入」「封存」「记录」，避免普通表单感。

### 策略页（策略终端）

负责今日状态、行动建议、风险提醒、策略卡分享。展示内容必须是复盘建议、节奏提醒、状态管理、风险控制，不做结果预测，不承诺收益，不引导冒进。

### 镜像页（行为画像）

负责 MBTI 协议、历史表现画像、人格一致性、五维雷达图、画像分享。镜像判读必须短、冷静、数据感，不写大段 AI 心理鸡汤。

### 身份页（身份终端）

负责用户身份、等级、总积分、样本数、成就、设置入口、声音/动效/触感协议。首页只放高频身份信息，详细开关进入二级设置或折叠区域。

## 6. 组件与布局规范

- **按钮**：主按钮高度 72rpx-88rpx，不超过 96rpx。优先细描边、切角、状态点，不做传统大圆角纯蓝按钮。
- **异步按钮**：必须使用「文本绝对居中 + 图标/Loading 绝对定位」结构，Loading 状态文字位置不能抖动。
- **危险操作**：退出、删除、解散使用透明底 + 红色细描边，不做大红底按钮。
- **线框图标**：全站 WXML/WXSS/运行时数据禁止原生彩色 Emoji。图标使用纯色线框、CSS icon、SVG path 或图标字体。
- **成员简易模式**：16 人以内使用 4x4 矩阵网格，配合 `scroll-view` 和 `max-height: 600rpx`，大数字必须格式化并防溢出。
- **座位模式**：使用绝对定位舞台，中央仅作为空间参考点，成员通过 `pos-top` / `pos-bottom` / `pos-left` / `pos-right` 环绕排布。
- **弹窗**：用 `wx:if` 懒渲染；底部抽屉、确认弹窗、选择器必须支持 reduce-motion 的静默展开。

## 7. 动效静默管理

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

- JS 动画、Canvas 动画、分数滚动、雷达扫描、打字机日志、粒子、`requestAnimationFrame`、长链 `setTimeout` 执行前必须判断 `app.globalData.animationEnabled`。
- 所有 timer / animation frame 必须在 `onHide` 或 `onUnload` 清理。
- 动效允许轻微渐入、短扫描线、按钮按压、数值滚动；禁止持续强发光、复杂滚动联动、长时间 loading、无法跳过的打字动画。

## 8. 文案与审核安全

运行时页面、Prompt、fallback、分享图文必须避开审核高风险词。文档可以列出禁词用于约束，但不得把禁词复制到用户可见页面。

禁止出现在运行时用户可见内容中：

```text
棋牌、赌博、赌、下注、押注、筹码、牌局、牌桌、打牌、麻将、扑克、德州、梭哈、赢钱、赚钱、发财、稳赚、必胜、翻本、追损、运势、算命、占卜、塔罗、抽牌、神谕、卦象、黄历、风水、开运、转运、改运、预测输赢、胜率提升
```

推荐替换：

```text
对局/回合/场景、积分、结果波动、今日状态、今日策略、生成策略、策略参考、状态分析、情绪化修正
```

AI 输出必须通过敏感词过滤。命中时丢弃生成结果，使用静态 fallback。推荐语气：冷静、克制、短句、策略终端感、复盘视角。

## 9. 前端性能规范

- 音色试听维护单例 `InnerAudioContext`，执行 `stop() -> src 替换 -> play()`，禁止重复创建实例。
- 页面滚动时不 `setData`，触摸绘图必须节流到一帧一次。
- WXSS 禁止 `transition: all;`，改成明确属性：`transition: opacity .2s, transform .2s, background-color .2s;`
- Canvas 组件必须在不可见或 reduce-motion 时停止扫描/脉冲动画。
- 普通卡片不用 blur 和阴影；仅主视觉卡、抽屉、浮层允许少量模糊。
- `setData` 只写必要字段，避免整块 `room`、大数组、图表数据在高频事件里反复写入。

## 10. 当前优先技术债

这些不是架构原则，而是下一轮优化必须优先排查的已知问题：

- `miniprogram/pages/room/room.wxml` 根节点仍缺少 `reduce-motion` 绑定。
- `miniprogram/pages/voice-select/voice-select.wxml` 页面根节点缺少全局动效静默类。
- `miniprogram/utils/score-ws.js` 当前 `DEBUG_WS = true`，且会打印带 token 的完整连接 URL。
- `backend/src/main/resources/voices.json` 分类 icon 仍使用原生彩色 Emoji。
- `miniprogram/pages/room/room.js` 获取二维码时仍按 `resp.data.qrCodeUrl` 读取，和当前 request 封装返回形态不一致。
- `backend/src/main/java/com/smartrecord/task/RoomTimeoutTask.java` 自动结算检查不能只看 `batches`，必须兼容自由流转 `events`。
- `ScoreServiceImpl.getRoomInsight` 不应直接用包含 owner/status 等字段的 meta `HLEN` 作为成员密度。

## 11. 最终体验目标

用户感知应该是：

```text
我在启动一个记录空间。
我在获得一条策略提示。
我在查看自己的行为画像。
我在管理自己的身份终端。
```

所有页面必须服务于：记录 -> 复盘 -> 画像 -> 身份。
