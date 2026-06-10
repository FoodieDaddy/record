# 太空记分器 · 基地总控台

> 太空记分器的独立 Web 管理后台，提供用户、编队、航迹、指令、镜像和系统运维的全链路管理能力。

## 项目概述

### 定位

基地总控台是面向管理员的桌面端 Web 后台，用于管理太空记分器小程序的所有数据和系统状态。视觉风格为「飞船控制中心」— 黑底、蓝光、HUD 面板、扫描线、克制发光。

### 技术栈

| 层级 | 技术 |
|---|---|
| 前端框架 | Vue 3 + TypeScript |
| 构建工具 | Vite 6 |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 |
| 图表 | ECharts 5 (按需引入) |
| HTTP | Axios |
| 后端 | Spring Boot 3.2.5 + MyBatis-Plus |
| 数据库 | MySQL 8.0 + Redis |
| 认证 | JWT (与小程序共用) |

### 端口

| 服务 | 端口 |
|---|---|
| 前端 Dev Server | 18090 |
| 后端 API | 18080 |
| MySQL | 13306 |
| Redis | 16379 |
| Sentinel Dashboard | 18858 |

## 启动方式

### 1. 启动基础设施

```bash
cd /Users/happy/Documents/projects/record
docker-compose up -d
```

### 2. 启动后端

```bash
cd backend
JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run
```

后端启动时会自动：
- 执行 Flyway 迁移（V1-V4）
- 创建默认管理员账号（admin / admin123，可通过 `admin.default.password` 环境变量修改）
- 本地开发环境自动创建种子数据（10 用户 + 5 编队 + 成员 + 指令 + 镜像）

### 3. 启动前端

```bash
cd admin-web
npm install
npm run dev
```

### 4. 访问

打开浏览器访问 http://localhost:18090

默认账号：`admin` / `admin123`

## 目录结构

```text
admin-web/
├── index.html                    # 入口 HTML
├── vite.config.ts                # Vite 配置（代理、别名）
├── tsconfig.json                 # TypeScript 配置
├── package.json                  # 依赖声明
├── test-api.sh                   # API 全量测试脚本
└── src/
    ├── main.ts                   # 应用入口
    ├── App.vue                   # 根组件
    ├── styles/
    │   ├── tokens.css            # 设计令牌（颜色/间距/字体/圆角/切角）
    │   ├── base.css              # 全局基础样式（reset/背景/扫描线/网格）
    │   ├── components.css        # 公共组件样式（panel/table/button/input）
    │   └── utilities.css         # 工具类
    ├── components/
    │   ├── layout/
    │   │   ├── AppLayout.vue     # 全局布局壳层
    │   │   ├── NavSidebar.vue    # 左侧导航舱
    │   │   ├── TopStatusBar.vue  # 顶部状态栏
    │   │   ├── Breadcrumb.vue    # 面包屑导航
    │   │   ├── RightMonitor.vue  # 右侧监控栏
    │   │   └── BottomStatus.vue  # 底部状态条
    │   ├── data/
    │   │   ├── StatCard.vue      # 数据指标卡
    │   │   ├── DataTable.vue     # 终端表格（支持多选）
    │   │   └── DataPagination.vue # 分页器
    │   ├── status/
    │   │   ├── StatusPill.vue    # 状态胶囊
    │   │   └── StatusDot.vue     # 状态点
    │   ├── button/
    │   │   └── CommandButton.vue # 控制键按钮
    │   ├── chart/
    │   │   └── HudChart.vue      # ECharts 图表容器
    │   ├── modal/
    │   │   └── ConfirmDangerModal.vue # 危险确认弹窗
    │   └── feedback/
    │       ├── ToastContainer.vue # Toast 通知
    │       ├── SkeletonLoader.vue # 骨架屏加载
    │       └── EmptyState.vue    # 空状态插图
    ├── composables/
    │   ├── useApi.ts             # Axios 封装（JWT 拦截、错误 Toast）
    │   └── useAuth.ts            # 登录/登出
    ├── stores/
    │   ├── auth.ts               # 认证状态（token 持久化）
    │   ├── app.ts                # 应用状态（侧栏折叠、右栏开关）
    │   └── toast.ts              # Toast 通知状态
    ├── router/
    │   └── index.ts              # 路由配置（16 条路由）
    ├── utils/
    │   ├── format.ts             # 格式化工具
    │   └── chart-theme.ts        # ECharts 主题
    └── views/
        ├── login/LoginView.vue
        ├── dashboard/DashboardView.vue
        ├── users/
        │   ├── UserListView.vue
        │   └── UserDetailView.vue
        ├── formations/
        │   ├── FormationListView.vue
        │   └── FormationDetailView.vue
        ├── traces/TraceCenterView.vue
        ├── directives/
        │   ├── DirectiveLogsView.vue
        │   └── DirectiveDetailView.vue
        ├── mirrors/
        │   ├── MirrorListView.vue
        │   └── MirrorDetailView.vue
        ├── system/
        │   ├── HealthView.vue
        │   └── AlertsView.vue
        ├── admins/
        │   ├── AdminListView.vue
        │   └── RolesView.vue
        └── audit/AuditLogView.vue
```

