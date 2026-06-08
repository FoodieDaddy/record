# 总览 Plan：问题地图与修复原则

## 给代码智能体的角色设定

你是一个熟悉微信小程序、Spring Boot、WebSocket、真机性能调优和移动端动画优化的高级工程师。请基于现有项目代码进行系统性修复，不要只输出建议，必须实际修改代码，并给出每一步改动说明。

## 项目当前核心问题

### 前端问题地图

重点页面是 `pages/room/room`。该页面承担了过多职责：

- 房间创建、加入、成员管理
- 实时积分/脉冲记录
- 飞线动画、粒子动画、数字滚动动画
- 数值总览、关系图、结算入口
- 分享弹层、封存弹层、输入弹层、结算浮层
- WebSocket 消息处理和 HTTP 数据刷新

已知问题：

- `room.js` 体积过大，`setData` 过多。
- `room.wxss` 特效过多，包含大量 animation、keyframes、box-shadow、clip-path、backdrop-filter、fixed overlay。
- 脉冲飞线和数字滚动疑似使用 `setTimeout(16ms) + setData` 模拟逐帧动画。
- WebSocket 消息触发后容易重复 `buildMemberGrid`、重复刷新 ranking、records、roomInfo。
- `matrix-overview` 打开时触发图表请求和关系计算，导致弹层打开不顺滑。
- `profile.js` 音频上下文生命周期存在风险：destroy 后二次进入无可靠重建路径。
- 所有页面都在主包中，缺少分包和懒加载策略。

### 后端问题地图

后端架构大体可用，但安全边界和可观测性不足：

- WebSocket 握手只校验 token，没有校验 userId 是否属于 roomId。
- 房间读接口缺少统一成员鉴权。
- `/storage/presign` 若未鉴权，会导致上传凭证滥用风险。
- `setAllowedOrigins("*")` 风险过大。
- 可能存在 `getMyRooms → getRoomDetail` 风格 N+1 查询。
- 敏感配置、服务器地址、SSH 路径、OSS/LLM/微信配置不应留在仓库。
- 缺少 requestId、duration、错误码、WS 在线数、Redis 命中率等监控。

## 总体修复策略

### 第一原则：先止血，再重构

不要第一步就做大规模 UI 重设计。先让真机顺滑、接口安全、状态不乱，再进入结构拆分和世界观统一。

### 第二原则：状态变化交给 JS，像素运动交给 CSS / 渲染层

禁止继续用 `setTimeout(16ms)`、`setInterval(16ms)` 或递归 `setData` 做逐帧动画。

正确方向：

- JS 只计算一次起点、终点、位移、class 状态。
- CSS 使用 `transform: translate3d()` 和 `opacity` 完成运动。
- 动画结束用 `bindanimationend` 收尾。
- 必要时再评估 Skyline / Worklet / Lottie，但不作为第一阶段依赖。

### 第三原则：WS 增量优先，HTTP 快照兜底

房间页的数据权威来源要清晰：

1. WebSocket 增量消息：用于实时同步。
2. 本地派生状态：用于渲染 `memberGrid`、`ranking`、`relationMap`。
3. HTTP 快照：只用于进入页面、重连后、用户手动刷新、疑似状态不一致时兜底。

### 第四原则：世界观保留，但视觉成本降级

当前“终端 / 驾驶舱 / 脉冲 / 镜像 / 指令 / 航迹”的世界观可以保留，但不能让每个区域都常驻发光、扫线、模糊、粒子、呼吸动画。

世界观应该放在：

- 页面命名
- 模块结构
- 状态文案
- 关键反馈点
- 少量高价值动画

不要放在：

- 所有卡片的常驻动画
- 所有按钮的持续呼吸
- 所有背景的多层 fixed 特效
- 大面积 blur/backdrop-filter

## 分阶段目标

### Phase 1：基线审计与安全止血

输出：问题清单、敏感配置清理、后端权限守卫、基础性能埋点。

### Phase 2：room 页性能止血

输出：减少 `setData`、卸载 overlay、去除常驻高耗动画、合并重复刷新。

### Phase 3：动画系统重写

输出：飞线、数字变更、按钮反馈、入场/离场动画重写为 CSS transform/opacity 模式。

### Phase 4：状态管理与 WebSocket 治理

输出：统一 room store、WS 心跳重连、增量 patch、HTTP snapshot 兜底。

### Phase 5：接口层与后端鉴权重构

输出：request 层去重/abort/trace，后端房间读权限、WS room 鉴权、预签名鉴权。

### Phase 6：分包、懒加载与组件拆分

输出：主包瘦身、子包迁移、room 页面组件化、低频组件按需加载。

### Phase 7：matrix-overview 与图表优化

输出：关系数据预聚合、图表懒初始化、弹层打开不触发重计算。

### Phase 8：profile 音频、Canvas 与资源治理

输出：音频上下文修复、Canvas 延迟执行、图片/头像/海报资源缓存治理。

### Phase 9：世界观功能框架统一

输出：模块命名、状态文案、视觉层级、动效预算、设计 token。

### Phase 10：测试验收与灰度发布

输出：真机回归、性能指标、接口安全测试、回滚开关、发布清单。
