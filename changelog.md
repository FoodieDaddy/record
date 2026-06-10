# 变更日志

## 未发布

### 修复

- 解散编队时成员记录未更新 `quit_time` 和 `final_score`，导致历史编队成员数据不完整。

### 变更

- Redis key 结构整合：每个编队从 13 个 key 收敛到 6 个，用户信息/镜像画像/五维扫描合并为单 Hash，总 key 模式从 22 种减少到 13 种。
- 编队页 active 态 v6 重构：大型 HUD 舷窗(640rpx+) + 实体控制台 + 任务终端区，消除下半屏空黑。
- HUD 舷窗从 420rpx 扩展到 640rpx-740rpx，成员观测区从 248rpx 扩展到 320rpx。
- 本舰脉冲仪表改为绝对定位嵌入 HUD 下半区，不再被轨迹条遮挡。
- 空态新增远距离信标扫描视觉：三层脉冲扫描环 + 3 个占位航船点 + "等待编队接入"。
- 控制台从 AR 悬浮面板改为 cockpit-console 实体按键：console-key__slot 凹槽 + __face 按键面 + LED 状态点，按下 feedback translateY。
- 按钮从 2 个(信标/航迹)扩展为 4 个(信标/航迹/封存航程/更多)，两排布局。
- 新增"更多"面板：复制编队码 + 解散/撤离，危险操作从信标面板移入此地。
- 新增 task-terminal 任务终端区：协议/阶段/席位/链路四读数 + 迷你点阵 + 最近 3 条脉冲轨迹。
- 信标面板重构为 beacon-panel AR 浮空终端：只保留 QR/编队码/复制/关闭，移除保存信标/发送信标/危险区。
- 顶部状态条压缩为 cockpit-status-strip：绿点 + 文字，半透明深色底，不占 HUD 空间。
- 底部 Dock 蓝线和能量轨透明度降低，选中态标签从 #0A84FF 改为 rgba(0,200,255,0.72)。
- room-view-model 新增 protocolLabel（脉冲流向/航段写入），terminalLogEntries 扩展到 3 条。
- room.js 新增 toggleMorePanel/closeMorePanel/copyRoomNoFromMore，showMorePanel 在 onHide 清理。

- 产品命名统一为「太空记分器 / Space Scorekeeper」，强调多人编队记分与航迹复盘；Smart Record 收敛为工程代号，脉冲终端不再作为用户可见品牌名。
- 世界观名从「脉冲方舟」调整为「太空方舟」。
- 产品副标题定为「多人编队记分与航迹复盘 / Crew scoring and flight-log review」。
- 登录页英文标识从 PULSE TERMINAL 改为 SPACE SCOREKEEPER。
- Canvas 海报标识从 SMART RECORD · NAV BAY 改为 SPACE SCOREKEEPER · NAV BAY，从 SMART RECORD · HOLO BAY 改为 SPACE SCOREKEEPER · HOLO BAY。
- 小程序导航栏标题从「脉冲终端」改为「太空记分器」。
- 产品定位补充：必须让用户一眼知道这是记分器，其次再通过太空编队、驾驶舱、航迹档案形成差异化。

### 变更

