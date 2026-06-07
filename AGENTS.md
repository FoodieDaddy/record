# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 项目概述

脉冲终端（Smart Record）是一个多人实时协同记录与复盘微信小程序。产品世界观为「脉冲方舟」：用户通过启动任务空间记录一次短程航程中的数值流向，封存后写入黑匣子；黑匣子样本继续驱动今日指令、行为镜像和身份等级沉淀。

产品主线保持不变：

```text
空间记录 -> 策略提示 -> 行为画像 -> 身份沉淀
```

新的用户心智表达为：

```text
启动空间，记录脉冲。
封存航程，写入黑匣子。
点火航行核心，生成今日指令。
进入全息观测舱，查看镜像投影。
接入身份终端，管理舰员档案。
```

当前技术栈：后端 Java 21 + Spring Boot 3.2.5 + MyBatis-Plus + MySQL + Redis/Redisson + WebSocket；前端为原生微信小程序。视觉定位为黑底、蓝光、克制、冷静的数据终端，不做浮夸科幻游戏，不做传统表单工具。

## 启动命令

```bash
# 基础设施（MySQL 13306, Redis 16379）
docker-compose up -d

# 后端（端口 18080，需指定 Java 21）
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run

# 前端：微信开发者工具导入 miniprogram/ 目录
```

## 当前架构事实

- **一个空间 = 一次任务航程记录**：没有 session 表；封存时把运行期数据归档到 `room.all_record`，成员最终值写入 `room_member.final_score`，`quit_time` 标记历史样本。
- **双记录模式**：Mode 1 自由流转（成员之间直接记录数值流向）；Mode 2 本局录入（start → submit → confirm/reject/cancel/apply，支持主控填写和成员自填）。代码层可保留既有命名，用户可见文案必须收敛到「记录」「脉冲」「航程」「封存」等体系。
- **Redis 优先但不是纯 Redis**：运行期分数、成员元信息、流向事件、待处理本局录、总览缓存都在 Redis；当前实现仍会在创建/加入/记分/轮次生效时访问 MySQL。不要把「MySQL 零参与」描述成既成事实，后续只能作为性能收敛目标。
- **实时推送**：WebSocket `/ws/score` 以空间为广播单位，推送 `TRANSFER`、`SCORE_UPDATE`、`MEMBER_JOIN/LEAVE`、`ROUND_*`、`SETTINGS_CHANGED`、`SETTLE` 等事件。
- **持久化边界**：创建空间、成员关系、用户设置、镜像档案、策略日志、身份等级进入 MySQL；封存和本局录生效会写 MySQL；趋势/身份/镜像主要从历史归档数据计算。
- **黑匣子样本**：产品层称为「黑匣子」，工程层仍主要对应 `room.all_record`、`room_member.final_score`、历史归档、趋势统计和策略/镜像/身份的输入样本。
- **图片与头像**：后端签发 OSS 预签名 PUT URL；前端压缩后直传；本地默认头像和 `helmet-avatar` 组件负责头像终端化展示。
- **雪花 ID**：所有实体 ID 由 `SnowflakeIdGenerator` 生成，禁止依赖数据库自增。
- **虚拟线程**：`spring.threads.virtual.enabled=true`，异步任务复用 `asyncExecutor` 虚拟线程池。
- **启动恢复**：`CacheWarmUpRunner` 会从 MySQL 活跃空间重建 Redis 元信息、房间号映射和排行榜。
- **超时任务**：`RoomTimeoutTask` 每 5 分钟扫描 3 小时无活动空间。当前自由流转模式主要写 `events`，自动封存/结算逻辑必须同时检查 `events` 与 `batches`，不能只看批次列表。

## 世界观与产品语言

### 核心设定

脉冲终端是一套深空任务记录系统。用户不是在填写表格，而是在接入一艘个人数据舰船。每一次空间启动都是一次短程航程；每一次数值变化都是脉冲轨迹；每一次封存都会写入黑匣子，并让后续的航行核心、镜像系统和身份终端获得更多样本。

