# Codex 变动追踪日志

> 自动生成 · 仅记录 Codex 对项目的改动 · 不做任何代码修改

---

## 项目概览

- **项目名：** 脉冲终端 (Smart Record) — 多人实时协同记录与复盘微信小程序
- **技术栈：** Java 21 + Spring Boot 3.2.5 + MyBatis-Plus + MySQL + Redis/Redisson + WebSocket（后端）/ 原生微信小程序（前端）
- **仓库路径：** `/Users/happy/Documents/record`
- **总提交数：** 113（截至 2026-06-06 12:59）

---

## 当前快照

| 项 | 值 |
|---|---|
| 最新提交 | `ef56db9` — test: 第1轮迭代前置快照 2026-06-06 12:50 |
| 分支 | main |
| 工作区状态 | clean |
| Codex 进程 | 运行中 (PID 16604, Codex.app v149.0.7827.54) |

---

## 最近变动时间线 (2026-06-06)

### 12:56 — 第1轮迭代前置快照
- `ef56db9` test: 第1轮迭代前置快照 2026-06-06 12:50
- 28 文件变更，+930 / -129
- **改动范围：** app.wxss 全局样式大幅扩展、多组件/页面按钮与关闭图标统一、helmet-avatar 非法选择器修复、项目配置调整
- **新增文件：** `docs/superpowers/plans/2026-06-06-cockpit-ui-button-audit-changes.md`（387 行改动报告）

### 12:37 — 座舱 UI 审查基线
- `00ebc12` chore: checkpoint cockpit UI audit baseline

### 12:04 — 流向日志 + 空间扫描面板重构
- `74ddcc8` refactor(room): 流向日志 + 空间扫描面板全量重构

### 10:30 — 全局赛博飞船化重构
- `ecff5f3` refactor: 全局赛博飞船化重构 — 术语体系统一 + 展示层文案替换

### 09:40 — 全局赛博终端样式体系
- `f0820d2` feat: 全局赛博终端样式体系 + score-network 重写 + 结算页行为信号重构

### 06:24 — 全模块赛博终端风格重构
- `f0d769e` feat: 全模块赛博终端风格重构 + 镜像/运势/登录/个人页 UI 升级

### 04:42 — 本局录入弹窗风格
- `679fad6` feat(room): Mode 2 本局录入弹窗统一为暗色玻璃卡风格

### 04:39 — 结算弹层视觉统一
- `1181dcb` feat(settle): 结算弹层视觉统一 — score-chart 移除橙色，battle-insight 改为数据块风格

### 04:38 — 移除网络图
- `d5f1420` refactor(room): 移除房间页网络图 (force-graph)

### 04:37 — 结算流程修复
- `564f390` fix(room): 移除房主结算的重复确认弹窗
- `d301f7e` feat(room): 结算按钮增加 SYSTEM WARNING 二次确认弹窗

### 04:34 — 战局洞察改造
- `3f2a4ce` feat(room): 战局洞察改造为 2x2 数据块网格终端仪表盘

### 04:33 — 积分流改造
- `8ab2ee0` feat(room): FLOW LOG 积分流改造为时间线数据流布局

### 04:31 — 动画模式变更
- `fa14192` refactor(score-anim): 分数滚动动画改为 300ms 跳变模式

### 04:29 — 流转终端
- `fcb74df` feat(room): TRANSFER TERMINAL 流转终端改造

### 04:27 — 成员网络改造
- `bad6ca8` feat(room): 成员网络改造为横向滚动 + 赛博环 + HOST/TARGET 标签

### 04:24 — 顶部终端栏
- `c01a8ab` refactor(room): ROOM TERMINAL 顶部终端栏改为分段式布局

### 04:00~04:08 — 策略页完整重写
- `35bb2a9` feat(fortune): 前端 fortune.wxss 完整重写为新配色系统
- `c864c0e` feat(fortune): 前端 fortune.wxml 完整重写为 6 屏结构
- `28d44a8` feat(fortune): 前端 fortune.js 完整重写为 6 状态机
- `305714e` feat(fortune): 后端卡牌原型池 + nextRefreshAt 计算
- `7786335` feat(fortune): FortuneResp 新增 title/subtitle/tags/nextRefreshAt 字段

