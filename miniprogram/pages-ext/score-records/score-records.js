const { get } = require('../../utils/request');
const scoreService = require('../../services/score-service');
const app = getApp();

Page({
  data: {
    loading: true,
    loadError: false,
    animationEnabled: true,
    records: [],
    pageHeight: 0,
    playbackVisible: false,
    playbackLoading: false,
    playbackRecords: [],
    playbackRoomNo: '',
    customNavTop: 0,
    customNavBarHeight: 0,
    customNavHeight: 0,
    scrollHeight: 0,
    reduceMotion: false,
  },

  onLoad() {
    this.initCustomNav();
  },

  onShow() {
    this.setData({ animationEnabled: app.globalData.animationEnabled !== false });
    this.initCustomNav();
    this.loadSamples();
  },

  initCustomNav() {
    let statusBarHeight = 44;
    let navBarHeight = 44;
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    statusBarHeight = windowInfo.statusBarHeight || statusBarHeight;
    const menuRect = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
    if (menuRect && menuRect.height && menuRect.top > statusBarHeight) {
      navBarHeight = (menuRect.top - statusBarHeight) * 2 + menuRect.height;
    }
    const screenHeight = windowInfo.windowHeight || 667;
    this.setData({
      customNavTop: statusBarHeight,
      customNavBarHeight: navBarHeight,
      customNavHeight: statusBarHeight + navBarHeight,
      scrollHeight: screenHeight - statusBarHeight - navBarHeight - 120,
      reduceMotion: !this.data.animationEnabled
    });
  },

  navigateBack() {
    wx.navigateBack({ delta: 1 });
  },

  noop() {},

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
    const sample = this.data.records.find(item => String(item.roomId) === String(roomId));
    this.openPlayback(roomId, sample && sample.roomNo);
  },

  async openPlayback(roomId, roomNo) {
    this.setData({
      playbackVisible: true,
      playbackLoading: true,
      playbackRecords: [],
      playbackRoomNo: roomNo || '--'
    });
    try {
      const res = await scoreService.getRoomTransfers(roomId, 1, 18);
      const myId = String(app.globalData.userId || '');
      const records = ((res && res.records) || []).map(item => ({
        id: item.id,
        fromName: item.fromUser && item.fromUser.nickname || '?',
        toName: item.toUser && item.toUser.nickname || '?',
        fromUserId: item.fromUser && item.fromUser.userId,
        toUserId: item.toUser && item.toUser.userId,
        amount: item.amount,
        createdAt: item.createdAt,
        myRole: String(item.fromUser && item.fromUser.userId) === myId
          ? 'from'
          : String(item.toUser && item.toUser.userId) === myId
            ? 'to'
            : ''
      }));
      this.setData({ playbackRecords: records });
    } catch (e) {
      console.error('航迹回放加载失败', e);
      wx.showToast({ title: '航迹回放加载失败', icon: 'none' });
    } finally {
      this.setData({ playbackLoading: false });
    }
  },

  closePlayback() {
    this.setData({
      playbackVisible: false,
      playbackLoading: false,
      playbackRecords: [],
      playbackRoomNo: ''
    });
  },

  onPullDownRefresh() {
    this.loadSamples().finally(() => {
      wx.stopPullDownRefresh();
    });
  },
});
