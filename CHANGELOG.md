# CHANGELOG.md — 变更记录

## Step 1: 系统设计与数据库建模

**新增文件（DDL）：**
- 设计了 6 张 MySQL 表：user, room, room_member, session, score, score_image
- 所有表 id 使用雪花算法（BIGINT），非自增
- session 表纯元数据，不存储得分聚合数据
- score 表通过 session_id 关联场次，冗余 room_id 便于查询
- score_image 通过 session_id 关联，每轮最多 9 张图

**Redis Key 设计：**
- `mj:room_no:{room_no}` — 房间号唯一映射
- `mj:room:{rid}:info/members` — 房间实时状态
- `mj:session:{sid}:scores` — Sorted Set 实时排行榜
- `mj:session:{sid}:batch:{ts}` — Hash 批次得分
- `mj:session:{sid}:batches` — List 批次时间戳列表
- `mj:session:{sid}:lock` — Redisson 分布式锁

---

## Step 2: 全局 Swagger 接口设计

**新增文件（43 个 Java 文件）：**

- `pom.xml` — Spring Boot 3.2.5, MyBatis-Plus 3.5.6, Springdoc 2.5.0, Redisson 3.27.2, MinIO 8.5.9
- `application.yml` — 数据库/Redis/MinIO/Swagger 配置
- `MahjongScoreApplication.java` — 启动类

**通用模块：**
- `common/Result.java` — 统一响应 Result<T>
- `common/PageResult.java` — 分页响应
- `common/BizException.java` — 业务异常
- `common/GlobalExceptionHandler.java` — 全局异常处理

**配置模块：**
- `config/MinioConfig.java` — MinIO 客户端 Bean
- `config/MybatisPlusConfig.java` — 分页插件 + 自动填充
- `config/WebMvcConfig.java` — JWT 拦截器
- `config/interceptor/JwtInterceptor.java` — JWT 鉴权

**工具模块：**
- `util/SnowflakeIdGenerator.java` — 雪花 ID 生成
- `util/JwtUtil.java` — JWT 签发/解析

**实体（6 个）：**
- `entity/User.java`, `entity/Room.java`, `entity/RoomMember.java`
- `entity/Session.java`, `entity/Score.java`, `entity/ScoreImage.java`

**Mapper（6 个）：**
- `mapper/UserMapper.java` ~ `mapper/ScoreImageMapper.java`

**Service 接口（5 个）：**
- `service/UserService.java`, `service/RoomService.java`, `service/SessionService.java`
- `service/ScoreService.java`, `service/StorageService.java`

**Controller（5 个，19 个 API 端点）：**
- `controller/UserController.java` — POST /login, GET /me, PUT /me
- `controller/RoomController.java` — POST /, POST /join, GET /{id}, GET /my, DELETE /{id}/quit, DELETE /{id}
- `controller/SessionController.java` — POST /, GET /room/{id}, GET /{id}, POST /{id}/settle
- `controller/ScoreController.java` — POST /, GET /session/{id}, GET /session/{id}/recent, GET /session/{id}/ranking
- `controller/StorageController.java` — GET /presign, POST /presign/batch

**DTO（13 个）：**
- user/: LoginReq, LoginResp, UserInfoResp
- room/: CreateRoomReq, JoinRoomReq, RoomResp
- session/: CreateSessionReq, SessionResp
- score/: SubmitScoreReq, ScoreBatchResp, SessionScoreResp
- storage/: PresignUrlResp, BatchPresignReq

---

## Step 3: 后端核心 Service 层实现

**新增文件（9 个 Java 文件）：**

**Service 实现（5 个）：**
- `service/impl/UserServiceImpl.java` — 微信 code2session 登录 + JWT 签发 + 用户 CRUD
- `service/impl/RoomServiceImpl.java` — 建房（Redis 唯一房间号 + 微信小程序码生成 + MinIO 上传）、加入/退出/解散房间
- `service/impl/SessionServiceImpl.java` — 创建场次（Redis INCR 序号）、查询列表/详情、结算触发异步落库
- `service/impl/ScoreServiceImpl.java` — Redisson 分布式锁 + Redis 记分（ZINCRBY 排行榜 + Hash 批次） + WebSocket 推送
- `service/impl/StorageServiceImpl.java` — MinIO 预签名 PUT URL 签发（单个/批量）

**异步任务（1 个）：**
- `service/impl/async/ScoreSettleTask.java` — @Async 异步落库：Redis 批量读取 → MySQL 批量 INSERT（score + score_image） → 清理 Redis key

**WebSocket（1 个）：**
- `service/impl/ws/ScoreWebSocket.java` — 房间级 WebSocket 推送，记分后实时同步给同房间所有玩家

**配置（1 个）：**
- `config/WebSocketConfig.java` — WebSocket 端点注册 `/ws/score`

