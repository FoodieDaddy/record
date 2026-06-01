# PLAN.md — 麻将记分器开发计划

## 已完成 ✅

### Step 1-4: 核心四步 ✅
- 系统设计 + DDL + Redis Key
- Swagger 接口 + DTO + Controller
- Service 层实现（Redisson 分布式锁 + WebSocket + 异步落库）
- 前端四个页面 + 工具模块 + 毛玻璃主题

### Phase 1-3: 功能完善 ✅
- 微信开发者工具项目配置
- MinIO Bucket 自动创建
- 环境切换 config.js
- 战绩分享海报（Canvas）
- WebSocket 连接管理优化
- 图库页面优化（加载态 + 空状态）

## 全部完成 ✅

项目已可运行：
- docker-compose up -d → MySQL(13306) + Redis(16379) + MinIO(19000)
- mvn spring-boot:run → 后端 (18080)
- 微信开发者工具 → miniprogram 目录
