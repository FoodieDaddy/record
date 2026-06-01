const config = require('./config');

App({
  globalData: {
    baseUrl: config.baseUrl,
    token: null,
    userId: null,
    userInfo: null
  },

  onLaunch() {
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
      this.globalData.userId = wx.getStorageSync('userId');
    }
  },

  setLoginInfo(data) {
    this.globalData.token = data.token;
    this.globalData.userId = data.userId;
    this.globalData.userInfo = {
      nickname: data.nickname,
      avatarUrl: data.avatarUrl
    };
    wx.setStorageSync('token', data.token);
    wx.setStorageSync('userId', data.userId);
  },

  logout() {
    this.globalData.token = null;
    this.globalData.userId = null;
    this.globalData.userInfo = null;
    wx.clearStorageSync();
  }
});
