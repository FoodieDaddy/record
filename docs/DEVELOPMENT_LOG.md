# 开发日志

## 2026-06-13 — 小程序英文副标题全局清理

### 变更原因

- 中文标题下方大量重复英文翻译占用移动端空间，降低了驾驶舱信息的可读性。
- 页面、公共组件和 Canvas 海报的语言规则不一致，需要统一为中文信息层级。

### 变更内容

- 更新 `CLAUDE.md`、`docs/PRODUCT_LANGUAGE.md`、`docs/UI_GUIDELINES.md` 和 `docs/CONTENT_SAFETY.md`，禁止运行时英文副标题、英文翻译和装饰性英文标签。
- 清理登录、编队、指令、镜像、身份、航迹与扩展页面中的英文副标题，并将开关状态、日志空状态和音色分类改为中文。
- 移除 `terminal-popup` 的 `subtitle` 属性，确认弹窗只保留中文标题与正文。
- 清理指令卡和镜像卡 Canvas 中的英文舱位副标题，仅允许独立品牌标识。
- 删除主要失效副标题样式，保留编队码、MBTI 类型、版本号等必要技术信息。

### 验证方式

- 扫描小程序 WXML，确认无静态英文副标题和纯英文按钮。
- 对本次涉及的 JavaScript 文件执行 `node --check`。

---

## 2026-06-12 — 后端集成测试与鉴权状态码一致性修复

### 变更原因

- 后端集成测试（IntegrationSmokeTest）在检测 Swagger 入口和未登录 401 状态码时存在断言失败，暴露了两个设计缺陷：
  1. 拦截器 WebMvcConfig 未排除入口 `/swagger-ui.html` 与监控 `/actuator/**` 路径。
  2. 异常处理器 GlobalExceptionHandler 将所有业务异常（包括未登录 4001、无权 4031）捕获后直接返回了 Result.fail 并默认设置 HTTP Status 200。
- 这导致管理端 Vue3 的 Axios 响应拦截器（检测 status 401/403）无法感知鉴权失效，Token 过期后无法自动触发刷新/登出。

### 变更文件

- `backend/src/main/java/com/smartrecord/config/WebMvcConfig.java` — 拦截器排除路径中追加 `/swagger-ui.html` 和 `/actuator/**`
- `backend/src/main/java/com/smartrecord/common/GlobalExceptionHandler.java` — 拦截方法返回类型升级为 `ResponseEntity<Result<Void>>`，将未登录/过期 (401)、账号异常与越权 (403)、参数格式/绑定/校验失败 (400) 以及数据库/缓存故障 (503) 映射至标准的 HTTP 状态码
- `backend/src/main/resources/application.yml` — management 端点配置中暴露 health 和 info，使集成测试环境正常工作
- `plan.md` / `changelog.md` — 同步任务记录与变更日志

### 验证方式

- 运行 `JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn test -Dgroups=integration -B` 结果为 BUILD SUCCESS，全部集成测试用例通过。
- 编译通过无任何异常。

---

## 2026-06-11 — admin-web 玻璃质感未来家具风视觉升级

### 变更原因

- 当前界面虽然已是浅色，但缺少参考图那种"未来世界高端家具 + 白色飞船内部控制台"的玻璃质感和立体感。
- 需要从"浅色后台"升级为"玻璃质感未来家具风"。

### 变更文件

核心设计系统：
- `admin-web/src/styles/tokens.css` — 新增 `--border-glass`、`--blur-soft`/`--blur-panel`、`--highlight-inner`；主色改为 `#5E8BFF`；面板改为半透明 `rgba(255,255,255,0.62)`；新增 `--bg-panel-solid`
- `admin-web/src/styles/base.css` — 背景径向蓝+青冷光线性渐变
- `admin-web/src/styles/components.css` — 全面玻璃化：所有核心组件加入 `backdrop-filter: blur()`、`::before` 高光伪元素、半透明白色渐变背景

布局组件：
- `admin-web/src/components/layout/NavSidebar.vue` — `rgba(255,255,255,0.58)` + `blur(22px)` 毛玻璃
- `admin-web/src/components/layout/TopStatusBar.vue` — 同上毛玻璃 + 搜索框玻璃输入舱
- `admin-web/src/components/layout/RightMonitor.vue` — 毛玻璃抽屉

通用组件：
- `admin-web/src/components/chart/HudChart.vue` — 24px 圆角 + 毛玻璃 + 高光伪元素
- `admin-web/src/components/feedback/ToastContainer.vue` — 毛玻璃 toast
- `admin-web/src/components/modal/ConfirmDangerModal.vue` — 毛玻璃弹窗
- `admin-web/src/components/data/DataPagination.vue` — 玻璃分页按钮

### 验证方式

- `npm run build` 通过
- TypeScript 无错误
- 所有核心卡片和面板有明显毛玻璃质感
- 导航栏和顶栏像独立悬浮家具模块

## 2026-06-11 — admin-web 白色飞船舰桥控制台视觉升级

### 变更原因

- 当前界面只是普通浅色后台，缺少参考图那种"白色纯净太空飞船控制台"的卡片感、悬浮感和设备模块感。
- 需要从"浅色后台"升级为"白色飞船舰桥控制台"。

### 变更文件

