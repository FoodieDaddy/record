const { get } = require('../../utils/request');
const { getColor, getFirstChar } = require('../../utils/avatar');
const app = getApp();

Page({
  data: {
    loading: true,
    rooms: [],
    trendPoints: [],
    totalNetScore: 0,
    trendLoading: false
  },

  onShow() {
    this.loadHistory();
    this.loadTrend();
  },

  async loadHistory() {
    this.setData({ loading: true });
    try {
      const rooms = await get('/room/history');
      // 为每个成员添加头像降级数据
      const enriched = (rooms || []).map(room => ({
        ...room,
        members: (room.members || []).map(m => ({
          ...m,
          avatarBgColor: getColor(m.nickname),
          avatarChar: getFirstChar(m.nickname)
        }))
      }));
      this.setData({ rooms: enriched });
    } catch (e) {
      console.error('加载历史房间失败', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadTrend() {
    this.setData({ trendLoading: true });
    try {
      const resp = await get('/score/trend?limit=20');
      const points = (resp && resp.points) || [];
      const totalNetScore = points.reduce((sum, p) => sum + (p.netScore || 0), 0);
      this.setData({ trendPoints: points, totalNetScore });
    } catch (e) {
      console.error('加载趋势数据失败', e);
    } finally {
      this.setData({ trendLoading: false });
    }
  },

  onRoomTap(e) {
    const { roomId } = e.currentTarget.dataset;
    if (!roomId) return;
    wx.navigateTo({ url: '/pages/settle/settle?roomId=' + roomId });
  },

  onAvatarError(e) {
    const { roomId, userId } = e.currentTarget.dataset;
    const rooms = this.data.rooms.map(room => {
      if (String(room.roomId) !== String(roomId)) return room;
      return {
        ...room,
        members: room.members.map(m => {
          if (String(m.userId) !== String(userId)) return m;
          return { ...m, avatarUrl: '' };
        })
      };
    });
    this.setData({ rooms });
  }
});
