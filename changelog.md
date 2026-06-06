# Smart Record 第 2 轮迭代 Changelog

生成时间：2026-06-06 19:26 CST
前置快照：`fbeae95 test: 第2轮迭代前置快照 [2026-06-06 18:47]`

## 改动文件清单

| 文件 | 改动类型 | Before | After |
|---|---|---|---|
| `miniprogram/pages/room/room.wxml` | Bug 修复 | 分数显示 `++7`（WXML 额外拼接 `+`） | 统一由 `fmt.formatScore` 负责符号，显示 `+7` |
| `miniprogram/pages/room/room.wxs` | Bug 修复 | `formatScore` 返回 `(score>0?'+':'')+score` 导致双重 `+`；无 null/NaN 防御 | 统一 `sign + abs`；新增 null/NaN/Infinity 防御；`formatAmount` 同步加固 |
| `miniprogram/pages/fortune/fortune.wxml` | 风格重构 | 卡牌隐喻：`mission-stage`、`strategy-core`、`card-inner`、`card-ring`、`card-dot`、`gen-card-area`、`gen-card` | 飞控核心：`core-stage`、`avionics-core`、`core-inner`、`core-ring`、`core-dot`、`gen-core-area`、`gen-core` |
| `miniprogram/pages/fortune/fortune.wxss` | 风格重构 | `.strategy-core`、`.card-*`、`.gen-card*`、`cardEntrance`、`cardBreathe` 动画名 | `.avionics-core`、`.core-*`、`.gen-core*`、`coreEntrance`、`coreBreath` 动画名 |
| `miniprogram/pages/voice-select/voice-select.js` | Bug 修复 + 动效守卫 | 全局 `const audioCtx` 不可重建；`setTimeout` 无保存、无清理；reduce-motion 下仍播放滑入/返回动画 | `let audioCtx` 可重建；保存 `_sheetTimer/_backTimer/_confirmTimer` 并在 `onUnload` 清理；reduce-motion 下直接展示/返回 |
| `miniprogram/utils/score-ws.js` | 安全加固 | token 通过 URL query 传输：`wsUrl?roomId=X&token=TOKEN` | token 通过 `Sec-WebSocket-Protocol: access_token.<jwt>` 头传输，URL 不含 token |
| `backend/src/main/java/com/smartrecord/config/WebSocketConfig.java` | 回归修复 | Spring 未回选小程序请求的 `access_token.<jwt>` 子协议，DevTools 会判定 WS 握手失败 | 自定义握手选择器回选 `access_token.*` 子协议，保留旧 query token 降级兼容 |
| `plan.md` | 文档更新 | 第 4 轮迭代计划 | 第 2 轮全量测试与优化计划（4 Agent 并行方案） |

## 测试结果

### 基础设施

- [x] Docker 容器健康（sr-mysql:13306, sr-redis:16379）
- [x] 后端编译通过（`mvn compile -q`，Java 21）
- [x] API 可访问（`/api/fortune/today` HTTP 200）
- [x] WebSocket protocol 鉴权建连通过（后端日志出现 `WebSocket 连接建立`，URL 不含 token）

### API 矩阵

- failureCount: **0**
- 覆盖场景: 1-12 人全部通过、16 人上限通过、17 人返回 4003、重复加入返回 4009
- 运行 ID: `1780745145962`
- 结果文件: `/tmp/smart-record-round2-matrix.json`

| 场景 | 状态 | 排行榜总和 | 图表 series | 洞察流转数 | 网络节点 | 封存成员 |
|---|---|---|---|---|---|---|
| 1 人 | PASSED | 0 | 0 | 0 | 1 | 1 |
| 2 人 | PASSED | 0 | 2 | 2 | 2 | 2 |
| 3 人 | PASSED | 0 | 3 | 3 | 3 | 3 |
| 4 人 | PASSED | 0 | 4 | 4 | 4 | 4 |
| 5 人 | PASSED | 0 | 5 | 5 | 5 | 5 |
| 6 人 | PASSED | 0 | 6 | 6 | 6 | 6 |
| 7 人 | PASSED | 0 | 7 | 7 | 7 | 7 |
| 8 人 | PASSED | 0 | 8 | 8 | 8 | 8 |
| 9 人 | PASSED | 0 | 9 | 9 | 9 | 9 |
| 10 人 | PASSED | 0 | 10 | 10 | 10 | 10 |
| 11 人 | PASSED | 0 | 11 | 11 | 11 | 11 |
| 12 人 | PASSED | 0 | 12 | 12 | 12 | 12 |
| 16 人上限 | PASSED | - | - | - | 16 | 16 |
| 17 人超限 | 4003 | - | - | - | - | - |
| 重复加入 | 4009 | - | - | - | - | - |

### 数据一致性

- [x] ranking 总和为 0（1-12 人全部验证）
- [x] 封存后 transfer 拒绝（code=400）
- [x] 非成员权限拒绝（code=400）
- [x] 16 人上限通过、17 人返回 4003
- [x] 重复加入返回 4009

### 问题修复验证

| ID | 问题 | 修复前 | 修复后 | 状态 |
|---|---|---|---|---|
| R2-01 | 分数显示 `++7` | `room.wxml` 额外拼接 `+`，`room.wxs` 未统一 | `formatScore` 统一负责符号，WXML 移除额外 `+` | 已修复 |
| R2-03 | 策略页卡牌隐喻 | `card-inner`、`card-ring`、`strategy-core`、`gen-card` | `core-inner`、`core-ring`、`avionics-core`、`gen-core` | 已修复 |
| R2-04 | WS token 在 URL 中暴露 | `wsUrl?roomId=X&token=TOKEN` | 前端改 protocol；后端回选 `access_token.*` 子协议，DevTools 建连成功 | 已修复 |
| R2-05 | 音色页 timer 未清理、reduce-motion 未守卫 | 固定 `setTimeout`，全局 `const audioCtx` | 保存 timer 引用并清理，reduce-motion 直接展示/返回，audioCtx 可重建 | 已修复 |

## 未解决问题清单

| ID | 问题 | 优先级 | 状态 |
|---|---|---|---|
| R2-02 | DevTools 多账号调试工具限制只能选 4 个测试号，6 人 UI 联调无法自动确认 | P0 | 待人工确认：需第二台设备/真机/工具突破限制 |
| R2-06 | 音色抽屉试听/选择回写完整链路未在本轮 UI 取证中覆盖 | P2 | 待人工确认：需在 DevTools 中完整测试试听 -> 选择 -> 保存 -> Storage/API 回写 |
| R2-07 | Canvas/timer 在 reduce-motion 切换后的 onHide/onUnload 清理需逐项验证 | P2 | 待人工确认：需关闭动效后巡检镜像/记录页 |
| R2-08 | DevTools Console 基础库灰度、合法域名警告、WAServiceMainContext timeout | P2 | 工具噪声，非应用错误 |
