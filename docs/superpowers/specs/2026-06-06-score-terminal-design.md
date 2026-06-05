# Score Terminal — 房间页赛博终端重构设计

**日期**: 2026-06-06
**状态**: 已批准
**分阶段**: Phase 1（前端重构）+ Phase 2（新功能 + 后端）

---

## 目标

将房间页从「记分工具」升级为「积分流转终端（Score Terminal）」，与策略灵感页、人格终端页、身份终端页保持统一的赛博终端视觉风格。

**关键词**: 赛博、终端、数据流、实时同步、战局控制台

**禁止**: 大面积灰卡片、普通列表、普通弹窗、传统后台 UI

---

## Phase 1 — 前端视觉重构

### 模块 1：ROOM TERMINAL（顶部终端栏）

**替换**: 当前 `glass-card-glow room-top-card`（房间号大卡片 + 右侧圆形按钮）

**新布局**: 横向 HUD 栏，高度 ~110rpx

```
┌─────────────────────────────────────────────┐
│ ROOM TERMINAL                    ● ONLINE   │
│ HGEWRT  2/8  自由流转          [复制][邀请]  │
└─────────────────────────────────────────────┘
```

- 左上角: `ROOM TERMINAL` 英文 kicker（`rgba(10,132,255,0.72)`，18rpx，`letter-spacing: 4rpx`）
- 左下: 房间号（等宽字体，蓝色 `#0A84FF`）+ 成员数 + 模式标签（小胶囊）
- 右上: 绿色状态点 `#30D158` + `ONLINE` 文字
- 右下: 复制/邀请按钮（线框图标，复用现有 `icon-clip`/`icon-share`）
- 卡片样式: `border: 1rpx solid rgba(10,132,255,0.18)`，`background: rgba(255,255,255,0.035)`，顶部微弱发光线
- 不再使用 `glass-card-glow` 和 `hero-glow`

**退出按钮**: 从顶部栏移除，保留现有 `quitRoom` 逻辑，移至结算确认弹层的底部操作区（与「结算」按钮并列）。在非结算状态下，通过页面底部悬浮的「退出房间」次级按钮触发。

### 模块 2：PLAYER NETWORK（成员网络）

**替换**: 当前 `glass-card member-section`（4 列网格）

**新布局**: 保持 4 列网格，每个 cell 改为「终端玩家卡」风格

```
┌──────────────────────────┐
│ PLAYER NETWORK  成员网络  │
│                  2 / 8   │
├──────────────────────────┤
│  [头像]                  │
│  专业发牌员               │
│  -143                    │
│──────────────────────────│
│  [头像]                  │
│  先天话痨                 │
│  +143                    │
└──────────────────────────┘
```

**积分颜色规则**:
- 正数: `#36FF74`
- 负数: `#FF5A5A`
- 零分: `#9CA3AF`

**选中效果**: 圆形扫描环（替代矩形描边）
- 使用 `::after` 伪元素，`border-radius: 50%`，蓝色脉冲动画
- 头像区域外扩 6rpx，`border: 2rpx solid rgba(10,132,255,0.6)`
- `box-shadow: 0 0 16rpx rgba(10,132,255,0.4)`
- 动画: `@keyframes scanPulse` 从 opacity 0.4 → 1 循环

**卡片背景**: `rgba(255,255,255,0.02)`，`border: 1rpx solid rgba(255,255,255,0.06)`

**节标题双层**: 中文「成员网络」+ 英文 `PLAYER NETWORK`（复用 `.cyber-section-title` 模式）

### 模块 3：TRANSFER TERMINAL（流转终端 / 数字键盘）

**替换**: 当前 `numpad-overlay`（普通计算器风格）

**新设计**: 机械终端风

```
┌─────────────────────────────────────┐
│        TRANSFER TERMINAL            │
│                                     │
│   专业发牌员  →  先天话痨            │
│                                     │
│          +66                        │
│        积分                         │
│                                     │
│   [1]  [2]  [3]                    │
│   [4]  [5]  [6]                    │
│   [7]  [8]  [9]                    │
│   [C]  [0]  [⌫]                    │
│                                     │
│   ┌─────────────────────────────┐  │
│   │     确认流转                 │  │
│   └─────────────────────────────┘  │
└─────────────────────────────────────┘
```

**关键改动**:
- 顶部标题: `TRANSFER TERMINAL` 英文 kicker
- 转账方向行: 显示 `A 头像 A昵称  →  B头像 B昵称`
- 数字键盘按钮: 增大间距（gap 从 12rpx → 16rpx），`border: 1rpx solid rgba(255,255,255,0.08)`，`background: rgba(255,255,255,0.04)`
- 确认按钮: 蓝色能量按钮（渐变背景 `linear-gradient(135deg, rgba(0,191,255,0.12), rgba(0,120,255,0.06))` + 微发光 + 切角 `clip-path`）
- **实时预览**（新增功能）: 输入数字时，底部显示 A 的新分数 → B 的新分数
  - `fromNewScore = fromCurrentScore - numpadValue`
  - `toNewScore = toCurrentScore + numpadValue`
  - 使用 `observer` 监听 `numpadValue` 变化触发计算