### 四个主 Tab 的舱位定位

| Tab | 舰船舱位 | 系统身份 | 主要体验 |
|---|---|---|---|
| 空间 | 驾驶舱 | 任务记录系统 | 启动空间、接入舰员、记录脉冲、封存航程 |
| 策略 | 起飞甲板 | 航行核心系统 | 点火航行核心、生成今日指令投影、校准推进节奏与安全边界 |
| 镜像 | 全息观测舱 | 行为镜像系统 | 校准人格协议、读取黑匣子样本、展开五维扫描与镜像投影 |
| 身份 | 舰员档案舱 | 身份认证系统 | 管理舰员代号、头盔识别、权限等级、装备协议 |

### 全局术语表

| 普通说法/旧说法 | 用户可见推荐说法 |
|---|---|
| 用户 | 舰员 |
| 昵称 | 舰员代号 |
| 头像 | 头盔识别 |
| 房间 | 空间 |
| 房间号 | 识别码 |
| 创建房间 | 启动空间 |
| 加入房间 | 接入空间 |
| 成员列表 | 舰员席位 |
| 分数变化 | 脉冲变化 / 数值流向 |
| 流水记录 | 脉冲轨迹 |
| 结算 | 封存 |
| 历史记录 | 黑匣子样本 / 黑匣子回放 |
| 今日策略 | 今日指令投影 |
| 策略核心 | 航行核心 |
| 生成策略 | 点火航行核心 / 展开指令投影 |
| 重新生成/重新推演 | 重新点火 |
| 状态提示 | 状态读数 |
| 行动建议 | 推进节奏 |
| 风险提醒 | 安全边界 |
| 执行建议 | 舰载指令 |
| 人格测试 | 人格协议校准 |
| 行为画像 | 镜像投影 |
| 雷达图 | 五维扫描 |
| 设置 | 装备协议 |
| 退出登录 | 断开终端 |

### 技术穿帮词禁止直出

以下词可以存在于代码变量、接口字段、日志表或内部注释中，但不得直接出现在运行时用户可见页面、海报、分享标题、按钮、Toast、弹窗正文中：

```text
LLM、LOW-NOISE、MEDIUM-NOISE、HIGH-NOISE、HIGH_RISK、fallback、oracle、fortune、strategy output、THE CALIBRATOR、校准者
```

推荐展示映射：

```text
LLM -> 主引擎
LOW-NOISE -> 低噪
MEDIUM-NOISE -> 中噪
HIGH-NOISE -> 高噪
HIGH_RISK -> 偏高
fallback -> 备用指令
strategy output -> 指令投影
THE CALIBRATOR / 校准者 -> 舰载指令 / DIRECTIVE
```

## 核心模块

### 空间模块：驾驶舱 / 任务记录系统

- **创建/接入空间**：`POST /room`、`POST /room/join`，房间号由 Redis `SETNX` 预占生成，成员上限 16。
- **自由流转**：`POST /score/transfer`，Lua 原子更新 `sr:room:{rid}:scores`，流向事件写入 `sr:room:{rid}:events`，WS 推送双方最新分数。
- **本局录入**：`POST /round/start`、`/round/submit`、`/round/confirm`、`/round/cancel`，待处理状态在 Redis，生效后写 `round_record` 与 `round_record_detail`。
- **封存归档**：`POST /score/room/{rid}/settle`，归档 `room.all_record`，更新 `room_member.final_score/quit_time`，清理运行期 Redis key，广播 `SETTLE`。
- **复盘数据**：`/score/room/{rid}/chart`、`/score/room/{rid}/insight`、`/score/room/{rid}/network`、`/score/trend`、`/score/yield-log`。

用户可见表达优先使用：

```text
驾驶舱待机、启动任务空间、接入识别码、舰员席位、记录脉冲、脉冲轨迹、航程已封存、样本已写入黑匣子
```

