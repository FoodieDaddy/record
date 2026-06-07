# 技术债

这些不是架构原则，而是下一轮优化必须优先排查的已知问题。修复前不要在文档、提交说明或页面中写成已完成。

- [ ] `miniprogram/pages/room/room.wxml` 根节点仍需确认是否已绑定 `reduce-motion`。
- [ ] `miniprogram/pages/voice-select/voice-select.wxml` 页面根节点需确认是否已绑定全局动效静默类。
- [ ] `miniprogram/utils/score-ws.js` 若 `DEBUG_WS = true`，必须关闭，且不得打印带 token 的完整连接 URL。
- [ ] `backend/src/main/resources/voices.json` 分类 icon 若仍使用原生彩色 Emoji，必须替换为线框图标或纯文本代码。
- [ ] `miniprogram/pages/room/room.js` 获取二维码时需确认是否仍按 `resp.data.qrCodeUrl` 读取，避免和当前 request 封装返回形态不一致。
- [ ] `backend/src/main/java/com/smartrecord/task/RoomTimeoutTask.java` 自动封存检查不能只看 `batches`，必须兼容自由流转 `events`。
- [ ] `ScoreServiceImpl.getRoomInsight` 不应直接用包含 owner/status 等字段的 meta `HLEN` 作为成员密度。
- [ ] 策略页需持续巡检是否仍有 `LOW-NOISE`、`LLM`、`THE CALIBRATOR`、`盈利` 等用户可见穿帮词。
- [ ] 分享海报需确认不是结果页缩略截图，而是独立排版且文字清晰可读。