- 驾驶舱控制台二次重构：console-bridge 桥接舷窗 + console-panel 透视面板 + console-danger-strip 封存安全锁条，控制台高度压缩，删除重复 readout-chip 行改为单行紧凑读数。
- 按钮从 cockpit-switch 平面斜切升级为 flight-key 三层实体按键：flight-key-slot（凹槽）+ flight-key-body（切角按键面 + 上高光线）+ flight-key-side（底部厚度暗边），按下时 body translateY(2rpx) + side 高度收缩 + LED 亮度降低。
- 按钮行从等宽 1fr 1fr 改为主操作 1.15fr + 辅助 0.85fr 不等宽布局，更接近主键 + 辅助键座舱感。
- 封存航程从大红主按钮改为安全锁条 console-danger-strip：暗红描边 + 锁点 + 副标题 + 确认按钮，高度 72rpx，不再和主操作抢视觉。
- HUD 舷窗新增座舱包围：cockpit-frame-left/right（左右舱体暗色边框）+ cockpit-canopy-arc（顶部弧形玻璃边缘），舷窗更像玻璃而非普通面板。
- cockpit-dashboard-lip 唇缘加粗加阴影，视觉上连接舷窗底部与 console-bridge。
- 脉冲轨迹区高度压缩至 96rpx，TERMINAL FEED 透明度降至 0.18。
- 封存航程不再被底部 TabBar 遮挡：room-page--active padding-bottom 改为 calc(320rpx + env(safe-area-inset-bottom))。
- 控制台使用 perspective + rotateX(5deg) 模拟低头透视，reduce-motion 下取消。
- 无 transition: all，无新增 setInterval / requestAnimationFrame。
- 识别徽标存储从阿里云 OSS 迁移到可切换的存储抽象层：开发测试阶段使用腾讯云开发 CloudBase 存储，后期可切换腾讯 COS，不再依赖阿里云 OSS。
- 新增 `avatar-storage.js` 前端工具，对外只暴露 `uploadAvatar(tempFilePath)` 和 `resolveAvatarSrc(avatarUrl)` 两个方法，页面不直接写 `wx.cloud.uploadFile`、OSS presign 或 COS 逻辑。
- 识别徽标选择改用 `wx.chooseMedia`（`mediaType=['image']`, `sizeType=['compressed']`），替代原来的 `open-type="chooseAvatar"`。
- 后端新增 `StorageProviderConfig` 和 `storage.provider` 配置（aliyun / cloudbase / cos），`PresignUrlResp` 增加 `provider` 字段。
- `helmet-avatar` 组件和 `room.js` 编队成员头像支持 `cloud://` fileID 异步解析渲染。
- 默认 TTS 语音从晓晓改为云扬（专业男声），更符合宇航员角色。

### 修复

- 创建房间后的 WebSocket `PRESENCE_UPDATE` 改为先复制到可变 Map 再补信封字段，避免 `Map.of(...)` 触发 `UnsupportedOperationException`。
- 首页待机态协议选择与创建/加入按钮下移到独立操作区，避免压住 HUD 读数。
- 首页改用自定义导航栏，太空背景延伸到标题栏和刘海/状态栏区域。
- 自定义底部 Dock 下方原生 tabBar 文案清空，避免真机出现两层「编队/指令/镜像/身份」。
- 头像 URL 清洗新增后端早期自动生成 OSS SVG 默认头像过滤，缺失的 `images/avatar-*.svg` 会回退到首字徽标，避免渲染层 404。
- 登录页接入语义收敛：主按钮改为「接入终端」，接入步骤改为识别档案、协议参数、编队链路和导航核心。
- 编队页待机态改为更清晰的舷窗/HUD 待机结构，模式选择改为协议槽位表达，创建/加入按钮上移并避开底部 Dock。
- 编队页 WebSocket 重连遮罩改为页面可见态绑定，切换 Tab 时立即清理视觉遮罩和页面级 loading。
- 指令页重新计算弹窗打开时锁定背景滚动，正文和安全边界可读性提升。
- 全息舱底部安全区加大，固定操作栏抬高并改为实底，协议一致率在 0 样本时显示「待计算」。
- 全息舱协议校准作为全屏任务处理：进入时隐藏自定义 Dock，退出/完成/切页恢复；答题按钮固定在安全区上方，旧题文字不再叠卡显示。
- 识别舱底部安全区加大，「断开终端」保持流式布局并增加底部 spacer。
- 通讯音色抽屉覆盖底部 Dock，增加拖拽柄和关闭按钮，列表底部补足安全区。
- 识别徽标点击后直接调用微信头像授权，不再先展示自定义来源面板，避免重复选择流程。

