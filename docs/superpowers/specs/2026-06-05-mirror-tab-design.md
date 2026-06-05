# Mirror Tab 设计文档

## Context

Smart Record 微信小程序需要将 Tab 3 从空桩的"图库"重构为"镜像"——一个赛博风多维测试终端。镜像页整合 MBTI 博弈人格校准、taibu 命理工具、今日场域、占测结果档案，移除战力雷达图和胜率类内容。

**核心约束**：2C2G 服务器、不破坏现有记分/房间/结算功能、所有动效支持 reduce-motion、禁止彩色 Emoji。

## 决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| TabBar 处理 | 替换图库 Tab | 图库是空桩，直接替换 |
| TaibuService 复用 | 包装现有 TaibuService | 不修改现有接口，MirrorToolService 内部调用 TaibuService.execute() |
| MBTI 版本 | 简化版 20 题 | 3 级评分（1/-1/0），滑动交互，适合小程序快速完成 |
| 档案入口 | 镜像模块内 | 镜像页 header 右侧按钮 |
| astrology 工具 | 首版 locked | 依赖 Node.js CJS，GraalVM 不支持 |

## 1. 架构

```
前端 (微信小程序)
  mirror/index (Tab 页) → mirror-api.js → request.js (JWT)
      ↓ HTTP
后端 (Java 21 + Spring Boot)
  MirrorController
    ├── MirrorService (dashboard 聚合)
    ├── MirrorToolService → TaibuService.execute() (GraalVM JS)
    ├── MirrorInterpretService → MiMo LLM (Hutool HTTP, 3s 超时)
    ├── MirrorReportService (CRUD)
    ├── MirrorProfileService (MBTI + 出生档案)
    └── MirrorContentGuard (禁止词过滤)
      ↓
MySQL (4 张新表) + Redis (缓存)
```

## 2. 数据库

### user_mirror_profile
| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | BIGINT PK | 与 user 表一对一 |
| mbti_type | VARCHAR(4) | 16 种 MBTI 类型 |
| mbti_source | VARCHAR(16) | test / direct |
| mbti_confidence | DECIMAL(5,2) | 置信度 0-100 |
| mbti_test_version | VARCHAR(32) | 测试版本 |
| mbti_answers_json | JSON | 测试原始答案 |
| mbti_title | VARCHAR(64) | 中文称号 |
| calibrated_at | DATETIME | 校准时间 |
| created_at / updated_at | DATETIME | 时间戳 |

### mirror_birth_profile
| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | BIGINT PK | 与 user 表一对一 |
| calendar_type | VARCHAR(16) | solar / lunar |
| birth_date | DATE | 出生日期 |
| birth_time | VARCHAR(16) | 出生时间 |
| birth_place | VARCHAR(128) | 出生地 |
| timezone | VARCHAR(64) | 时区 |
| gender | VARCHAR(16) | 性别 |
| extra_json | JSON | 扩展字段 |
| created_at / updated_at | DATETIME | 时间戳 |

### mirror_report
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 雪花 ID |
| user_id | BIGINT NOT NULL | 用户 ID |
| tool_type | VARCHAR(64) NOT NULL | 工具类型 code |
| question | VARCHAR(512) | 用户问题 |
| title | VARCHAR(128) | 结果标题 |
| raw_result | JSON | taibu 原始返回 |
| normalized_result | JSON | 标准化字段 |
| mbti_snapshot | JSON | 当时 MBTI 快照 |
| interpretation | JSON | 解释结果 |
| summary | TEXT | 摘要 |
| suggestions / warnings | JSON | 建议/预警 |
| theme_color | VARCHAR(16) | 主题色 |
| tag | VARCHAR(32) | 状态标签 |
| source | VARCHAR(32) | taibu / mimo / fallback |
| created_at / updated_at | DATETIME | 时间戳 |

索引：`(user_id, created_at)`, `(user_id, tool_type)`, `(tool_type, created_at)`

### mirror_daily_field
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 雪花 ID |
| user_id | BIGINT NOT NULL | 用户 ID |
| field_date | DATE NOT NULL | 日期 |
| almanac_result | JSON | 黄历结果 |
| taiyi_result | JSON | 太乙结果 |
| summary | VARCHAR(512) | 摘要 |
| tag | VARCHAR(32) | 状态标签 |
| theme_color | VARCHAR(16) | 主题色 |
| created_at / updated_at | DATETIME | 时间戳 |

唯一索引：`(user_id, field_date)`

## 3. API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/mirror/dashboard` | 首页聚合 |
| POST | `/mirror/mbti/test` | 20 题测试提交 |
| POST | `/mirror/mbti/direct` | 直接设置 MBTI |
| POST | `/mirror/tool/run` | 统一工具运行 |
| GET | `/mirror/report/{id}` | 结果详情 |
| GET | `/mirror/archive` | 档案分页 |
| POST | `/mirror/birth-profile` | 保存出生档案 |
| GET | `/mirror/birth-profile` | 读取出生档案 |

## 4. MirrorToolType 枚举

15 个工具，4 个分类：