空间页必须强调操作感、实时感、成员席位和封存仪式感，避免普通创建表单和管理后台风格。

### 策略模块：起飞甲板 / 航行核心系统

- **今日指令投影**：LLM 主引擎 + 静态兜底双引擎，结合历史行为标签与时间意象，但输出必须是状态管理、推进节奏、安全边界和舰载指令。
- **用户标签**：连胜、连败、高风险、稳健四类在工程层影响策略原型；运行时展示必须转换为安全、克制、非结果承诺的表达。
- **缓存与刷新**：Redis 4 小时 TTL，`?force=true` 可绕过缓存重新生成。
- **安全过滤**：LLM 输出命中敏感词必须丢弃并使用 fallback；前端展示层、海报 Canvas、分享标题也要做二次替换。
- API：`GET /fortune/today`

策略页用户可见结构：

```text
起飞甲板
航行核心
点火航行核心
航核点火
校准舰员状态
接入黑匣子样本
展开指令投影
今日指令投影
舰载指令
状态读数
推进节奏
安全边界
重新点火
分享指令卡
下次校准
```

策略页交互原则：

- 底部 Tab 可以叫「策略」，页面内部优先使用「起飞甲板 / 航行核心 / 指令投影」体系。
- 点击点火后，动画要从当前航行核心原地启动，避免突然黑屏或像普通 loading。
- 生成中如果等待较久，要有舰载 heartbeat 文案轮换，例如「指令投影展开中 / 推进节奏校准中 / 链路保持中 / 安全边界校准中」。
- 结果页优先展示「舰载指令」，再展示状态读数、推进节奏和安全边界。
- 重新点火确认后必须回到 launch 待机页，由用户再次点击「点火航行核心」，不要自动生成。
- 分享卡必须是独立海报排版，不要把页面截图缩小塞进预览。

禁止把策略页做成预测、玄学、收益承诺或 AI 长文解释。策略内容只能给出状态管理、节奏提醒、安全边界和行为复盘视角。

### 镜像模块：全息观测舱 / 行为镜像系统

- **人格协议**：20 题滑动测试或直接选择 16 种 MBTI 类型。
- **任务镜像**：基于黑匣子样本生成行为镜像、人格可信度、协议偏移和系统判读。
- **五维扫描**：推进倾向、舰体稳定、接入频率、回稳能力、场域控制。3+ 次封存后解锁完整扫描。
- API：`/mirror/profile`、`/mirror/mbti/test`、`/mirror/mbti/direct`、`/mirror/stats`

用户可见表达优先使用：

```text
全息观测舱、镜像舱在线、读取黑匣子样本、人格协议校准、镜像投影、协议一致率、协议偏移、五维扫描、镜像尚未稳定
```

镜像判读必须短、冷静、数据感强，不写大段心理鸡汤，不做社交测试娱乐化。推荐短句风格：

```text
推进倾向偏高。
回稳能力中等。
连续波动后容易出现节奏偏移。
建议降低高频切换。
```

### 身份模块：舰员档案舱 / 身份认证系统

- **身份档案**：舰员代号、头盔识别、成员代号、本地乐观更新与防抖保存。
- **数据矩阵**：趋势、净数值、样本数、稳定性、成就。
- **系统控制**：通讯协议、通讯音色、视觉协议、触感协议和断开终端。
- API：`/user/me`、`/user/detail`、`/user/identity-level`

用户可见表达优先使用：

```text
身份终端已接入、舰员代号、头盔识别、权限等级、航程徽章、数据矩阵、通讯协议、视觉协议、触感协议、装备协议、断开终端
```

身份页不做普通「我的」页面，不做传统设置页。昵称应作为舰员铭牌的视觉核心；设置项应像装备槽位，而不是普通开关列表。

### 语音/TTS 系统

