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
   * @param {string} roomId
   * @param {boolean} [force=false] - 是否强制重新连接
   */
  connect(roomId, force = false) {
    if (!roomId) return;
    if (this.isConnecting && !force) return;
    if (this.isConnected && this.roomId === roomId && !force) return;

    // 防御性关闭已有连接
    if (this.socketTask) {
      debugLog('[score-ws] 强制关闭旧连接，准备重新连接');
      try {
        this.socketTask.close();
      } catch (e) {}
      this.socketTask = null;
    }

    this.roomId = roomId;
    this.isConnecting = true;
    this.manualClose = false;
    this._reconnectCount = 0;

    const app = getApp();
    const config = require('../config');
    // token 通过 Sec-WebSocket-Protocol 头传输，不放入 URL，避免日志/工具泄露
    // AnyService WebSocket 接入需在真机环境中单独验证，当前走 config 统一配置
    const token = app.globalData.token;
    const wsUrl = config.getWsUrl(roomId);

    debugLog('[score-ws] connecting roomId:', roomId);
    const connectOptions = { url: wsUrl };
    // token 通过 Sec-WebSocket-Protocol 头传输，不在 URL 中暴露
    if (token) {
      connectOptions.protocols = ['access_token.' + token];
    }
    connectOptions.success = () => debugLog('[WS] 连接中...');
    connectOptions.fail = (err) => {
      debugWarn('[WS] 连接失败', err);
      this.isConnecting = false;
      this._emit('error', err);
    };
    this.socketTask = wx.connectSocket(connectOptions);

    this.socketTask.onOpen(() => {
      debugLog('[WS] 已连接');
      this.isConnected = true;
      this.isConnecting = false;
      this._lastMessageTime = Date.now();
      this._startHeartbeat();
      this._emit('open');
      
      // 上报连接成功状态
      try {
        const behaviorLogger = require('./behavior-logger');
        behaviorLogger.track('WEBSOCKET_STATUS', { status: 'OPEN', roomId: this.roomId });
      } catch (e) {}

      // 重连成功时触发 reconnected 事件，通知页面主动同步状态
      if (this._reconnecting) {
        this._reconnecting = false;
        this._emit('reconnected');
      }
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

      // 上报连接关闭状态
      try {
        const behaviorLogger = require('./behavior-logger');
        behaviorLogger.track('WEBSOCKET_STATUS', { status: 'CLOSE', roomId: this.roomId, code: res ? res.code : '' });
      } catch (e) {}

      // 被服务器踢出（封禁/注销）
      if (res && res.code === 4003) {
        this._emit('kicked', res);
        return;
      }
      this._emit('close');
      // 自动重连（仅在非手动关闭时）
      if (!this.manualClose && this.roomId) {
        this._reconnecting = true;
        this._scheduleReconnect();
      }
    });

    this.socketTask.onError((err) => {
      debugWarn('[WS] 错误', err);
      this.isConnected = false;
      this.isConnecting = false;
      
      // 上报连接异常状态
      try {
        const behaviorLogger = require('./behavior-logger');
        behaviorLogger.track('WEBSOCKET_STATUS', { status: 'ERROR', roomId: this.roomId, errMsg: err.errMsg || String(err) });
      } catch (e) {}

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

    // 上报重连尝试状态
    try {
      const behaviorLogger = require('./behavior-logger');
      behaviorLogger.track('WEBSOCKET_STATUS', { status: 'RECONNECT_ATTEMPT', roomId: this.roomId, count: this._reconnectCount });
    } catch (e) {}

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
