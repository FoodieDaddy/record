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

---

## 2. 产品总气质

Smart Record 不是普通记分小程序，也不是传统设置工具。

整体风格定位为：

> 赛博策略终端 / 玩家数据档案 / 积分复盘工具

核心关键词：

```text
黑底、蓝光、克制、冷静、数据感、终端感、策略感、身份感、复盘感
```

禁止做成：

```text
微信表单页、传统设置页、棋牌工具页、赌博工具页、占卜运势页、儿童化游戏界面、大红大金玄学风
```

产品主线：

```text
房间 = 记录现实
灵感 = 获得策略提示
镜像 = 认识自己的行为画像
我的 = 沉淀玩家身份
```

---

## 3. 全局视觉规范

### 背景

统一黑底：

```css
background: #0A0A0A;
```

可以使用极弱径向光：

```css
background:
  radial-gradient(circle at 20% 0%, rgba(10,132,255,0.12), transparent 32%),
  radial-gradient(circle at 90% 18%, rgba(94,92,230,0.08), transparent 30%),
  #0A0A0A;
```

不要使用大面积纯蓝、大面积渐变、彩色背景。

### 主色

```css
--color-primary: #0A84FF;
--color-cyan: #00C8FF;
--color-purple: #5E5CE6;
--color-green: #30D158;
--color-orange: #FF9F0A;
--color-red: #FF453A;
```

蓝色是主高亮色。绿色只用于「在线 / 成功 / 已连接」。红色只用于危险、退出、错误，不要大面积使用。

### 文字颜色

```css
--text-main: rgba(255,255,255,0.92);
--text-secondary: rgba(255,255,255,0.56);
--text-muted: rgba(255,255,255,0.38);
--text-disabled: rgba(255,255,255,0.24);
```

正文透明度不要低于 `0.40`。装饰性英文可以低到 `0.28`，但不能影响关键阅读。

### 卡片

统一使用暗色玻璃卡，但不要滥用毛玻璃。

主卡：

```css
.primary-card {
  border-radius: 28rpx;
  border: 1rpx solid rgba(10,132,255,0.18);
  background: rgba(255,255,255,0.035);
}
```

次级卡：

```css
.secondary-card {
  border-radius: 24rpx;
  border: 1rpx solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.025);
}
```

只允许少数主卡使用 `backdrop-filter: blur(14px);`。普通卡片不要全部 blur，不要全部 box-shadow。

---

## 4. 赛博风细节

赛博风不是大量英文、不是满屏发光、不是控制台日志堆砌。应该是：克制、少字、强层级、精确线框、冷色微光，像终端不像后台表单。

允许使用：细描边、切角按钮、扫描线、HUD小标签、弱英文副标题、数据条、状态点。

禁止滥用：大面积发光、全部文字蓝色、全部按钮发光、大量 console 日志、大量英文缩写、大段 AI 废话。

---

## 5. 中英文使用规则

页面主要面向中文用户，所有关键功能必须使用中文。英文只能作为弱装饰、副标题或状态标签。

推荐格式：

```text
房间模式          ROOM MODE
人格档案          PERSONA PROFILE
```

中文为主，英文为辅。英文样式：

```css
.kicker {
  font-size: 18rpx;
  letter-spacing: 4rpx;
  color: rgba(10,132,255,0.72);
}
```

不要出现纯英文主按钮（如 CREATE ROOM / CONNECT / STANDARD），应该改为中文（启动房间 / 接入房间 / 标准协议）。

---

## 6. 按钮规范

### 主按钮

不要用传统大圆角蓝色按钮，推荐赛博切角或细描边按钮。主按钮高度 72rpx - 88rpx，不要超过 96rpx。按钮不要全屏宽，除非是底部主操作。

### 次按钮

用于修改类型、重新测试、重新生成、取消等。

```css
border: 1rpx solid rgba(255,255,255,0.14);
background: rgba(255,255,255,0.02);
color: rgba(255,255,255,0.68);
```

### 危险按钮

退出登录、删除类操作：

```css
color: rgba(255,69,58,0.86);
border: 1rpx solid rgba(255,69,58,0.24);
background: transparent;
```

不要大红字单独悬浮。

---

## 7. 页面分工

### 房间页（记录终端）

负责：创建房间、加入房间、积分记录、房间配置。

风格：房间初始化系统、接入空间、配置终端，不要像普通表单。

创建房间主文案「启动房间」，加入房间主文案「接入房间 / 扫描接入 / 房间识别码」。不要用「房间号」「验证码」。

### 灵感页（策略灵感终端）

负责：生成今日策略提示、行动建议、风险提醒、分享策略卡。

禁止表达为：塔罗、抽牌、占卜、运势、神谕、预测输赢。

推荐文案：校准今日状态、生成你的策略提示、今日策略、行动建议、风险提醒、分享策略卡。

结果内容必须是复盘建议、状态管理、节奏提醒、风险控制，不能是输赢预测、收益承诺、玄学解释、赌博建议。

### 镜像页（玩家行为画像）

负责：MBTI人格、战绩镜像、人格一致性、分享画像。

应该回答：我是一个什么样的玩家？我的行为数据和人格是否一致？

避免：塔罗、黄历、运势、占卜工具矩阵、大量 AI 判读长文。

### 我的页（身份终端）

负责：玩家身份、总积分、胜率、对局数、人格标签、数据中心、成就、设置入口。

不要做成传统设置页。设置应该降级到二级入口「设置中心」，首页不要堆满开关。

---

## 8. 极致极简视觉美学 (UI/UX Guidelines)

