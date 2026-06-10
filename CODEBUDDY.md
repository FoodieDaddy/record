# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## 项目概览

太空记分器（Space Scorekeeper，工程代号 smartrecord）—— 多人编队记分与航迹复盘微信小程序。

技术栈：Java 21 + Spring Boot 3.2.5 + MyBatis-Plus + MySQL + Redis/Redisson + WebSocket（后端），原生微信小程序（前端），Vue 3 + TypeScript + Vite + Pinia + ECharts（管理后台）。

视觉定位：黑底、蓝光、克制、冷静、数据终端感。

## 常用命令

### 基础设施

```bash
docker-compose up -d              # MySQL :13306, Redis :16379, Sentinel :18858
```

### 后端

```bash
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run   # 启动
cd backend && mvn test -DexcludedGroups=integration -B                         # 单元测试
cd backend && mvn test -Dgroups=integration -B                                # 集成测试（需 MySQL+Redis）
cd backend && mvn test -Dtest=RoomServiceTest -B                              # 单个测试类
cd backend && mvn package -DskipTests -B                                      # 构建 JAR
```

### 管理后台

```bash
cd admin-web && npm install && npm run dev      # 开发
cd admin-web && npm run build                   # 构建
```

### 前端

微信开发者工具导入 `miniprogram/` 目录。

### 部署

```bash
./deploy.sh     # 构建 JAR + 上传服务器 + 重建 Docker + 健康检查
```

### CI

推送到 main 时自动运行：单元测试 → 集成测试 → Docker 构建验证。

## 架构

### 目录结构

- `backend/` — Spring Boot 后端（Java 21，Maven）
- `miniprogram/` — 微信小程序前端（原生 WXML/WXSS/JS）
- `admin-web/` — 管理后台（Vue 3 + TypeScript）
- `docs/` — 项目文档（架构、API、数据库、术语等）
- `scripts/` — 工具脚本

### 后端包结构（com.smartrecord）

| 包 | 职责 |
|---|---|
| `controller/` | REST 接口 + admin 子包（8 个管理控制器） |
| `service/impl/` | 业务逻辑，含 `ws/` 子包（WebSocket 处理） |
| `mapper/` | MyBatis-Plus Mapper 接口 |
| `entity/` | 数据实体 |
| `dto/` | 请求/响应 DTO（含 admin/fortune/mirror/room/round/score/storage/user 子包） |
| `config/` | Spring 配置（JWT 拦截器、WebSocket、OSS、Sentinel、Snowflake 等） |
| `common/` | Result\<T\>、BizException、ErrorCode、GlobalExceptionHandler |
| `enums/` | 枚举（ScoreMode、RoundRecordStatus、MbtiType 等） |
| `util/` | 工具类（JwtUtil、SnowflakeIdGenerator、AvatarGenerator） |
| `annotation/` | @CurrentUser、@Idempotent |
| `aop/` | 幂等性切面 |
| `task/` | 启动缓存预热、房间超时任务 |
| `scheduler/` | 异步任务调度 |

### API 路由（/api 前缀）

公开路由（无需 JWT）：`/user/login`、`/admin/login`、`/tts/**`、`/voice/**`、Swagger 路径。

| 模块 | 路径 | 主要操作 |
|---|---|---|
| User | `/user/*` | 登录、资料 CRUD、身份等级 |
| Room | `/room/*` | 创建/加入/退出编队、设置 |
| Score | `/score/*` | 记分、流转、图表、概览、排名、封存、趋势、洞察、网络 |
| Round | `/round/*` | 轮次流程：开始/提交/确认/取消 |
| Mirror | `/mirror/*` | MBTI 测试/直填、镜像档案、五维扫描 |
| Fortune | `/fortune/*` | 今日策略 |
| TTS | `/tts/*` | 语音合成 |
| Storage | `/storage/*` | 预签名上传 |
| Admin | `/admin/*` | 认证、仪表盘、用户、编队、指令、镜像、审计、系统 |

### 数据层

- **MySQL**：用户、编队元数据、成员关系、设置、镜像档案、策略日志、身份等级、封存归档、管理/审计
- **Redis**：运行期热数据（分数 ZSet、成员 Hash、流向事件 List、待处理轮次、概览缓存、流转建议）
- **Redis Key 模式**：`sr:room:<roomId>:data`（Hash 存成员、ZSet 存分数、List 存事件）
- **Redisson**：分布式锁（记分并发控制）、Lua 原子操作（流转）
- **ID 策略**：全局 Snowflake ID，禁止数据库自增
- **Flyway**：V1–V5 迁移（admin、async_task、audit_log、性能索引）

### WebSocket

- 端点：`ws://host:18080/api/ws/score?roomId=XXX`
- 认证：`Sec-WebSocket-Protocol: access_token.<jwt>`（主）/ `?token=<jwt>`（兼容）
- 服务端：`ScoreWebSocket`，按编队广播（`ConcurrentHashMap<roomId, Set<Session>>`），心跳 25s/超时 60s
- 客户端：`miniprogram/utils/score-ws.js`，全局单例事件总线，自动重连指数退避（3s→48s，最多 5 次），页面只订阅/取消

