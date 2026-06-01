const { post } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    loading: false
  },

  onShow() {
    // 已登录则自动跳转
    if (app.globalData.token) {
      wx.switchTab({ url: '/pages/room/room' });
    }
  },

  async onLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      // 1. 获取微信 login code
      const { code } = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject });
      });

      // 2. 调用后端登录
      const userInfo = app.globalData.userInfo || {};
      const data = await post('/user/login', {
        code,
        nickname: userInfo.nickname || '',
        avatarUrl: userInfo.avatarUrl || ''
      });

      // 3. 保存登录态
      app.setLoginInfo(data);

      wx.showToast({ title: '登录成功', icon: 'success' });

      // 4. 跳转到房间页
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
