# Phase 7 Prompt：matrix-overview 与图表优化

## 角色

你是数据可视化与小程序性能优化工程师。请优化 `matrix-overview`、图表、关系网络和数值总览弹层，使其打开时不再触发大量计算和请求。

## 阶段目标

1. 弹层打开不做重计算。
2. 关系数据从 O(members × records) 改为 O(records) 预聚合。
3. 图表懒初始化，进入视图后再渲染。
4. 网络请求由 room snapshot 或统一 service 管理。
5. 关闭弹层后释放 canvas/chart 资源。

## 重点文件

- `miniprogram/components/matrix-overview/matrix-overview.js`
- `miniprogram/components/matrix-overview/matrix-overview.wxml`
- `miniprogram/components/matrix-overview/matrix-overview.wxss`
- `miniprogram/pages/room/room.js`
- `miniprogram/services/score-service.js`
- 图表相关组件目录

## 当前问题

数值总览弹层打开时容易卡顿，原因包括：

- 组件自己请求 chart/network 数据。
- 组件自己遍历 members 和 records 构建关系。
- 弹层滑入动画和图表初始化同时发生。
- canvas/chart 初始化抢占主线程。

## 任务一：关系数据预聚合

在 room store 或 room 页面中维护 `relationMap`：

```js
function buildRelationMap(records = []) {
  const map = {};
  for (const record of records) {
    const from = String(record.fromUserId || record.fromId || '');
    const to = String(record.toUserId || record.toId || '');
    const amount = Number(record.amount || record.score || 0);
    if (!from || !to) continue;
    const key = `${from}->${to}`;
    map[key] = (map[key] || 0) + amount;
  }
  return map;
}
```

`matrix-overview` 只接收：

- `members`
- `ranking`
- `relationMap`
- `chartLite`
- `latestRecords`

不要自己扫全量 records。

## 任务二：图表延迟初始化

弹层打开流程：

1. 第 0ms：挂载弹层骨架。
2. 第 180~240ms：弹层动画结束。
3. 第 260ms 后：初始化图表。
4. 图表数据不存在时才请求。

示例：

```js
observers: {
  visible(val) {
    if (val) {
      this.prepareLiteView();
      this._chartTimer = setTimeout(() => {
        this.initChartsIfNeeded();
      }, 260);
    } else {
      this.disposeCharts();
    }
  }
}
```

## 任务三：组件不直接请求全量数据

禁止在 `matrix-overview` 的 `attached` 中直接拉全量数据。

允许：

- 组件发现 `chartLite` 缺失时，触发事件请求父页面补数据。

示例：

```js
this.triggerEvent('needchart', { roomId: this.data.roomId });
```

父页面统一处理：

```js
onMatrixNeedChart() {
  this.loadChartLiteOnce();
}
```

## 任务四：列表虚拟化或截断

如果关系列表很长：

- 默认只显示 Top 10。
- 其余通过“展开更多”加载。
- 不要一次性渲染几十/上百条复杂关系项。

```js
const topRelations = relationList
  .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  .slice(0, 10);
```

## 任务五：关闭时释放资源

关闭弹层：

- clearTimeout
- 销毁 chart 实例
- 清空临时 canvas 状态
- 停止未完成动画

示例：

```js
detached() {
  this.disposeCharts();
  if (this._chartTimer) clearTimeout(this._chartTimer);
}
```

## 输出格式

```md
# Phase 7 matrix-overview 与图表优化完成报告

## 关系数据复杂度变化

## 图表懒初始化说明

## 删除的组件内请求

## 弹层打开耗时对比

## 资源释放说明

## 风险与回滚
```

## 验收标准

- 打开数值总览时动画先顺滑完成，再加载图表。
- 弹层打开瞬间不再发起多条网络请求。
- 关系构建复杂度从 O(members × records) 变为 O(records)。
- 关闭弹层后无 canvas/chart 残留任务。
- 200 条记录下弹层打开无明显卡顿。
