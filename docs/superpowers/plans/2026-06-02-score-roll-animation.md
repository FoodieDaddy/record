# 分数数字滚动动画实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 转账完成后，成员网格中发送方和接收方的分数从旧值逐步滚动到新值，而非瞬间跳变。

**Architecture:** JS 帧动画驱动，每 16ms 通过 setData 更新 displayScore 字段，WXML 读取 displayScore 渲染。粒子动画结束后触发，受 animationEnabled 开关控制。

**Tech Stack:** 微信小程序原生框架，WXS 格式化函数已有

---

## 受影响文件

| 文件 | 改动 |
|---|---|
| `miniprogram/pages/room/room.js` | 修改 `buildMemberGrid()`、`playTransferAnimation()`；新增 `playScoreRollAnimation()` |
| `miniprogram/pages/room/room.wxml` | `.mg-score` 读 `item.displayScore` 替代 `item.score` |

---

### Task 1: 修改 buildMemberGrid() 初始化 displayScore

**Files:**
- Modify: `miniprogram/pages/room/room.js:145-162`

- [ ] **Step 1: 在 buildMemberGrid() 中为每个 item 添加 displayScore 字段**

当前代码（第 151-159 行）：
```js
const grid = room.members.map((m, i) => {
  const score = scores[i];
  const style = this.getScoreStyle(score);
  return {
    ...m,
    score,
    scoreFontSize: style.fontSize,
    scoreColor: style.color
  };
});
```

改为：
```js
const grid = room.members.map((m, i) => {
  const score = scores[i];
  const style = this.getScoreStyle(score);
  // 如果该成员正在播放滚动动画，保留当前 displayScore
  const oldItem = this.data.memberGrid.find(g => g.userId === m.userId);
  const displayScore = (oldItem && oldItem._animating) ? oldItem.displayScore : score;
  return {
    ...m,
    score,
    displayScore,
    _animating: (oldItem && oldItem._animating) || false,
    scoreFontSize: style.fontSize,
    scoreColor: style.color
  };
});
```

- [ ] **Step 2: 验证**

在微信开发者工具中打开房间页面，确认成员分数正常显示，无报错。

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/room/room.js
git commit -m "feat: buildMemberGrid 初始化 displayScore 字段"
```

---

### Task 2: 新增 playScoreRollAnimation() 方法

**Files:**
- Modify: `miniprogram/pages/room/room.js:819`（在 playTransferAnimation 之后插入）

- [ ] **Step 1: 在 playTransferAnimation() 方法之后添加 playScoreRollAnimation()**

在第 819 行 `playTransferAnimation` 方法的闭合 `},` 之后，插入：

```js
/** 分数滚动动画：从旧值逐步滚动到新值 */
playScoreRollAnimation(fromUserId, toUserId, amount) {
  // 已有动画在播放，跳过（等待当前动画结束）
  if (this._rollTimer) return;

  const grid = this.data.memberGrid;
  const fromIdx = grid.findIndex(m => m.userId === fromUserId);
  const toIdx = grid.findIndex(m => m.userId === toUserId);
  if (fromIdx < 0 || toIdx < 0) return;

  const fromOld = grid[fromIdx].displayScore;
  const toOld = grid[toIdx].displayScore;
  const fromNew = grid[fromIdx].score;
  const toNew = grid[toIdx].score;

  // 分数没有变化，跳过
  if (fromOld === fromNew && toOld === toNew) return;

  // 非动画模式，直接设置最终值
  if (!app.globalData.animationEnabled) {
    const updates = {};
    updates[`memberGrid[${fromIdx}].displayScore`] = fromNew;
    updates[`memberGrid[${toIdx}].displayScore`] = toNew;
    this.setData(updates);
    return;
  }

  // 标记动画中
  const markAnim = {};
  markAnim[`memberGrid[${fromIdx}]._animating`] = true;
  markAnim[`memberGrid[${toIdx}]._animating`] = true;
  this.setData(markAnim);

  const duration = 600;
  const startTime = Date.now();

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    // easeOutExpo: 前期快后期慢
    const ease = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

    const updates = {};
    updates[`memberGrid[${fromIdx}].displayScore`] = Math.round(fromOld + (fromNew - fromOld) * ease);
    updates[`memberGrid[${toIdx}].displayScore`] = Math.round(toOld + (toNew - toOld) * ease);
    this.setData(updates);

    if (t < 1) {
      this._rollTimer = setTimeout(animate, 16);
    } else {
      // 动画结束：确保最终值精确，清除标记
      const finalUpdates = {};
      finalUpdates[`memberGrid[${fromIdx}].displayScore`] = fromNew;
      finalUpdates[`memberGrid[${fromIdx}]._animating`] = false;
      finalUpdates[`memberGrid[${toIdx}].displayScore`] = toNew;
      finalUpdates[`memberGrid[${toIdx}]._animating`] = false;
      this.setData(finalUpdates);
      this._rollTimer = null;
    }
  };

  this._rollTimer = setTimeout(animate, 16);
},
```

- [ ] **Step 2: 验证**

代码无语法错误，可在开发者工具中确认房间页面正常加载。

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/room/room.js
git commit -m "feat: 新增 playScoreRollAnimation 数字滚动动画方法"
```

