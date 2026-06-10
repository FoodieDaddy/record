---
name: fix-network-toast-flash
overview: 修复前端短暂弹出"网络异常"提醒的问题：在 request.js 中添加 toast 节流机制，防止多个并发请求同时失败时重复弹出断网提示
todos:
  - id: add-toast-throttle
    content: 在 request.js 添加网络异常 toast 节流和业务错误 toast 去重
    status: completed
  - id: add-logout-debounce
    content: 在 request.js 添加 401 登出防抖，避免并发重复登出
    status: completed
  - id: verify-behavior
    content: 验证节流逻辑：并发失败只弹一次 toast，silent 请求不受影响
    status: completed
    dependencies:
      - add-toast-throttle
      - add-logout-debounce
---

## 用户需求

前端总会短暂弹出"网络异常"的提醒，持续几秒，需要修复此问题。

## 问题根因

`miniprogram/utils/request.js` 的 `onFail` 回调（第 80-84 行）对每个失败的请求都直接调用 `wx.showToast({ title: '网络异常', icon: 'none' })`，没有任何节流或去重。

### 触发链路

1. App 从后台切回 → `onShow` 触发
2. `room.js` onShow → `loadMyRooms()` → `loadRoomData()` → 并发调用 `loadRanking` + `loadScoreRecords` + `loadInsightData` + `loadTransferAmountSuggestions`
3. 若此时网络短暂波动，4+ 个请求同时失败
4. 每个失败请求各自弹一次 `wx.showToast`
5. `wx.showToast` 默认 duration 1500ms，多个 toast 排队展示，累计持续数秒

### 同时存在的问题

- `onSuccess` 中业务错误（非 200 码）也直接弹 toast（第 73-75 行），同样无节流
- 401/4001 并发场景下会多次调用 `app.logout()` + `wx.redirectTo`

## 修复目标

在 `request.js` 中添加 toast 节流机制：同一类错误在冷却期内只弹一次 toast，避免多个失败请求堆叠显示数秒。

## 技术方案

### 修改文件

`miniprogram/utils/request.js`

### 实现方式

在模块顶层添加一个简单的 toast 节流器：

1. **网络异常节流** — `onFail` 中弹"网络异常" toast 前，先检查冷却期（5 秒内只弹一次），且在弹新 toast 前先 `wx.hideToast()` 清除之前排队的 toast
2. **业务错误节流** — `onSuccess` 中非 200 的业务错误 toast 也纳入节流，按 message 内容去重（同一消息 3 秒内不重复弹）
3. **401/4001/4003 登出逻辑** — 加防抖标志，避免多个并发 401 重复执行 `app.logout()` + `wx.redirectTo()`

### 关键设计

- 使用模块级变量 `_networkToastCooldown` 和 `_bizToastCooldowns` 实现，不引入额外依赖
- 冷却期到后自动重置，无需手动清理
- `silent: true` 的请求仍跳过 toast，行为不变
- `wx.hideToast()` 确保不会出现多个 toast 排队堆叠

### 实现细节

```javascript
// 模块级变量
let _networkToastTime = 0;        // 网络异常上次弹 toast 时间
const _bizToastTimes = new Map();  // 业务错误上次弹 toast 时间 (message → timestamp)
let _loggingOut = false;           // 401 登出防抖

// onFail 节流
const onFail = (err) => {
  if (!options.silent) {
    const now = Date.now();
    if (now - _networkToastTime > 5000) {
      _networkToastTime = now;
      wx.hideToast();  // 清除之前排队的 toast
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  }
  reject(err);
};

// onSuccess 业务错误节流
if (!options.silent) {
  const now = Date.now();
  const lastTime = _bizToastTimes.get(msg) || 0;
  if (now - lastTime > 3000) {
    _bizToastTimes.set(msg, now);
    // 限制 Map 大小，避免内存泄漏
    if (_bizToastTimes.size > 20) {
      const oldest = _bizToastTimes.keys().next().value;
      _bizToastTimes.delete(oldest);
    }
    wx.showToast({ title: msg, icon: 'none' });
  }
}

// 401 登出防抖
if (!_loggingOut) {
  _loggingOut = true;
  app.logout();
  wx.redirectTo({ url: '/pages/login/login' });
  setTimeout(() => { _loggingOut = false; }, 3000);
  // ...
}
```