### 模块 4：FLOW LOG（积分流）

**替换**: 当前 `score-record-card`（时间头 + 三列 from|amount→|to 布局）

**新布局**: 时间轴风格

```
┌──────────────────────────────────────┐
│ FLOW LOG  积分流            [我][总览] │
├──────────────────────────────────────┤
│ 02:04                                │
│ ● 专业发牌员  ── 88 ──→  先天话痨     │
│                                      │
│ 02:04                                │
│ ● 先天话痨    ──  6 ──→  专业发牌员   │
│                                      │
│ 02:03                                │
│ ● 专业发牌员  ── 66 ──→  先天话痨     │
└──────────────────────────────────────┘
```

**关键改动**:
- 布局从三列改为单行时间轴
- 左侧: 时间节点（小号灰色 `rgba(255,255,255,0.3)`）
- 中间: `from名 ── amount ──→ to名`
- 流转箭头 `──→`: 蓝色 `#0A84FF`
- 金额数字: 等宽字体，根据当前用户视角着色（出分红色/入分绿色/旁观白色）
- 节点圆点 `●`: 蓝色微光，`width: 8rpx; height: 8rpx; border-radius: 50%; background: #0A84FF; box-shadow: 0 0 6rpx rgba(10,132,255,0.6)`
- 保持现有分页加载（`onScoreScrollToLower`）和过滤（`toggleFilterMine`）功能
- 分组逻辑保持不变（`rebuildGroupedRecords`），仅改变 WXML 渲染结构

---

## Phase 2 — 新增功能 + 后端

### 模块 5：ROOM INSIGHT（战局洞察）

**后端接口**: `GET /room/{id}/insight`

**数据源**: `sr:room:{rid}:events` ZSet（与 `getRoomTransfers` 相同的数据源）

**聚合逻辑** (在 `ScoreServiceImpl` 中实现，复用已有的 `redisTemplate` 和 `ROOM_PREFIX` 常量):
1. `ZRANGEBYSCORE events 0 +inf` 获取全部 event JSON
2. 解析每个 event 的 `{from, to, amount}`
3. 计算:
   - `totalTransfer`: 所有 amount 之和
   - `maxSingleTransfer`: 单次最大 amount
   - `mostActiveUser`: 出现次数最多的 userId（from + to 合并计数）
   - `transferCount`: event 总数
   - `networkDensity`: `transferCount / (n * (n-1))`，>0.3 = HIGH，>0.1 = MEDIUM，其余 LOW

**响应 DTO** (`RoomInsightResp`):
```java
@Data @Builder
public class RoomInsightResp {
    private Integer totalTransfer;       // 总流转量
    private Integer maxSingleTransfer;   // 单次最大流转
    private ActiveUser mostActiveUser;   // 最活跃用户
    private Integer transferCount;       // 流转次数
    private String networkDensity;       // HIGH / MEDIUM / LOW

    @Data @Builder
    public static class ActiveUser {
        private Long userId;
        private String nickname;
        private String avatarUrl;
        private Integer count;           // 互动次数
    }
}
```

**缓存**: 无缓存，直接从 Redis 实时计算（events 数据量有限，单次 ZRANGEBYSCORE 在 2C2G 上可接受）

**前端展示**:
```
┌──────────────────────────────────────┐
│ ROOM INSIGHT  战局洞察               │
├──────────────────────────────────────┤
│ 本场最活跃    先天话痨  互动14次      │
│ 最大流转      88                      │
│ 积分流转量    286                     │
│ 互动密度      ■■■■ HIGH              │
└──────────────────────────────────────┘
```

- 使用 `.secondary-card` 样式
- 密度条: 用 CSS 宽度百分比表示，颜色随等级变化（HIGH=蓝，MEDIUM=青，LOW=灰）

### 模块 6：NETWORK MAP（积分关系图）

**后端接口**: `GET /room/{id}/network`

**聚合逻辑**:
1. 遍历 events，按 `(from, to)` 分组
2. 对每对计算 `netAmount`（正向总额 - 反向总额）和 `count`（总次数）
3. 返回 nodes（来自 ranking）和 links

**响应 DTO** (`RoomNetworkResp`):
```java
@Data @Builder
public class RoomNetworkResp {
    private List<Node> nodes;
    private List<Link> links;

    @Data @Builder
    public static class Node {
        private Long userId;
        private String nickname;
        private String avatarUrl;
        private Integer score;           // 当前积分
    }

    @Data @Builder
    public static class Link {
        private Long from;
        private Long to;
        private Integer netAmount;       // 净流转额（正数=from→to 净流入）
        private Integer count;           // 交互次数
    }
}
```

