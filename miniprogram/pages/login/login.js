const { post } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    loading: false,
    connecting: false,
    steps: [],
    accessGranted: false
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

      await this.playConnectingAnimation();

      wx.switchTab({ url: '/pages/room/room' });
    } catch (err) {
      console.error('登录失败', err);
      wx.showToast({ title: '登录失败', icon: 'none' });
      this.setData({ connecting: false });
    } finally {
      this.setData({ loading: false });
    }
  },

  playConnectingAnimation() {
    return new Promise((resolve) => {
      const stepTexts = [
        '同步用户档案',
        '加载人格镜像',
        '初始化房间模块',
        '同步策略引擎'
      ];

      const steps = stepTexts.map(text => ({ text, done: false }));
      this.setData({ connecting: true, steps, accessGranted: false });

      let i = 0;
      const showNext = () => {
        if (i >= stepTexts.length) {
          setTimeout(() => {
            this.setData({ accessGranted: true });
            setTimeout(resolve, 800);
          }, 400);
          return;
        }
        const idx = i;
        setTimeout(() => {
          this.setData({ [`steps[${idx}].done`]: true });
          setTimeout(showNext, 300);
        }, 400);
        i++;
      };

      setTimeout(showNext, 500);
    });
  }
});
