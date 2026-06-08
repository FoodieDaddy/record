# 开发日志

## 2026-06-08 — 识别舱/全息舱信息架构调整

### 摘要

- 识别舱职责收敛：移除「数据矩阵」和「航迹档案摘要」，不再承担航迹分析功能。
- 识别舱保留：本舰档案、本舰呼号、识别徽标、授权等级、航行经验、稳定读数（轻量「本舰状态」）、装备协议、断开终端。
- 全息舱新增「航迹档案」模块：航迹摘要（已写入样本、最近航程、封存时间）+ 航迹回放入口。
- 「身份档案」更名为「识别档案」，「身份经验」更名为「航行经验」。

### 变更文件

修改：
- `miniprogram/pages/profile/profile.wxml` — 移除数据矩阵和航迹档案摘要，新增本舰状态
- `miniprogram/pages/profile/profile.js` — 移除 loadScoreStats、loadBlackboxSummary 和相关数据字段
- `miniprogram/pages/profile/profile.wxss` — 替换数据矩阵和黑匣子样式为本舰状态样式
- `miniprogram/pages/mirror/index.wxml` — 新增航迹档案卡片
- `miniprogram/pages/mirror/index.js` — 新增 _fetchBlackboxSummary、goScoreRecords，导入 request.get
- `miniprogram/pages/mirror/index.wxss` — 新增航迹档案样式
- `miniprogram/pages/level-archive/level-archive.json` — 导航标题改为「识别档案」
- `miniprogram/pages/level-archive/level-archive.wxml` — 标题和经验文案更新
- `docs/PRODUCT_LANGUAGE.md` — 术语表和页面推荐表达更新
- `docs/UI_GUIDELINES.md` — 页面分工描述更新
- `docs/ACCEPTANCE_CHECKLIST.md` — 新增验收项
- `docs/DEVELOPMENT_LOG.md` — 本条记录
- `changelog.md` — 记录用户可感知变化

### 验证方式

- 识别舱页面不出现「数据矩阵」和「航迹档案摘要」
- 识别舱页面展示「本舰状态」（航行经验 + 稳定读数）
- 全息舱页面展示「航迹档案」卡片（已写入样本、最近航程、封存时间）
- 全息舱航迹档案卡片可点击跳转航迹回放
- 识别档案页面标题显示「识别档案」
- 识别档案页面「航行经验」文案正确

### 后续事项

- 无

---

## 2026-06-08

### 摘要

- 全局产品语言重构：底部导航从「空间/策略/镜像/身份」改为「编队/指令/镜像/身份」。
- 创建舰载系统 Dock 自定义 TabBar，纯 CSS 四舱位插槽图标。
- 统一「黑匣子」→「航迹档案」，「五维扫描」→「全息扫描」，「航行核心」→「导航核心」。
- 用户称呼体系重构：「舰员代号」→「本舰呼号」，「头盔识别」→「识别徽标」，「身份等级」→「授权等级」。
- 身份图标从芯片卡重新设计为四角扫描框 + 中心识别点。
- 同步更新所有运行时用户可见文案、sanitize 规则和文档。

### 世界观映射

- 编队 = 驾驶舱（COCKPIT）
- 指令 = 导航舱（NAV）
- 镜像 = 全息舱（HOLO）
- 身份 = 识别舱（IDENTITY）

### 变更文件

新建：
- `miniprogram/custom-tab-bar/index.js`
- `miniprogram/custom-tab-bar/index.wxml`
- `miniprogram/custom-tab-bar/index.wxss`

