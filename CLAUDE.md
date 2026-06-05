# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Happy记分器 — 多人实时协同记分微信小程序，集成赛博运势、镜像人格分析、语音播报等增值模块。后端 Java 21 (Spring Boot 3.2.5) + 前端原生微信小程序。

## 启动命令

```bash
# 基础设施（MySQL 13306, Redis 16379）
docker-compose up -d

# 后端（端口 18080，需指定 Java 21）
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run

# 前端：微信开发者工具导入 miniprogram/ 目录
```

## 架构要点

- **一个房间 = 一次对局**：无 session 概念，settle 时数据归档到 room.all_record JSON
- **双记分模式**：自由流转（Mode 1，任何人可对任何人记分）+ 本局录入（Mode 2，轮次制批量录入）
- **实时数据走 Redis**：排行榜 (Sorted Set)、批次得分 (Hash)、流水 (ZSet)、分布式锁 (Redisson)
- **持久化走 MySQL**：settle 时同步写入 room.all_record + room_member.final_score
- **图片直传阿里云 OSS**：后端签发预签名 PUT URL，前端压缩后直传，不经过后端中转
- **实时推送**：WebSocket (`/ws/score`)，房间级广播，记分/轮次/成员变动推送给同房间所有玩家
- **雪花 ID**：所有实体 ID 由 `SnowflakeIdGenerator` 生成，非数据库自增
- **虚拟线程**：JDK 21 虚拟线程全面启用（`spring.threads.virtual.enabled=true`），异步任务复用 `asyncExecutor` 虚拟线程池
- **用户设置持久化**：user_detail 表存储语音/动画/震动设置，通过 `PUT /user/detail` 防抖保存
- **启动恢复**：CacheWarmUpRunner 启动时从 MySQL 重建所有活跃房间的 Redis 状态
- **自动结算**：RoomTimeoutTask 每 5 分钟扫描，3 小时无活动的房间自动归档/解散

## 核心模块

### 记分系统
- **自由流转 (Mode 1)**：POST `/score/transfer`，A 对 B 记分，Redisson 分布式锁保证并发安全
- **本局录入 (Mode 2)**：轮次生命周期 start → submit → confirm/reject → cancel，支持房主统录/成员自录两种输入方式
- **结算归档**：POST `/score/room/{rid}/settle` 归档数据到 MySQL，广播 WS `SETTLE`
- **趋势分析**：GET `/score/trend` 跨场次净得分折线图

### 镜像模块 (Mirror)
- **战斗人格**：分析最近 10 场净得分，4 维度（稳定性/进攻性/回撤控制/波动风险）→ 7 种人格原型
- **MBTI 校准**：20 题滑动测试 或 直接选择 16 种类型
- **综合解读**：MBTI + 战斗人格联合分析，生成策略标签和解读文本
- **五维雷达图**：进攻性/稳定性/参局率/翻盘力/控场力，需 3+ 场解锁
- API：`/mirror/profile`、`/mirror/mbti/test`、`/mirror/mbti/direct`、`/mirror/stats`

### 运势模块 (Fortune)
- **赛博运势**：LLM 主引擎 + 静态兜底双引擎，农历/干支/节气集成
- **用户标签**：连胜/连败/高风险/稳健 四类，影响运势生成
- **Redis 缓存**：4 小时 TTL，支持 `?force=true` 绕过缓存重新生成
- API：`GET /fortune/today`

### 语音/TTS 系统
- **双引擎**：Edge-TTS (CLI) 主引擎 + MiMo TTS API 副引擎，ffmpeg 后处理为 44.1kHz 128kbps MP3
- **语音播报**：记分到达时接收方听到 TTS 播报（队列防重叠）
- **情绪音效**：记分/轮次确认时播放随机胜负音效
- **音色目录**：`voices.json` 启动加载，支持分类/预览/速率配置
- API：`/tts/audio`、`/tts/benchmark`、`/voice/catalog`、`/voice/preview`

## 数据库表（8 张）

| 表 | 用途 |
|---|---|
| `user` | 用户基本信息（openid/nickname/avatarUrl） |
| `user_detail` | 用户设置（语音/动画/震动开关） |
| `room` | 房间（含 scoreMode、roundInputMethod、allRecord JSON 归档） |
| `room_member` | 房间成员（含 quit_time、final_score） |
| `round_record` | 轮次记录（状态机：pending → confirm → applied/rejected/cancelled） |
| `round_record_detail` | 轮次明细（每用户得分） |
| `user_mirror_profile` | 镜像档案（MBTI + 战斗人格 + 综合解读，PK=userId） |
| `mirror_birth_profile` | 出生档案（预留星盘/紫微集成） |

## 代码规范

- Java 使用 Lombok（@Data, @Slf4j, @RequiredArgsConstructor），不要手写 getter/setter
- 统一返回结构 `Result<T>`，业务异常用 `BizException`
- Controller 只做参数校验和转发，业务逻辑在 Service 层
- 所有 DTO 必须有 `@Schema` 注解和 `example` 示例值
- 前端 WXML/WXSS 使用 2 空格缩进
- 代码注释使用中文

## 非显而易见的模式

