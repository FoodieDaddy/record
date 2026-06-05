const api = require('../../utils/mirror-api');
const app = getApp();

Page({
  data: {
    loading: true,
    reduceMotion: false,
    profile: {
      calibrated: false,
      mbtiType: '',
      mbtiTitle: '',
      confidence: 0,
      mbtiSource: '',
      calibratedAt: ''
    },
    todayField: {
      tag: '',
      summary: '',
      themeColor: '#0A84FF',
      date: ''
    },
    quickTools: [],
    profileTools: [],
    advancedTools: [],
    recentReports: [],
    birthProfile: {
      exists: false,
      briefText: ''
    },
    showSwipeTest: false,
    showMbtiPicker: false,
    needRefresh: false
  },

  onLoad() {
    this.setData({ reduceMotion: !app.globalData.animationEnabled });
    this.loadDashboard();
  },

  onShow() {
    if (this.data.needRefresh) {
      this.loadDashboard();
      this.setData({ needRefresh: false });
    }
  },

  onPullDownRefresh() {
    this.loadDashboard().then(() => wx.stopPullDownRefresh());
  },

  async loadDashboard() {
    try {
      const data = await api.getMirrorDashboard();
      this.setData({
        loading: false,
        profile: data.profile || this.data.profile,
        todayField: data.todayField || this.data.todayField,
        quickTools: data.quickTools || [],
        profileTools: data.profileTools || [],
        advancedTools: data.advancedTools || [],
        recentReports: data.recentReports || [],
        birthProfile: data.birthProfile || this.data.birthProfile
      });
    } catch (e) {
      this.setData({ loading: false });
      // 不白屏，展示基础空状态
    }
  },

  startMbtiTest() {
    this.setData({ showSwipeTest: true });
  },

  closeMbtiTest() {
    this.setData({ showSwipeTest: false });
  },

  openMbtiPicker() {
    this.setData({ showMbtiPicker: true });
  },

  closeMbtiPicker() {
    this.setData({ showMbtiPicker: false });
  },

  async handleMbtiComplete(e) {
    const { testVersion, answers } = e.detail;
    try {
      const profile = await api.submitMbtiTest({ testVersion, answers });
      this.setData({ showSwipeTest: false, profile, needRefresh: true });
      this.loadDashboard();
      wx.showToast({ title: '校准完成', icon: 'success' });
    } catch (err) {
      wx.showToast({ title: '提交失败', icon: 'none' });
    }
  },

  async handleMbtiDirectInput(e) {
    const { mbtiType } = e.detail;
    try {
      const profile = await api.submitMbtiDirect({ mbtiType });
      this.setData({ showMbtiPicker: false, profile, needRefresh: true });
      this.loadDashboard();
      wx.showToast({ title: '设置成功', icon: 'success' });
    } catch (err) {
      wx.showToast({ title: '提交失败', icon: 'none' });
    }
  },

  openTool(e) {
    const { code, locked, lockreason } = e.currentTarget.dataset;
    if (locked) {
      wx.showToast({ title: lockreason || '暂不可用', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/mirror/tool/index?tool=' + code });
  },

  openArchive() {
    wx.navigateTo({ url: '/pages/mirror/archive/index' });
  },

  openReport(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: '/pages/mirror/report/index?id=' + id });
  }
});