- **TTS**：Edge-TTS CLI 主引擎，MiMo TTS API 副引擎，ffmpeg 后处理为 44.1kHz 128kbps MP3。
- **语音播报**：自由流转接收方听到 TTS 播报，`utils/voice.js` 队列防重叠。
- **情绪音效**：记分或本局录生效时为对应用户播放情绪音频。
- **音色目录**：`voices.json` 启动加载，支持分类、试听、rate/pitch 配置。分类图标不得使用原生彩色 Emoji，必须用线框图标或纯文本代码。
- API：`/tts/audio`、`/tts/benchmark`、`/voice/catalog`、`/voice/preview`

语音相关用户可见表达可以归入身份页「通讯协议 / 通讯音色」。

## 数据库表（当前实体 10 张）

| 表 | 用途 |
|---|---|
| `user` | 用户基本信息（openid/nickname/avatarUrl） |
| `user_detail` | 用户设置（语音/动画/震动开关） |
| `room` | 空间（含 scoreMode、roundInputMethod、trustMode、zeroSumRequired、allRecord JSON 归档） |
| `room_member` | 空间成员（含 quit_time、final_score） |
| `round_record` | 本局录记录（状态机：pending_member_input / pending_confirm / applied / rejected / cancelled） |
| `round_record_detail` | 本局录明细（每用户得分） |
| `user_mirror_profile` | 镜像档案（MBTI + 战斗人格 + 综合解读，PK=userId） |
| `mirror_birth_profile` | 出生档案（预留，不在当前主流程展示） |
| `fortune_log` | 指令生成日志（prompt、响应、source、耗时、错误） |
| `user_identity_level` | 身份等级、经验、稳定度 |

## 代码规范

- Java 使用 Lombok（@Data, @Slf4j, @RequiredArgsConstructor），不要手写 getter/setter。
- 统一返回结构 `Result<T>`，业务异常用 `BizException`。
- Controller 只做参数校验和转发，业务逻辑在 Service 层。
- 所有 DTO 必须有 `@Schema` 注解和 `example` 示例值。
- 前端 WXML/WXSS 使用 2 空格缩进。
- 代码注释使用中文。
- 运行时用户可见文案优先集中映射，不要在多个页面散落硬编码旧词。
- 后端字段名、数据库表名和 API 路径可以沿用既有命名，不为世界观强行改底层协议。

## 非显而易见的模式

- 房间号生成：Redis `SETNX`，字符集去 O/0/I/L，6 位，碰撞重试最多 10 次。用户可见称为「识别码」。
- 运行期锁：`sr:room:{rid}:lock`，Redisson `tryLock(5s, 30s)`；自由流转核心扣加分走 Lua。
- Redis key：`sr:room:{rid}:meta`、`scores`、`batches`、`batch:{ts}`、`events`、`overview`、`roundConfig`、`round`、`round:details`、`round:members`、`round:confirms`、`sr:room_no:{roomNo}`、`sr:user:rooms:{uid}`、`sr:user:{uid}`、`sr:fortune:{uid}:{date}`。
- 得分聚合：进行中优先读 Redis ZSet / events；已封存读 `room.all_record` 与 `room_member.final_score`。
- 小程序码：后端调微信 `getUnlimited` API → 字节流 → OSS PUT → 返回访问 URL。
- 前端设置防抖：舰员代号/头盔识别/语音/动效/触感统一 2 秒防抖 + onHide 刷盘，本地缓存即时生效，服务端延迟持久化。
- 震动守卫：所有 `wx.vibrateShort` 通过 `utils/haptic.js` 封装，`vibrateEnabled=false` 时跳过。
- 动效守卫：页面根节点必须绑定 `reduce-motion`，JS 动画和定时器必须先判断 `app.globalData.animationEnabled`。
- WebSocket：前端 `utils/score-ws.js` 是全局单例事件总线；页面只订阅/取消，不随页面销毁断开连接。
- 镜像缓存：profile 30 分钟 Redis TTL，stats 24 小时 TTL。
- 策略缓存：4 小时 Redis TTL，`?force=true` 绕过。
- TTS 队列：前端 `voice.js` 维护播放队列，防止多条播报重叠。