- 房间号生成：Redis SETNX，32 字符集（去 O/0/I/L），6 位，碰撞重试最多 10 次
- 记分并发控制：Redisson `tryLock(5s, 30s)`，锁 key 为 `sr:room:{rid}:lock`
- Redis key 前缀：`sr:room:{rid}:meta` (Hash)、`sr:room:{rid}:scores` (ZSet)、`sr:room:{rid}:batches` (List)、`sr:room:{rid}:batch:{ts}` (Hash)、`sr:room:{rid}:events` (ZSet)、`sr:room:{rid}:overview` (String)、`sr:room_no:{roomNo}` (String)、`sr:user:rooms:{uid}` (Set)、`sr:user:{uid}` (String)
- 得分聚合：进行中读 Redis Sorted Set，已结算读 room.all_record JSON
- 小程序码：后端调微信 `getUnlimited` API → 字节流 → OSS PUT → 返回访问 URL
- 前端设置防抖：昵称/头像/语音/动画/震动统一 2 秒防抖 + onHide 刷盘，本地缓存即时生效，服务端延迟持久化
- 震动守卫：所有 `wx.vibrateShort` 通过 `utils/haptic.js` 封装，`vibrateEnabled=false` 时跳过
- 镜像缓存：mirror profile 30 分钟 Redis TTL，stats 24 小时 TTL
- 运势缓存：4 小时 Redis TTL，`?force=true` 绕过
- TTS 队列：前端 `voice.js` 维护播放队列，防止多条播报重叠

## 安全注意

- `application.yml` 中的密码和密钥仅用于本地开发，生产环境必须替换
- 不要将 `target/` 目录提交到版本控制
- JWT secret 至少 256 位

## 端口规划（避开常用端口）

| 服务 | 端口 |
|---|---|
| 后端 API | 18080 |
| MySQL | 13306 |
| Redis | 16379 |

# ⚡️ Smart Record 全局工程架构与 UI 约束宪法 (Master Prompt)

在执行任何开发任务前，必须以本指令为最高约束。本项目运行在 2核2G 的极限环境下，追求极致的高性能与旗舰级美学体验。

## 1. 系统物理边界与核心架构 (The 2C2G Constraints)
- **CPU 瓶颈约束**：后端采用 2C2G 容器部署，严禁任何可能触发 CPU 广播风暴的逻辑。
- **并发与容量上限**：房间人数严格限制 `MAX_MEMBERS = 16`。
  - **强制校验**：加入房间前，必须通过 Redis `SCARD` 或 `HLEN` 前置校验，超过阈值立即执行 Fail-fast，前端统一拦截业务错误码（如 4003）并进行温和提示，严禁报错。
- **纯 Redis 流转架构**：
  - 打牌期间，MySQL 零参与。所有状态（分数、座次、成员）只存在于 Redis 中，通过 Lua 脚本原子操作。
  - **优雅降级**：必须全局捕获 Redis 异常（`RedisConnectionFailureException` 等），返回 HTTP 200 + Code 503，严禁暴露堆栈。

## 2. 极致极简视觉美学 (UI/UX Guidelines)
- **严禁彩色 Emoji**：全站 WXML/WXSS 中严禁出现原生彩色 Emoji。所有 UI 元素必须使用纯色线框 SVG (Line Icons)。
- **Glassmorphism 质感**：
  - 底色 `#0A0A0A`，卡片背景 `rgba(255, 255, 255, 0.04)`，模糊度 `blur(20px)`，边框 `1px solid rgba(255, 255, 255, 0.08)`。
  - 高亮强调色统一为 `#0A84FF`。
- **布局防抖逻辑**：所有异步 Loading 按钮，必须使用"文本绝对居中 + 图标绝对定位"的结构，确保文字在 Loading 状态下偏移量为 0。

## 3. 成员与座位布局模式 (Member Layouts)
- **简易模式 (Simple Mode)**：4x4 矩阵网格，必须配合 `scroll-view` 与 `max-height: 600rpx`，防止撑爆首屏。
- **座位模式 (Seat Mode)**：使用"绝对定位舞台 (Absolute Positioning Stage)"。中央设为虚拟桌子参考点，玩家通过 `pos-top`, `pos-bottom`, `pos-left`, `pos-right` 环绕排布，营造空间秩序感。

## 4. 全局动效静默管理 (Animation Management)
- **开关集成**：全局开关 `animationEnabled` (全局控制：`app.globalData` + `Storage`)。
- **JS 守卫**：记分流程、飞行粒子、分数滚动动画必须在执行前判断 `if (!app.globalData.animationEnabled)`，跳过所有 `requestAnimationFrame` 和定时器。
- **CSS 静默机制**：
  - 核心页面根节点必须绑定：`class="page-container {{!animationEnabled ? 'reduce-motion' : ''}}"`。
  - `app.wxss` 全局覆盖规则：
    ```css
    .reduce-motion * { animation: none !important; transition: none !important; }
    ```

## 5. 前端性能最佳实践
- **音频单例模式**：音色试听必须维护单例 `InnerAudioContext`，执行 `stop() -> src替换 -> play()`，严禁重复创建实例。
- **组件化交互**：记分键盘、成员卡片、底部抽屉，必须具备高级弹性动效（`cubic-bezier`），但在 `reduce-motion` 类名作用下必须实现 0 延迟的静默展示。
