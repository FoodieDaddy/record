const config = require('./config');
const scoreWS = require('./utils/score-ws');

App({
  globalData: {
    baseUrl: config.baseUrl,
    token: null,
    userId: null,
    userInfo: null,
    audioEnabled: true,
    animationEnabled: true,
    vibrateEnabled: true,
    enableWechatShare: false,
    activeTabKey: 'cockpit'
  },

  onLaunch() {
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
      this.globalData.userId = String(wx.getStorageSync('userId') || '');
      // 从本地缓存恢复用户信息，避免冷启动时的空窗期
      const cached = wx.getStorageSync('userInfo');
      if (cached) this.globalData.userInfo = cached;
    }
    this.globalData.animationEnabled = wx.getStorageSync('animationEnabled') !== false;
    this.globalData.audioEnabled = wx.getStorageSync('audioEnabled') !== false;
    this.globalData.vibrateEnabled = wx.getStorageSync('vibrateEnabled') !== false;
  },

  setLoginInfo(data) {
    this.globalData.token = data.token;
    this.globalData.userId = String(data.userId);
    const info = { nickname: data.nickname, avatarUrl: data.avatarUrl };
    this.globalData.userInfo = info;
    wx.setStorageSync('token', data.token);
    wx.setStorageSync('userId', data.userId);
    wx.setStorageSync('userInfo', info);
  },

  /** 局部更新 userInfo（乐观更新时调用） */
  updateUserInfo(partial) {
    const prev = this.globalData.userInfo || {};
    const merged = { ...prev, ...partial };
    this.globalData.userInfo = merged;
    wx.setStorageSync('userInfo', merged);
  },

  /** 连接房间 WebSocket（进入房间时调用） */
  connectWS(roomId) {
    scoreWS.connect(roomId);
  },

  /** 断开 WebSocket（退出登录/退出房间时调用） */
  disconnectWS() {
    scoreWS.disconnect();
  },

  logout() {
    scoreWS.disconnect();
    scoreWS.clearListeners();
    this.globalData.token = null;
    this.globalData.userId = null;
    this.globalData.userInfo = null;
    wx.clearStorageSync();
  }
});
