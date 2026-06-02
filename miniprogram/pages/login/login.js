const { post } = require('../../utils/request');
const { generateNickname } = require('../../utils/nickname');
const { getColor, getFirstChar } = require('../../utils/avatar');
const app = getApp();

Page({
  data: {
    loading: false,
    previewNickname: '',
    previewColor: '#4f8cff',
    previewChar: '?'
  },

  onShow() {
    if (app.globalData.token) {
      wx.switchTab({ url: '/pages/room/room' });
    }
    this.refreshNickname();
  },

  refreshNickname() {
    const nickname = generateNickname();
    this.setData({
      previewNickname: nickname,
      previewColor: getColor(nickname),
      previewChar: getFirstChar(nickname)
    });
  },

  async onLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      // 1. 获取微信 login code
      const { code } = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject });
      });

      // 2. 尝试获取微信用户信息（用户主动授权才会有）
      let nickname = '';
      let avatarUrl = '';

      try {
        const profile = await new Promise((resolve, reject) => {
          wx.getUserProfile({
            desc: '用于显示头像和昵称',
            success: resolve,
            fail: reject
          });
        });
        nickname = profile.userInfo.nickName || '';
        avatarUrl = profile.userInfo.avatarUrl || '';
      } catch (e) {
        // 用户拒绝授权，使用自动生成的昵称
        nickname = this.data.previewNickname;
      }

      // 3. 调用后端登录
      const data = await post('/user/login', {
        code,
        nickname,
        avatarUrl
      });

      // 4. 保存登录态
      app.setLoginInfo(data);

      wx.showToast({ title: '登录成功', icon: 'success' });

      // 5. 跳转到房间页
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
