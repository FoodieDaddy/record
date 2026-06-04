# 2.5D 沉浸式座位视图 — 设计规格

替换现有 `seat-mode` 组件，实现第一人称视角 2.5D 透视桌面 + 全屏模态座位分配交互。

## 决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 透视角度 | 55° | 60° 过于激进，55° 在视觉冲击与可读性间平衡 |
| 组件定位 | 替换 seat-mode | 避免维护两套座位逻辑 |
| 数据源 | 纯 Props | 组件接收 members/waitingList/scoreMap 等，由 room 页面传入 |
| 动画方案 | CSS transition only | 严禁第三方库，依赖 WXSS transition + cubic-bezier |
| 图标方案 | CSS 伪元素 | 延续项目现有模式，不引入 SVG/iconfont |

## 1. 2.5D 透视舞台

### 容器结构

```
.seat-stage (perspective: 800rpx)
  └─ .seat-stage-inner (transform: rotateX(55deg))
       ├─ .table-surface (桌面装饰)
       └─ .seat-list
            └─ .seat-item × N (transform: rotateX(-55deg) + translate3d)
```

- 舞台容器设置 `perspective: 800rpx`，创建 3D 灭点
- 内层 `rotateX(55deg)` 将整个座位组向后倾斜，模拟俯视桌面
- 每个座位节点反向 `rotateX(-55deg)` 实现广告牌效果，内容始终正对屏幕
- 座位坐标基于容器中心计算，沿圆形/矩形分布

### 桌面装饰

- 中央保留圆环 + 径向渐变光晕
- 增加半透明桌面平面（`rgba(255,255,255,0.02)`），通过 `transform: translateZ(-1px)` 置于座位下方
- 边缘增加微弱发光线条模拟桌面边缘

## 2. 座位节点

### DOM 结构

```html
<view class="seat-item" style="transform: rotateX(-55deg) translate3d(x, y, 0)">
  <!-- 头像区 -->
  <view class="seat-avatar-ring">
    <!-- 空位：虚线 + -->
    <!-- 有头像：image -->
    <!-- 无头像：彩色圆 + 首字 -->
  </view>
  <!-- 积分牌（胶囊） -->
  <view class="seat-score-pill">
    <text>+1234</text>
  </view>
</view>
```

### 积分牌设计

- 胶囊形（`border-radius: 999px`）
- 毛玻璃背景：`rgba(255,255,255,0.06)` + `backdrop-filter: blur(20rpx)`
- 微边框：`1px solid rgba(255,255,255,0.08)`
- 等宽字体（`SF Mono` / `Menlo`）防止数字跳动
- 正数橙色 / 负数红色 / 零灰色（延续现有配色方案）

## 3. 全屏成员选择器

### 触发条件

- 房主点击空位 → 打开选择器
- 非房主点击空位 → 提示"等待其他玩家加入"

### 交互流程

1. 点击空位 → 底部滑入全屏面板（`translateY(100%) → translateY(0)`，400ms cubic-bezier）
2. 面板背景：`rgba(10, 10, 10, 0.85)` + `backdrop-filter: blur(40rpx)`
3. 顶部：居中标题"选择入座成员" + 右侧关闭按钮
4. 列表：`waitingList`（未入座成员），每行显示头像 + 昵称
5. 点击成员 → 面板下滑收起 → 座位节点 opacity/scale 过渡入场

### Props

```js
waitingList: { type: Array, value: [] }  // [{ userId, nickname, avatarUrl }]
isOwner: { type: Boolean, value: false }
```

### 事件

- `assignseat` — `{ userId, seatIndex }` 通知父页面分配座位

## 4. 已入座成员操作菜单

### 触发条件

- 点击已入座的非本人成员

### 菜单设计

- 屏幕中央毛玻璃浮窗（`rgba(20,20,20,0.85)` + `blur(40rpx)`）
- 操作项：
  - 转让积分（触发 `transfer` 事件）
  - 移出座位（触发 `removeseat` 事件）
- 点击外部区域关闭

### 交互模型

- **点击空位** → 房主打开全屏成员选择器
- **点击已入座他人** → 触发 `tapseat`（由 room 页面打开 numpad 计分，保持现有流程）
- **长按已入座他人** → 弹出操作菜单
  - 非编辑模式：仅"转让积分"（所有成员可用）
  - 编辑模式（房主）：增加"移出座位"选项
- **编辑模式** → 房主点击底部"编辑"按钮切换，编辑模式下可踢人

### 事件

- `tapseat` — `{ userId, index }` 点击已入座他人（计分）
- `transfer` — `{ targetUserId }` 转让积分
- `removeseat` — `{ targetUserId }` 移出座位

## 5. 动画与静默管理

### 过渡动画

| 元素 | 属性 | 时长 | 缓动 |
|------|------|------|------|
| 全屏面板 | transform | 400ms | cubic-bezier(0.32, 0.72, 0, 1) |
| 操作菜单 | opacity + transform | 250ms | ease-out |
| 座位入场 | opacity + transform | 350ms | cubic-bezier(0.32, 0.72, 0, 1) |
| 分数滚动 | animValue | 600ms | easeOutExpo (JS) |

### reduce-motion 静默

- 组件根节点绑定 `class="{{!animationEnabled ? 'reduce-motion' : ''}}"`
- `.reduce-motion *` 覆盖：`animation: none !important; transition: none !important;`

## 6. 保留的核心逻辑

从现有 seat-mode.js 保留：

- `_buildSeats()` — 第一人称旋转切片算法（`relIndex = (i - myIndex + M) % M`）
- `_animateScores()` — 分数滚动 easeOutExpo
- `_calcCoords()` — 坐标缓存 + 容器尺寸查询
- `_circleLayout()` / `_rectangleLayout()` — 布局算法
- `onAvatarError()` — 头像降级
- `rollScore()` — 外部触发的单人分数滚动

## 7. 不再需要的

- `editMode` / `editSelectedUserId` properties — 被内置全屏选择器替代
- `editseat` 事件 — 被 `assignseat` 替代
- `onTapSeat` 中的 editMode 分支 — 统一为组件内部控制

## 8. 文件清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| seat-mode.js | 重写 | 新增全屏模态状态管理，保留核心算法 |
| seat-mode.wxml | 重写 | 2.5D 舞台 + 广告牌 + 全屏选择器 + 操作菜单 |
| seat-mode.wxss | 重写 | 3D transforms + 毛玻璃 + 全屏面板样式 |
| seat-mode.wxs | 不变 | formatScore 逻辑无需改动 |
| seat-mode.json | 不变 | |
