const config = require('./config');
const scoreWS = require('./utils/score-ws');

App({
  globalData: {
    baseUrl: config.baseUrl,
    token: null,
    userId: null,
    userInfo: null,
    audioEnabled: true,
    animationEnabled: true
  },

  onLaunch() {
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
      this.globalData.userId = String(wx.getStorageSync('userId') || '');
    }
    this.globalData.animationEnabled = wx.getStorageSync('animationEnabled') !== false;
    this.globalData.audioEnabled = wx.getStorageSync('audioEnabled') !== false;
  },

  setLoginInfo(data) {
    this.globalData.token = data.token;
    this.globalData.userId = String(data.userId);
    this.globalData.userInfo = {
      nickname: data.nickname,
      avatarUrl: data.avatarUrl
    };
    wx.setStorageSync('token', data.token);
    wx.setStorageSync('userId', data.userId);
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
