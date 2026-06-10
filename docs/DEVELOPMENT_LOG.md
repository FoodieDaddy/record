# 开发日志

## 2026-06-09 — room.js 全量迁移到 services 层（rebuild_plan Phase 5 收尾）

### 变更原因

- `room.js` 有 25+ 处直接 `get`/`post`/`del` 调用，未使用 Phase 5 创建的 services 层。
- rebuild_plan 要求全量迁移到 service 层，统一 API 调用入口。

### 变更文件

新建：
- `miniprogram/services/round-service.js` — 封装 5 个轮次 API（startRound/submitRoundScores/confirmRound/cancelRound/getPendingRound）

修改：
- `miniprogram/pages/room/room.js` — 25+ 处直接 API 调用替换为 `roomService`/`scoreService`/`roundService` 方法，移除 `get`/`post`/`del` 直接导入

### 实现方式

- 创建 `round-service.js` 补充轮次 API 封装。
- 逐一替换：`get('/room/my')` → `roomService.getMyRooms()`、`post('/score/transfer', ...)` → `scoreService.transferScore(...)` 等。
- 移除 `const { get, post, del } = require('../../utils/request')` 导入。

### 验证

- `node --check miniprogram/pages/room/room.js` 通过。
- grep 确认无残留直接 API 调用（除 `Map.get()` 等非 API 用途）。

## 2026-06-09 — Phase 6 子包拆分（rebuild_plan Batch C）

### 变更原因

- rebuild_plan Phase 6 要求将非 tabBar 页面拆入子包，减少主包体积。
- 主包原有 10 页，tabBar 4 页 + login 1 页必须留在主包，其余 5 页迁入子包。

### 变更文件

新建目录：
- `miniprogram/pages-ext/` — 子包根目录

迁移：
- `pages/settings/` → `pages-ext/settings/`
- `pages/voice-select/` → `pages-ext/voice-select/`
- `pages/settle/` → `pages-ext/settle/`
- `pages/score-records/` → `pages-ext/score-records/`
- `pages/level-archive/` → `pages-ext/level-archive/`

修改：
- `miniprogram/app.json` — 新增 `subpackages` 配置，主包 pages 收敛为 5 页
- `miniprogram/pages/profile/profile.js` — level-archive 导航路径更新
- `miniprogram/pages/mirror/index.js` — score-records 导航路径更新
- `miniprogram/pages-ext/score-records/score-records.js` — settle 导航路径更新

### 实现方式

- 子包 root 为 `pages-ext`，页面路径为 `settings/settings` 等（相对子包 root）。
- 导航 URL 从 `/pages/settle/settle` 改为 `/pages-ext/settle/settle`。
- 子包页面的 `require('../../utils/...')` 路径无需修改（相对路径仍指向 `miniprogram/utils/`）。
- settle 页面的组件引用使用绝对路径（`/components/battle-summary/battle-summary`），无需修改。

### 验证

- `node --check` 所有修改的 JS 文件通过。
- grep 确认无残留旧路径引用。
- 目录结构验证：主包 5 页、子包 5 页。

### 后续事项

- 微信开发者工具编译验证子包加载。

## 2026-06-10 — 驾驶舱 active 态 AR 悬浮按钮与脉冲写入面板重构

### 变更原因

- HUD 下方「信标 / 航迹」按钮像普通网页卡片，太方、太厚、太实，不像驾驶舱 AR 悬浮操作面板。
- 点击外部航船弹出的脉冲流向数字输入面板存在右侧裁剪、宽度超出安全区域、遮罩过暗、不像悬浮 AR 面板等问题。

### 变更文件

WXML（1 个文件）：

- `miniprogram/pages/room/room.wxml` — 将 `cockpit-button-deck` / `cockpit-3d-key` 实体按键区替换为 `ar-action-row` / `ar-action-pad` AR 悬浮操作面板（纯 CSS 图标、中文主文案、英文弱装饰、能量线、状态点）；脉冲面板 `pulse-vr-cluster` 新增扫描线和四角 HUD 装饰。

WXSS（2 个文件）：

- `miniprogram/pages/room/styles/08-cockpit-active-v2.wxss` — 移除 `.cockpit-button-deck` / `.cockpit-3d-key` 及所有子样式（key-face/key-main/key-sub/key-depth），新增 `.ar-action-row` / `.ar-action-pad` 全息悬浮操作面板样式（半透明底、青蓝切角描边、顶部扫描线、底部能量线、纯 CSS 信标/航迹图标、选中蓝色能量线反馈、reduce-motion 兜底）。
- `miniprogram/pages/room/styles/04-pulse-recorder.wxss` — 背景遮罩从全屏死黑改为局部径向暗化（透明度 0.42），`.pulse-vr-cluster` 改为深黑蓝半透明 AR 面板（`calc(100vw - 96rpx)` 宽 / 最大 620rpx、青蓝细描边、切角、扫描线、四角装饰），底部间距改为 `calc(170rpx + env(safe-area-inset-bottom))`；网格从固定 520rpx 改为 100% 宽，按键间隙缩小至 12rpx；关闭按钮和发射按钮视觉微调；reduce-motion 规则更新。

JS（2 个文件）：

- `miniprogram/pages/room/room.js` — `onTapMember` 移除 `loadTransferAmountSuggestions` 调用、新增 `isInputOpen: true`。
- `miniprogram/pages/room/pulse-handler.js` — `openTransferPad` 移除 `loadTransferAmountSuggestions` 调用。

### 关键变化

| 项目 | 旧 | 新 |
|---|---|---|
| 信标/航迹按钮 | `cockpit-button-deck` + `cockpit-3d-key` 实体按键（凹槽 + 按键面 + 厚度边） | `ar-action-row` + `ar-action-pad` AR 悬浮面板（半透明底、纯 CSS 图标、能量线） |
| 脉冲面板宽度 | 固定 520rpx | `calc(100vw - 96rpx)` / max 620rpx |
| 脉冲面板背景 | `rgba(2,14,26,0.12)` 极弱透明 | `rgba(3,12,24,0.74)` + 青蓝描边 + 切角 |
| 遮罩透明度 | `rgba(0,0,0,0.24)` 全屏均匀 | 径向暗化 0.42 + 面板周围局部渐变 |
| 面板底部间距 | `calc(210rpx + ...)` | `calc(170rpx + ...)` |
| 推荐数值加载 | openTransferPad/onTapMember 调用 API | 已移除调用 |
| 网格间距 | 18rpx | 12rpx |

### 验收状态

- `node --check` 三文件（room.js / room-view-model.js / pulse-handler.js）通过。
- `grep` 禁词扫描：命中均为注释、代码内部字段或 sanitize 映射，运行时用户可见内容未发现禁词。
- `grep` 动效扫描：未发现 `transition: all` / `setInterval` / `requestAnimationFrame` 新增。
- 代码侧已调整，真机待复核。

### 后续事项

- 微信开发者工具编译验证。
- 真机验证：AR 按钮悬浮感、脉冲面板完整显示（1-9/×/0/发射按钮不被裁剪）、遮罩透明度、底部 Dock 不遮挡、小屏机型不溢出。
- reduce-motion 下复测。
