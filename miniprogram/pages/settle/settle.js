/**
 * 结算详情页
 * 展示折线图 + 玩家总分卡牌 + 排名列表
 */
const { get } = require('../../utils/request');
const { getColor, getFirstChar } = require('../../utils/avatar');
const app = getApp();

Page({
  data: {
    roomId: '',
    roomNo: '',
    loading: true,
    // 折线图数据
    timestamps: [],
    series: [],
    visibleUsers: [],
    // 玩家总分（按 finalScore 降序）
    rankedMembers: [],
    // 当前用户 ID
    myUserId: ''
  },

  onLoad(options) {
    const roomId = options.roomId || '';
    this.setData({
      roomId,
      myUserId: app.globalData.userId || ''
    });
    if (roomId) {
      this.loadData(roomId);
    }
  },

  /**
   * 并行加载图表数据和房间详情
   */
  async loadData(roomId) {
    this.setData({ loading: true });
    try {
      const [chartData, roomData] = await Promise.all([
        get(`/score/room/${roomId}/chart`),
        get(`/room/${roomId}`)
      ]);

      // 图表数据
      const timestamps = chartData.timestamps || [];
      const series = chartData.series || [];
      const visibleUsers = series.map(s => String(s.userId));

      // 从图表 series 提取最终分数（每个 series 的最后一个 score）
      // 并与房间成员信息（avatarUrl 等）合并
      const memberMap = {};
      (roomData.members || []).forEach(m => {
        memberMap[String(m.userId)] = m;
      });

      const memberScores = series.map(s => {
        const scores = s.scores || [];
        const finalScore = scores.length > 0 ? scores[scores.length - 1] : 0;
        const member = memberMap[String(s.userId)] || {};
        const nickname = s.nickname || member.nickname || '?';
        return {
          userId: s.userId,
          nickname,
          avatarChar: getFirstChar(nickname),
          avatarUrl: member.avatarUrl || '',
          finalScore,
          avatarColor: getColor(s.nickname)
        };
      });
      // 按 finalScore 降序
      const rankedMembers = [...memberScores].sort((a, b) => b.finalScore - a.finalScore);

      this.setData({
        timestamps,
        series,
        visibleUsers,
        rankedMembers,
        roomNo: roomData.roomNo || '',
        loading: false
      });
    } catch (e) {
      console.error('加载结算数据失败', e);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 关闭页面：优先返回，失败则回首页
   */
  handleClose() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/room/room' });
    }
  }
});