- **严禁彩色 Emoji**：全站 WXML/WXSS 中严禁出现原生彩色 Emoji。所有 UI 元素必须使用纯色线框 SVG (Line Icons)。
- **Glassmorphism 质感**：
  - 底色 `#0A0A0A`，卡片背景 `rgba(255, 255, 255, 0.04)`，模糊度 `blur(20px)`，边框 `1px solid rgba(255, 255, 255, 0.08)`。
  - 高亮强调色统一为 `#0A84FF`。
- **布局防抖逻辑**：所有异步 Loading 按钮，必须使用"文本绝对居中 + 图标绝对定位"的结构，确保文字在 Loading 状态下偏移量为 0。

---

## 9. 成员与座位布局模式 (Member Layouts)

- **简易模式 (Simple Mode)**：4x4 矩阵网格，必须配合 `scroll-view` 与 `max-height: 600rpx`，防止撑爆首屏。
- **座位模式 (Seat Mode)**：使用"绝对定位舞台 (Absolute Positioning Stage)"。中央设为虚拟桌子参考点，玩家通过 `pos-top`, `pos-bottom`, `pos-left`, `pos-right` 环绕排布，营造空间秩序感。

---

## 10. 全局动效静默管理 (Animation Management)

- **开关集成**：全局开关 `animationEnabled` (全局控制：`app.globalData` + `Storage`)。
- **JS 守卫**：记分流程、飞行粒子、分数滚动动画必须在执行前判断 `if (!app.globalData.animationEnabled)`，跳过所有 `requestAnimationFrame` 和定时器。
- **CSS 静默机制**：
  - 核心页面根节点必须绑定：`class="page-container {{!animationEnabled ? 'reduce-motion' : ''}}"`。
  - `app.wxss` 全局覆盖规则：
    ```css
    .reduce-motion * { animation: none !important; transition: none !important; }
    ```

动效允许：轻微翻转、轻微浮动、渐入、细线扫描、按钮按压反馈。

动效禁止：持续强发光、大面积粒子、大量 console 打字动画、长时间 loading、滚动时复杂动画。

加载时间超过 1.5 秒必须给状态反馈。同类动画必须支持 `reduce-motion`。

---

## 11. 敏感词规避

为了小程序审核安全，所有页面、Prompt、fallback、分享图文都必须避开高风险词。

禁止出现：棋牌、赌博、赌、下注、押注、筹码、牌局、牌桌、打牌、麻将、扑克、德州、梭哈、赢钱、赚钱、发财、稳赚、必胜、翻本、追损、运势、算命、占卜、塔罗、抽牌、神谕、卦象、黄历、风水、开运、转运、改运、预测输赢、胜率提升。

推荐替换：牌局→对局/回合/场景、筹码→积分、输赢→结果波动/反馈、运势→今日状态/今日策略、抽牌→生成策略、占卜→策略参考/状态分析、翻本→情绪化修正。

所有 AI 生成内容必须经过敏感词过滤。命中敏感词时，丢弃生成结果，使用 fallback。

---

## 12. AI 文案风格

MiMo 或其他 LLM 输出必须遵守：不预测结果、不承诺收益、不鼓励冒进、不涉及赌博、不使用玄学解释、不使用传统算命口吻。

推荐语气：冷静、克制、短句、策略终端感、复盘视角。

示例安全文案：「今日适合降低试探频率，先明确目标，再进入行动。避免被短期反馈打乱节奏。」

不要写：「今日运势很好，适合出手。」

---

## 13. 前端性能最佳实践

- **音频单例模式**：音色试听必须维护单例 `InnerAudioContext`，执行 `stop() -> src替换 -> play()`，严禁重复创建实例。
- **组件化交互**：记分键盘、成员卡片、底部抽屉，必须具备高级弹性动效（`cubic-bezier`），但在 `reduce-motion` 类名作用下必须实现 0 延迟的静默展示。
- **弹窗使用 `wx:if` 懒渲染**，不要用 `hidden`。
- **页面滚动时不 setData**，普通卡片不用 blur 和阴影。
- **WXSS 禁止 `transition: all;`**，改为显式属性：`transition: opacity .2s, transform .2s, background-color .2s;`
- 避免每张卡片都 backdrop-filter / box-shadow、大量 DOM 装饰节点、setData 写入大对象。

---

## 14. TabBar 图标风格

Tab 图标统一：线框、圆角、低复杂度、24px 逻辑尺寸、未选中灰白、选中蓝色、少量发光。

当前四个 Tab：房间=记录终端、灵感=策略灵感、镜像=玩家画像、我的=身份终端。

图标必须一致，不要一个拟物、一个线框、一个填充风。

---

## 15. 表单设计规范

避免传统表单感。不要大量使用「标签+双按钮」「标签+开关」「标签+输入框」。

应改为：终端选择卡、配置预览、状态点、HUD标签、分组标题。

例如创建房间，不要：

```text
MODE
[FREE FLOW] [ROUND INPUT]
```

应该：

```text
房间模式          ROOM MODE

自由流转          实时记录积分变化
本局录入          每轮结束统一录入
```

---

## 16. 文案长度规范

- 卡片标题：2 - 6 字
- 说明文案：12 - 28 字
- 策略结果 summary：50 - 90 字
- 镜像判读：50 字以内

不要写长段 AI 解释。

---

## 17. 统一禁用项

全项目禁止：彩色 Emoji、大红大金玄学风、赌场感视觉、扑克/麻将/牌桌图形、赚钱暗示、收益承诺、无限抽取、每日运势、占卜口吻。

---

## 18. 最终设计目标

用户体验应该是：「我在启动一个记录空间 / 我在获得一条策略提示 / 我在查看自己的行为画像 / 我在管理自己的玩家身份」。

而不是：「我在填表 / 我在算命 / 我在玩牌 / 我在看设置」。

所有页面必须服务于：记录 → 复盘 → 画像 → 身份。