## 路由结构

```text
/login                         管理员接入终端

/dashboard                     基地总览

/users                         航船用户列表
/users/:id                     航船用户详情

/formations                    任务编队列表
/formations/:id                任务编队详情

/traces                        航迹中心

/directives/logs               指令日志
/directives/logs/:id           指令日志详情

/mirrors                       镜像档案
/mirrors/:userId               镜像档案详情

/system/health                 系统监控
/system/alerts                 告警中心

/admins                        管理员管理
/admins/roles                  角色权限

/audit                         审计日志
```

所有路由（除 `/login`）需要管理员 JWT 认证。未认证访问返回 `code=4001`。

## API 端点

### 管理员认证

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /admin/login | 管理员登录，返回 JWT token |

### Dashboard

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/dashboard/overview | 总览指标（用户数、编队数、脉冲数） |
| GET | /admin/dashboard/trends | 近 30 天用户增长与编队创建趋势 |
| GET | /admin/dashboard/events | 最近 10 条系统事件 |
| GET | /admin/dashboard/trace-stats | 航迹统计（封存趋势、活跃排行） |
| GET | /admin/dashboard/pulse-stats | 脉冲统计（总流向、总脉冲值、航段数） |
| GET | /admin/dashboard/pulse-trends | 近 30 天脉冲趋势 |

### 用户管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/users | 用户列表（分页、搜索） |
| GET | /admin/users/{id} | 用户详情 |
| PUT | /admin/users/{id}/status | 修改用户状态（启用/禁用） |
| GET | /admin/users/{id}/formations | 用户参与的编队列表 |
| PUT | /admin/users/batch-status | 批量修改用户状态 |
| DELETE | /admin/users/batch | 批量删除用户 |

### 编队管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/formations | 编队列表（分页） |
| GET | /admin/formations/{id} | 编队详情（含成员列表） |

### 指令日志

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/directives/logs | 指令日志列表（分页） |
| GET | /admin/directives/logs/{id} | 指令日志详情 |

### 镜像档案

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/mirrors | 镜像档案列表（分页） |
| GET | /admin/mirrors/{userId} | 镜像档案详情 |

### 系统监控

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/system/health | 系统健康状态（MySQL/Redis 实测连通性） |
| GET | /admin/system/alerts | 告警列表 |
| GET | /admin/system/sentinel | Sentinel 限流控制台信息 |

### 管理员管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/admins | 管理员列表（分页） |
| POST | /admin/admins | 创建管理员 |
| GET | /admin/admins/{id} | 管理员详情 |
| PUT | /admin/admins/{id}/status | 修改管理员状态（启用/禁用） |

### 审计日志

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/audit | 审计日志列表（分页） |

### 统一响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

错误码：`200` 成功，`400` 参数错误，`4001` 未认证，`5000` 业务错误。

## 页面功能

### 登录页

- 左侧：品牌标识 + SVG 轨道图形（60 秒旋转动画）
- 右侧：账号密码表单
- 交互：输入聚焦发光、登录按钮切角、错误 Toast 提示
- 入场：左右面板分层淡入

### 基地总览 Dashboard

- 6 个核心指标卡（用户数、活跃、编队、封存、脉冲、航段）
- 基地态势 SVG 图（编队节点 + 连接线 + 航船点）
- 系统健康矩阵（8 项服务，MySQL/Redis 实测连通性）
- 脉冲趋势折线图（近 30 天，双线：用户增长 + 编队创建）
- 实时事件流（最近 10 条，从数据库查询）
- 30 秒自动刷新

### 航船用户管理

- 搜索框（ID / 呼号模糊搜索）
- 用户增长趋势折线图
- 用户状态分布面板（正常/禁用）
- 数据表格（支持 checkbox 多选）
- 批量操作：启用、禁用、删除（红色确认弹窗）
- 单个操作：查看详情、启用/禁用
- 分页器

