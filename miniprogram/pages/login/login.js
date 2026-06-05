const { post } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    loading: false
  },

  onShow() {
    if (app.globalData.token) {
      wx.switchTab({ url: '/pages/room/room' });
    }
  },

  async onLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const { code } = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject });
      });

      const data = await post('/user/login', { code });
      app.setLoginInfo(data);

      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/room/room' });
      }, 800);
    } catch (err) {
      console.error('登录失败', err);
      wx.showToast({ title: '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