---

### Task 3: 修改 playTransferAnimation() 在粒子动画后触发滚动

**Files:**
- Modify: `miniprogram/pages/room/room.js:713-819`

- [ ] **Step 1: 在 playTransferAnimation 开头快照旧分数**

在第 714 行 `if (!app.globalData.animationEnabled) return;` 之后，第 716 行 `wx.createSelectorQuery()` 之前，插入：

```js
// 快照动画前的分数，用于滚动动画
const preAnimScores = {};
this.data.memberGrid.forEach(m => {
  preAnimScores[m.userId] = m.displayScore;
});
this._preAnimScores = preAnimScores;
this._rollFromUserId = fromUserId;
this._rollToUserId = toUserId;
this._rollAmount = amount;
```

- [ ] **Step 2: 在粒子动画结束时触发滚动动画**

找到第 813-814 行：
```js
          } else {
            this.setData({ animActive: false });
          }
```

改为：
```js
          } else {
            this.setData({ animActive: false });
            // 粒子动画结束后触发分数滚动动画
            this.playScoreRollAnimation(this._rollFromUserId, this._rollToUserId, this._rollAmount);
          }
```

- [ ] **Step 3: 验证**

在微信开发者工具中发起一笔转账，观察粒子动画结束后分数是否有从旧值到新值的滚动效果。

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/room/room.js
git commit -m "feat: 粒子动画结束后触发分数滚动动画"
```

---

### Task 4: 修改 WXML 读取 displayScore

**Files:**
- Modify: `miniprogram/pages/room/room.wxml:100-101`

- [ ] **Step 1: 修改 .mg-score 的数据绑定**

找到第 100-101 行：
```wxml
<text class="mg-score score-number" style="color:{{item.scoreColor}};">
  {{fmt.formatScore(item.score)}}
</text>
```

改为：
```wxml
<text class="mg-score score-number" style="color:{{item.scoreColor}};">
  {{fmt.formatScore(item.displayScore)}}
</text>
```

- [ ] **Step 2: 验证**

在微信开发者工具中打开房间页面，确认分数正常显示（初始时 displayScore === score，显示应无变化）。

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/room/room.wxml
git commit -m "feat: mg-score 读取 displayScore 替代 score"
```

---

### Task 5: 集成测试与最终提交

- [ ] **Step 1: 完整流程测试**

在微信开发者工具中：
1. 打开房间页面，确认成员分数正常显示
2. 选择收款方，输入金额，发起转账
3. 观察：粒子动画(900ms) → 分数从旧值滚动到新值(600ms)
4. 在个人设置中关闭动画开关
5. 再次发起转账，确认粒子动画和滚动动画均不播放，分数直接跳变

- [ ] **Step 2: 提交（如有修复）**

```bash
git add -A
git commit -m "fix: 滚动动画集成测试修复"
```