### 用户详情

- 用户档案卡片（头像首字、呼号、ID、状态）
- 4 个指标卡（身份等级、航行经验、封存航程、注册时间）
- 用户信息网格（OpenID、头像 URL）
- 参与的编队列表（编队码、协议、分数、加入时间）
- 骨架屏加载

### 任务编队管理

- 搜索框（编队码搜索）
- 编队创建趋势柱状图
- 协议分布面板（脉冲流向/航段写入）
- 数据表格（编队码青色高亮、状态胶囊、协议标签）
- 分页器

### 编队详情

- 编队摘要卡片（编队码、主控、成员数、协议、状态）
- 成员席位列表（头像首字、呼号、分数、加入时间、在线状态）
- 脉冲轨迹图表区（ECharts 占位）
- 危险操作区（强制封存、强制解散）— 红色确认弹窗
- 骨架屏加载

### 航迹中心

- 封存航程趋势柱状图（近 30 天）
- 活跃排行条形图（Top 10 用户总脉冲）
- 高活跃编队列表（编队码、成员数、协议）
- 高活跃航船排行表

### 指令日志

- 搜索框（用户 ID）
- 脉冲数据概览柱状图（总流向/总脉冲/航段/封存）
- 生成状态分布面板（成功/失败）
- 数据表格（来源高亮、状态着色）
- 详情页（生成摘要、主引擎输出、最终内容）

### 镜像档案

- 搜索框（用户 ID）
- 封存航程趋势折线图
- MBTI 协议分布面板
- 数据表格（协议类型紫色、一致率颜色编码）
- 详情页（全息档案、协议信息、扫描图占位）

### 系统监控

- 系统健康矩阵（8 项服务卡片，MySQL/Redis 实测延迟）
- 接口耗时排行 / 错误排行（占位）
- 限流控制台（Sentinel Dashboard 链接，可跳转）
- 30 秒自动刷新

### 管理员管理

- 角色分布面板（SUPER_ADMIN/OPERATOR/VIEWER）
- 状态分布面板（正常/禁用）
- 数据表格（角色紫色、状态胶囊）
- 创建管理员弹窗（用户名、密码、角色选择）
- 启用/禁用操作

### 审计日志

- 操作类型分布面板
- 数据表格（操作类型青色高亮、结果着色）

## 设计系统

### 颜色令牌

```css
--color-primary: #0A84FF;     /* 蓝色 — 主操作、数据焦点 */
--color-cyan: #00C8FF;        /* 青色 — 接入状态、高亮 */
--color-purple: #5E5CE6;      /* 紫色 — 装饰、协议类型 */
--color-green: #30D158;       /* 绿色 — 在线、健康、完成 */
--color-orange: #FF9F0A;      /* 橙色 — 注意、边界、告警 */
--color-red: #FF453A;         /* 红色 — 危险、错误 */

--bg-base: #0A0A0A;           /* 主背景 */
--bg-panel: rgba(4,8,16,0.6); /* 面板背景 */
--text-main: rgba(255,255,255,0.92);
--text-secondary: rgba(255,255,255,0.56);
--text-muted: rgba(255,255,255,0.38);
```

### 飞船控制中心特效

| 元素 | 效果 |
|---|---|
| 全局背景 | 径向蓝光 + 网格线 + 扫描线叠加 |
| 面板 | 半透明深色底 + backdrop blur + 蓝色描边 |
| 面板头部 | 蓝色底色渐变 |
| 表头 | 大写 + 蓝色底色 |
| 表格行 hover | 弱蓝背景 + 内发光 |
| 按钮 | 切角 clip-path + 青色光晕 |
| 输入框 | 深色底 + 聚焦外发光 |
| 状态点 | 绿/橙/红发光脉冲 |
| 导航选中 | 青色竖条 + 脉冲光晕 |
| HUD 标签 | 青色小标签，大写字母 |
| 指标卡 | 底部能量线脉冲 + 数字入场动画 |
| 登录页 | SVG 轨道 60 秒旋转 |

### 动画

| 动画 | 时长 | 使用场景 |
|---|---|---|
| fade-in-up | 400ms | 卡片/行入场 |
| fade-in | 300ms | 面板入场 |
| pulse-glow | 2s infinite | 状态点、导航选中 |
| scan-line | 4s infinite | HUD 面板扫描线 |
| slide-in-right | 300ms | 事件流入场 |
| number-count | 500ms | 指标卡数字 |
| page-fade | 150ms | 页面转场 |
| orbit-rotate | 60s infinite | 登录页轨道 |