核心设计系统：
- `admin-web/src/styles/tokens.css` — 全面重写：文字颜色加深（#111827）、面板双层阴影+inset 高光、gradient header、表格表头 #F3F6FA
- `admin-web/src/styles/base.css` — 背景改为径向冷光渐变（蓝+青）+ 线性渐变
- `admin-web/src/styles/components.css` — StatCard 92px/gradient/48px 图标/28px 数字、BasePanel 22px 圆角/gradient header、StatusPill 26px 固定高度、readout-row 设备读数行、chart-inner 图表内嵌框
- `admin-web/src/styles/utilities.css` — summary-bar 改为 gradient 背景+双层阴影

布局组件：
- `admin-web/src/components/layout/NavSidebar.vue` — 白色毛玻璃背景、44px 菜单项、14px 圆角、700 标题
- `admin-web/src/components/layout/TopStatusBar.vue` — 16px 毛玻璃、柔和分隔

通用组件：
- `admin-web/src/components/data/StatCard.vue` — 新结构：icon + info（label + value + trend）
- `admin-web/src/components/chart/HudChart.vue` — 22px 圆角、gradient header、双层阴影

业务页面：
- `admin-web/src/views/dashboard/DashboardView.vue` — 运行总览改为 readout-row 设备读数行、系统健康改为独立设备条、实时事件改为行卡片
- `admin-web/src/views/users/UserListView.vue` — summary-card 改为 92px 悬浮设备卡
- `admin-web/src/views/formations/FormationListView.vue` — 同上
- `admin-web/src/views/directives/DirectiveLogsView.vue` — 同上
- `admin-web/src/views/mirrors/MirrorListView.vue` — 同上

### 验证方式

- `npm run build` 通过
- TypeScript 无错误
- 卡片有明显悬浮感和厚度
- 面板有 gradient header 和双层阴影
- 导航栏像白色飞船侧舱

## 2026-06-11 — admin-web 深度精修：Dashboard + 列表页

### 变更原因

- Dashboard 基地态势面板只是装饰 SVG 轨道图，没有实际信息价值。
- 列表页摘要条（summary-bar）太像普通后台数字行，缺少设备模块感。
- 数据少时页面太空，缺少引导说明。

### 变更文件

- `admin-web/src/views/dashboard/DashboardView.vue` — 基地态势改为「运行总览」：左侧 160px 小轨道图 + 右侧 5 行实际数据（活跃编队/今日脉冲/封存/事件/系统状态）；新增 `overviewData` ref
- `admin-web/src/views/users/UserListView.vue` — summary-bar 改为 3 个带图标 summary-card；增加稀疏数据提示
- `admin-web/src/views/formations/FormationListView.vue` — summary-bar 改为 3 个带图标 summary-card
- `admin-web/src/views/directives/DirectiveLogsView.vue` — summary-bar 改为 4 个带图标 summary-card
- `admin-web/src/views/mirrors/MirrorListView.vue` — summary-bar 改为 4 个带图标 summary-card

### 验证方式

- `npm run build` 通过
- TypeScript 无错误
- Dashboard 运行总览面板显示实际数据
- 列表页摘要卡有图标和设备模块感

## 2026-06-11 — admin-web 白色舰桥 UI 精修

### 变更原因

- 初版白色舰桥风格太像普通浅色 SaaS 后台，飞船舱体感不足。
- 存在 i18n key 泄漏（`system.title`）、状态胶囊换行、英文残留等问题。

### 变更文件

- `admin-web/src/styles/tokens.css` — 背景改为 `#E8EEF5` 冷灰蓝，面板阴影加深
- `admin-web/src/styles/base.css` — 增加径向冷光背景
- `admin-web/src/styles/components.css` — 面板圆角 20px、按钮 12px、输入框 12px、状态胶囊 `nowrap`+固定高度、表格层级增强
- `admin-web/src/styles/utilities.css` — 摘要条圆角 18px、筛选按钮 10px
- `admin-web/src/components/data/StatCard.vue` — 增加 `icon` prop 支持 SVG 图标
- `admin-web/src/components/data/DataPagination.vue` — 分页按钮圆角 10px
- `admin-web/src/components/chart/HudChart.vue` — 圆角 20px
- `admin-web/src/components/layout/NavSidebar.vue` — 导航项圆角 14px、Orbital Bridge i18n
- `admin-web/src/components/layout/TopStatusBar.vue` — 搜索框 14px、设置面板 16px、下拉 16px
- `admin-web/src/components/layout/RightMonitor.vue` — 抽屉右侧圆角 24px
- `admin-web/src/components/feedback/ToastContainer.vue` — Toast 圆角 14px
- `admin-web/src/components/modal/ConfirmDangerModal.vue` — 弹窗圆角 24px
- `admin-web/src/views/dashboard/DashboardView.vue` — 6 个指标卡增加 SVG 图标
- `admin-web/src/views/system/HealthView.vue` — 修复 `system.title` → `nav.system`、健康卡圆角 16px
- `admin-web/src/views/traces/TraceCenterView.vue` — Top 10 → 前十
- `admin-web/src/views/admins/AdminListView.vue` — 弹窗圆角 24px
- `admin-web/src/views/login/LoginView.vue` — 按钮圆角 14px

### 验证方式

- `npm run build` 通过
- TypeScript `vue-tsc --noEmit` 无错误
- 系统监控页不再显示 `system.title`
- 中文模式无 Orbital Bridge、Top 10 英文残留
- 状态胶囊不换行

