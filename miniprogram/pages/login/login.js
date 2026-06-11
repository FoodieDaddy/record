const { post } = require('../../utils/request');
const { vibrateShort } = require('../../utils/haptic');
const TimerManager = require('../../utils/timer-manager');
const app = getApp();

// 创建 TimerManager 实例
const timerMgr = new TimerManager();

Page({
  data: {
    loading: false,
    connecting: false,
    steps: [],
    accessGranted: false,
    animationEnabled: true
  },

  onShow() {
    this.setData({ animationEnabled: app.globalData.animationEnabled !== false });
    if (app.globalData.token) {
      wx.switchTab({ url: '/pages/room/room' });
    }
  },

  async onLogin() {
    if (this.data.loading) return;
    vibrateShort('light');
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
      console.error('终端接入失败', err);
      wx.showToast({ title: '接入失败', icon: 'none' });
      this.setData({ connecting: false });
    } finally {
      this.setData({ loading: false });
    }
  },

  onHide() {
    timerMgr.clearAll();
    this.setData({ connecting: false, accessGranted: false });
  },

  onUnload() {
    timerMgr.clearAll();
  },

  playConnectingAnimation() {
    // 动效静默时直接跳过动画
    if (!this.data.animationEnabled) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const stepTexts = [
        '同步识别档案',
        '加载协议参数',
        '初始化编队链路',
        '同步导航核心'
      ];

      const steps = stepTexts.map(text => ({ text, done: false }));
      this.setData({ connecting: true, steps, accessGranted: false });

      let i = 0;
      const showNext = () => {
        if (i >= stepTexts.length) {
          timerMgr.setTimeout(() => {
            this.setData({
              accessGranted: true,
              connecting: false
            });
            timerMgr.setTimeout(resolve, 800);
          }, 400);
          return;
        }
        const idx = i;
        timerMgr.setTimeout(() => {
          this.setData({ [`steps[${idx}].done`]: true });
          timerMgr.setTimeout(showNext, 300);
        }, 400);
        i++;
      };

      timerMgr.setTimeout(showNext, 500);
    });
  }
});
