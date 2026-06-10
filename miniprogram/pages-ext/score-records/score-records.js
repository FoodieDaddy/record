const { get } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    loading: true,
    loadError: false,
    animationEnabled: true,
    records: [],
    pageHeight: 0,
  },

  onLoad() {
    this.calcPageHeight();
  },

  onShow() {
    this.setData({ animationEnabled: app.globalData.animationEnabled !== false });
    this.loadSamples();
    this.calcPageHeight();
  },

  async loadSamples() {
    this.setData({ loading: true, loadError: false });
    try {
      const resp = await get('/score/yield-log');
      if (!resp) return;
      this.setData({ records: resp.records || [] });
    } catch (e) {
      console.error('读取航迹索引失败', e);
      this.setData({ loadError: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  onSampleTap(e) {
    const { roomId } = e.currentTarget.dataset;
    if (!roomId) return;
    wx.navigateTo({
      url: '/pages-ext/settle/settle?roomId=' + roomId,
      fail: () => {
        wx.showToast({ title: '航程回放加载失败', icon: 'none' });
      }
    });
  },

  onPullDownRefresh() {
    this.loadSamples().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  calcPageHeight() {
    let pageHeight = 0;
    try {
      const win = wx.getWindowInfo();
      pageHeight = win.windowHeight;
    } catch (e) {
      try {
        const info = wx.getSystemInfoSync();
        pageHeight = info.windowHeight;
      } catch (e2) { /* 最终降级 */ }
    }
    if (pageHeight) {
      this.setData({ pageHeight });
    }
  },
});
