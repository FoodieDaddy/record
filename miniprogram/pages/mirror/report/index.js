const api = require('../../../utils/mirror-api');

Page({
  data: {
    loading: true,
    report: null,
    showRaw: false
  },

  onLoad(options) {
    const id = options.id;
    if (id) this.loadReport(id);
  },

  async loadReport(id) {
    try {
      const report = await api.getMirrorReport(id);
      wx.setNavigationBarTitle({ title: report.toolName || '结果' });
      this.setData({ loading: false, report });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  toggleRaw() {
    this.setData({ showRaw: !this.data.showRaw });
  },

  goBack() {
    wx.navigateBack();
  }
});