## 安全注意

- `application.yml` 中的密码和密钥仅用于本地开发，生产环境必须替换。
- 不要将 `target/` 目录提交到版本控制。
- JWT secret 至少 256 位。
- 禁止在 console、日志、错误提示中输出 JWT、微信 code、OSS 签名 URL 的敏感 query。
- WebSocket 可以通过 query token 兼容旧客户端，但前端不得打印完整连接 URL；后续优先使用 `Sec-WebSocket-Protocol: access_token.<jwt>`。
- 运行时页面、Prompt、fallback、分享文案不得出现审核高风险词；文档可以列出禁词用于约束，但不得复制到用户可见页面。
- 分享卡、Canvas 海报、Toast、弹窗、空状态、错误态同样属于运行时用户可见内容，必须经过同一套敏感词和世界观映射。

## 端口规划（避开常用端口）

| 服务 | 端口 |
|---|---|
| 后端 API | 18080 |
| MySQL | 13306 |
| Redis | 16379 |

# Smart Record 全局工程架构与 UI 约束宪法 (Master Prompt)

执行任何开发任务前，先区分三类信息：**当前事实** 是代码已经具备的行为；**硬约束** 是本次改动必须遵守的边界；**收敛目标** 是后续优化方向，不能在文档、注释、提交说明中写成已完成能力。

## 1. 运行边界与架构约束

- **2C2G 极限环境**：后端按 2 核 2G 容器预算设计，严禁引入高频全空间轮询、无差别广播、阻塞式批量计算、运行期大对象 JSON 反复序列化等 CPU/内存放大逻辑。
- **成员上限**：空间成员数严格限制 `MAX_MEMBERS = 16`。接入空间前必须先做 Redis 侧容量校验，超过阈值立即 fail-fast，前端用温和提示承接业务错误码，不能把异常堆栈或服务端错误直接暴露给用户。
- **Redis 优先，逐步收敛**：当前实现已经把分数、成员元信息、流向事件、待处理本局录、总览缓存放在 Redis，但创建、加入、部分记分生效和归档仍会访问 MySQL。新增运行期功能必须优先使用 Redis Hash/ZSet/List 与 Lua 原子操作；MySQL 热路径只能作为待收敛技术债处理。
- **持久化边界**：MySQL 负责用户、空间元数据、成员关系、用户设置、镜像档案、策略日志、身份等级、封存归档。运行期频繁变化状态不得新增 MySQL 读写依赖。
- **Redis 降级**：Redis 连接失败、脚本失败、锁失败必须被业务层捕获，统一返回 `Result` 结构和可识别 code；页面只展示简短状态提示，不展示堆栈、类名、连接串。
- **实时同步**：WebSocket 必须维持全局单例与稳定回调引用。页面只订阅/取消事件，不在普通页面生命周期里反复销毁连接。任何调试日志都不能打印 JWT、完整 WS URL、微信 code 或 OSS 签名 query。
- **超时归档**：自动封存/解散必须同时识别 `events` 与 `batches`，自由流转模式不能因为没有批次记录就被误判为空空间。

## 2. 产品定位

Smart Record 不是普通表单工具，也不是传统娱乐小程序。它的主体验是：

```text
空间记录 -> 策略提示 -> 行为画像 -> 身份沉淀
```

新的世界观表达是：

```text
空间是驾驶，策略是点火，镜像是扫描，身份是认证，黑匣子是记忆。
```

整体气质：

```text
黑底、蓝光、克制、冷静、数据感、舰载终端感、复盘感、身份感
```

四个主 Tab 的职责：

| Tab | 舱位定位 | 主要体验 |
|---|---|---|
| 空间 | 驾驶舱 | 启动任务空间、接入舰员、记录脉冲、封存航程 |
| 策略 | 起飞甲板 | 点火航行核心、生成今日指令投影、查看推进节奏与安全边界 |
| 镜像 | 全息观测舱 | 校准人格协议、查看镜像投影、协议一致率与五维扫描 |
| 身份 | 舰员档案舱 | 管理舰员代号、头盔识别、权限等级、通讯/视觉/触感协议 |