### 认证

- JWT（HMAC-SHA），Header：`Authorization: Bearer <token>`
- 微信登录：`wx.login` code → 后端调微信 API 取 openid → 创建/查找用户 → 返回 JWT
- 管理端：独立 BCrypt 登录 + 会话追踪

### 小程序前端

- **页面**：login、room（主驾驶舱，拆分为 room.js + room-action-handler.js + room-patch-scheduler.js + room-view-model.js + pulse-handler.js）、fortune、mirror、profile
- **分包** pages-ext：settings、voice-select、settle、score-records、level-archive
- **组件** 22 个（battle-insight、flow-log-panel、force-graph、radar-chart、score-chart 等）
- **服务层** 5 个（room-service、score-service、round-service、fortune-service、profile-service）
- **工具** 20 个（score-ws、request、haptic、audio-manager、transfer-audio 等）
- **环境配置**：`config/env.js`（local / anyservice / prod 三模式）

## 核心规则

### 后端

- Lombok（`@Data`、`@Slf4j`、`@RequiredArgsConstructor`），不手写 getter/setter
- 统一返回 `Result<T>`，业务异常 `BizException`
- Controller 只做参数校验和转发，业务逻辑在 Service
- DTO 必须有 `@Schema` 注解和 `example`
- 运行期频繁变化状态优先用 Redis Hash/ZSet/List + Lua 原子操作
- MySQL 热路径收敛是目标，不是已完成事实；不要把优化目标写成已实现
- Redis/锁/脚本失败必须被业务层捕获，返回统一 Result 结构
- WebSocket 按编队广播，禁止无差别广播
- 编队成员上限 16，接入前 Redis 侧容量校验 fail-fast
- 后端字段名、数据库表名、API 路径沿用既有命名，不为世界观强行改底层协议

### 前端

- WXML/WXSS 2 空格缩进
- 核心页面根节点绑定 `reduce-motion`；JS 动画/Canvas/timer/rAF 执行前判断 `app.globalData.animationEnabled`
- `reduce-motion` 下停止所有持续动画/循环旋转/扫描，可切换静态状态和文字
- 所有 timer/interval/rAF 必须在 `onHide`/`onUnload` 清理
- `utils/score-ws.js` 是全局单例；页面只订阅/取消，不随页面销毁断开连接
- 所有 `wx.vibrateShort` 通过 `utils/haptic.js` 封装
- `setData` 只写必要字段，页面滚动时不 setData，触摸绘图节流到一帧一次
- 全站禁止原生彩色 Emoji；图标用纯色线框/CSS icon/SVG/图标字体
- WXSS 禁止 `transition: all;`，改成明确属性
- 异步按钮：文本绝对居中 + 图标/Loading 绝对定位，Loading 状态文字不抖动
- 危险操作：透明底 + 红色细描边，不做大红底按钮

### 性能约束（2C2G 容器预算）

- 禁止高频全空间轮询、无差别广播、热路径阻塞式批量计算、反复序列化运行期大对象 JSON
- Canvas 不可见或 reduce-motion 时停止扫描/脉冲动画
- 分享海报 Canvas 一次性绘制
- 长等待 heartbeat 文案至少 3 秒轮换
- 普通卡片避免 blur 和阴影

### 安全

- JWT secret 至少 256 位
- 禁止在 console/日志/错误提示中打印 JWT、微信 code、OSS 签名 URL、连接串、完整 WebSocket URL
- 用户可见内容必须避开审核高风险词；策略和镜像内容必须避开结果预测/承诺和高风险金融/游戏表达
- Redis/脚本/锁失败由业务层捕获，返回统一 Result，不暴露堆栈/类名/连接串

### 文档维护

代码或功能更新后，结束前必须同步更新文档：

- 始终更新：`plan.md`、`changelog.md`、`docs/DEVELOPMENT_LOG.md`
- 按需更新：`docs/ARCHITECTURE.md`、`docs/API.md`、`docs/DATABASE.md`、`docs/PRODUCT_LANGUAGE.md`、`docs/UI_GUIDELINES.md`、`docs/CONTENT_SAFETY.md`、`docs/TECH_DEBT.md`
- 所有 `.md` 文档使用中文书写；代码标识符、路径、命令、表名、字段名、配置键保留原文

### 产品术语

用户可见主术语以「编队 / 指令 / 镜像 / 身份」为底部入口。「信标」= 编队邀请/二维码/分享入口/扫码加入。「编队码」仅指 6 位短码，不替代「信标」。除非 API 字段或数据库命名需要保留旧词，否则产品语言维持舰载终端世界观。运行时文案遵守 `docs/PRODUCT_LANGUAGE.md` 和 `docs/CONTENT_SAFETY.md`。

## 端口

| 服务 | 端口 |
|---|---:|
| 后端 API | 18080 |
| MySQL | 13306 |
| Redis | 16379 |
| Sentinel | 18858 |

## 环境变量

复制 `.env.example` 为 `.env` 并填入真实值。所需变量：数据库连接、Redis 地址、JWT Secret、阿里云 OSS、LLM API、微信 AppID/Secret、TTS 配置。