- **TODAY**: almanac, taiyi
- **QUICK**: tarot, meihua, xiaoliuren, liuyao, qimen
- **PROFILE**: bazi, ziwei, astrology (locked, GraalVM 不支持)
- **ADVANCED**: bazi_dayun, bazi_pillars_resolve, ziwei_horoscope, ziwei_flying_star, daliuren

每个枚举包含：code, displayName, category, requiresBirthProfile, requiresQuestion, description

## 5. 核心流程

### Dashboard 加载
1. 读 Redis 缓存 `sr:mirror:dashboard:{userId}` (TTL 5min)
2. 未命中：并行查 MBTI profile、出生档案、今日场域、最近 3 条报告
3. 今日场域：Redis `sr:mirror:field:{userId}:{date}` → 未命中则调 TaibuService 生成
4. 组装工具列表：根据 MBTI/出生档案状态计算 locked
5. 返回聚合数据

### MBTI 校准
1. 20 题答案 (score: 1/-1/0)
2. 后端计算 4 维度：E/I, S/N, T/F, J/P
3. 查中文称号映射（16 种）
4. 写入 user_mirror_profile
5. 清除 dashboard + profile Redis 缓存

### 工具运行
1. 解析 tool → MirrorToolType
2. 校验 question/birthProfile 需求
3. 组装 taibu 参数 JSON → TaibuService.execute(domain, params)
4. 读取 MBTI profile 作为解释上下文
5. MirrorInterpretService → MiMo LLM (3s 超时)
6. ContentGuard 过滤禁止词
7. 失败则 fallback 解释池
8. 保存 mirror_report
9. 清除 dashboard 缓存

### Fallback 策略
- taibu 失败 → fallback 结构化结果
- LLM 超时/失败 → fallback 解释池（按 toolType + MBTI 分类）
- ContentGuard 拦截 → 替换为安全文案
- Redis 异常 → 跳过缓存，不影响主流程

## 6. 前端结构

### 页面
- `pages/mirror/index` — 首页（Tab 页）
- `pages/mirror/tool/index` — 工具输入页
- `pages/mirror/report/index` — 结果详情页
- `pages/mirror/archive/index` — 档案页

### 组件
- `mirror-personality-card` — MBTI 人格卡（已校准/未校准两种状态）
- `mirror-today-field` — 今日场域卡
- `mirror-tool-card` — 工具卡（含锁定态）
- `mirror-tool-section` — 工具分区（标题+网格/列表）
- `mbti-swipe-test` — 20 题滑动测试浮层
- `mbti-picker-modal` — MBTI 直接输入弹窗
- `mirror-report-card` — 结果卡片

### API 封装
- `utils/mirror-api.js` — 封装 8 个接口，复用 request.js

### 首页模块顺序
1. Header（标题 + 档案入口）
2. 人格镜像 MBTI 卡
3. 今日场域
4. 快速占测（工具网格）
5. 命盘画像（工具网格）
6. 高级推演（列表）
7. 最近结果
8. 底部安全提示

### TabBar 变更
将 `pages/gallery/gallery` 替换为 `pages/mirror/index`，文字"图库"→"镜像"。

## 7. 视觉规范

沿用现有 app.wxss CSS 变量体系：

- 背景：`#0A0A0A`
- 卡片：`rgba(255,255,255,0.04)` + `blur(20px)` + `border: 1px solid rgba(255,255,255,0.08)`
- 主色：`#0A84FF`
- 辅色：`#5E5CE6`
- 文字：主 `rgba(255,255,255,0.92)` / 次 `rgba(255,255,255,0.52)` / 弱 `rgba(255,255,255,0.34)`
- 禁止彩色 Emoji，图标用纯 CSS 线框
- 所有动画支持 reduce-motion

## 8. 安全合规

- 镜像首页底部：安全提示文案
- 工具输入页按钮上方：安全提示
- 结果页底部：安全提示
- 后端 ContentGuard：拦截 12 个禁止词，触发 fallback
- 所有解释文案不得承诺输赢、鼓励赌博、恐吓用户

## 9. Redis 缓存策略

| Key | TTL | 说明 |
|-----|-----|------|
| `sr:mirror:dashboard:{userId}` | 5 min | 首页聚合 |
| `sr:mirror:field:{userId}:{yyyyMMdd}` | 次日凌晨 + 随机抖动 | 今日场域 |
| `sr:mirror:tool:used:{userId}:{tool}:{yyyyMMdd}` | 次日凌晨 + 随机抖动 | 工具使用标记 |
| `sr:mirror:profile:{userId}` | 30 min | MBTI profile |

缓存清除：MBTI 更新 → 清 dashboard + profile；出生档案保存 → 清 dashboard；工具运行成功 → 清 dashboard。

## 10. 开发阶段

| 阶段 | 内容 | 交付物 |
|------|------|--------|
| 1 | 基础结构 | SQL DDL、Entity、Mapper、Enum、Controller 骨架 |
| 2 | 前端首页 | mirror/index + 3 个组件 |
| 3 | MBTI | 直接输入 + 滑动测试 + 后端计算 |
| 4 | 工具运行 | tool/index + MockTaibuService + /tool/run |
| 5 | 解释层 | FallbackPool + ContentGuard + MiMo |
| 6 | 档案 | archive 接口 + 页面 |
| 7 | 真实 taibu | 集成 TaibuService |
