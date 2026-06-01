/**
 * WebSocket 连接管理 — 房间级实时记分同步
 */
const app = getApp();

class ScoreWS {
  constructor() {
    this.socketTask = null;
    this.roomId = null;
    this.listeners = [];
    this.reconnectTimer = null;
    this.isConnecting = false;
  }

  /**
   * 连接到房间的 WebSocket
   */
  connect(roomId) {
    if (this.isConnecting && this.roomId === roomId) return;
    this.roomId = roomId;
    this.isConnecting = true;

    const wsUrl = app.globalData.baseUrl.replace(/^http/, 'ws') +
      `/ws/score?roomId=${roomId}&token=${app.globalData.token}`;

    this.socketTask = wx.connectSocket({
      url: wsUrl,
      success: () => console.log('[WS] 连接中...'),
      fail: (err) => {
        console.error('[WS] 连接失败', err);
        this.isConnecting = false;
      }
    });

    this.socketTask.onOpen(() => {
      console.log('[WS] 已连接');
      this.isConnecting = false;
    });

    this.socketTask.onMessage((res) => {
      try {
        const data = JSON.parse(res.data);
        this.listeners.forEach(fn => fn(data));
      } catch (e) {
        console.error('[WS] 解析消息失败', e);
      }
    });

    this.socketTask.onClose(() => {
      console.log('[WS] 已断开');
      this.isConnecting = false;
      // 自动重连
      if (this.roomId) {
        this.reconnectTimer = setTimeout(() => this.connect(this.roomId), 3000);
      }
    });

    this.socketTask.onError((err) => {
      console.error('[WS] 错误', err);
      this.isConnecting = false;
    });
  }

  /**
   * 监听记分更新
   */
  onScoreUpdate(callback) {
    this.listeners.push(callback);
  }

  /**
   * 移除监听
   */
  offScoreUpdate(callback) {
    this.listeners = this.listeners.filter(fn => fn !== callback);
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.roomId = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socketTask) {
      this.socketTask.close();
      this.socketTask = null;
    }
    this.listeners = [];
  }
}

// 单例
let instance = null;
function getScoreWS() {
  if (!instance) instance = new ScoreWS();
  return instance;
}

module.exports = { getScoreWS };