## 2026-06-11 — 编队页 room.js 架构重构与体积优化

### 变更原因

- 编队页核心逻辑文件 `room.js` 体积庞大（100KB，3100+ 行），业务深度耦合，难以维护。
- 需要将 WebSocket 监听、封存结算、键盘脉冲输入、Mode 2 轮次提报等逻辑拆解解耦。

### 变更文件

子处理器开发：
- `miniprogram/pages/room/room-ws-handler.js` — [NEW] 负责 WebSocket 的连接与推送消息事件处理
- `miniprogram/pages/room/room-settle-handler.js` — [NEW] 负责航程结算、二维码获取、海报分享、退出解散等结算行为
- `miniprogram/pages/room/room-transfer-handler.js` — [NEW] 负责数字流向键盘操作、乐观分数刷新与发射数值记录
- `miniprogram/pages/room/room-round-handler.js` — [NEW] 负责 Mode 2（本局录入）提报与确认流程

主逻辑收敛：
- `miniprogram/pages/room/room.js` — [MODIFY] 混入上述 4 个子处理器，并彻底清理已提取的函数，行数收敛至 900 行左右

### 验证方式

- 运行 `node --check` 校验所有相关 JS 文件语法，均无错误顺利通过。
- 检查 `Object.assign` 首层混入的组件引用与方法调用。

### 后续事项

- 在真机与微信开发者工具上进行业务全流程验证。

## 2026-06-11 — admin-web 白色飞船舰桥 UI 重构

### 变更原因

- 管理后台原有「深色基地总控台 / 黑底蓝光」风格过于沉重，不符合「白色纯净太空飞船内部控制台」的产品定位。
- 需要整体改为明亮、轻盈、洁净、未来感的「白色飞船舰桥控制系统」。

### 变更文件

主题系统：
- `admin-web/src/styles/tokens.css` — 完全重写，浅色主题为默认（白色舰桥模式），深色主题保留为维护模式
- `admin-web/src/styles/base.css` — 移除扫描线覆盖层和网格背景，更新动画（fade-in-up 8px 偏移）
- `admin-web/src/styles/components.css` — 所有组件改为大圆角（12-24px）、柔和阴影、轻描边
- `admin-web/src/styles/utilities.css` — 新增页面通用区块样式（page-header/summary-bar/toolbar/filter-group）
- `admin-web/src/stores/theme.ts` — 默认主题从 `dark` 改为 `light`

布局组件：
- `admin-web/src/components/layout/NavSidebar.vue` — 改为悬浮式侧舱控制条，SVG 线性图标，圆角胶囊高亮
- `admin-web/src/components/layout/TopStatusBar.vue` — 轻量化（64px），圆角搜索舱，backdrop-filter 毛玻璃
- `admin-web/src/components/layout/AppLayout.vue` — 页面切换动画改为淡入+上浮
- `admin-web/src/components/layout/BottomStatus.vue` — 适配新主题
- `admin-web/src/components/layout/RightMonitor.vue` — 抽屉样式更新，backdrop-filter

通用组件：
- `admin-web/src/components/chart/HudChart.vue` — 圆角面板，新 header 样式
- `admin-web/src/components/data/StatCard.vue` — hover 上浮+阴影加深
- `admin-web/src/components/data/DataTable.vue` — 适配新主题
- `admin-web/src/components/data/DataPagination.vue` — 适配新主题
- `admin-web/src/components/feedback/EmptyState.vue` — 适配新主题
- `admin-web/src/components/feedback/ToastContainer.vue` — 圆角 toast，新阴影
- `admin-web/src/components/modal/ConfirmDangerModal.vue` — 圆角弹窗，backdrop-filter
- `admin-web/src/utils/chart-theme.ts` — 浅色图表主题（透明背景、极淡轴线、柔和配色）

业务页面：
- `admin-web/src/views/dashboard/DashboardView.vue` — 完全重写，一屏 Grid 布局
- `admin-web/src/views/login/LoginView.vue` — 适配新主题
- `admin-web/src/views/users/UserListView.vue` — 移除 clip-path，适配新主题
- `admin-web/src/views/formations/FormationListView.vue` — 移除 clip-path
- `admin-web/src/views/formations/FormationDetailView.vue` — 移除发光效果，适配新主题
- `admin-web/src/views/traces/TraceCenterView.vue` — 适配新主题
- `admin-web/src/views/directives/DirectiveLogsView.vue` — 移除 clip-path
- `admin-web/src/views/directives/DirectiveDetailView.vue` — i18n 化
- `admin-web/src/views/mirrors/MirrorListView.vue` — 移除 clip-path
- `admin-web/src/views/system/HealthView.vue` — 健康卡圆角+hover 效果
- `admin-web/src/views/system/AlertsView.vue` — i18n 化
- `admin-web/src/views/admins/AdminListView.vue` — 移除 clip-path，圆角弹窗
- `admin-web/src/views/admins/RolesView.vue` — 圆角角色卡
- `admin-web/src/views/audit/AuditLogView.vue` — 适配新主题

文档：
- `docs/UI_GUIDELINES.md` — 重写 admin-web 主题系统章节
- `CHANGELOG.md` — 新增变更记录
- `PLAN.md` — 新增任务记录

### 验证方式

- `npm run build` 通过
- TypeScript `vue-tsc --noEmit` 无错误
- 所有页面在浅色主题下视觉统一（白色舰桥风格）
- 深色主题仍可正常切换使用
- 中英文切换无残留

