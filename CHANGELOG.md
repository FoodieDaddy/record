# CHANGELOG.md — 变更记录

## 字体 4 级固定 + 积分记录格式化 + 3 列左对齐

**修改文件（4 个）：**
- `pages/room/room.js` — `getScoreStyle` 改为 4 级固定字体：输 22rpx / 零 26rpx / 赢 32rpx / 赢最多 38rpx；`buildMemberGrid` 计算 `maxPositive` 传入；颜色仍按分数强度渐变
- `pages/room/room.wxml` — 积分记录金额改用 `fmt.formatScore(item.amount)`；明细弹窗金额同理；积分记录结构改为 `sr-col sr-from` / `sr-col sr-amount` / `sr-col sr-to` + `sr-time` 4 个子元素
- `pages/room/room.wxss` — 积分记录 `.sr-item` 改为 flex 布局，3 列百分比宽度（35% / 22% / 35% / 8%），`justify-content: flex-start` 严格左对齐；移除旧 `.sr-arrow` 样式，新增 `.sr-amount` / `.sr-amount-text`
- `utils/score-ws.js` — `getApp()` 从模块顶层改为 `connect()` 内延迟获取（修复 App 实例未就绪时报错）

**字体 4 级规则：**
| 分数 | 字号 | 说明 |
|------|------|------|
| < 0 | 22rpx | 输 — 最小 |
| = 0 | 26rpx | 默认 — 中等 |
| > 0 且非最大 | 32rpx | 赢 — 较大 |
| = maxPositive | 38rpx | 赢最多 — 最大 |

**积分记录 3 列布局：**
```
[头像 名字  ] [金额 →] [头像 名字  ] [时间]
← 35% ——→   ← 22% →   ← 35% ——→   ← 8% →
```

---

## 大数字防溢出 + 积分格式化

**问题：** 成员网格中大积分数字（如 `-8989136`）撑破 Grid 列宽，导致卡片重叠或被挤出屏幕。

**新增文件（1 个）：**
- `pages/room/room.wxs` — WXS 视图层格式化函数：`formatScore(score)`，绝对值 >= 10000 时转为"万"单位保留一位小数（如 `90919` → `+9.0万`，`-8989136` → `-898.9万`）

**修改文件（3 个）：**
- `pages/room/room.wxml` — 引入 `room.wxs`；成员网格分数显示改用 `fmt.formatScore(item.score)`；积分明细净积分改用 `fmt.formatScore(detailNet)`
- `pages/room/room.wxss` — `.member-grid` 列定义从 `repeat(4, 1fr)` 改为 `repeat(4, minmax(0, 1fr))` 防止内容撑开；`.mg-cell` 增加 `min-width: 0; overflow: hidden`；`.mg-score` 增加 `max-width: 100%; text-overflow: ellipsis`；`.matrix-cell-val` 同样增加溢出保护
- `pages/room/room.js` — 新增 `formatScore(val)` 方法（JS 层格式化，供积分表格 `buildMatrix` 使用）；`buildMatrix` 中矩阵单元格 display 改用 `this.formatScore(val)`

**CSS 防溢出策略：**
1. Grid 列用 `minmax(0, 1fr)` 替代 `1fr`，强制列宽不被内容撑开
2. 单元格容器 `min-width: 0; overflow: hidden` 兜底
3. 分数文本 `max-width: 100%; text-overflow: ellipsis` 截断

**JS 格式化策略：**
- WXS（视图层）+ JS（逻辑层）双重实现，保持一致
- 绝对值 < 10000 原样显示（带 +/- 前缀）
- 绝对值 >= 10000 转为"万"单位，保留一位小数

---

## WebSocket 全局单例重构（修复连接泄漏）

**问题根因：**
1. `offScoreUpdate(this.onWsUpdate)` 传原方法引用，但注册时用了 `.bind(this)`，`filter(fn !== callback)` 永远匹配不上 → 回调堆积
2. `disconnect()` 直接销毁单例连接和所有监听器，频繁进入房间时旧 socketTask 未完全释放 → 撑爆微信 5 个 WebSocket 上限
3. 页面 `onUnload` 直接断开全局连接，其他页面无法复用

