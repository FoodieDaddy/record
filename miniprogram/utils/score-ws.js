/**
 * WebSocket 全局单例 — 编队级实时记分同步
 *
 * 设计原则：
 * - 全局唯一实例，不随页面销毁
 * - 页面只订阅/取消事件，不控制连接生命周期
 * - 自动重连（3 秒延迟），手动断开后不重连
 * - token 通过 Sec-WebSocket-Protocol 头传输，不在 URL 中暴露
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
    // 心跳
    this._heartbeatTimer = null;
    this._lastMessageTime = 0;
    // 事件总线：事件名 → 回调集合
    this.events = new Map();
  }

  /**
   * 连接到编队的 WebSocket
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
    this._reconnectCount = 0;

    const app = getApp();
    // 使用独立的 wsUrl 配置，避免从 baseUrl 拼接出错
    const config = require('../config');
    // token 通过 Sec-WebSocket-Protocol 头传输，不放入 URL，避免日志/工具泄露
    const wsUrl = `${config.wsUrl}/ws/score?roomId=${roomId}`;
    const token = app.globalData.token;

    debugLog('[score-ws] connecting roomId:', roomId);
    this.socketTask = wx.connectSocket({
      url: wsUrl,
      // 后端已支持 Sec-WebSocket-Protocol: access_token.<jwt> 认证
      protocols: ['access_token.' + token],
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
      this._lastMessageTime = Date.now();
      this._startHeartbeat();
      this._emit('open');
    });

    this.socketTask.onMessage((res) => {
      this._lastMessageTime = Date.now();
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
      this._stopHeartbeat();
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
   * 切换编队（断开当前 -> 连接新编队）
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
   * 延迟重连（指数退避 + 最大次数）
   */
  _scheduleReconnect() {
    if (!this._reconnectCount) this._reconnectCount = 0;
    this._reconnectCount++;

    // 最多重连 5 次
    if (this._reconnectCount > 5) {
      debugWarn('[WS] 达到最大重连次数，停止重连');
      this._emit('reconnectFailed');
      return;
    }

    // 指数退避：3s, 6s, 12s, 24s, 48s
    const delay = Math.min(3000 * Math.pow(2, this._reconnectCount - 1), 48000);
    debugLog(`[WS] ${delay / 1000}s 后重连 (第 ${this._reconnectCount} 次)`);

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.roomId && !this.isConnected && !this.isConnecting) {
        this.connect(this.roomId);
      }
    }, delay);
  }

  /**
   * 断开连接（手动，不触发自动重连）
   */
  disconnect() {
    this.manualClose = true;
    this.roomId = null;
    this.isConnected = false;
    this.isConnecting = false;
    this._stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socketTask) {
      this.socketTask.close();
      this.socketTask = null;
    }
  }

  /** 启动心跳检测（25s 间隔，40s 无消息判定断线） */
  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (!this.isConnected) return;
      const silence = Date.now() - this._lastMessageTime;
      if (silence > 40000) {
        debugWarn('[WS] 心跳超时，重连');
        this._stopHeartbeat();
        this.isConnected = false;
        if (this.socketTask) {
          this.socketTask.close();
          this.socketTask = null;
        }
        this._scheduleReconnect();
      }
    }, 25000);
  }

  /** 停止心跳检测 */
  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
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