### 后续事项

- 真机浏览器渲染验收
- 各页面信息密度和间距微调
- 图表在数据量少时的空态优化

### 变更原因

- 当前只有 WebSocket 在线推送，用户离线时完全收不到通知。
- 需要引入微信订阅消息，在用户离线时也能收到关键通知（记分提醒、编队封存等）。

### 变更文件

小程序配置：
- `miniprogram/project.config.json` — 添加 `cloudfunctionRoot: "cloudfunctions/"`
- `miniprogram/app.json` — 添加 `"cloud": true`

云函数：
- `cloudfunctions/sendSubscribeMessage/index.js` — 云函数入口，接收请求后调用 `subscribeMessage.send` API
- `cloudfunctions/sendSubscribeMessage/package.json` — 依赖配置（`wx-server-sdk`）
- `cloudfunctions/sendSubscribeMessage/config.json` — 权限配置（申请 `subscribeMessage.send` 权限）

后端：
- `backend/src/main/java/com/smartrecord/service/SubscribeMessageService.java` — 新建，封装订阅消息发送逻辑（含 access_token 获取和缓存）
- `backend/src/main/java/com/smartrecord/service/impl/ws/ScoreWebSocket.java` — 新增 `getOnlineUserIds()` 方法，用于判断用户是否在线
- `backend/src/main/java/com/smartrecord/service/impl/ScoreServiceImpl.java` — `settleRoom()` 中添加离线用户封存通知订阅消息发送逻辑
- `backend/src/main/java/com/smartrecord/service/impl/RoundRecordServiceImpl.java` — 添加 `sendScoreReminderToOfflineUsers()` 方法，在轮次开始时发送记分提醒订阅消息
- `backend/src/main/resources/application-local.yml` — 添加订阅消息模板 ID 配置

前端：
- `miniprogram/pages/room/room-action-handler.js` — `handleStartSpace()` 和 `handleJoinSpace()` 中添加 `wx.requestSubscribeMessage` 调用（请求订阅权限）

### 验证方式

- 小程序云开发配置正确，`project.config.json` 中 `cloudfunctionRoot` 指向 `cloudfunctions/`
- 云函数可部署到云开发环境
- 后端编译通过（需解决 Lombok 配置问题）
- 前端语法检查通过
- 需在微信公众平台申请订阅消息模板后，替换代码中的占位符模板 ID
- 需真机测试订阅消息接收

## 2026-06-11 — Dashboard 一屏化与浅色模式重做

### 变更原因

- Dashboard 首页高度超出视口，需要下滑才能看到趋势图和实时事件，破坏总控台整体感。
- 浅色模式背景发白、面板雾蒙蒙，像普通办公后台，不符合基地控制台风格。
- 浅色主题被标记为「实验维护模式」默认禁用，需改为正式可用主题。

### 变更文件

样式：
- `tokens.css` — 浅色主题全面重写：背景改为灰蓝（`#C8D3DE` ~ `#D8E1EA`），面板实体化（`rgba(226,235,243,0.96)`），主色更克制（`#2F6FC7`），绿色柔和化（`#3C8B5F`），文字加深（`#172433`），网格线降低 40%；移除「实验」注释。
- `base.css` — 新增浅色模式 body 背景渐变（灰蓝径向 + 线性）；浅色模式网格从 80px 扩大到 120px。
- `components.css` — 无变更。

布局：
- `AppLayout.vue` — `app-layout` 和 `app-main` 改为 `height: 100vh; overflow: hidden`；`app-workspace` 改为 `flex: 1; min-height: 0; overflow-y: auto`；Dashboard 路由使用 `app-workspace--dashboard`（`padding: 16px 20px; overflow: hidden`）。
- `DashboardView.vue` — 完全重写为 Grid 布局：五行固定高度（56px / 40px / 96px / 1fr / 180px），gap 12px；指标卡 6/3/2 响应式；主态势和底部使用嵌套 Grid；移除 `min-height: 400px`；实时事件限制 5 条。
- `HudChart.vue` — `title` 改为可选；chart 容器改为 `height: 100%` 由父容器控制；新增 `hud-chart--with-header` 修饰。

Store：
- `theme.ts` — `lightThemeEnabled` 默认改为 `true`；`setTheme` 不再检查 enabled 标志；移除 `enableLightTheme` 函数。
- `locale.ts` — `settings.light` 从「浅色（实验）」改为「浅色」。

组件：
- `TopStatusBar.vue` — 深色/浅色按钮均可直接点击切换，移除 disabled 和「维护中」逻辑。

### 验证方式

- Dashboard 首页在 1920x1080 浏览器窗口内完整展示，无纵向滚动条。
- 趋势图和实时事件完整露出，不被视口裁切。
- 浅色模式切换后背景为灰蓝色调，面板为实体灰蓝，不发白。
- 左侧导航在浅色模式下保持深蓝，与主内容区视觉连贯。
- 列表页（用户、编队等）仍可正常纵向滚动。
- `npm run build` 通过，TypeScript 无新增错误。

## 2026-06-11 — 头像存储双模式支持

### 变更原因

- 头像存储原本默认 aliyun OSS，需要支持微信云存储（cloudbase）作为默认模式。
- 纯 cloudbase 模式下，OSS bean 初始化会因缺少环境变量而失败，需要条件化 bean 创建。

