# 微信小程序整体修复 Prompt 工具包

本工具包基于前面几份研究报告整理而成，目标是把“问题分析”转化为可以直接交给 Claude Code、OpenClaw、Codex 或其他代码智能体执行的分阶段工程 Prompt。

## 使用方式

建议按文件编号顺序执行，不要一次性把所有 Prompt 丢给代码智能体。每个阶段完成后，必须先做真机回归，再进入下一阶段。

推荐执行顺序：

1. `01_PLAN_总览_问题地图与修复原则.md`
2. `02_PROMPT_阶段一_基线审计与安全止血.md`
3. `03_PROMPT_阶段二_room页性能止血.md`
4. `04_PROMPT_阶段三_动画系统重写.md`
5. `05_PROMPT_阶段四_状态管理与WebSocket治理.md`
6. `06_PROMPT_阶段五_接口层与后端鉴权重构.md`
7. `07_PROMPT_阶段六_分包懒加载与组件拆分.md`
8. `08_PROMPT_阶段七_matrix_overview与图表优化.md`
9. `09_PROMPT_阶段八_profile音频Canvas与资源治理.md`
10. `10_PROMPT_阶段九_世界观功能框架统一.md`
11. `11_PROMPT_阶段十_测试验收与灰度发布.md`
12. `12_CODE_SNIPPETS_可复用补丁片段.md`
13. `13_ACCEPTANCE_CHECKLIST_最终验收清单.md`

## 总体判断

当前项目不是单点 bug，而是页面复杂度、动画实现方式、状态刷新模型、接口权限边界、资源管理共同叠加的问题。

最关键的修复优先级：

1. 先处理 `pages/room/room`：减少高频 `setData`、拆掉 JS 逐帧动画、卸载隐藏 overlay、压缩常驻特效。
2. 再处理 WebSocket 与 HTTP 数据链路：统一“WS 增量优先，HTTP 快照兜底”的状态模型。
3. 同步补后端安全边界：房间成员鉴权、WebSocket room 鉴权、`/storage/presign` 鉴权、敏感配置移出仓库。
4. 再做结构重构：分包、懒加载、组件拆分、图表预聚合。
5. 最后做世界观统一、性能监控、灰度和自动化回归。

## 面向代码智能体的通用约束

所有阶段都必须遵守以下约束：

- 不允许只改视觉，不改性能根因。
- 不允许继续新增 JS 逐帧 `setData` 动画。
- 不允许把隐藏弹层长期留在页面树里，只用 `hidden` 或 class 隐藏。
- 不允许在非成员用户可访问的接口上返回房间数据。
- 不允许把密钥、服务器地址、SSH 路径、OSS/LLM/微信平台配置提交到仓库。
- 每个阶段输出必须包含：改动文件列表、核心 diff 摘要、风险说明、真机测试步骤、回滚方案。

## 建议分支策略

```bash
git checkout -b fix/phase-01-baseline-security
git checkout -b fix/phase-02-room-performance
git checkout -b fix/phase-03-motion-system
git checkout -b fix/phase-04-state-ws
git checkout -b fix/phase-05-api-auth
git checkout -b refactor/phase-06-subpackage-components
git checkout -b refactor/phase-07-matrix-chart
git checkout -b refactor/phase-08-resource-governance
git checkout -b design/phase-09-worldview-framework
git checkout -b release/phase-10-acceptance-gray
```

## 固定真机回归链路

每个阶段结束后都按这个链路测一次：

登录 → 进入驾驶舱 → 创建编队 → 加入/进入房间 → 记录一次脉冲 → 连续记录 5 次脉冲 → 打开数值总览 → 关闭总览 → 切到指令页 → 触发一次生成 → 切到镜像页 → 打开身份页 → 试听音色 → 返回驾驶舱 → 后台/前台切换 → 弱网重连。
