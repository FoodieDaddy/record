# 分数数字滚动动画设计

## 概述

转账完成后，成员网格中发送方和接收方的分数从旧值逐步滚动到新值，而非瞬间跳变。

## 触发场景

- **本地发起转账**：`submitTransfer()` 中，粒子动画结束后触发
- **收到他人转账**：`onWsMessage()` 中，粒子动画结束后触发

两种场景均受 `app.globalData.animationEnabled` 控制，与粒子动画共享同一开关。

## 动画参数

| 参数 | 值 |
|---|---|
| 缓动曲线 | easeOutExpo：`t === 1 ? 1 : 1 - Math.pow(2, -10 * t)` |
| 时长 | 600ms |
| 帧间隔 | 16ms（setTimeout） |
| 触发时机 | 粒子动画结束（900ms）后立即开始 |
| 开关 | `app.globalData.animationEnabled` |

## 数据结构变更

memberGrid 每个 item 新增 `displayScore` 字段：

```js
{
  userId: 'xxx',
  nickname: '张三',
  score: 1200,        // 真实分数（数据源）
  displayScore: 1200, // 显示分数（动画期间逐帧变化）
  scoreColor: 'rgb(...)',
  // ...
}
```

## 核心逻辑

### buildMemberGrid() 变更

构建 grid 时，如果成员已有 `displayScore` 且正在动画中，保留 `displayScore`；否则 `displayScore = score`。

### playScoreRollAnimation(oldScores, newScores) 新增方法

```
1. 比对 oldScores 和 newScores，找出分数变化的成员（fromUserId, toUserId）
2. 若 animationEnabled 为 false，直接 setData displayScore = score，跳过动画
3. 记录动画起始时间，启动 setTimeout 循环
4. 每帧：
   - 计算进度 t = elapsed / 600ms
   - ease = easeOutExpo(t)
   - displayScore = oldScore + (newScore - oldScore) * ease
   - 对变化的成员 setData { memberGrid[idx].displayScore: displayScore }
5. 动画结束：displayScore = score，清除动画标记
```

### playTransferAnimation() 变更

在现有粒子动画结束的 `if (t < 1)` 分支的 else 中，在 `setData({ animActive: false })` 之后调用 `playScoreRollAnimation()`。

需要在 `playTransferAnimation` 开始时快照当前 `memberGrid` 的分数作为 oldScores。

### onWsMessage() 变更

WS 触发场景：粒子动画已由 `playTransferAnimation` 处理，滚动动画也在其中触发，无需额外改动。但需确保 `updateAllData()` 不会覆盖动画中的 `displayScore`。

方案：在 `buildMemberGrid()` 中，如果某成员正在动画中（通过 `_animating` 标记），保留其 `displayScore` 不被覆盖。

## WXML 变更

```wxml
<!-- 之前 -->
<text class="mg-score score-number" style="color:{{item.scoreColor}};">
  {{fmt.formatScore(item.score)}}
</text>

<!-- 之后 -->
<text class="mg-score score-number" style="color:{{item.scoreColor}};">
  {{fmt.formatScore(item.displayScore)}}
</text>
```

`formatScore` 接收数字类型，`displayScore` 是数字，无需修改 WXS。

## 并发动画处理

当新转账到来时，某成员可能正在播放滚动动画：

- 不打断当前动画，等待其自然结束
- 动画结束后，`buildMemberGrid()` 会用最新 ranking 数据重建 grid，此时分数已是最新值
- 如果动画结束时 `displayScore !== score`（说明期间又有新分数），立即触发一次新的滚动动画

实现：用 `_rollTimer` 存储 setTimeout ID，`playScoreRollAnimation` 开始前检查是否已有动画在播放，若有则跳过（分数会在动画结束后自动对齐）。

## 防冲突机制

动画期间 `updateAllData()` 可能被多次调用（WS 推送），需防止覆盖进行中的动画：

- memberGrid item 上加 `_animating: true` 标记
- `buildMemberGrid()` 中，若 `_animating` 为 true，保留当前 `displayScore`，不从 ranking 覆盖
- 动画结束后清除 `_animating` 标记，下次 `buildMemberGrid()` 正常更新

## 受影响文件

| 文件 | 改动 |
|---|---|
| `miniprogram/pages/room/room.js` | `buildMemberGrid()` 初始化 displayScore；新增 `playScoreRollAnimation()`；修改 `playTransferAnimation()` 在粒子动画后触发滚动 |
| `miniprogram/pages/room/room.wxml` | `.mg-score` 读 `item.displayScore` 替代 `item.score` |

不需要改动 `room.wxss`（纯 JS 驱动）和 `room.wxs`（formatScore 接口不变）。
