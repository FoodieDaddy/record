const api = require('../../../utils/mirror-api');

const TABS = [
  { key: '', label: '全部' },
  { key: 'QUICK', label: '快速占测' },
  { key: 'PROFILE', label: '命盘画像' },
  { key: 'ADVANCED', label: '高级推演' },
  { key: 'TODAY', label: '今日场域' }
];

Page({
  data: {
    tabs: TABS,
    activeTab: '',
    list: [],
    page: 1,
    pageSize: 20,
    total: 0,
    loading: false,
    hasMore: true
  },

  onLoad() {
    this.loadList(true);
  },

  onPullDownRefresh() {
    this.loadList(true).then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadList(false);
    }
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.key;
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab, list: [], page: 1, hasMore: true });
    this.loadList(true);
  },

  async loadList(refresh) {
    if (this.data.loading) return;
    const page = refresh ? 1 : this.data.page;
    this.setData({ loading: true });

    try {
      const params = { page, pageSize: this.data.pageSize };
      if (this.data.activeTab) params.category = this.data.activeTab;

      const result = await api.getMirrorArchive(params);
      const newList = refresh ? result.records : [...this.data.list, ...result.records];

      this.setData({
        list: newList,
        page: page + 1,
        total: result.total,
        hasMore: newList.length < result.total,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  openReport(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: '/pages/mirror/report/index?id=' + id });
  }
});