**修改文件（3 个）：**
- `utils/score-ws.js` — 完全重写：全局单例直接导出（非懒加载函数）；`Map<string, Set<Function>>` 事件总线替代简单回调数组；`isConnected` + `isConnecting` 双状态锁；`connect()` 开头防御性关闭已有 socketTask；`onClose`/`onError` 触发 3 秒延迟自动重连；`manualClose` 标记阻止手动断开后重连；新增 `switchRoom()` / `clearListeners()` 方法
- `pages/room/room.js` — 移除旧 `connectWS`/`disconnectWS` 对连接的直接控制；改为 `onShow` 时 `scoreWS.on('message', this._onWsMessage)`、`onUnload` 时 `scoreWS.off('message', this._onWsMessage)` 订阅模式；`this._onWsMessage` 在首次 `onShow` 时一次性 `bind` 创建，确保 on/off 用同一引用；`quitRoom`/`dissolveRoom` 通过 `app.disconnectWS()` 断开
- `app.js` — 新增 `connectWS(roomId)` / `disconnectWS()` 方法代理到全局单例；`logout()` 时断开连接并清除所有监听器

**核心设计：**
- 页面只订阅/取消事件，不控制连接生命周期
- 连接由 app 层管理，全局唯一
- 回调引用稳定（`bind` 一次，复用引用），杜绝泄漏

---

## 积分系统重构 + 实时同步 + 积分表格

**修改文件（3 个）：**
- `pages/room/room.wxml` — 顶部卡片显示房间号（替换底分）；移除转账确认卡片（numpad 确认直接提交）；移除转账记录区域；"最近流水"→"积分记录"（头像+名称+方向+积分+时间）；新增 N×N 积分表格（点击查看两人明细）；移除所有 ¥ 符号
- `pages/room/room.js` — `confirmNumpad()` 直接调用 `submitTransfer()`，无中间确认；移除 `loadTransfers()`，新增 `loadScoreRecords()` 加载转账记录作为积分记录；新增 `buildMatrix()` 构建积分矩阵；新增 `onMatrixCell()`/`closeMatrixDetail()` 明细弹窗；WebSocket `onWsUpdate` 新增 `MEMBER_UPDATE` 处理 + `reloadRoomInfo()` 实时刷新房间成员；`submitTransfer` 移除 `fromUserId`（后端从 JWT 获取）
- `pages/room/room.wxss` — 移除转账确认卡片样式；新增积分记录样式（`.sr-item` 头像+名称+箭头+积分）；新增积分表格样式（`.matrix-wrap` N×N 网格）；新增积分明细弹窗样式（`.matrix-detail-overlay`）；键盘区新增留证区域样式；新增 `.auto-avatar-xs`/`.auto-avatar-xxs` 小头像

**核心变化：**
1. 顶部显示房间号（6 位字母数字），替代底分
2. 点击成员 → 键盘输入积分 → 确认直接转账，无中间确认卡片
3. 全局移除 ¥ 金钱符号，统一使用"积分"
4. 积分记录：头像 + 名称 → 积分 → 头像 + 名称 + 时间
5. 积分表格：N×N 矩阵，行=付款方，列=收款方，正数珊瑚橙/负数冰蓝，点击弹出两人明细
6. WebSocket 实时同步：收到任何推送都刷新房间信息（含成员列表）
7. 移除底部转账记录区域

---

## 房间布局重构 + "我的"Tab 页

**修改文件（7 个）：**

- `pages/room/room.wxml` — 顶部卡片精简为底分 + 操作按钮（📋复制/📤分享/📷扫码/🔊音效/🚪退出或🗑️解散）；成员改为 4 列网格（头像+昵称+分数），点击成员直接弹出转账键盘；移除独立转账面板、底部操作栏、排行榜卡片
- `pages/room/room.wxss` — 新增 4 列 grid 布局（`.member-grid`）、成员选中光晕、转账确认卡片；移除旧 action-bar、transfer-panel、room-hero 样式
- `pages/room/room.js` — 数据模型精简：`memberGrid[]` 合并成员+排名分数；转账简化为 `onTapMember` → 键盘 → `submitTransfer`（fromUserId 固定为当前用户）；移除 selectFrom/selectTo/transferStep 多步流程
- `pages/room/room.json` — 无需变更（已空 usingComponents）
- `pages/profile/profile.wxml` — 重构为"我的"Tab 页：用户卡片（头像+昵称+骰子）、设置（语音播报）、历史房间列表、微信授权状态、退出登录
- `pages/profile/profile.js` — 新增 `onShow` 登录检查、`loadHistory` 加载历史房间、`isLoggedIn` 状态
- `pages/profile/profile.wxss` — 新增用户卡片横排布局、历史房间列表、授权状态样式
- `app.json` — tabBar 新增"我的"Tab（`pages/profile/profile`）
- `images/tab-profile.png` / `images/tab-profile-active.png` — 占位 Tab 图标（灰色/白色方块，需替换为正式图标）