### 基础设施

- 新增 CloudBase / AnyService 接入能力：小程序前端支持 local / anyservice / prod 三种环境模式切换，HTTP API 可通过 `wx.cloud.callContainer` 经 CloudBase AnyService 转发到后端。
- 新增 `config/env.js` 统一环境配置，`config.js` 集成并保持向后兼容。
- `request.js` 改造支持三种模式，页面调用方式不变。
- `score-ws.js` 改用 `config.getWsUrl()` 统一 WebSocket URL 来源。
- 新增 `storage-client.js` 上传封装，默认走后端预签名 URL 直传对象存储，可选 CloudBase 云存储开发模式。
- 新增 `application-prod.yml` 后端生产配置，敏感信息通过环境变量注入。
- 本地开发模式不受影响，无需 CloudBase 依赖。
- Docker Compose 数据库从 MySQL 5.7 升级到 8.0。
- 新增 Spring Boot Actuator 健康检查端点（`/actuator/health`），Dockerfile 新增 `HEALTHCHECK` 指令。
- 生产环境启用优雅关闭（30s 超时），滚动更新时在途请求不会被强断。
- 生产环境 HikariCP 连接池参数配置（最大 20 连接、最小 5 空闲、30s 闲置超时）。
- 生产环境 Redis Lettuce 连接池参数配置（最大 16 活跃、最大 8 空闲）。
- 生产环境禁用 Swagger UI 和 API Docs。
- 生产环境关闭 MyBatis SQL 日志输出。
- 接入 Spring Cloud Alibaba Sentinel 熔断限流，微信登录接口已配置 `@SentinelResource` 熔断降级。
- Docker Compose 生产配置 MySQL 和 Redis 新增健康检查，`depends_on` 改为 `condition: service_healthy`。
- Docker Compose 生产配置 `SPRING_PROFILES_ACTIVE` 修正为 `prod`。
- Sentinel Dashboard 管理控制台接入（`bladex/sentinel-dashboard:1.8.8`，端口 18858）。
- Sentinel URL 全局限流（200 QPS 预热模式）+ 微信登录 50 QPS + OSS 预签名 100 QPS + TTS 合成 30 QPS。
- OSS 预签名和 TTS 合成接口新增 `@SentinelResource` 熔断降级。
- 新增 `logback-spring.xml` 结构化 JSON 日志（`logstash-logback-encoder`），生产环境按天轮转、单文件 100MB、保留 30 天、总量 2GB，ERROR 日志独立文件。
- 新增 Prometheus Metrics 端点（`/actuator/prometheus`），带 `application` 标签。
- WebSocket 心跳机制：服务端每 25 秒发送 Ping，60 秒无响应自动关闭僵尸连接。
- MySQL 慢查询日志开启（阈值 1 秒）。
- Redis 开启 AOF 持久化（`appendonly yes`，`appendfsync everysec`）。
- 新增 OpenTelemetry 链路追踪（`micrometer-tracing-bridge-otel` + OTLP 导出），通过 `OTEL_EXPORTER_OTLP_ENDPOINT` 环境变量配置后端地址。
- 新增 CORS 跨域配置，允许未来 H5/管理端跨域访问 API。
- 生产环境开启 Response Gzip 压缩（JSON/XML/HTML/JS/CSS，阈值 1KB）。
- Jackson 序列化优化：日期统一 `yyyy-MM-dd HH:mm:ss` 格式、忽略未知属性、空 Bean 不抛异常。
- 新增集成测试（Actuator 健康检查、未登录 401、Swagger 可访问、微信登录无效 code 校验）。
- 新增 GitHub Actions CI/CD：单元测试 → 集成测试（MySQL + Redis Service）→ Docker 构建验证。
- Dockerfile 安全加固：创建非 root 用户 `appuser` 运行应用，日志目录预创建并赋权。

### 可靠性

