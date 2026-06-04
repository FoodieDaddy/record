const { get } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    loading: true,
    rooms: []
  },

  onShow() {
    this.loadHistory();
  },

  async loadHistory() {
    this.setData({ loading: true });
    try {
      const rooms = await get('/room/history');
      this.setData({ rooms: rooms || [] });
    } catch (e) {
      console.error('加载历史房间失败', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  onRoomTap(e) {
    const { roomId } = e.currentTarget.dataset;
    if (!roomId) return;
    wx.navigateTo({ url: '/pages/settle/settle?roomId=' + roomId });
  }
});