**核心变化：**
1. 成员网格 4 列平铺，每人显示头像 + 昵称 + 累计分数，点击即转账
2. 顶部卡片集成所有操作按钮，移除底部操作栏
3. 移除房间号和轮次显示
4. "我的"作为第三个 Tab，包含个人设置和历史记录

---

## P2P 点对点转账面板重构

**设计哲学：** 彻底放弃零和校验，回归线下最真实的"当面付钱"场景。参考 Crypto Wallet 转账界面的高逼格交互。

**修改文件（4 个）：**
- `pages/room/room.wxml` — 3 步转账流程：横向滚动头像选付款方 → 过滤后选收款方 → 大字号金额输入 + 留证 + 提交；移除 `transfer-modal` 组件引用
- `pages/room/room.wxss` — 新增转账面板样式：流程指示点动画、头像选中光晕呼吸（pulseGlow）、96rpx 超大金额显示区、闪烁光标、毛玻璃留证框
- `pages/room/room.js` — 数据模型从 `scoreInputs[]` 改为 `transferFrom/transferTo/transferAmount`；新增 `selectFrom` → `selectTo` → `onTapAmount` → `submitTransfer` 流程；数字键盘仅正整数（C 清零 + ⌫ 退格）；移除零和校验、buildScoreInputs、checkZeroSum
- `pages/room/room.json` — 移除 `transfer-modal` 组件注册

**核心交互：**
1. Step 1：横向滚动展示房间所有玩家头像，点击选中付款方（蓝色光晕呼吸动画）
2. Step 2：自动过滤付款方，展示其余玩家，流程指示点实时更新
3. Step 3：转账摘要（A → B）+ 超大 ¥ 金额显示（点击唤起键盘）+ 留证区 + 确认按钮
4. 提交后自动语音播报、刷新转账记录和排行榜

**视觉细节：**
- 头像选中态：`var(--accent)` 边框 + 24rpx 蓝色光晕 + pulseGlow 呼吸动画
- 流程指示：3 个圆点 + 连接线，完成态变绿色
- 金额区：96rpx 字重 700，¥ 前缀 48rpx 轻薄，闪烁光标
- 键盘弹出：底部 sheet + cubic-bezier 回弹动画

---

## 极简零和记分面板重构

**设计哲学：** 化繁为简——从带边框 Input 的传统表单回归到「平铺展示 + 点击输入 + 零和自动补全」的极速录入方案。

**修改文件（3 个）：**
- `pages/room/room.wxml` — 记分表单重构为极简面板：4 玩家卡片平铺、自定义数字键盘、毛玻璃留证区、零和指示条
- `pages/room/room.wxss` — 新增记分面板样式：正分珊瑚橙 / 负分冰蓝的荧光色系、键盘弹出动画（translateY + cubic-bezier）、自动补全呼吸高亮、留证虚线框
- `pages/room/room.js` — 新增 `onTapScore` / `onNumpadKey` / `confirmNumpad` / `checkZeroSum` 方法；零和自动补全逻辑：3 人输入完毕自动算出第 4 人；提交前强制校验分数之和为 0

**核心交互：**
1. 点击玩家卡片 → 底部弹出自定义数字键盘（非系统键盘，更沉浸）
2. 输入 3 人分数后 → 第 4 人自动填入负数和，卡片边框变为绿色呼吸光
3. 零和指示条：实时显示平衡状态（绿点 + ✓ / 还需输入 N 人）
4. 提交时硬校验 sum === 0，不通过则提示
5. 留证区：毛玻璃虚线框，支持拍照/选图 + 缩略图预览 + 删除

**视觉细节：**
- 赢分（正数）：柔和珊瑚橙 `#ff8a65` + 橙色文字光晕
- 输分（负数）：冰蓝青 `#4dd0e1` + 青色文字光晕
- 零分：中性灰色 `var(--text-tertiary)`
- 活跃玩家卡片：蓝色边框呼吸 + 淡蓝背景
- 自动补全卡片：绿色边框呼吸

