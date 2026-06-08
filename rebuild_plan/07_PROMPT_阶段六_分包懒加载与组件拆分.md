# Phase 6 Prompt：分包、懒加载与组件拆分

## 角色

你是微信小程序架构优化工程师。请将当前主包过重、页面职责过载的问题拆解成分包和组件化结构，目标是降低冷启动和首屏压力。

## 阶段目标

1. 建立合理分包结构。
2. 将非首屏、低频、重页面迁出主包。
3. 将 `room` 页面拆成容器 + 子组件。
4. 图表、海报、镜像卡、历史归档按需加载。
5. 保证页面跳转、分享、回退路径正常。

## 当前问题

`app.json` 中所有页面都在主包，导致：

- 冷启动下载成本高。
- 首次进入非核心功能时没有懒加载边界。
- room 页和图表/海报/镜像等重功能互相拖累。

## 建议分包结构

请根据实际目录调整，但原则如下：

```json
{
  "pages": [
    "pages/login/login",
    "pages/room/room",
    "pages/profile/profile"
  ],
  "subpackages": [
    {
      "root": "pkg-fortune",
      "pages": [
        "index/index"
      ]
    },
    {
      "root": "pkg-mirror",
      "pages": [
        "index/index"
      ]
    },
    {
      "root": "pkg-history",
      "pages": [
        "settle/settle",
        "score-records/score-records",
        "level-archive/level-archive"
      ]
    },
    {
      "root": "pkg-voice",
      "pages": [
        "voice-select/voice-select"
      ]
    }
  ]
}
```

## 任务一：主包瘦身

主包只保留：

- 登录页
- 驾驶舱 room 页
- 身份页 profile
- tabBar
- 基础组件：avatar、toast、empty、haptic、motion tokens
- request/ws/service 基础能力

迁出主包：

- fortune 指令页
- mirror 镜像页
- settle 结算页
- score-records 历史页
- level-archive 档案页
- voice-select 音色选择页
- 海报/镜像卡 Canvas 生成能力
- 大图表组件

## 任务二：路径迁移与跳转修复

迁移后检查：

- `wx.navigateTo` 路径是否更新。
- `redirectTo` / `switchTab` 是否仍合法。
- tabBar 页面不能放在分包中。
- 分享路径是否仍能打开正确页面。
- 页面入参是否完整。

示例：

```js
wx.navigateTo({
  url: `/pkg-history/score-records/score-records?roomId=${roomId}`
});
```

## 任务三：room 页组件拆分

目标结构：

```text
pages/room/
├── room.js
├── room.wxml
├── room.wxss
└── components/
    ├── cockpit-stage/
    ├── pulse-panel/
    ├── member-grid/
    ├── room-overlays/
    ├── motion-layer/
    └── room-status-bar/
```

职责说明：

### `room.js`

只负责：

- 页面生命周期
- room store 初始化
- service 调用
- ws 连接
- 顶层事件协调

### `cockpit-stage`

负责：

- 驾驶舱主视图
- 成员座位布局
- 在线状态展示
- 成员点击事件

### `pulse-panel`

负责：

- 金额输入
- 推荐金额
- 确认/取消
- 输入校验

### `motion-layer`

负责：

- 飞线动画
- impact 动画
- 不持有业务数据，只消费动画 payload

### `room-overlays`

负责：

- 分享
- 封存确认
- 加入房间
- 结算入口
- 数值总览挂载

## 任务四：懒加载组件

低频组件必须 `wx:if` 按需加载：

```xml
<matrix-overview
  wx:if="{{matrixVisible}}"
  room-id="{{roomId}}"
  members="{{members}}"
  relation-map="{{relationMap}}"
  bind:close="onMatrixClose"
/>
```

不要在页面初始化时加载重图表。

## 任务五：样式拆分

将 `room.wxss` 拆分或重组：

```text
styles/
├── tokens.wxss
├── motion.wxss
├── overlays.wxss
└── cockpit.wxss
```

或者在组件内各自维护样式，避免一个页面 WXSS 超大。

## 输出格式

```md
# Phase 6 分包与组件拆分完成报告

## app.json 分包变化

## 页面路径迁移清单

## room 组件拆分说明

## 主包瘦身结果

## 跳转与分享测试结果

## 风险与回滚
```

## 验收标准

- 主包页面数量明显减少。
- 分包页面可正常打开、分享、回退。
- room 页主文件复杂度下降。
- 数值总览、图表、历史、镜像、指令等非首屏功能按需加载。
- 真机冷启动体感改善。
