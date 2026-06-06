const { get } = require('../../utils/request');
const { getColor, getFirstChar } = require('../../utils/avatar');
const app = getApp();

Page({
  data: {
    loading: true,
    loadError: false,
    animationEnabled: true,
    netYield: 0,
    sampleCount: 0,
    curveUnlockCount: 2,
    curveData: [],
    records: []
  },

  onShow() {
    this.setData({ animationEnabled: app.globalData.animationEnabled !== false });
    this.loadYieldLog();
  },

  async loadYieldLog() {
    this.setData({ loading: true, loadError: false });
    try {
      const resp = await get('/score/yield-log');
      if (!resp) return;

      const records = (resp.records || []).map(record => ({
        ...record,
        players: (record.players || []).map(p => ({
          ...p,
          avatarBgColor: getColor(p.nickname),
          avatarChar: getFirstChar(p.nickname)
        }))
      }));

      this.setData({
        netYield: resp.netYield || 0,
        sampleCount: resp.sampleCount || 0,
        curveUnlockCount: resp.curveUnlockCount || 2,
        curveData: resp.curveData || [],
        records
      });
    } catch (e) {
      console.error('加载积分流水失败', e);
      this.setData({ loadError: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  onRoomTap(e) {
    const { roomId } = e.currentTarget.dataset;
    if (!roomId) return;
    wx.navigateTo({
      url: '/pages/settle/settle?roomId=' + roomId,
      fail: () => {
        wx.showToast({ title: '航程档案加载失败', icon: 'none' });
      }
    });
  },

  onPullDownRefresh() {
    this.loadYieldLog().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onAvatarError(e) {
    const { roomId, userId } = e.currentTarget.dataset;
    const records = this.data.records.map(record => {
      if (String(record.roomId) !== String(roomId)) return record;
      return {
        ...record,
        players: record.players.map(p => {
          if (String(p.userId) !== String(userId)) return p;
          return { ...p, avatarUrl: '' };
        })
      };
    });
    this.setData({ records });
  }
});
