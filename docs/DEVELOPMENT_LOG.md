# 开发日志

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