- 核心写接口幂等性保护：转分、封存、本局录提交/确认接口支持 `clientRequestId` 去重，重复请求返回首次结果。
- 异步任务持久化：二维码生成改为数据库持久化任务，服务重启后自动恢复执行，指数退避重试。
- 引入 Flyway 数据库迁移工具，schema 变更通过版本化脚本管理。
- Snowflake ID 生成器支持通过环境变量显式配置 dataCenterId/workerId，prod 环境未配置时启动失败。
- 生产环境配置 fail-fast：缺少 JWT、微信、OSS、Snowflake 等关键配置时直接启动失败，不泄露敏感值。
- WebSocket 消息统一信封：每条推送携带 messageId 和 serverTime，支持前端去重和补偿。
- WebSocket 重连后自动恢复房间状态：成员列表、分数、待处理轮次主动同步。
- 新增 10 个后端单元测试：Snowflake ID 生成器（5）、房间服务（2）、记分服务（3）。

### 安全

- WebSocket 连接新增 roomId 成员校验，非房间成员无法订阅实时广播。
- 房间读端点（详情、排行榜、折线图、关系网络、洞察、最近记录、总览、流水）全部要求成员身份。
- `/storage/presign` 端点不再允许匿名访问，需要登录才能获取上传凭证。
- WebSocket CORS 从 `*` 收紧为具体域名白名单。
- 后端新增 `RequestIdFilter`，每个请求携带唯一追踪 ID。
- 后端新增 `RoomAccessGuard` 组件，统一编队访问校验。
- `application-local.yml` 中硬编码密钥全部改为环境变量注入。
- `.gitignore` 新增 `application-local.yml`，防止密钥再次提交。
- 新建 `.env.example` 提供环境变量模板。
- `deploy.sh` 中服务器地址和密钥路径改为环境变量。

### 变更

- 驾驶舱 active 态 HUD 下方「信标 / 航迹」按钮从实体 3D 按键重构为 AR 悬浮操作面板：半透明全息面板、青蓝切角描边、纯 CSS 图标、能量线和状态点，更像悬浮在舷窗下沿的舰载 AR 操作面板。
- 脉冲流向数字输入面板重构为悬浮 AR 脉冲写入面板：深黑蓝半透明背景、青蓝细描边、扫描线和四角 HUD 装饰；宽度响应式适配、底部间距优化避免被 Dock 遮挡；移除推荐数值区域。

### 优化

- `room.wxss` 按现有视觉区域拆分为 `pages/room/styles/*.wxss`，主文件仅保留同序 `@import`，降低单文件维护成本。
- 新增 `room-view-model.js`，抽出驾驶舱视图态、席位列表、presence 标签、脉冲格式化和航船坐标等纯展示逻辑。
- `room.js` 的 `buildMemberGrid` + `rebuildPulseStats` 合并为一次 setData 写入，减少渲染压力。
- 新增 `room-patch-scheduler` 批处理调度器，支持高频 setData 合并。
- `request.js` 新增 GET 请求去重和 X-Request-Id 追踪头。
- 新建 `services/room-service.js`、`services/score-service.js` 和 `services/round-service.js`，封装全部房间、记分和轮次 API。
- `room.js` 全量迁移到 services 层，移除直接 `get`/`post`/`del` 调用。
- 子包拆分：主包保留 5 页（登录/驾驶舱/指令/镜像/身份），子包 `pages-ext` 包含 5 页（设置/语音/航程档案/航迹回放/识别档案）。
- 新建 `styles/motion.wxss` 动效协议 token，`app.wxss` 全局引入。
- 粒子飞行动画从 16ms setData 逐帧循环改为 CSS `@keyframes` 驱动，setData 从每帧 20+ 次降到 2 次。
- `flashTargetSeat` impact 反馈改用 CSS `motion-score-impact` class，ship-craft 有独立 impact 动画。
- `score-ws.js` 新增 25s 心跳检测，40s 无消息自动重连。
- 驾驶舱前后台切换恢复策略：<30s 静默、30s-5min 刷新数据、>5min 强制重连。