### 变更文件

后端：
- `StorageProviderConfig.java` — 默认 provider 从 `aliyun` 改为 `cloudbase`
- `OssConfig.java` — `ossClient()` bean 增加 `@ConditionalOnProperty(name = "storage.provider", havingValue = "aliyun")`，仅 aliyun 模式时创建
- `StorageServiceImpl.java` — `OSS` 字段改为 `ObjectProvider<OSS> ossClientProvider` 可选注入；`generatePresignUrl()` 和 `deleteObjectAsync()` 使用 `ossClientProvider.getIfAvailable()` 并增加 null 检查

配置：
- `.env.example` — 增加 `STORAGE_PROVIDER=cloudbase`，OSS 变量归类为 aliyun 模式专用
- `CODEBUDDY.md` — 更新存储模式说明
- `changelog.md` — 记录变更
- `plan.md` — 记录已完成任务

前端：
- `config/env.js` — `storage.provider` 已为 `'cloudbase'`（无需修改）
- `utils/avatar-storage.js` — 已完整支持 cloudbase 直传和 `cloud://` URL 解析（无需修改）

### 验证方式

- 纯 cloudbase 模式：不配置 OSS 环境变量，启动后端，验证 `ossClient` bean 未被创建（日志无 "阿里云 OSS 客户端初始化完成"）
- aliyun 模式：配置 `STORAGE_PROVIDER=aliyun` 和 OSS 环境变量，启动后端，验证 `ossClient` bean 被创建
- 前端上传头像：切换 `storage.provider` 配置，验证上传流程正常

## 2026-06-11 — admin-web 系统级重构

### 变更原因

- 深色主题仍然偏亮、网格/描边/发光过多，需要进一步降噪。
- 浅色主题不应作为主交互入口，需隐藏或标记为实验模式。
- 中文模式下仍有大量英文残留（VESSEL REGISTRY / FLEET REGISTRY / DIRECTIVE LOGS / MIRROR ARCHIVES / STATUS / ROLES / LLM / fallback / VIEWER / SUPER_ADMIN 等）。
- 右侧监控栏常驻占位压缩主内容，应改为抽屉。
- 各页面信息密度不足，缺少摘要卡、筛选、状态分布等管理后台标配功能。

### 变更文件

样式：
- `tokens.css` — 深色主题降噪：绿色改为 `#31A866`，网格透明度 `0.006`，扫描线 `0.008`，边框/描边/发光强度全面降低；新增 `--drawer-*` token；浅色主题保留但不作为默认。
- `base.css` — 扫描线间距从 3px 改为 4px，网格从 80px 保持，pulse-glow 进一步降低；新增 `.text-mono` 工具类。
- `components.css` — 移除 `.status-pill--running .status-pill__dot` 的 pulse-glow 动画；HUD corner 尺寸从 14px 改为 12px；letter-spacing 从 0.5px 改为 0.3px。
- `chart-theme.ts` — 图表颜色进一步柔和化（`0.60` / `0.42` / `0.05`）。

Store：
- `theme.ts` — 新增 `lightThemeEnabled` 标志，默认 `false`；`setTheme('light')` 需先启用。
- `locale.ts` — 新增 120+ key：用户页（`users.*`）、编队页（`formations.*`）、指令页（`directives.*`）、镜像页（`mirrors.*`）、系统页（`system.*`）、管理员页（`admins.*`）、角色名（`role.*`）、抽屉（`drawer.*`）、通用操作（`common.*`）。
- `app.ts` — 无变更（rightPanelOpen 已存在）。

布局组件：
- `AppLayout.vue` — 移除 `<RightMonitor v-if>` 从 `.app-content` 内部，改为独立 `<RightMonitor />`（Teleport to body）。
- `RightMonitor.vue` — 从常驻侧栏完全重写为抽屉模式：Teleport + overlay + slide transition；新增手动刷新按钮和上次同步时间。
- `TopStatusBar.vue` — 角色名映射（`mapRoleName`）；设置面板浅色按钮默认 disabled；新增 `mapServiceName`。
- `NavSidebar.vue` — 移除活动状态 dot 的 pulse-glow 动画。
- `BottomStatus.vue` — 无变更（已是 i18n）。

视图：
- `DashboardView.vue` — 新增 `mapServiceName` 函数映射技术名为中文；健康矩阵服务名走映射。
- `UserListView.vue` — 新增页面头部/摘要卡/状态筛选/批量操作栏/filter-group；columns 使用 i18n key。
- `FormationListView.vue` — 新增页面头部/摘要卡/状态筛选；columns 使用 i18n key；移除 FLEET REGISTRY 硬编码。
- `TraceCenterView.vue` — 表格新增「查看航迹」操作列；columns 使用 i18n key。
- `DirectiveLogsView.vue` — 新增页面头部/摘要卡；`mapSource` 函数映射 LLM/fallback；columns 使用 i18n key；移除 STATUS/DIRECTIVE LOGS 硬编码。
- `MirrorListView.vue` — 新增页面头部/摘要卡；未校准显示灰色；双操作按钮（查看镜像/查看用户）；columns 使用 i18n key；移除 MIRROR ARCHIVES/MBTI 硬编码。
- `HealthView.vue` — 新增页面头部/最后检测时间；`mapServiceName` + `mapServiceDetail` 映射技术名；空面板使用 i18n。
- `AdminListView.vue` — `mapRoleName` 映射角色名；新增禁用确认弹窗；角色权限说明卡独立区块；select 选项显示中文；移除 ADMIN REGISTRY/ROLES/STATUS 硬编码。
- `AuditLogView.vue` — 新增页面头部；高风险操作橙色标记；移除硬编码「暂无数据」。
- `RolesView.vue` — 角色名从 SUPER_ADMIN/OPERATOR/VIEWER 改为 i18n key。

