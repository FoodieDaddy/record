# CLAUDE.md

本文件是 Claude Code 在本仓库工作时的项目入口说明。

## 项目身份

Smart Record / 脉冲终端是一个多人实时协同记录与复盘微信小程序。

产品主线：

```text
空间记录 -> 策略提示 -> 行为画像 -> 身份沉淀
```

世界观：

```text
空间是驾驶。
策略是点火。
镜像是扫描。
身份是认证。
黑匣子是记忆。
```

技术栈：

- 后端：Java 21、Spring Boot 3.2.5、MyBatis-Plus、MySQL、Redis/Redisson、WebSocket
- 前端：原生微信小程序

视觉定位：

```text
黑底、蓝光、克制、冷静、数据终端感
```

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

## 常用命令

启动基础设施：

```bash
docker-compose up -d
```

启动后端：

```bash
cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn spring-boot:run
```

前端：

```text
打开微信开发者工具，导入 miniprogram/ 目录。
```

端口：

| 服务 | 端口 |
|---|---:|
| 后端 API | 18080 |
| MySQL | 13306 |
| Redis | 16379 |

## 必须遵守

- 不要把后续优化目标写成已经完成的事实。
- 不要引入高频轮询、无差别广播或运行期大对象反复序列化。
- 运行时用户可见文案必须遵守 `docs/PRODUCT_LANGUAGE.md` 和 `docs/CONTENT_SAFETY.md`。
- 前端 UI 改动必须遵守 `docs/UI_GUIDELINES.md`。
- 后端和运行期改动必须遵守 `docs/ARCHITECTURE.md`。
- 已知问题要对照 `docs/TECH_DEBT.md` 检查。
- 除非 API 字段或数据库命名需要保留旧词，否则产品语言必须维持舰载终端世界观。
- 不要为了世界观强行改后端字段、数据库表或 API 路径。
- 所有 Markdown 文档必须使用中文书写；代码标识符、文件路径、API 路径、命令、表名、字段名、配置键、专有库名可以保留原文。

## 后端基线

- Java 使用 Lombok，例如 `@Data`、`@Slf4j`、`@RequiredArgsConstructor`。
- 返回结构使用 `Result<T>`。
- 业务异常使用 `BizException`。
- Controller 只做参数校验和转发，业务逻辑放在 Service 层。
- DTO 必须包含 `@Schema` 注解和 `example` 示例值。
- 实体 ID 由 `SnowflakeIdGenerator` 生成，禁止依赖数据库自增。
- 运行期频繁变化状态应优先使用 Redis Hash/ZSet/List 和 Lua 原子操作。

## 前端基线

- WXML/WXSS 使用 2 空格缩进。
- 核心页面根节点绑定 `reduce-motion`。
- JS 动画、Canvas 循环、timer、interval、animation frame 必须遵守 `app.globalData.animationEnabled`。
- timer、interval、animation frame 必须在 `onHide` 或 `onUnload` 清理。
- 所有触感反馈通过 `utils/haptic.js`。
- `utils/score-ws.js` 是全局 WebSocket 单例；页面只订阅/取消，不重复创建连接。
- 避免高频 `setData`，只更新必要字段。

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