---

## STEP 3: 记分情绪播报 — 前端播放管理器与极简 UI

**新增文件（1 个）：**
- `utils/audio-manager.js` — 单例音频管理器：打断并播放最新音频，InnerAudioContext 实例复用/释放，`obeyMuteSwitch = false` 保证静音模式下也播放

**修改文件（4 个）：**
- `pages/room/room.js` — 记分成功后从响应取 `emotionAudioUrl` 播放；WebSocket 收到 `SCORE_UPDATE` 时按 userId 匹配播放当前用户情绪音频；新增 `toggleAudioSwitch` 方法；`onShow` 同步 `audioEnabled` 状态
- `pages/room/room.wxml` — 记分表单卡片标题行右侧增加音效开关 Toggle（毛玻璃圆形按钮）
- `pages/room/room.wxss` — 音效开关样式：开启态蓝色光晕、关闭态灰色、点击缩放动画
- `app.js` — `globalData` 新增 `audioEnabled: true` 全局状态

**核心设计：**
- 防重叠策略：打断并播放最新音频——最新记分的情绪反应最重要，旧音频立即 stop + destroy
- 音效开关状态存 `app.globalData.audioEnabled`，关闭时立即停止当前播放
- WebSocket 推送中每个玩家的 `emotionAudioUrl` 按 `userId` 匹配取用

---

## STEP 1: 记分情绪播报 — 后端情绪池结构与 DTO 改造

**新增文件（4 个）：**
- `common/EmotionType.java` — 情绪枚举：`WIN`（赢分装逼）、`LOSE`（输分悲伤）
- `service/EmotionAudioPool.java` — 音频池接口：按情绪类型随机获取音频 URL
- `service/impl/EmotionAudioPoolImpl.java` — 实现：从 `application.yml` 配置加载音频 URL 列表，内存 `ThreadLocalRandom` 随机抽取
- `dto/score/ScoreSubmitResp.java` — 记分提交响应 DTO，包含 `emotionAudioUrl` 字段

**修改文件（4 个）：**
- `controller/ScoreController.java` — `submitScore` 返回值从 `Result<Void>` → `Result<ScoreSubmitResp>`
- `service/ScoreService.java` — `submitScore` 返回值从 `void` → `ScoreSubmitResp`
- `service/impl/ScoreServiceImpl.java` — 注入 `EmotionAudioPool`；记分后为提交者按正负分抽音频返回；WebSocket 推送 Map 中每个玩家附带 `emotionAudioUrl`
- `application.yml` — 新增 `emotion.audio.win-urls` 和 `emotion.audio.lose-urls` 配置（6 条占位音频 URL）

**设计决策：**
- 音频池用内存 List（yml 静态配置），不走 Redis——静态数据无需分布式存储
- 提交者 scoreChange > 0 → WIN 池随机，< 0 → LOSE 池随机，= 0 → null
- WebSocket `SCORE_UPDATE` 推送扩展：scores 数组每项增加 `emotionAudioUrl`，前端按 userId 匹配

---

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

---

## 清理：删除无用代码

**删除前端文件（6 个）：**
- `miniprogram/pages/session/` — 整个目录（4 个文件），未注册到 app.json，无页面跳转
- `miniprogram/utils/poster.js` — 仅被死页面 session.js 引用

**删除后端文件（1 个）：**
- `service/impl/async/ScoreSettleTask.java` — 无任何调用方

**后端接口清理：**
- `SessionController` 移除 `GET /{sessionId}` 和 `POST /{sessionId}/settle`（仅死页面调用）
- `ScoreController` 移除 `GET /session/{sessionId}/recent` 和 `GET /session/{sessionId}/ranking`（仅死页面调用）
- `SessionService` 接口移除 `getSessionDetail`、`settleSession`
- `ScoreService` 接口移除 `getRecentScores`、`getRanking`（实现保留为 private，房间级接口仍依赖）
- `SessionServiceImpl` 清理 `ScoreSettleTask` 引用

**保留的接口（gallery.js 在用）：**
- `GET /session/room/{roomId}` — 图库加载场次列表
- `GET /score/session/{sessionId}` — 图库加载场次详情