### 新增

- 创建编队后的 active 态背景改为全局星空背景，编队码、成员数、外部航船、本舰脉冲、实时脉冲、轨迹和航程控制继续作为 WXML 动态覆盖层实时更新。
- 驾驶舱 active 首屏曾改为静态 `cockpit-active.webp` 底图 + WXML 动态覆盖层；当前页面已切换为全局星空背景，不再引用该底图。
- 驾驶舱 active 首屏 v2：`cockpit-shell-v2` 一屏结构，舷窗 430rpx + 驾驶台 370rpx，编队码/成员数/模式/阶段/链路统一进入内嵌终端屏，航程控制紧贴其下。
- 外部航船目标重绘：`ship-craft` 改为小型航船标记，1-4 人编队使用固定坐标，不再贴近驾驶台或挤在中央。
- 轨迹预览压缩：终端内仅保留 sparkline 点阵与“查看轨迹”入口，空态显示“等待更多脉冲写入”。

- 驾驶舱一体化外壳：舷窗和驾驶台合并为 cockpit-shell 连续空间，八角切角外壳，驾驶台向上偏移 40rpx 与舷窗底部融合，通过唇缘线和中轴线连接。
- 飞船目标标记：外部成员从球形航船包裹改为 ship-target 结构（机身环 + 护罩 + 核心 + 机鼻 + 双翼 + 链路灯），下方 HUD 标签。
- 实时脉冲终端：整合脉冲概览和轨迹入口到驾驶台区域，显示统计徽章、最近 2 条事件、轨迹预览（含 ghost 空状态）和展开入口。
- 舰载系统 Dock 底部导航：纯 CSS 四舱位插槽图标（驾驶舱/导航舱/全息舱/识别舱），选中态通过图标点亮和能量条表达。
- 驾驶舱启动过渡动画：创建/加入编队时显示「编队链路建立中 → 舷窗正在开启 → HUD 接入完成」三阶段过渡。
- 驾驶舱实时脉冲概览卡片：显示流转次数、总额和最近 3 条脉冲轨迹。
- 驾驶舱脉冲轨迹预览：可展开的 score-timeline 图表组件。
- 舷窗角落 HUD 标签：左上编队码、右上成员数、左下模式、右下链路状态。

### 变更