禁止把产品做成：微信默认表单页、传统设置页、娱乐押注工具、玄学工具、儿童化游戏界面、大红大金视觉、满屏营销卡片、浮夸科幻游戏界面。

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

- 蓝色/青色只做主高亮、数据焦点、航行核心、指令投影和按钮焦点。
- 绿色只表达在线、已连接、同步完成等正向系统状态。
- 橙色只表达偏高、注意、边界、校准中。
- 红色只用于危险、退出、错误、失败，禁止用于分享按钮、普通状态 badge、非危险提示。
- 正文透明度不要低于 `0.40`；装饰性英文可低到 `0.24-0.28`，但不能承载关键含义。
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

舰载 HUD 核心框推荐：

```css
.sr-hud-panel {
  border: 1rpx solid rgba(0,200,255,0.22);
  background: rgba(3,10,18,0.64);
  clip-path: polygon(
    24rpx 0,
    calc(100% - 24rpx) 0,
    100% 24rpx,
    100% calc(100% - 24rpx),
    calc(100% - 24rpx) 100%,
    24rpx 100%,
    0 calc(100% - 24rpx),
    0 24rpx
  );
}
```

## 4. 终端风格细节

舰载终端感来自克制层级，不来自堆砌发光元素。

允许：细描边、切角按钮、弱扫描线、HUD 小标签、状态点、数据条、甲板透视线、全息扫描环、极少量英文 kicker、数字等宽。

禁止：大面积发光、所有文字都变蓝、每个按钮都有光晕、持续粒子、控制台日志堆砌、大量英文缩写、AI 长段解释、模拟游戏战斗 UI。

所有关键功能必须使用中文。英文只能作为弱装饰、副标题或状态标签：

```text
航行核心          NAV CORE
今日指令投影      FLIGHT DIRECTIVE
镜像投影          MIRROR PROJECTION
舰员档案          CREW PROFILE
```

不要出现纯英文主按钮。主操作使用「启动空间 / 接入空间 / 点火航行核心 / 更新协议 / 封存航程 / 断开终端」这类中文动词。

中文标题字距要克制，不要过度拉开导致可读性下降；英文装饰可以拉开字距。

## 5. 页面分工

### 空间页（驾驶舱）

负责启动空间、接入空间、空间配置、成员布局、数值记录、实时流水、封存归档。文案使用「空间」「识别码」「接入」「舰员席位」「记录脉冲」「封存」「黑匣子」，避免普通表单感。

空间页视觉关键词：驾驶舱仪表、席位矩阵、实时脉冲轨迹、任务状态条、封存黑匣子。

### 策略页（起飞甲板）

负责今日状态、行动建议、风险提醒、策略卡分享的产品功能，但用户可见体验必须包装为「航行核心 / 今日指令投影」。展示内容必须是复盘建议、节奏提醒、状态管理、安全边界，不做结果预测，不承诺收益，不引导冒进。

策略页视觉关键词：甲板透视线、航行核心、点火动画、指令投影、系统日志舱、低噪/中噪/高噪状态。

### 镜像页（全息观测舱）

负责 MBTI 协议、历史表现画像、人格一致性、五维扫描、画像分享。镜像判读必须短、冷静、数据感，不写大段 AI 心理鸡汤。

镜像页视觉关键词：全息投影、扫描环、人格协议、协议偏移、五维扫描、黑匣子样本读取。

### 身份页（舰员档案舱）

负责用户身份、权限等级、总积分、样本数、成就、设置入口、声音/动效/触感协议。首页只放高频身份信息，详细开关进入二级设置或折叠区域。

身份页视觉关键词：舰员铭牌、头盔识别、权限等级、数据矩阵、装备槽位、通讯/视觉/触感协议。