**Canvas 组件**: `components/force-graph/force-graph.js`

力导向图实现:
- **排斥力**: 所有节点之间，`F = k / d^2`，k 可调
- **弹簧力**: 有 link 的节点之间，`F = -k * (d - restLength)`
- **阻尼**: 每帧速度衰减 0.9
- **边界约束**: 节点不超出 Canvas 区域
- **渲染**: `wx.createCanvasContext('forceGraph')`，每帧清除 + 重绘
  - 连线: `ctx.setStrokeStyle()`，粗细按 count 缩放（1~4px），颜色按净流向（蓝/红）
  - 节点: 圆形，半径按总互动量缩放（16~32px），填充头像颜色或默认蓝
  - 标签: 昵称文字，节点下方

**组件接口**:
```javascript
Component({
  properties: {
    nodes: Array,    // [{userId, nickname, score}]
    links: Array,    // [{from, to, netAmount, count}]
    width: Number,   // Canvas 宽度 px
    height: Number   // Canvas 高度 px
  }
})
```

**reduce-motion 支持**: 检测 `app.globalData.animationEnabled`，禁用时直接使用圆形布局（节点均匀分布在圆周上），跳过物理模拟。

**性能约束**: 节点数上限 16（`MAX_MEMBERS`），Canvas 尺寸 300x300 px，帧率限制 30fps。

---

## 页面最终结构（Phase 1 + 2 完成后）

```
ROOM TERMINAL（顶部 HUD 栏）
    ↓
PLAYER NETWORK（成员网络 4 列网格）
    ↓
FLOW LOG（积分流时间轴）
    ↓
ROOM INSIGHT（战局洞察卡片）     ← Phase 2
    ↓
NETWORK MAP（Canvas 关系图）     ← Phase 2
    ↓
结算按钮区域
```

---

## 与镜像模块的数据闭环（未来）

房间页的 events 数据可直接喂给镜像模块的人格分析:
- 流转频率高 → 社交驱动
- 总给别人加分 → 利他倾向
- 总给自己加分 → 自利倾向
- 集中给单人转账 → 联盟倾向
- 高额波动 → 风险偏好

这不在本次改造范围内，但 Phase 2 的 network 接口为后续提供了数据基础。

---

## 改动文件清单

### Phase 1
| 文件 | 操作 |
|---|---|
| `miniprogram/pages/room/room.wxml` | 重构: 顶部栏、成员区、数字键盘、积分记录 |
| `miniprogram/pages/room/room.wxss` | 重构: 新增终端栏/玩家卡/流转终端/时间轴样式 |
| `miniprogram/pages/room/room.js` | 小改: 实时预览计算、积分颜色规则调整 |

### Phase 2
| 文件 | 操作 |
|---|---|
| `backend/.../dto/score/RoomInsightResp.java` | 新建 |
| `backend/.../dto/score/RoomNetworkResp.java` | 新建 |
| `backend/.../service/ScoreService.java` | 新增 2 个方法签名 |
| `backend/.../service/impl/ScoreServiceImpl.java` | 新增 2 个方法实现 |
| `backend/.../controller/ScoreController.java` | 新增 2 个接口 |
| `miniprogram/components/force-graph/` | 新建: .js/.wxml/.wxss/.json |
| `miniprogram/pages/room/room.wxml` | 新增: 洞察卡片 + 关系图区域 |
| `miniprogram/pages/room/room.wxss` | 新增: 洞察卡片样式 |
| `miniprogram/pages/room/room.js` | 新增: 加载洞察/网络数据 |

---

## 验收标准

### Phase 1
- [ ] 顶部房间号卡片替换为 HUD 终端栏，显示房间号/成员数/模式/在线状态
- [ ] 成员网格积分颜色: 正绿/负红/零灰
- [ ] 选中成员显示圆形扫描环（脉冲动画）
- [ ] 数字键盘改为终端风格，确认按钮改为能量按钮
- [ ] 输入数字时实时预览双方新分数
- [ ] 积分记录改为时间轴布局（from ── amount ──→ to）
- [ ] 所有动画在 reduce-motion 下静默
- [ ] 本局录入模式的所有功能不受影响

### Phase 2
- [ ] `GET /room/{id}/insight` 返回正确的聚合数据
- [ ] `GET /room/{id}/network` 返回正确的 nodes + links
- [ ] 战局洞察卡片正确展示最活跃用户/最大流转/流转量/密度
- [ ] Canvas 力导向图正确渲染节点和连线
- [ ] 4 人以内使用力导向布局，超出时仍可渲染
- [ ] reduce-motion 下使用静态圆形布局