- active 驾驶舱主结构从 `cockpit-image-shell` 改为 `cockpit-starry-shell`，背景层复用全局黑底、深蓝光晕、弱星点和弱网格；动态覆盖层继续使用百分比定位并保留底部安全间距。
- 外部航船 1-3 艘的固定坐标更新为 50/34、34/36 + 68/28、26/38 + 50/26 + 74/36，全部限制在舷窗上半区。
- 驾驶舱上窗下台重构：从三卡叠放改为 cockpit-shell 一体化外壳，上方舷窗（cockpit-window）显示飞船编队，下方驾驶台（cockpit-deck）包含半圆仪表和终端屏幕。
- 飞船剪影改为 CSS-only 结构（三角机鼻 + 双翼条 + 护盾环 + 核心），移除旧 ship-body 球形包裹。
- 驾驶台终端屏幕整合编队信息行（编队码 + 复制 + 成员/模式/阶段芯片）、实时脉冲行、最近流向和脉冲轨迹预览行。
- 半圆仪表弧线改用 gauge-arc--outer / gauge-arc--inner 类名，刻度和数值/标题/链路状态统一为 gauge-* 命名。
- 编队信息区（formation-info-bar）移除，编队码和芯片行移入终端屏幕内。
- 航程控制改名 voyage-control-panel，封存区改名 voyage-seal-zone，底部安全间距增至 360rpx。
- 编队安全区扩展：x 范围 18-82%，y 范围 18-48%，防止飞船标签重叠。
- 底部安全间距从 320rpx 增至 360rpx。
- 驾驶舱控制台二轮优化：半圆仪表改为嵌入式（无独立边框，从舷窗下沿自然延伸）；控制台重叠加深至 -120rpx；连接器从垂直细线改为水平渐变线；实时脉冲终端移除切角改用圆角，背景透明度降低，与仪表视觉融合为一体。
- 迷你轨迹预览：实时脉冲终端内新增轻量脉冲走势点阵（最近 12 个采样点归一化展示），无需展开完整轨迹图即可感知趋势。
- 航船标记文字收紧：呼号 16rpx、脉冲值 18rpx、角落 HUD 读数 20rpx，整体更轻量不抢视觉焦点。
- 舷窗角落 HUD 简化为纯数值读数，不再重复显示标签文字，与下方编队信息区减少信息重复。
- 外部航船呼号长度限制从 8 字符缩短为 5 字符，适配更小的 marker 空间。
- 实时脉冲概览和脉冲轨迹预览合并为控制台内的实时脉冲终端，不再作为独立卡片。
- 驾驶舱底部间距增大至 320rpx，确保飞行控制区不被底部 Dock 遮挡。
- 编队信息区改为两行 HUD 布局：第一行编队码 + 复制按钮，第二行四列读数（成员/模式/阶段/链路）。
- 脉冲记录面板改用终端浮动记录器风格：深半透明底、青蓝描边、切角、弱扫描线，底部定位在 TabBar 上方。
- 脉冲记录面板文案更新：「转积分」改为「记录脉冲」，「确认」改为「确认记录」，清除按钮改为「清空」。
- 封存/解散编队前增加状态校验：已封存或已断开时阻止打开记录面板并提示终端风格文案。
- 记录失败错误信息映射为终端风格文案，不再显示通用「记录失败，请重试」。
- 创建编队和复制编队码改用页面顶部 Toast，不再被视口遮挡。
- 状态栏新增副标题行，编队态显示「N 艘航船在线」，待机态不显示。
- 航程控制区（封存/解散按钮）底部间距增大至 180rpx，距 TabBar 至少 32rpx 视觉间距。
- 危险操作按钮改为透明底 + 红色细描边，不再使用微红色背景。
- 驾驶舱左上角改为身份页一致的状态栏（● 驾驶舱已接入 / ● 驾驶舱待机 / ● 链路接入中）。
- 驾驶舱舷窗 HUD 放大，待机态和编队态共用同一视觉容器；创建/加入编队时显示「链路接入中」过渡态。
- 本舰脉冲圆环从 HUD 中心移至中下区（66%），外部航船 markers 分布在上半区。
- 编队码、成员数、记录模式、航程阶段从 HUD 内移至 HUD 下方集中信息区。
- 驾驶舱移除「航迹档案」入口块。
- 转积分面板高度增至 50vh，数字键盘和确认按钮放大，z-index 高于底部导航。
- 新成员加入编队时，舷窗内航船 marker 有 450ms 接入动画（opacity + scale + 边框点亮）。
- 驾驶舱舷窗外部航船改用真实头像显示，替代几何航船轮廓；标记尺寸加大并建立清晰层级（头像 > 呼号 > 脉冲点 > 状态点）。
- 舷窗外部航船分布改为角落/边缘布局，2 人和 3 人编队不再重叠。
- 创建/加入编队按钮增加能量扫描呼吸动画和按压反馈。
- 外部航船标记从大头像圆环改为 CSS 线框飞船轮廓（三角舰桥 + 矩形机翼）+ 32rpx 小徽标。
- 舷窗增加第二层星点渐变，增强深空氛围。
- 记录脉冲面板增加终端扫描线装饰、数字键盘切角 clip-path、数值显示器角标。
- 脉冲轨迹预览组件（score-timeline）注册到驾驶舱页面。
- 驾驶舱主视觉脉冲 HUD 环居中显示，编队码、成员数、模式、阶段、链路等读数移至边缘。
- 转积分面板精简为仅显示发送方头像和呼号，移除接收方信息；数字键盘和确认按钮并排显示。
- 移除驾驶舱全部英文 kicker（COCKPIT ONLINE、FORWARD VIEW、FORMATION CORE、ACCESS CODE 等）。
- 放大驾驶舱舷窗中的外部航船 marker：少人编队下显示为更醒目的航船轮廓、呼号卡标和脉冲读数。
- 编队页重构为第一人称驾驶舱：首屏呈现前方舷窗、深空外景、外部编队航船和 HUD 仪表。
- 编队成员在驾驶舱中改为外部航船 marker / 编队位表达，不再作为头像大卡片列表成为主视觉。
- 本舰信息改为 HUD 小块展示，突出本舰呼号、本舰脉冲、链路状态和主控身份。
- 编队码、成员数、记录模式、航程阶段和链路状态改为舷窗 HUD 读数。
- 航迹档案在驾驶舱中弱化为轻量入口，详细航迹映射由全息舱承接。
- 底部导航从「空间 / 策略 / 镜像 / 身份」重构为「编队 / 指令 / 镜像 / 身份」。
- 舱位体系：驾驶舱、导航舱、全息舱、识别舱。
- 「黑匣子」统一更名为「航迹档案」，「黑匣子样本」更名为「航迹样本」，「黑匣子回放」更名为「航迹回放」。
- 「五维扫描」统一更名为「全息扫描」。
- 「空间」相关用户可见文案统一改为「编队」（创建编队、加入编队、编队码等）。
- 「航行核心 / 起飞甲板」统一改为「导航核心 / 导航舱」。
- 「点火 / 重新点火」统一改为「计算 / 重新计算」。
- 「策略」底部入口改为「指令」。
- 「舰员代号」改为「本舰呼号」，「头盔识别」改为「识别徽标」。
- 「身份等级」改为「授权等级」，「身份经验」改为「航行经验」。
- 「身份档案」改为「识别档案」。
- 用户称呼体系：当前用户称「本舰」，任务参与者称「编队成员」。
- 身份图标从芯片卡重新设计为四角扫描框 + 中心识别点。
- 识别舱移除「数据矩阵」和「航迹档案摘要」，收敛为本舰识别、授权等级和装备协议。保留轻量「本舰状态」展示航行经验和稳定读数。
- 全息舱新增「航迹档案」模块，承接航迹摘要、航迹回放入口。
- 全局 sanitize 规则同步更新。
- 所有文档同步更新为新体系。
- 指令页（导航舱）文案全面收敛：页面标题改为「导航舱」，按钮改为「开始导航计算 / 重新计算」，结果区改为「今日指令 / 状态读数 / 推进节奏 / 安全边界」，海报标识改为「NAV BAY」。
- 指令页生成中日志和长等待文案统一为导航计算体系，不再出现「主引擎链路保持」等旧表达。
- 指令页 sanitize 映射扩展：覆盖「策略 / 今日策略 / 生成策略 / 策略卡 / 黑匣子 / 重新点火 / 点火航行核心 / 预知 / 神谕 / 占卜」等旧词。
- 指令页弹窗文案收敛为「重新计算 / 确认计算 / 保持当前」，副标题改为「RECALCULATE DIRECTIVE」。

