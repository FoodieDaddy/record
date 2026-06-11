/**
 * 微信小程序用户行为日志批量异步上报 SDK (behavior-logger.js)
 * 采用“内存缓存、定时与定量混合策略、离线 Storage 持候化防丢失”的设计方案。
 */
const request = require('./request');

// 内存缓冲区
let _queue = [];

// 定时器引用
let _timer = null;

// 配置参数
const CONFIG = {
  limit: 10,             // 队列达到该数量时自动触发上报
  interval: 10000,       // 定时上报周期 (毫秒)
  storageKey: 'SMART_BEHAVIOR_OFFLINE_LOGS',
  maxOfflineLogs: 200    // 本地离线缓存最大条数配额，防止超出限制
};

// 避免无限递归：上报接口本身的 path
const REPORT_PATH = '/behavior/report';

/**
 * 获取当前最顶层页面路径
 */
function getCurrentPagePath() {
  try {
    const pages = getCurrentPages();
    if (pages && pages.length > 0) {
      return pages[pages.length - 1].route || '';
    }
  } catch (e) {
    // 捕获在 App 初始化阶段调用 getCurrentPages 报错的情况
  }
  return '';
}

/**
 * 核心追踪接口
 * @param {string} actionType 行为标识
 * @param {object|string} [payload] 附加的结构化数据
 */
function track(actionType, payload) {
  if (!actionType) return;
  
  const pagePath = getCurrentPagePath();
  const payloadStr = payload 
    ? (typeof payload === 'string' ? payload : JSON.stringify(payload)) 
    : '';

  const logItem = {
    actionType,
    pagePath,
    payload: payloadStr,
    timestamp: Date.now()
  };

  _queue.push(logItem);

  // 定量触发：如果缓冲队列达到阈值，立即异步上报
  if (_queue.length >= CONFIG.limit) {
    flush();
  }
}

/**
 * 触发缓冲区上报
 */
function flush() {
  if (_queue.length === 0) return;

  const logsToSend = [..._queue];
  _queue = []; // 立即清空，避免并发时数据被重复发送

  // 发送批量请求
  sendLogs(logsToSend).catch(err => {
    console.error('[BehaviorLogger] 批量上报失败，降级写入离线存储', err);
    saveOfflineLogs(logsToSend);
  });
}

/**
 * 执行底层发送
 */
function sendLogs(logs) {
  // 注意：此处必须显式设置 silent: true，防止接口报错时 request.js 弹出全局网络异常 Toast 骚扰用户
  // 同时 dedupe: false 确保上报不会被 GET 去重规则过滤（虽然是 POST，安全第一）
  return request.request({
    url: REPORT_PATH,
    method: 'POST',
    data: logs,
    silent: true,
    dedupe: false
  });
}

/**
 * 降级逻辑：将上报失败的日志存入本地 Storage
 */
function saveOfflineLogs(logs) {
  try {
    let offlineLogs = wx.getStorageSync(CONFIG.storageKey) || [];
    offlineLogs = offlineLogs.concat(logs);

    // 限制离线存储上限配额 (FIFO)
    if (offlineLogs.length > CONFIG.maxOfflineLogs) {
      offlineLogs = offlineLogs.slice(offlineLogs.length - CONFIG.maxOfflineLogs);
      console.warn('[BehaviorLogger] 离线日志超出配额上限，丢弃旧日志');
    }

    wx.setStorageSync(CONFIG.storageKey, offlineLogs);
  } catch (e) {
    console.error('[BehaviorLogger] 保存离线日志到 Storage 失败', e);
  }
}

/**
 * 尝试上报并清空本地 Storage 中的离线日志
 */
function flushOfflineLogs() {
  try {
    const offlineLogs = wx.getStorageSync(CONFIG.storageKey);
    if (!offlineLogs || offlineLogs.length === 0) return;

    console.log(`[BehaviorLogger] 发现本地离线日志共 ${offlineLogs.length} 条，开始合并上报...`);
    
    sendLogs(offlineLogs).then(() => {
      console.log('[BehaviorLogger] 离线日志合并上报成功，清空 Storage 缓存');
      wx.removeStorageSync(CONFIG.storageKey);
    }).catch(err => {
      console.warn('[BehaviorLogger] 离线日志上报尝试失败，保留本地缓存，待下次重试', err);
    });
  } catch (e) {
    console.error('[BehaviorLogger] 读取并上报离线日志失败', e);
  }
}

/**
 * SDK 初始化方法
 */
function init() {
  // 1. 防重复初始化
  if (_timer) {
    clearInterval(_timer);
  }

  // 2. 启动后首次尝试合并上报本地 Storage 堆积的离线包
  setTimeout(() => {
    flushOfflineLogs();
  }, 3000); // 延迟 3s 上报，避免抢占小程序启动首屏关键渲染的网络资源

  // 3. 开启定时上报周期器
  _timer = setInterval(() => {
    flush();
    flushOfflineLogs(); // 顺带轮询检测是否有离线缓存需要补报
  }, CONFIG.interval);

  // 4. 监听网络状态变化，从无网/弱网恢复时，立即执行一次补报
  wx.onNetworkStatusChange((res) => {
    if (res.isConnected) {
      console.log('[BehaviorLogger] 检测到网络已恢复，立即补发离线日志');
      flushOfflineLogs();
    }
  });

  // 5. 监听小程序页面切换，无侵入式自动实现全局 PAGE_VIEW 埋点上报
  if (typeof wx.onAppRoute === 'function') {
    wx.onAppRoute((res) => {
      track('PAGE_VIEW', {
        path: res.path,
        openType: res.openType,
        query: res.query || {}
      });
    });
  }

  console.log('[BehaviorLogger] SDK 初始化完成');
}

/**
 * 销毁定时器（退出登录或小程序 onHide 时调用）
 */
function destroy() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  // 最后一次刷出残余日志
  flush();
}

module.exports = {
  init,
  track,
  flush,
  destroy
};
