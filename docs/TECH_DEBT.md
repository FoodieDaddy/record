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
- [x] 真机安全区第一轮修复：登录、编队、指令、全息舱、识别舱已完成代码侧底部安全区、弹层层级和抽屉遮挡修复。
- [x] `room.wxss` 已拆为 `pages/room/styles/*.wxss`，主文件仅保留同序 imports。
- [x] `room.js` 驾驶舱视图模型、presence 标签和格式化纯逻辑已抽到 `room-view-model.js`。
- [x] `dissolveRoom` 解散编队时未更新成员记录（quit_time/final_score），已修复并回填 17 条历史数据。
- [x] Redis key 过多（每房间 13 个、每用户 3 个），已整合为每房间 6 个、每用户 1 个。
- [ ] 真机安全区复测：需要用微信开发者工具或真机复核底部 Dock、Home Indicator、协议校准 20 题按钮、通讯音色抽屉和识别徽标微信授权入口。

## rebuild_plan 新增项

- [x] `room.js` 全量迁移到 services 层，25+ 处直接 API 调用已替换为 `roomService`/`scoreService`/`roundService` 方法。
- [x] room.js 粒子动画 `_runParticleWithRects` 已改为 CSS `@keyframes` 驱动，setData 从每帧 20+ 次降到 2 次。
- [ ] room.js 尚未继续拆分 controllers/components（WebSocket、创建/加入流程、pulse-recorder、blackbox-panel、settle-overlay），后续 Phase 待执行。
- [x] 子包拆分完成：主包保留 5 页（login/room/fortune/mirror/profile），子包 `pages-ext` 包含 5 页（settings/voice-select/settle/score-records/level-archive）。
- [ ] room-store.js 未创建，状态管理仍为扁平 data + 分散 setData（低优先级，当前方案可接受）。
- [x] `score-ws.js` 已新增 25s 心跳检测，40s 无消息自动重连。
- [ ] matrix-overview 组件可优化：关系预聚合、图表懒初始化（Phase 7 待执行）。
- [x] 后端已补充最小单元测试：SnowflakeIdGeneratorTest（5）、RoomServiceTest（2）、ScoreServiceTest（3），共 10 个测试全部通过。

## 生产就绪待补项

- [x] MySQL 5.7 升级到 8.0。
- [x] Spring Boot Actuator 健康检查端点。
- [x] Docker HEALTHCHECK 指令。
- [x] 优雅关闭配置。
- [x] HikariCP 连接池参数。
- [x] Redis Lettuce 连接池参数。
- [x] 生产环境 Swagger 禁用。
- [x] 生产环境 MyBatis SQL 日志关闭。
- [x] Spring Cloud Alibaba Sentinel 熔断接入。
- [x] P1：API 限流（Sentinel URL 规则或独立限流组件）。
- [x] P1：外部服务熔断规则细化（OSS、TTS 的 `@SentinelResource` 注解）。
- [x] P1：结构化 JSON 日志（logback-spring + JSON encoder）。
- [x] P2：Metrics / Prometheus 暴露。
- [x] P2：WebSocket 心跳 ping/pong 机制。
- [x] P2：数据库慢查询检测配置。
- [x] OpenTelemetry 链路追踪。
- [x] CORS 跨域配置。
- [x] Response Gzip 压缩。
- [x] Jackson 序列化优化。
- [x] 集成测试。
- [x] GitHub Actions CI/CD。
- [x] Docker 镜像加固（非 root 用户）。