### 03:48~03:52 — 积分流水终端
- `3de5f00` fix(score-records): 补充 animationEnabled 数据绑定
- `005be9e` feat(score-records): 重写为积分流水终端风格
- `b6eabbb` feat(chart): 新增 yield-chart 收益曲线组件
- `7cac360` feat(score): 新增 GET /score/yield-log 端点
- `b6e7420` feat(score): 实现 getYieldLog 聚合逻辑
- `b275810` feat(score): 新增 YieldLogResp 积分流水终端 DTO

### 03:40~03:43 — 文档
- `a80e41c` docs: 积分流水终端 UI 重构实现计划
- `ae85add` docs: 积分流水终端 UI 重构设计文档

---

## 2026-06-06 之前的重要变动

### 06-06 凌晨 (01:40~03:00) — 身份终端 + 房间页终端化
- 身份等级系统完整实现（entity → mapper → service → controller → 前端重写）
- 房间页 ROOM TERMINAL HUD 栏、PLAYER NETWORK 终端卡、TRANSFER TERMINAL 键盘、FLOW LOG 时间轴
- 积分颜色统一（正绿/负红/零灰）、退出按钮迁移至底部操作区

### 06-05 — 镜像模块 + 架构精简
- `6105b92` feat: 镜像模块完整实现 — MBTI 校准 + 15 种测试工具 + MiMo 解读 + 档案系统
- `ba29a35` refactor: 精简架构 — 移除太卜/报告/座位模式，新增轮次录入系统
- GraalVM 太乙命理集成（后被移除）

### 06-04 — Redis 重构 + 分享
- `b2a51cd` refactor: 移除 Session 层，记分直接归属房间 + 转账改用 Lua 原子脚本
- 二维码异步生成、OSS 清理、指数退避重试

### 06-03 — 音色系统 + 后端重构
- 音色系统完整实现：14 个官方音色 + 9 个搞怪音色 + 抽屉试听 + 延迟保存
- 后端包名重构、房间页极简暗黑重设计

### 06-02 — 计分动画 + 脱敏
- 分数滚动动画实现 + 多轮竞态修复
- 全面脱敏处理

### 06-01 — 项目初始化
- `6748129` init: 麻将记分器微信小程序

---

## Codex 行为模式观察

### 工作节奏
- Codex 在 2026-06-06 凌晨 01:40 ~ 12:56 期间持续高频提交（约 30+ commits）
- 提交间隔通常 1~5 分钟，偶尔有 revert+recommit 的试错模式
- 会先写 docs/specs 再写实现代码，有设计先行的习惯

### 改动特征
- **大规模 UI 重构为主**：当前阶段主要在做「赛博终端」视觉风格统一
- **前后端联动**：改 DTO/Service 的同时会更新前端页面
- **组件化程度高**：新建了 battle-insight、battle-summary、persona-signal、score-network、yield-chart 等独立组件
- **渐进式迁移**：先写文档/计划，再分 Phase 实施

### 提交规范
- 使用 Conventional Commits 格式（feat/fix/refactor/style/chore/docs/test）
- 中文描述为主
- 偶尔有 `chore: 批量保存所有本地改动` 这种非结构化提交

### 已知问题
- 有一次 revert 记录（QR URL 改造被 revert 后重新提交）
- 最新提交提到「DevTools Console 中 Error: timeout 来源未定位」
- `score-ws.js` 中 `DEBUG_WS = true` 会打印带 token 的完整连接 URL

---

## 待 Codex 解决的技术债

来自 CLAUDE.md 第 10 节：

1. `room.wxml` 根节点缺少 `reduce-motion` 绑定
2. `voice-select.wxml` 页面根节点缺少全局动效静默类
3. `score-ws.js` 的 `DEBUG_WS = true` 需要关闭
4. `voices.json` 分类 icon 仍使用原生彩色 Emoji
5. `room.js` 二维码读取路径与 request 封装不一致
6. `RoomTimeoutTask` 自动结算需兼容自由流转 events
7. `getRoomInsight` 成员密度计算逻辑有误

---

_下次检查时间：待设定 cron_
