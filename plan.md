# 计划

## 当前理解

- 当前工作区不是干净状态，已有大量前端、后端和文档改动；下一步应先收口这些改动，不宜继续开启大功能。
- 后端已通过 `JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn -q -DskipTests compile` 编译验证。
- 当前代码已经覆盖多项旧技术债：空间页和音色页根节点已接入 `reduce-motion`，`score-ws.js` 已关闭 `DEBUG_WS` 并改用 `Sec-WebSocket-Protocol` 传 token，二维码读取已兼容多种返回结构，超时任务已同时检查 `events` 与 `batches`，`ScoreServiceImpl.getRoomInsight` 已不再使用 meta `HLEN` 作为密度。
- 策略页、镜像页、身份页和黑匣子回放已有明显体验重构，但还缺一轮端到端验收、文案巡检和技术债状态校准。

## 下一轮目标

先完成「当前大批改动的稳定化验收」，再做小范围修补：

```text
编译与接口兼容 -> 技术债勾销 -> 前端可见文案收口 -> 小程序端视觉/交互验收 -> 文档同步
```

## 执行顺序

### 1. 后端数据闭环验收

- 验证封存后 `room_member.final_score` 与 `quit_time` 保留，已结束空间再次退出不会删除历史成员记录。
- 验证封存后会异步重算身份等级，并清理 `sr:mirror:stats:{uid}` 与 `sr:fortune:{uid}:{date}`。
- 验证 `/score/trend`、`/score/yield-log`、`/room/history` 对同一封存空间返回口径一致。
- 验证 `YieldLogResp` 新结构 `myRank/memberCount` 与前端 `score-records`、身份页黑匣子摘要兼容。

### 2. 技术债状态校准

- 将已确认完成的技术债从 `docs/TECH_DEBT.md` 勾选或改写为验收项。
- 对仍需巡检的项目保留未完成状态，尤其是策略页用户可见穿帮词、分享海报清晰度和文案 sanitize。
- 记录验证证据：涉及文件、检查命令、是否需要真机或微信开发者工具确认。

### 3. 文案和世界观收口

- 把 `miniprogram/utils/domain-display.js` 中 `HIGH_RISK -> 高风险` 改为「偏高」。
- 将镜像页用户可见「风险」标签收敛为「安全边界」或「边界」。
- 将登录页「策略终端 / 策略模块」等旧表达收敛到「航行核心 / 指令投影」体系；底部 Tab 仍可保留「策略」。
- 巡检分享标题、Canvas 海报、Toast、弹窗正文，确保不漏出 `LLM`、`fallback`、`LOW-NOISE`、`HIGH_RISK` 等穿帮词。

### 4. 小程序端运行风险检查

- 重点检查 WXML 中的 `Math.min/Math.max` 表达式是否被微信小程序运行时支持；如果不支持，移到 JS 计算后再 `setData`。
- 检查所有新增页面是否已经在 `app.json` 注册且首屏黑底兜底完整，尤其是 `level-archive`。
- 检查 `transition: all`、持续动画、timer/interval/animation frame 清理情况，确保 reduce-motion 下没有长循环动画。
- 检查敏感日志：前端不得打印完整 WebSocket URL、JWT、微信 code、OSS 签名 query。

### 5. 微信开发者工具验收

- 空间链路：启动空间、接入空间、自由流转记录、封存航程、查看航程档案。
- 策略链路：点火航行核心、等待 heartbeat、8-10 秒超时兜底、重新点火回到待机页、分享指令卡。
- 镜像链路：人格协议校准、样本不足态、五维扫描、镜像卡生成和保存。
- 身份链路：舰员代号抽屉、头盔识别上传、装备协议开关、黑匣子摘要、身份档案页。
- 关闭动效后复测以上核心链路，确认没有持续扫描、旋转、粒子或长链动画。

### 6. 文档同步

- 更新 `docs/TECH_DEBT.md` 的 checklist 状态。
- 更新 `docs/DEVELOPMENT_LOG.md`，记录本轮验收、修补文件、验证结果和剩余风险。
- 如接口返回结构继续变化，补充 `docs/API.md` 或在 `docs/ARCHITECTURE.md` 中记录临时契约。
- 保持所有 Markdown 文档中文书写。

## 本轮不做

- 不继续扩大 UI 重构范围。
- 不宣称 MySQL 热路径已完全收敛。
- 不新增高频轮询、无差别广播或运行期大对象反复序列化。
- 不把策略/镜像内容改成预测、收益承诺或娱乐化测试。

## 后续事项

- 确认此前删除的小写 `plan.md`、`changelog.md` 和 `codex-changelog.md` 是否应由 `PLAN.md` 与 `CHANGELOG.md` 替代。
- 当接口契约需要稳定文档承载时，补充 `docs/API.md`。
