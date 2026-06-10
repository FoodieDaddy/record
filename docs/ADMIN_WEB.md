# 太空记分器 · 基地总控台

> 太空记分器独立 Web 管理后台，视觉风格为「飞船控制中心」。

## 项目概述

### 定位

面向管理员的桌面端 Web 后台，管理小程序所有数据和系统状态。

### 技术栈

| 层级 | 技术 |
|---|---|
| 前端 | Vue 3 + TypeScript + Vite 6 |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 |
| 图表 | ECharts 5（按需引入） |
| HTTP | Axios |
| 后端 | Spring Boot 3.2.5 + MyBatis-Plus |
| 数据库 | MySQL 8.0 + Redis |
| 认证 | JWT（与小程序共用） |

### 端口

| 服务 | 端口 |
|---|---|
| 前端 Dev Server | 18090 |
| 后端 API | 18080 |
| MySQL | 13306 |
| Redis | 16379 |
| Sentinel | 18858 |

## 启动方式

```bash
# 1. 基础设施
docker-compose up -d

# 2. 后端
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run

# 3. 前端
cd admin-web && npm install && npm run dev
```

访问 http://localhost:18090，默认账号 `admin` / `admin123`。

后端启动自动执行：Flyway 迁移（V1-V4）、创建默认管理员、本地种子数据（10 用户 + 5 编队）。

## 目录结构

```text
admin-web/
├── vite.config.ts                # Vite 配置（代理、别名）
├── src/
│   ├── main.ts                   # 应用入口
│   ├── styles/                   # tokens.css / base.css / components.css / utilities.css
│   ├── components/
│   │   ├── layout/               # AppLayout / NavSidebar / TopStatusBar / Breadcrumb / RightMonitor / BottomStatus
│   │   ├── data/                 # StatCard / DataTable / DataPagination
│   │   ├── status/               # StatusPill / StatusDot
│   │   ├── button/               # CommandButton
│   │   ├── chart/                # HudChart
│   │   ├── modal/                # ConfirmDangerModal
│   │   └── feedback/             # ToastContainer / SkeletonLoader / EmptyState
│   ├── composables/              # useApi.ts / useAuth.ts
│   ├── stores/                   # auth.ts / app.ts / toast.ts
│   ├── router/index.ts           # 路由配置（16 条）
│   ├── utils/                    # format.ts / chart-theme.ts
│   └── views/
│       ├── login/                # LoginView
│       ├── dashboard/            # DashboardView
│       ├── users/                # UserListView / UserDetailView
│       ├── formations/           # FormationListView / FormationDetailView
│       ├── traces/               # TraceCenterView
│       ├── directives/           # DirectiveLogsView / DirectiveDetailView
│       ├── mirrors/              # MirrorListView / MirrorDetailView
│       ├── system/               # HealthView / AlertsView
│       ├── admins/               # AdminListView / RolesView
│       └── audit/                # AuditLogView
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

所有路由（除 `/login`）需管理员 JWT 认证。未认证返回 `code=4001`。

## API 端点

### 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /admin/login | 管理员登录，返回 JWT |

### Dashboard

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/dashboard/overview | 总览指标 |
| GET | /admin/dashboard/trends | 近 30 天增长趋势 |
| GET | /admin/dashboard/events | 最近 10 条事件 |
| GET | /admin/dashboard/trace-stats | 航迹统计 |
| GET | /admin/dashboard/pulse-stats | 脉冲统计 |
| GET | /admin/dashboard/pulse-trends | 近 30 天脉冲趋势 |

### 用户管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/users | 用户列表（分页、搜索） |
| GET | /admin/users/{id} | 用户详情 |
| PUT | /admin/users/{id}/status | 修改用户状态 |
| GET | /admin/users/{id}/formations | 用户参与的编队 |
| PUT | /admin/users/batch-status | 批量修改状态 |
| DELETE | /admin/users/batch | 批量删除 |

### 编队管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/formations | 编队列表 |
| GET | /admin/formations/{id} | 编队详情 |

### 指令日志

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/directives/logs | 指令日志列表 |
| GET | /admin/directives/logs/{id} | 指令日志详情 |

### 镜像档案

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/mirrors | 镜像档案列表 |
| GET | /admin/mirrors/{userId} | 镜像档案详情 |

### 系统监控

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/system/health | 健康状态（MySQL/Redis 实测） |
| GET | /admin/system/alerts | 告警列表 |
| GET | /admin/system/sentinel | Sentinel 限流信息 |

### 管理员管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/admins | 管理员列表 |
| POST | /admin/admins | 创建管理员 |
| GET | /admin/admins/{id} | 管理员详情 |
| PUT | /admin/admins/{id}/status | 修改管理员状态 |

### 审计日志

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/audit | 审计日志列表 |

### 统一响应

```json
{ "code": 200, "message": "success", "data": {} }
```

错误码：`200` 成功，`400` 参数错误，`4001` 未认证，`5000` 业务错误。

## 角色权限

| 角色 | 说明 | 权限 |
|---|---|---|
| SUPER_ADMIN | 超级管理员 | 所有权限 |
| OPERATOR | 运营处理 | 用户/编队/指令/镜像管理 |
| VIEWER | 只读观察 | 仅查看 |

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
  password VARCHAR(128) NOT NULL,          -- BCrypt
  role VARCHAR(32) NOT NULL DEFAULT 'VIEWER',  -- SUPER_ADMIN / OPERATOR / VIEWER
  status TINYINT NOT NULL DEFAULT 1,       -- 0-禁用 1-正常
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

## 设计系统

设计系统详见源码 `src/styles/` 目录和组件库。核心风格：黑底蓝光、三级面板体系（半透明+描边，透明度逐级递增）、切角按钮、状态点发光脉冲、HUD 标签。颜色令牌定义在 `tokens.css`，动画/特效定义在 `base.css` 和 `components.css`。