### 修复

- 识别舱页面底部 padding 不足导致「断开终端」按钮被自定义底部导航和 Home Indicator 遮挡。
- 识别舱「本舰状态」区块标题改为「授权状态」，信息架构收敛为：本舰档案 → 授权状态 → 装备协议 → 终端控制。
- 识别舱代码注释从「舰员铭牌/舰员代号」更新为「本舰档案/本舰呼号」。
- 识别舱「断开终端」按钮包裹「终端控制 / TERMINAL CONTROL」区块标题。
- 登录页底部信息区域未考虑 Home Indicator 安全区，退出后底部文案被遮挡。
- 全息舱页面底部操作按钮（重新校准、修改协议、生成镜像图片）不再被自定义底部导航遮挡。
- 全息舱页面标题从「全息观测舱」修正为「全息舱」。
- 全息舱校准流程标题从「镜像舱」修正为「协议校准」。
- 全息舱页面信息架构重排为四层：全息总览、协议行动、协议分析、航迹档案，首屏不再堆满分析卡片。
- 协议分析（系统判读、信号标签、协议偏移、协议演化）默认折叠，减少阅读压力。
- 操作栏（生成镜像图片、重新校准、修改协议）移至底部导航上方，三按钮均完整可见。
- 生成镜像图片入口恢复为固定操作栏主按钮。
- 镜像图片预览新增「关闭预览」按钮。
- 校准退出弹窗文案从「本次信号尚未写入镜像」修正为「本次校准尚未写入协议」。
- Canvas 海报标识从「MIRROR PROJECTION」修正为「HOLO BAY」。
- 扫描中提示从「全息扫描采集中」简化为「全息扫描中」。
- sanitize 规则新增：五维图谱→全息图谱、人格测试→协议校准、行为画像→镜像投影、预测→推演、预知→校准、运势→状态、神谕→指令。
- 全息舱全息扫描图从五角星雷达改为星图式轨道圈，去掉五角星连线和轴线。
- 全息舱顶部新增状态点指示器，展示连接状态。
- 全息舱核心标签（信号标签）移至全息图下方默认可见，不再藏在协议分析折叠内。
- 协议分析折叠入口新增摘要行（一致率和偏移百分比）。
- 协议校准流程层级修复：校准面板 z-index 提升至 1001，高于底部导航 999，提交面板不再被遮挡。
- 协议校准底部操作按钮增加安全区 padding，不被 Home Indicator 遮挡。
- 协议校准提交成功 Toast 改为「校准已完成」，提交失败提示改为「校准失败，请稍后重试」。
- 协议校准流程副标题从「协议同步中」修正为「协议校准」。
- 修改协议流程精简：页面标题改为「修改协议」，移除英文 kicker，维度选择区改为「协议维度」，确认按钮改为「确认接入」，退出弹窗文案改为「退出修改 / 当前协议修改尚未写入」。
- 修改协议底部确认按钮增加安全区 padding，不被底部导航和 Home Indicator 遮挡。
- 全息舱顶部状态文案从「全息舱在线」改为「已接入」，移除页面标题「全息舱」和英文 kicker「HOLO BAY」。
- 全息图下方状态摘要：协议一致率改用 `personaMatch.matchPercentage`（绿色），航迹样本数移除「/ 3」后缀（橙色）。
- 移除「协议状态」卡片（协议编号、来源、状态），信息层级更精简。
- 协议分析折叠入口移除一致率和偏移百分比摘要，仅保留标题和展开/收起按钮。
- 协议分析从独立折叠区改为航迹档案下方的独立卡片，子模块（系统判读、信号标签、协议偏移、协议演化）作为卡片内分区展示。
- 重新校准流程底部操作按钮改为相对定位，不再被导航栏遮挡。
- 修改协议确认按钮从滚动区移至固定底部栏，确保不被导航栏和 Home Indicator 遮挡。
- 全息舱左上角状态文案改为「全息舱已接入」。
- 协议分析卡片不再折叠，内容直接展示；移除卡片内信号标签分区（已在全息图下方显示）。
- 识别舱呼号校准从底部抽屉改为居中悬浮终端面板，输入框改为 text 类型避免触发微信白色昵称建议条，键盘弹出时面板自动上移。

### 移除

- 无。

### 破坏性变更

- 无。API 路径、数据库字段、Redis key、WebSocket 事件名均保持不变。