修改：
- `miniprogram/app.json` — tabBar 文案
- `miniprogram/app.js` — activeTabKey 初始值
- `miniprogram/utils/terminology.js` — 全局术语参考
- `miniprogram/utils/domain-display.js` — 展示适配层
- `miniprogram/utils/mirror-sanitize.js` — 新增航迹/全息扫描替换规则
- `miniprogram/pages/room/room.json` — 导航标题
- `miniprogram/pages/room/room.wxml` — 编队/航迹档案文案
- `miniprogram/pages/room/room.js` — Toast/heartbeat 文案 + activeTabKey
- `miniprogram/pages/fortune/fortune.json` — 导航标题
- `miniprogram/pages/fortune/fortune.wxml` — 导航舱/计算文案
- `miniprogram/pages/fortune/fortune.js` — Toast/nav title + activeTabKey
- `miniprogram/pages/mirror/index.wxml` — 航迹样本文案
- `miniprogram/pages/mirror/index.js` — 航迹样本/全息扫描文案 + activeTabKey
- `miniprogram/pages/profile/profile.json` — 导航标题
- `miniprogram/pages/profile/profile.wxml` — 识别舱文案
- `miniprogram/pages/profile/profile.js` — activeTabKey
- `miniprogram/pages/login/login.wxml` — 编队/导航核心文案
- `miniprogram/pages/login/login.js` — 导航引擎文案
- `miniprogram/pages/score-records/score-records.json` — 航迹回放标题
- `miniprogram/pages/score-records/score-records.wxml` — 航迹回放文案
- `miniprogram/pages/score-records/score-records.js` — console 文案
- `miniprogram/pages/level-archive/level-archive.js` — 指令执行者徽章
- `miniprogram/components/battle-insight/battle-insight.wxml` — 编队洞察
- `miniprogram/components/battle-summary/battle-summary.wxml` — 编队
- `miniprogram/components/space-scan-panel/space-scan-panel.wxml` — 编队扫描

文档：
- `docs/PRODUCT_LANGUAGE.md` — 全面重写
- `docs/UI_GUIDELINES.md` — 补充 Dock 规范
- `docs/CONTENT_SAFETY.md` — 指令页禁止表达
- `docs/ARCHITECTURE.md` — 模块描述更新
- `docs/ACCEPTANCE_CHECKLIST.md` — 新增验收项
- `CHANGELOG.md` — 记录变更
- `PLAN.md` — 标记进度

### 验证

- 微信开发者工具编译待验证
- 关键词搜索验证待执行
- 底部导航渲染待验证

### 后续事项

- 微信开发者工具中验证底部 Dock 渲染效果
- 真机验证安全区适配
- 确认 Canvas 海报文案无遗漏

## 2026-06-07

### 摘要

- 将过长的根目录 `CLAUDE.md` 拆分为精简入口文档、聚焦的 `docs/` 项目知识文件和 `.claude/rules/` 执行规则。

### 变更文件

- `CLAUDE.md`
- `PLAN.md`
- `CHANGELOG.md`
- `docs/PROJECT_OVERVIEW.md`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCT_LANGUAGE.md`
- `docs/UI_GUIDELINES.md`
- `docs/CONTENT_SAFETY.md`
- `docs/DEVELOPMENT_LOG.md`
- `docs/TECH_DEBT.md`
- `docs/ACCEPTANCE_CHECKLIST.md`
- `docs/DATABASE.md`
- `.claude/rules/backend.md`
- `.claude/rules/frontend.md`
- `.claude/rules/documentation.md`
- `.claude/rules/performance.md`
- `.claude/rules/security.md`
- `.gitignore`

### 实现说明

- 保留根目录 `CLAUDE.md` 作为项目入口、命令参考、文档索引和高层工作规则。
- 将项目概述、架构事实、产品语言、UI 规则、内容安全、数据库说明、技术债和验收清单拆入独立文件。
- 增加后端、前端、文档、性能和安全执行规则文件。
- 收窄 `.claude/` 忽略规则，让 `.claude/rules/*.md` 可以被版本控制追踪，同时继续忽略本地 Claude 设置和技能文件。
- 增加 Markdown 文档强制中文规则；代码标识符、路径、API 路径、命令、表名、字段名、配置键和专有库名可以保留原文。
- 基于当前代码、技术债清单和工作区改动，重写 `PLAN.md` 为下一轮稳定化验收计划。

### 验证

- 本次为纯文档变更，无需运行后端或前端测试。
- 生成下一步计划前，已执行后端编译命令 `JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn -q -DskipTests compile`，结果通过。

### 后续事项

- 确认此前已删除的小写 `changelog.md`、`plan.md` 与 `codex-changelog.md` 是否应继续移除。
- 后续记录或修改接口契约时，补充 `docs/API.md`。
