# 文档规则

每次代码或功能更新后，结束前必须同步更新相关文档。

## Markdown 语言规则

- 所有新增或修改的 `.md` 文档必须使用中文书写。
- 代码标识符、文件路径、API 路径、命令、表名、字段名、配置键、专有库名可以保留原文。
- 面向开发者的说明、标题、列表项、验收结论和开发日志都应使用中文。
- 不要把业务术语强行翻译成不符合项目约定的表达；用户可见文案仍以 `docs/PRODUCT_LANGUAGE.md` 和 `docs/CONTENT_SAFETY.md` 为准。

## 始终更新

- `PLAN.md`：标记任务进度和后续事项。
- `CHANGELOG.md`：记录用户可感知的软件变化。
- `docs/DEVELOPMENT_LOG.md`：总结实现细节、变更文件、验证方式和后续事项。

## 按需更新

- `docs/ARCHITECTURE.md`：模块边界、数据流、Redis/MySQL 行为、WebSocket 行为或核心实现变化时更新。
- `docs/API.md`：接口、请求/响应字段、鉴权行为或错误码变化时更新。
- `docs/DATABASE.md`：表结构、迁移、索引或持久化规则变化时更新。
- `docs/PRODUCT_LANGUAGE.md`：用户可见术语或世界观文案变化时更新。
- `docs/UI_GUIDELINES.md`：视觉系统、布局规则、动效规则或组件行为变化时更新。
- `docs/CONTENT_SAFETY.md`：禁词、sanitize 规则、Prompt 安全或分享/海报文案规则变化时更新。
- `docs/TECH_DEBT.md`：已知问题修复或发现新技术债时更新。

## 不要

- 不要把临时任务笔记放进 `CLAUDE.md`。
- 不要把实现历史写进 `PLAN.md`。
- 不要只把产品变更写进 `docs/DEVELOPMENT_LOG.md`。
- 相关文档和验证步骤没有更新前，不要标记工作完成。

## 文件职责

- `CLAUDE.md` = 项目入口和规则索引。
- `docs/*` = 稳定项目知识。
- `.claude/rules/*` = Claude 执行规则。
- `PLAN.md` = 当前计划。
- `CHANGELOG.md` = 用户可感知的软件变化。
- `docs/DEVELOPMENT_LOG.md` = 内部实现记录。