组件：
- `DataTable.vue` — 新增 `useLocaleStore` 导入；loading/empty/copy 按钮全部走 i18n。

### 验证

- `npm run build` 通过。
- 中文模式下页面无英文残留。
- 技术穿帮词（LLM / fallback / VIEWER / SUPER_ADMIN / Edge-TTS / MiMo）不在主界面出现。
- `DashboardView.vue` — 页面标题/副标题/统计卡 label/kicker/trend/图表 legend/axis labels 全部走 i18n；stats 改为 computed 响应 locale 变化。
- `TraceCenterView.vue` — 全面重写：页面头部/统计卡/图表/空状态/表格列名/操作按钮全部走 i18n。
- `FormationListView.vue` — 图表标题 "编队创建趋势" / "MODE" 改为 i18n key。
- `DirectiveLogsView.vue` — 图表 axis labels 改为 i18n key。
- `AdminListView.vue` — toast 消息改为 i18n key。
- `RolesView.vue` — 角色描述改为 i18n key。
- `AuditLogView.vue` — "AUDIT TRAIL" / "ACTIONS" / 描述改为 i18n key。
- `MirrorDetailView.vue` — 全息档案/协议类型/航迹样本等标签改为 i18n key。
- `HealthView.vue` — "HEALTH MATRIX" / "SENTINEL" 改为 i18n key。
- `LoginView.vue` — 品牌文案/placeholder/error message 改为 i18n 或 locale.isZh 三元。

### 验证

- `npm run build` 通过。
- 中文模式下页面不出现任何英文。
- 英文模式下页面不出现任何中文。

---

## 2026-06-11 — admin-web 主题与布局优化（第二轮）

### 变更原因

- 浅色主题背景过亮（`#DCE6F2`），面板/卡片/图表层级区分不够，整体像办公系统。
- 搜索框像普通 input，左侧导航折叠按钮突兀，中部浮动监控箭头不自然。
- Dashboard 基地态势图太小、系统健康无排序、趋势图空数据渲染空坐标轴。
- 航迹中心活跃排行总脉冲为 0 时显示空条形图、编队列表不可点击、表格操作列缺失。

### 变更文件

样式：
- `tokens.css` — 浅色 `--bg-base: #C9D8E8` / `--bg-shell: #D7E3F0` / `--bg-panel: rgba(236,244,251,0.88)`；深色 `--bg-shell: #07101D` / `--bg-panel: rgba(5,13,26,0.78)`；新增 `--panel-shadow` / `--search-bg` / `--search-border`
- `base.css` — body 背景改为 `var(--bg-shell)`
- `components.css` — 面板/卡片增加 `box-shadow: var(--panel-shadow)`、表头 `font-weight: 600`

布局：
- `AppLayout.vue` — 移除中部浮动 `monitor-toggle` 按钮、workspace padding 改为 `24px 28px`
- `NavSidebar.vue` — 折叠按钮颜色从 `--text-muted` 改为 `--text-disabled`（弱化）
- `TopStatusBar.vue` — 搜索框改为 `.search-box` 容器（扫描图标 + 圆角），不再用 `.input-field`

视图：
- `DashboardView.vue` — 新增页面头部、基地运行状态条（服务健康胶囊 `status-pill`）、态势图 SVG 放大到 `max-width:600px`、系统健康按状态排序（`sortedHealth` computed）、趋势图空数据时显示 `EmptyState`
- `TraceCenterView.vue` — 图表区域改为 `38%/34%/28%` 三栏、活跃排行零脉冲时显示用户列表（`trace-user-row`）、编队行可点击跳转、表格增加操作列（查看用户）、总脉冲 0 使用 `--text-disabled` 样式

工具：
- `chart-theme.ts` — 浅色 `axisLine` 从 `0.14` 提升到 `0.18`、`axisLabel` 从 `0.56` 提升到 `0.60`

### 验证

- `npm run build` 通过
- 浅色主题面板有实体感（阴影 + 描边）
- 深色主题层级清晰
- 航迹中心零脉冲不显示空图表
- 搜索框有扫描图标和聚焦态

- 明亮主题使用大面积纯白背景，与深色导航/顶栏割裂，图表/表格几乎看不清。
- 航迹中心页面缺少页面头部说明和摘要指标，低数据量时柱状图孤立显示。
- 所有组件硬编码 `rgba(255,255,255,...)` / `rgba(0,0,0,...)`，无法统一适配主题切换。
- ECharts 图表不跟随主题变化，切换后轴线和文字保持深色残留。

### 变更文件

核心样式：
- `admin-web/src/styles/tokens.css` — 完整重写，`[data-theme="dark"]` / `[data-theme="light"]` 双套 CSS 变量（80+ token）
- `admin-web/src/styles/base.css` — body 背景、网格、扫描线、滚动条改用 CSS 变量
- `admin-web/src/styles/components.css` — 所有组件（面板/卡片/胶囊/按钮/表格/输入框/标签/分页器）改用 token 引用