## 6. 组件与布局规范

- **按钮**：主按钮高度 72rpx-88rpx，不超过 96rpx。优先细描边、切角、状态点，不做传统大圆角纯蓝按钮。
- **异步按钮**：必须使用「文本绝对居中 + 图标/Loading 绝对定位」结构，Loading 状态文字位置不能抖动。
- **危险操作**：退出、删除、解散、断开终端使用透明底 + 红色细描边，不做大红底按钮。
- **分享/保存操作**：分享、保存、发送给朋友使用蓝色/青色，不使用红色。
- **线框图标**：全站 WXML/WXSS/运行时数据禁止原生彩色 Emoji。图标使用纯色线框、CSS icon、SVG path 或图标字体。
- **成员简易模式**：16 人以内使用 4x4 矩阵网格，配合 `scroll-view` 和 `max-height: 600rpx`，大数字必须格式化并防溢出。
- **座位模式**：使用绝对定位舞台，中央仅作为空间参考点，成员通过 `pos-top` / `pos-bottom` / `pos-left` / `pos-right` 环绕排布。
- **弹窗**：用 `wx:if` 懒渲染；底部抽屉、确认弹窗、选择器必须支持 reduce-motion 的静默展开。
- **底部安全区**：Tab 页面内容区必须考虑自定义 tabbar 与 `env(safe-area-inset-bottom)`，结果页、长列表、底部按钮至少预留 180rpx-240rpx。
- **海报预览**：分享海报不是页面缩略图，必须做独立排版，保证主指令/核心信息可读。

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

- JS 动画、Canvas 动画、分数滚动、雷达扫描、点火动画、打字机日志、heartbeat 文案轮换、粒子、`requestAnimationFrame`、长链 `setTimeout` 执行前必须判断 `app.globalData.animationEnabled`。
- reduce-motion 下可以切换静态状态和文字，但不得运行长动画、循环旋转、持续光束、粒子或扫描。
- 所有 timer / interval / animation frame 必须在 `onHide` 或 `onUnload` 清理。
- 动效允许轻微渐入、短扫描线、按钮按压、数值滚动、短点火序列；禁止持续强发光、复杂滚动联动、长时间 loading、无法跳过的打字动画。
- 等待时间超过 6 秒的页面必须提供克制的状态反馈，不能让页面长时间完全静止。

## 8. 文案与审核安全

运行时页面、Prompt、fallback、分享图文、Canvas 海报、Toast、弹窗、按钮、空状态、错误态必须避开审核高风险词。文档可以列出禁词用于约束，但不得把禁词复制到用户可见页面。

禁止出现在运行时用户可见内容中：

```text
棋牌、赌博、赌、下注、押注、筹码、牌局、牌桌、打牌、麻将、扑克、德州、梭哈、赢钱、赚钱、发财、稳赚、必胜、翻本、追损、运势、算命、占卜、塔罗、抽牌、神谕、卦象、黄历、风水、开运、转运、改运、预测输赢、胜率提升
```

额外禁止直接出现在策略、镜像、分享卡等运行时内容中：

```text
盈利、亏损、收益、胜率、预测、稳赚、暴富、回本、翻盘、赔率、盘口、庄家
```

推荐替换：

```text
任务/回合/场景、积分、结果波动、状态读数、今日指令投影、点火航行核心、指令参考、状态分析、节奏校准、情绪化修正、安全边界、黑匣子样本
```

AI 输出必须通过敏感词过滤。命中时丢弃生成结果，使用静态 fallback。前端二次展示也必须做 sanitize，尤其是后端返回的 title、subtitle、tags、verdict、poster canvas 文案、分享标题。

推荐语气：冷静、克制、短句、舰载终端感、复盘视角。

## 9. 前端性能规范