**Mapper 增强（1 个）：**
- `mapper/SessionMapper.java` — 新增 `selectScoreBySessionId` 方法 + `getPlayerTotalsBySessionId` 聚合方法

**核心业务流程：**
1. 记分提交 → Redisson tryLock(5s, 30s) → Redis Hash 写批次 + ZINCRBY 排行榜 → WebSocket 推送
2. 场次结算 → 标记 status=1 → @Async 从 Redis 全量读取 → 批量 INSERT MySQL → 清理 Redis
3. 查询：进行中走 Redis（O(logN)），已结算走 MySQL GROUP BY（覆盖索引）
4. 房间号生成：Redis SETNX 32 字符集 6 位，碰撞重试最多 10 次
5. 小程序码：微信 getUnlimited API → 字节流 → MinIO PUT → 返回 URL

---

## Step 4: 前端交互实现

**新增文件（17 个前端文件 + 2 个基础设施文件）：**

**小程序全局配置：**
- `miniprogram/app.json` — 页面路由、TabBar（房间/图库）、暗黑主题
- `miniprogram/app.js` — 全局登录态管理
- `miniprogram/app.wxss` — 毛玻璃主题系统（CSS 变量 + 通用工具类）
- `miniprogram/sitemap.json` — 小程序索引配置

**工具模块（3 个）：**
- `utils/request.js` — wx.request 封装，自动 JWT、401 跳转、统一错误处理
- `utils/score-ws.js` — WebSocket 单例管理，自动重连，房间级记分推送
- `utils/image.js` — 图片压缩 + 预签名直传 MinIO（单个/批量）

**页面（4 个，各含 wxml/wxss/js/json）：**
- `pages/login/login` — 微信一键授权登录，渐变背景 + 毛玻璃卡片
- `pages/room/room` — 房间主页：创建房间、扫码/输号入房、成员列表、场次列表、小程序码展示、解散/退出
- `pages/session/session` — 核心记分页：实时排行榜（动画）、记分表单、图片上传（最多9张）、WebSocket 实时同步、最近流水
- `pages/gallery/gallery` — 我的图库：按时间线展示所有记分凭证图片，支持全屏预览

**基础设施：**
- `docker-compose.yml` — MySQL 8.0 (13306) + Redis 7 (16379) + MinIO (19000/19001)
- `backend/src/main/resources/sql/init.sql` — 6 张表的 DDL 初始化脚本

**端口规划（避开常用端口）：**
- 后端: 18080
- MySQL: 13306
- Redis: 16379
- MinIO API: 19000 / Console: 19001

**核心闭环流程：**
1. 扫码: wx.scanCode → 解析 scene → POST /room/join → 进入房间
2. 图片直传: chooseImage → compressImage → GET /storage/presign → wx.uploadFile PUT 到 MinIO → 拿到 accessUrl
3. 记分: 收集表单分数 + 图片 URL → POST /score → Redisson 锁 → Redis 写入 → WebSocket 推送 → 所有人实时刷新

---

## Phase 1: 功能完善与工程化

**项目配置补全：**
- `miniprogram/project.config.json` — 微信开发者工具项目配置
- `miniprogram/project.private.config.json` — 私有配置
- `miniprogram/config.js` — 环境切换（dev/prod）
- `miniprogram/images/` — TabBar 图标（4 个 PNG）+ 默认头像
- `.gitignore` — Git 忽略规则

**后端健壮性：**
- `MinioConfig.java` — 启动时自动创建 MinIO bucket + 设置公开读策略
- `login.js` — 已登录态自动跳转
- `app.js` — 使用 config.js 管理环境 URL

---

## Phase 3: 功能增强

**战绩分享海报：**
- `utils/poster.js` — Canvas 生成暗黑风格排行榜海报（支持离屏 Canvas）
- `pages/session/session.wxml` — 增加「分享海报」按钮 + 海报预览弹窗 + 隐藏 Canvas
- `pages/session/session.wxss` — 海报弹窗样式（全屏遮罩 + 居中预览）
- `pages/session/session.js` — 结算后自动生成海报、保存到相册

**WebSocket 连接管理优化：**
- `pages/room/room.js` — 进入房间自动连接 WebSocket，退出/解散断开
- `pages/room/room.js` — 收到 SCORE_UPDATE 时自动刷新场次列表
- `pages/room/room.js` — 增加 `onShareAppMessage` 支持微信分享房间

**图库页面优化：**
- `pages/gallery/gallery.wxml` — 增加加载动画 spinner + 空状态图标
- `pages/gallery/gallery.wxss` — loading spinner 动画 + 空状态布局
- `pages/gallery/gallery.js` — 增加 loading 状态、单个场次加载失败不影响整体、错误提示