Store 与工具：
- `admin-web/src/stores/theme.ts` — 从 `classList.add/remove('theme-light')` 改为 `setAttribute('data-theme', t)`
- `admin-web/src/utils/chart-theme.ts` — 从单对象导出改为 `getChartColors(theme)` 函数，返回深色/明亮两套配色

布局组件：
- `admin-web/src/components/layout/NavSidebar.vue` — 所有颜色改用 `--nav-*` token
- `admin-web/src/components/layout/TopStatusBar.vue` — 搜索框改为左侧 380px，设置弹层使用 `--settings-*` token
- `admin-web/src/components/layout/BottomStatus.vue` — 改用 `--bottom-*` token
- `admin-web/src/components/layout/RightMonitor.vue` — 改用 `--monitor-*` token
- `admin-web/src/components/layout/AppLayout.vue` — monitor-toggle 按钮改用 token

数据/反馈组件：
- `admin-web/src/components/chart/HudChart.vue` — 监听 `themeStore.theme` 变化自动 `setOption` 重绘
- `admin-web/src/components/data/DataTable.vue` — 表格颜色改用 `--table-*` token
- `admin-web/src/components/data/StatCard.vue` — 无变更（已通过 CSS 变量）
- `admin-web/src/components/feedback/EmptyState.vue` — SVG 改用 `currentColor` 跟随主题
- `admin-web/src/components/feedback/SkeletonLoader.vue` — 骨架 shimmer 改用 `--border-*` token

视图页面：
- `admin-web/src/views/traces/TraceCenterView.vue` — 完整重构：页面头部 + 4 StatCard + 空状态 + 低数据量提示 + 表格列优化
- `admin-web/src/views/dashboard/DashboardView.vue` — 态势图 SVG 改用 token，趋势图改用 `getChartColors()`
- `admin-web/src/views/formations/FormationListView.vue` — 图表改用 `getChartColors()`
- `admin-web/src/views/directives/DirectiveLogsView.vue` — 图表改用 `getChartColors()`
- `admin-web/src/views/mirrors/MirrorListView.vue` — 图表改用 `getChartColors()`
- `admin-web/src/views/users/UserListView.vue` — 内联边框改用 token
- `admin-web/src/views/users/UserDetailView.vue` — 内联边框改用 token
- `admin-web/src/views/formations/FormationDetailView.vue` — 内联边框改用 token
- `admin-web/src/views/admins/RolesView.vue` — 内联背景改用 token
- `admin-web/src/views/system/HealthView.vue` — 内联背景改用 token
- `admin-web/src/views/login/LoginView.vue` — 右侧面板背景改用 token

### 实现方式

- 主题切换从 class 改为 `data-theme` 属性，CSS 选择器 `[data-theme="light"]` 覆盖全部 token。
- `getChartColors(theme)` 返回完整 ECharts 配色对象（textStyle/axisLine/splitLine/tooltip/seriesColors），各视图在构建 option 时调用。
- `HudChart` 通过 `watch(() => themeStore.theme, ...)` 在主题变化时调用 `chart.setOption(opt, true)` 重绘。
- 主题过渡使用 `transition: background-color 180ms ease, color 180ms ease, border-color 180ms ease`，不用 `transition: all`。

### 验证

- `npm run build` 通过，无 TypeScript 错误。
- 深色主题下航迹中心、基地总览、编队列表、指令日志、镜像档案页面风格一致。
- 明亮主题下无大面积纯白，图表/表格/面板/导航层级清晰。
- 主题切换后刷新页面仍保持选择（localStorage `admin_theme`）。

## 2026-06-09 — room.js 全量迁移到 services 层（rebuild_plan Phase 5 收尾）

### 变更原因

- `room.js` 有 25+ 处直接 `get`/`post`/`del` 调用，未使用 Phase 5 创建的 services 层。
- rebuild_plan 要求全量迁移到 service 层，统一 API 调用入口。

### 变更文件

新建：
- `miniprogram/services/round-service.js` — 封装 5 个轮次 API（startRound/submitRoundScores/confirmRound/cancelRound/getPendingRound）

修改：
- `miniprogram/pages/room/room.js` — 25+ 处直接 API 调用替换为 `roomService`/`scoreService`/`roundService` 方法，移除 `get`/`post`/`del` 直接导入

### 实现方式

- 创建 `round-service.js` 补充轮次 API 封装。
- 逐一替换：`get('/room/my')` → `roomService.getMyRooms()`、`post('/score/transfer', ...)` → `scoreService.transferScore(...)` 等。
- 移除 `const { get, post, del } = require('../../utils/request')` 导入。

### 验证

- `node --check miniprogram/pages/room/room.js` 通过。
- grep 确认无残留直接 API 调用（除 `Map.get()` 等非 API 用途）。

## 2026-06-09 — Phase 6 子包拆分（rebuild_plan Batch C）

### 变更原因

- rebuild_plan Phase 6 要求将非 tabBar 页面拆入子包，减少主包体积。
- 主包原有 10 页，tabBar 4 页 + login 1 页必须留在主包，其余 5 页迁入子包。

### 变更文件

新建目录：
- `miniprogram/pages-ext/` — 子包根目录