- 音色试听维护单例 `InnerAudioContext`，执行 `stop() -> src 替换 -> play()`，禁止重复创建实例。
- 页面滚动时不 `setData`，触摸绘图必须节流到一帧一次。
- WXSS 禁止 `transition: all;`，改成明确属性：`transition: opacity .2s, transform .2s, background-color .2s;`。
- Canvas 组件必须在不可见或 reduce-motion 时停止扫描/脉冲动画。
- 普通卡片不用 blur 和阴影；仅主视觉卡、抽屉、浮层允许少量模糊。
- `setData` 只写必要字段，避免整块 `room`、大数组、图表数据在高频事件里反复写入。
- 长等待 heartbeat 文案轮换不得高频 setData，建议 3 秒以上间隔。
- 分享海报 Canvas 应一次性绘制，避免在页面滚动或动画中反复重绘。

## 10. 当前优先技术债

这些不是架构原则，而是下一轮优化必须优先排查的已知问题。修复前不要在文档、提交说明或页面中写成已完成：

- `miniprogram/pages/room/room.wxml` 根节点仍需确认是否已绑定 `reduce-motion`。
- `miniprogram/pages/voice-select/voice-select.wxml` 页面根节点需确认是否已绑定全局动效静默类。
- `miniprogram/utils/score-ws.js` 若 `DEBUG_WS = true`，必须关闭，且不得打印带 token 的完整连接 URL。
- `backend/src/main/resources/voices.json` 分类 icon 若仍使用原生彩色 Emoji，必须替换为线框图标或纯文本代码。
- `miniprogram/pages/room/room.js` 获取二维码时需确认是否仍按 `resp.data.qrCodeUrl` 读取，避免和当前 request 封装返回形态不一致。
- `backend/src/main/java/com/smartrecord/task/RoomTimeoutTask.java` 自动封存检查不能只看 `batches`，必须兼容自由流转 `events`。
- `ScoreServiceImpl.getRoomInsight` 不应直接用包含 owner/status 等字段的 meta `HLEN` 作为成员密度。
- 策略页需持续巡检是否仍有 `LOW-NOISE`、`LLM`、`THE CALIBRATOR`、`盈利` 等用户可见穿帮词。
- 分享海报需确认不是结果页缩略截图，而是独立排版且文字清晰可读。

## 11. 验收清单

### 全局验收

- 所有主操作为中文，英文仅弱装饰。
- 运行时不出现审核高风险词。
- 运行时不出现技术穿帮词：`LLM`、`LOW-NOISE`、`HIGH_RISK`、`fallback` 等。
- 红色只用于危险、错误、失败。
- 所有核心页面支持 reduce-motion。
- 所有 timer / interval / animation frame 在页面隐藏或卸载时清理。
- 不新增高频轮询、无差别广播、运行期大对象反复序列化。

### 空间页验收

```text
我在驾驶舱启动一个任务空间。
我能接入舰员，看到席位和脉冲轨迹。
我能封存航程，并理解样本写入黑匣子。
```

### 策略页验收

```text
我站在起飞甲板上点火航行核心。
我看到今日指令投影，而不是普通 AI 建议。
我先获得舰载指令，再查看状态读数、推进节奏和安全边界。
重新点火会回到待机页，由我再次手动点火。
```

### 镜像页验收

```text
我进入全息观测舱查看镜像投影。
系统读取黑匣子样本，展示人格协议、协议偏移和五维扫描。
判读短、冷静、像系统扫描结果。
```

### 身份页验收

```text
我在身份终端管理舰员档案。
舰员代号是页面视觉核心。
声音、动效、触感像装备协议，而不是普通设置开关。
```

## 12. 最终体验目标

用户感知应该是：

```text
我在驾驶舱启动空间。
我在起飞甲板点火航行核心。
我在全息观测舱查看镜像。
我在舰员档案舱管理身份。
每一次封存，都会写入黑匣子，让系统更懂我。
```

所有页面必须服务于：记录 -> 复盘 -> 画像 -> 身份。

最终产品心智：

```text
空间是驾驶。
策略是点火。
镜像是扫描。
身份是认证。
黑匣子是记忆。
```