### 组件

| 组件 | 说明 |
|---|---|
| BasePanel | 控制面板容器（切角、描边、HUD 角标） |
| StatCard | 数据指标卡（标题、英文装饰、数字、趋势、能量线） |
| DataTable | 终端表格（列配置、插槽、多选、空状态） |
| DataPagination | 分页器 |
| CommandButton | 控制键按钮（primary/secondary/ghost/danger） |
| StatusPill | 状态胶囊（ok/warn/error/running/offline） |
| StatusDot | 状态点 |
| HudChart | ECharts 图表容器 |
| ConfirmDangerModal | 危险确认弹窗 |
| ToastContainer | Toast 通知（成功/错误/警告/信息） |
| SkeletonLoader | 骨架屏加载 |
| EmptyState | 空状态插图 |

## 数据库

### 迁移版本

| 版本 | 说明 |
|---|---|
| V1 | 初始表（user, room, room_member, round_record 等） |
| V2 | 异步任务表（async_task） |
| V3 | 管理员表（admin） |
| V4 | 审计日志表（audit_log） |

### admin 表

```sql
CREATE TABLE admin (
  id BIGINT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password VARCHAR(128) NOT NULL,  -- BCrypt 加密
  role VARCHAR(32) NOT NULL DEFAULT 'VIEWER',  -- SUPER_ADMIN / OPERATOR / VIEWER
  status TINYINT NOT NULL DEFAULT 1,  -- 0-禁用 1-正常
  last_login_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### audit_log 表

```sql
CREATE TABLE audit_log (
  id BIGINT PRIMARY KEY,
  admin_id BIGINT,
  admin_name VARCHAR(64),
  action_type VARCHAR(32) NOT NULL,
  target_type VARCHAR(32),
  target_id VARCHAR(64),
  ip VARCHAR(64),
  result VARCHAR(16) DEFAULT '成功',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_id (admin_id),
  INDEX idx_created_at (created_at)
);
```

## 测试

### API 全量测试

```bash
cd /Users/happy/Documents/projects/record
bash admin-web/test-api.sh
```

测试覆盖 19 个端点：

| 模块 | 端点数 | 测试内容 |
|---|---|---|
| 认证 | 1 | 登录获取 token |
| Dashboard | 6 | overview, trends, events, trace-stats, pulse-stats, pulse-trends |
| 用户 | 4 | 列表、详情、编队历史、状态修改 |
| 编队 | 2 | 列表、详情 |
| 指令 | 1 | 列表 |
| 镜像 | 1 | 列表 |
| 系统 | 3 | health, alerts, sentinel |
| 管理员 | 3 | 列表、创建、详情 |
| 审计 | 1 | 列表 |
| 鉴权 | 2 | 未认证拒绝、不存在资源 |

### 构建验证

```bash
# 前端
cd admin-web && npx vite build

# 后端
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile
```

## 配置

### Vite 代理

```typescript
// vite.config.ts
server: {
  port: 18090,
  proxy: {
    '/api': {
      target: 'http://localhost:18080',
      changeOrigin: true,
      // 不 rewrite，后端 context-path 为 /api
    }
  }
}
```

### 后端配置

```yaml
# application.yml
server:
  servlet:
    context-path: /api

# 管理员默认密码（环境变量）
admin:
  default:
    password: ${ADMIN_DEFAULT_PASSWORD:admin123}

# Sentinel Dashboard 地址
sentinel:
  dashboard: ${SENTINEL_DASHBOARD:http://localhost:18858}
```

## 角色权限

| 角色 | 说明 | 权限 |
|---|---|---|
| SUPER_ADMIN | 超级管理员 | 所有权限 |
| OPERATOR | 运营处理 | 用户/编队/指令/镜像管理 |
| VIEWER | 只读观察 | 仅查看 |

## 后续规划

- [ ] 编队详情脉冲轨迹 ECharts 图表
- [ ] 指令日志详情页完整内容
- [ ] 镜像详情页全息扫描雷达图
- [ ] 告警中心实时推送
- [ ] 用户导出 CSV
- [ ] 编队强制封存/解散 API
- [ ] 管理员密码修改
- [ ] 操作审计自动记录
- [ ] 响应式移动端适配