迁移：
- `pages/settings/` → `pages-ext/settings/`
- `pages/voice-select/` → `pages-ext/voice-select/`
- `pages/settle/` → `pages-ext/settle/`
- `pages/score-records/` → `pages-ext/score-records/`
- `pages/level-archive/` → `pages-ext/level-archive/`

修改：
- `miniprogram/app.json` — 新增 `subpackages` 配置，主包 pages 收敛为 5 页
- `miniprogram/pages/profile/profile.js` — level-archive 导航路径更新
- `miniprogram/pages/mirror/index.js` — score-records 导航路径更新
- `miniprogram/pages-ext/score-records/score-records.js` — settle 导航路径更新

### 实现方式

- 子包 root 为 `pages-ext`，页面路径为 `settings/settings` 等（相对子包 root）。
- 导航 URL 从 `/pages/settle/settle` 改为 `/pages-ext/settle/settle`。
- 子包页面的 `require('../../utils/...')` 路径无需修改（相对路径仍指向 `miniprogram/utils/`）。
- settle 页面的组件引用使用绝对路径（`/components/battle-summary/battle-summary`），无需修改。

### 验证

- `node --check` 所有修改的 JS 文件通过。
- grep 确认无残留旧路径引用。
- 目录结构验证：主包 5 页、子包 5 页。

### 后续事项

- 微信开发者工具编译验证子包加载。

## 2026-06-10 — 驾驶舱 active 态 AR 悬浮按钮与脉冲写入面板重构

### 变更原因

- HUD 下方「信标 / 航迹」按钮像普通网页卡片，太方、太厚、太实，不像驾驶舱 AR 悬浮操作面板。
- 点击外部航船弹出的脉冲流向数字输入面板存在右侧裁剪、宽度超出安全区域、遮罩过暗、不像悬浮 AR 面板等问题。

### 变更文件

WXML（1 个文件）：

- `miniprogram/pages/room/room.wxml` — 将 `cockpit-button-deck` / `cockpit-3d-key` 实体按键区替换为 `ar-action-row` / `ar-action-pad` AR 悬浮操作面板（纯 CSS 图标、中文主文案、英文弱装饰、能量线、状态点）；脉冲面板 `pulse-vr-cluster` 新增扫描线和四角 HUD 装饰。

WXSS（2 个文件）：

- `miniprogram/pages/room/styles/08-cockpit-active-v2.wxss` — 移除 `.cockpit-button-deck` / `.cockpit-3d-key` 及所有子样式（key-face/key-main/key-sub/key-depth），新增 `.ar-action-row` / `.ar-action-pad` 全息悬浮操作面板样式（半透明底、青蓝切角描边、顶部扫描线、底部能量线、纯 CSS 信标/航迹图标、选中蓝色能量线反馈、reduce-motion 兜底）。
- `miniprogram/pages/room/styles/04-pulse-recorder.wxss` — 背景遮罩从全屏死黑改为局部径向暗化（透明度 0.42），`.pulse-vr-cluster` 改为深黑蓝半透明 AR 面板（`calc(100vw - 96rpx)` 宽 / 最大 620rpx、青蓝细描边、切角、扫描线、四角装饰），底部间距改为 `calc(170rpx + env(safe-area-inset-bottom))`；网格从固定 520rpx 改为 100% 宽，按键间隙缩小至 12rpx；关闭按钮和发射按钮视觉微调；reduce-motion 规则更新。

JS（2 个文件）：

- `miniprogram/pages/room/room.js` — `onTapMember` 移除 `loadTransferAmountSuggestions` 调用、新增 `isInputOpen: true`。
- `miniprogram/pages/room/pulse-handler.js` — `openTransferPad` 移除 `loadTransferAmountSuggestions` 调用。

### 关键变化

| 项目 | 旧 | 新 |
|---|---|---|
| 信标/航迹按钮 | `cockpit-button-deck` + `cockpit-3d-key` 实体按键（凹槽 + 按键面 + 厚度边） | `ar-action-row` + `ar-action-pad` AR 悬浮面板（半透明底、纯 CSS 图标、能量线） |
| 脉冲面板宽度 | 固定 520rpx | `calc(100vw - 96rpx)` / max 620rpx |
| 脉冲面板背景 | `rgba(2,14,26,0.12)` 极弱透明 | `rgba(3,12,24,0.74)` + 青蓝描边 + 切角 |
| 遮罩透明度 | `rgba(0,0,0,0.24)` 全屏均匀 | 径向暗化 0.42 + 面板周围局部渐变 |
| 面板底部间距 | `calc(210rpx + ...)` | `calc(170rpx + ...)` |
| 推荐数值加载 | openTransferPad/onTapMember 调用 API | 已移除调用 |
| 网格间距 | 18rpx | 12rpx |

### 验收状态

- `node --check` 三文件（room.js / room-view-model.js / pulse-handler.js）通过。
- `grep` 禁词扫描：命中均为注释、代码内部字段或 sanitize 映射，运行时用户可见内容未发现禁词。
- `grep` 动效扫描：未发现 `transition: all` / `setInterval` / `requestAnimationFrame` 新增。
- 代码侧已调整，真机待复核。

### 后续事项

- 微信开发者工具编译验证。
- 真机验证：AR 按钮悬浮感、脉冲面板完整显示（1-9/×/0/发射按钮不被裁剪）、遮罩透明度、底部 Dock 不遮挡、小屏机型不溢出。
- reduce-motion 下复测。
