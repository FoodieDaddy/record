# CLAUDE.md

本文件是 Claude Code 在本仓库工作时的项目入口说明。

## 项目身份

太空记分器 / Space Scorekeeper（工程代号 smartrecord）—— 多人编队记分与航迹复盘微信小程序。

产品主线：

```text
任务编队 -> 脉冲记录 -> 航迹复盘 -> 指令推演 -> 镜像投影 -> 身份沉淀
```

世界观：每个用户是一艘个人航船。编队是航船为完成短程任务组成的临时航行单元；脉冲是任务航程的核心读数单位，记录推进、流向和协作变化；每次脉冲变化形成航迹点，封存后写入航迹档案，驱动驾驶舱（现场）、导航舱（推演）、全息舱（映射）、识别舱（身份）。

视觉定位：黑底、蓝光、克制、冷静、数据终端感。

## 工作前阅读

改动前按任务范围阅读相关文档：

- `docs/PROJECT_OVERVIEW.md`：项目概述、产品定位、技术栈、启动命令
- `docs/ARCHITECTURE.md`：架构事实、模块边界、Redis/MySQL 职责
- `docs/PRODUCT_LANGUAGE.md`：世界观、术语表、用户可见文案规则
- `docs/UI_GUIDELINES.md`：视觉系统、页面体验、组件规则
- `docs/CONTENT_SAFETY.md`：禁用词、敏感文案规则、sanitize 要求
- `docs/DATABASE.md`：数据库表和持久化边界
- `docs/TECH_DEBT.md`：已知问题和优先清理项
- `docs/ACCEPTANCE_CHECKLIST.md`：全局与页面级验收清单

执行细节阅读规则文件：

- `.claude/rules/backend.md`：后端实现规则
- `.claude/rules/frontend.md`：前端实现规则
- `.claude/rules/documentation.md`：文档维护规则
- `.claude/rules/performance.md`：性能与 2C2G 约束
- `.claude/rules/security.md`：密钥、日志和用户可见安全规则

## 必须遵守

- 不要把后续优化目标写成已经完成的事实。
- 不要引入高频轮询、无差别广播或运行期大对象反复序列化。
- 运行时用户可见文案必须遵守 `docs/PRODUCT_LANGUAGE.md` 和 `docs/CONTENT_SAFETY.md`。
- 前端 UI 改动必须遵守 `docs/UI_GUIDELINES.md`。
- 后端和运行期改动必须遵守 `docs/ARCHITECTURE.md`。
- 已知问题要对照 `docs/TECH_DEBT.md` 检查。
- 除非 API 字段或数据库命名需要保留旧词，否则产品语言必须维持舰载终端世界观。
- 用户可见主术语以「编队 / 指令 / 镜像 / 身份」为底部入口；「信标」必须保留为编队邀请、二维码、分享入口和扫码加入的用户可见称呼。
- 「编队码」只表示 6 位短码；不要用「编队码」替代「信标」。
- 运行时界面禁止在中文标题、按钮、卡片、状态或弹窗下方附加英文副标题、英文翻译或英文装饰标签；品牌专名、技术标识、协议字段和必要单位不受此限制，但不得作为第二行装饰文案。
- 不要为了世界观强行改后端字段、数据库表或 API 路径。
- 所有 Markdown 文档必须使用中文书写；代码标识符、文件路径、API 路径、命令、表名、字段名、配置键、专有库名可以保留原文。
- 在自定义沉浸式导航栏页面中，弹窗或全息大屏幕等浮动面板的顶部严禁超过/侵染原生原有标题栏和胶囊按钮。必须通过页面 JS 获取精确的 `customNavHeight` 传递至组件，利用内联样式动态控制最外层 `padding-top` 避让。不要只依赖 `env(safe-area-inset-top)` 作为唯一的 CSS 避让规则，以防止其意外失效。

## 文档维护规则

每次代码或功能更新后，结束前必须同步更新文档。

Markdown 语言规则：

- 所有新增或修改的 `.md` 文档必须使用中文书写。
- 代码标识符、文件路径、API 路径、命令、表名、字段名、配置键、专有库名可以保留原文。
- 面向开发者的说明、标题、列表项、验收结论和开发日志都应使用中文。

始终更新：

- `PLAN.md`：标记任务进度和后续事项。
- `CHANGELOG.md`：只记录用户可感知的软件变化。
- `docs/DEVELOPMENT_LOG.md`：总结实现细节、变更文件、验证方式和后续事项。

按需更新：

- `docs/ARCHITECTURE.md`：模块边界、数据流、Redis/MySQL 行为、WebSocket 行为或核心实现变化时更新。
- `docs/API.md`：接口、请求/响应字段、鉴权行为或错误码变化时更新。
- `docs/DATABASE.md`：表结构、迁移、索引或持久化规则变化时更新。
- `docs/PRODUCT_LANGUAGE.md`：用户可见术语或世界观文案变化时更新。
- `docs/UI_GUIDELINES.md`：视觉系统、布局规则、动效规则或组件行为变化时更新。
- `docs/CONTENT_SAFETY.md`：禁词、sanitize 规则、Prompt 安全或分享/海报文案规则变化时更新。
- `docs/TECH_DEBT.md`：已知问题修复或发现新技术债时更新。

不要：

- 不要把临时任务笔记放进 `CLAUDE.md`。
- 不要把实现历史写进 `PLAN.md`。
- 不要只把产品变更写进 `docs/DEVELOPMENT_LOG.md`。
- 相关文档和验证步骤没有更新前，不要标记工作完成。

## 工作边界

在本仓库工作时：

- 以当前代码作为行为事实来源。
- 把文档视为指导，不把文档描述直接当成已实现事实。
- 保留工作区中无关的用户改动。
- 改动范围收敛到当前任务。
- 修改后端 Java 代码后，使用仓库验证流程确认。
