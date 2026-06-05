/**
 * WebSocket 全局单例 — 房间级实时记分同步
 *
 * 设计原则：
 * - 全局唯一实例，不随页面销毁
 * - 页面只订阅/取消事件，不控制连接生命周期
 * - 自动重连（3 秒延迟），手动断开后不重连
 */
const DEBUG_WS = false;

function debugLog(...args) {
  if (DEBUG_WS) console.log(...args);
}

function debugWarn(...args) {
  if (DEBUG_WS) console.warn(...args);
}

class ScoreWS {
  constructor() {
    this.socketTask = null;
    this.roomId = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.manualClose = false;
    this.reconnectTimer = null;
    // 事件总线：事件名 → 回调集合
    this.events = new Map();
  }

  /**
   * 连接到房间的 WebSocket
   */
  connect(roomId) {
    if (!roomId) return;
    if (this.isConnecting) return;
    if (this.isConnected && this.roomId === roomId) return;

    // 防御性关闭已有连接
    if (this.socketTask) {
      this.socketTask.close();
      this.socketTask = null;
    }

    this.roomId = roomId;
    this.isConnecting = true;
    this.manualClose = false;

    const app = getApp();
    const wsUrl = app.globalData.baseUrl.replace(/^http/, 'ws') +
      `/ws/score?roomId=${roomId}&token=${app.globalData.token}`;

    this.socketTask = wx.connectSocket({
      url: wsUrl,
      success: () => debugLog('[WS] 连接中...'),
      fail: (err) => {
        debugWarn('[WS] 连接失败', err);
        this.isConnecting = false;
        this._emit('error', err);
      }
    });

    this.socketTask.onOpen(() => {
      debugLog('[WS] 已连接');
      this.isConnected = true;
      this.isConnecting = false;
      this._emit('open');
    });

    this.socketTask.onMessage((res) => {
      try {
        const data = JSON.parse(res.data);
        this._emit('message', data);
      } catch (e) {
        console.error('[WS] 解析消息失败', e);
      }
    });

    this.socketTask.onClose((res) => {
      debugLog('[WS] 已断开');
      this.isConnected = false;
      this.isConnecting = false;
      this.socketTask = null;
      // 被服务器踢出（封禁/注销）
      if (res && res.code === 4003) {
        this._emit('kicked', res);
        return;
      }
      this._emit('close');
      // 自动重连（仅在非手动关闭时）
      if (!this.manualClose && this.roomId) {
        this._scheduleReconnect();
      }
    });

    this.socketTask.onError((err) => {
      debugWarn('[WS] 错误', err);
      this.isConnected = false;
      this.isConnecting = false;
      this._emit('error', err);
    });
  }

  /**
   * 切换房间（断开当前 → 连接新房间）
   */
  switchRoom(roomId) {
    if (this.roomId === roomId && this.isConnected) return;
    this.disconnect();
    this.connect(roomId);
  }

  /**
   * 订阅事件
   * @param {string} event - 事件名：'message' | 'open' | 'close'
   * @param {Function} callback
   */
  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(callback);
  }

  /**
   * 取消订阅
   */
  off(event, callback) {
    const set = this.events.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) this.events.delete(event);
    }
  }

  /**
   * 触发事件
   */
  _emit(event, data) {
    const set = this.events.get(event);
    if (set) {
      set.forEach(fn => {
        try {
          fn(data);
        } catch (e) {
          console.error(`[WS] 事件回调异常 (${event})`, e);
        }
      });
    }
  }

  /**
   * 延迟重连
   */
  _scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.roomId && !this.isConnected && !this.isConnecting) {
        debugLog('[WS] 自动重连...');
        this.connect(this.roomId);
      }
    }, 3000);
  }

  /**
   * 断开连接（手动，不触发自动重连）
   */
  disconnect() {
    this.manualClose = true;
    this.roomId = null;
    this.isConnected = false;
    this.isConnecting = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socketTask) {
      this.socketTask.close();
      this.socketTask = null;
    }
  }

  /**
   * 清除所有监听器（退出登录时调用）
   */
  clearListeners() {
    this.events.clear();
  }
}

// 全局单例
const scoreWS = new ScoreWS();

module.exports = scoreWS;
