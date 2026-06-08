# 技术债

这些不是架构原则，而是下一轮优化必须优先排查的已知问题。修复前不要在文档、提交说明或页面中写成已完成。

- [x] `miniprogram/pages/room/room.wxml` 根节点已绑定 `reduce-motion`（第 3 行）。
- [x] `miniprogram/pages/voice-select/voice-select.wxml` 根节点已绑定全局动效静默类（第 1 行）。
- [x] `miniprogram/utils/score-ws.js` 的 `DEBUG_WS` 已关闭（第 10 行，值为 `false`），且 token 通过 `Sec-WebSocket-Protocol` 传递，不在 URL 中。
- [x] `backend/src/main/resources/voices.json` 分类 icon 已使用文本代码（`F`、`M`、`FX`），无原生彩色 Emoji。
- [x] `miniprogram/pages/room/room.js` 二维码读取已兼容多种返回结构（第 1640-1642 行，同时支持 `resp.qrCodeUrl` 和 `resp.data.qrCodeUrl`）。
- [x] `backend/src/main/java/com/smartrecord/task/RoomTimeoutTask.java` 自动封存检查已同时识别 `events` 与 `batches`（第 65-79 行）。
- [x] `ScoreServiceImpl.getRoomInsight` 已不使用 meta `HLEN` 作为成员密度，改为基于事件参与用户数计算（第 926-928 行）。
- [x] `miniprogram/utils/domain-display.js` 中 `HIGH_RISK` 映射已从「高风险」修正为「偏高」。
- [x] `miniprogram/pages/login/login.wxml` 中「策略终端」「策略模块」已修正为「航行核心」「指令投影」。
- [x] `miniprogram/pages/mirror/index.wxml` 中用户可见「风险」标签已修正为「边界」。
- [x] `miniprogram/pages/profile/profile.wxml` 中 `Math.min` 已移至 JS 计算，通过 `setData` 输出预计算值。
- [x] 策略页穿帮词验收：代码级审查通过。`fortune.js` 中 `STRATEGY_TEXT_REPLACEMENTS` 覆盖全部禁词，所有用户可见字段均经过 `sanitizeStrategyText()` 处理，HUD 芯片标签有专用映射函数。运行时渲染仍建议人工抽检。
- [x] 分享海报验收：策略页和镜像页 Canvas 海报均为独立排版（非页面截图），文字经过 sanitize，深色背景无白底，分享/保存按钮使用蓝/青色。运行时渲染仍建议人工抽检。
