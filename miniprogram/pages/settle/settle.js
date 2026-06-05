const { get } = require('../../utils/request');
const { getColor, getFirstChar } = require('../../utils/avatar');
const app = getApp();

Page({
  data: {
    roomId: '',
    roomNo: '',
    loading: true,
    animationEnabled: true,
    settleTime: '',
    // 战局总结
    winner: null,
    loser: null,
    maxSingle: 0,
    totalTransfer: 0,
    transferCount: 0,
    memberCount: 0,
    // 图表
    timestamps: [],
    series: [],
    visibleUsers: [],
    eventMarkers: [],
    // 排名
    rankedMembers: [],
    myUserId: '',
    // 关系网络
    networkNodes: [],
    networkLinks: [],
    // 战局洞察
    insight: null,
    // 人格信号
    personaSignals: null
  },

  onLoad(options) {
    const roomId = options.roomId || '';
    this.setData({
      roomId,
      myUserId: app.globalData.userId || '',
      animationEnabled: app.globalData.animationEnabled !== false
    });
    if (roomId) {
      this.loadData(roomId);
    }
  },

  async loadData(roomId) {
    this.setData({ loading: true });
    try {
      const [chartData, roomData, insightData, networkData] = await Promise.all([
        get(`/score/room/${roomId}/chart`),
        get(`/room/${roomId}`),
        get(`/score/room/${roomId}/insight`).catch(() => null),
        get(`/score/room/${roomId}/network`).catch(() => null)
      ]);

      const timestamps = chartData.timestamps || [];
      const series = chartData.series || [];
      const visibleUsers = series.map(s => String(s.userId));

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
      const rankedMembers = [...memberScores].sort((a, b) => b.finalScore - a.finalScore);

      const winner = rankedMembers.length > 0 ? rankedMembers[0] : null;
      const loser = rankedMembers.length > 0 ? rankedMembers[rankedMembers.length - 1] : null;
      let maxSingle = 0;
      for (const s of series) {
        const scores = s.scores || [];
        for (let i = 1; i < scores.length; i++) {
          const delta = Math.abs(scores[i] - scores[i - 1]);
          if (delta > maxSingle) maxSingle = delta;
        }
      }
      if (insightData && insightData.maxSingleTransfer > maxSingle) {
        maxSingle = insightData.maxSingleTransfer;
      }

      const eventMarkers = [];
      for (const s of series) {
        const scores = s.scores || [];
        for (let i = 1; i < scores.length; i++) {
          const delta = scores[i] - scores[i - 1];
          if (Math.abs(delta) === maxSingle && maxSingle > 0) {
            eventMarkers.push({
              index: i,
              label: (delta > 0 ? '+' : '') + delta,
              color: delta > 0 ? '#32D74B' : '#FF453A'
            });
            break;
          }
        }
        if (eventMarkers.length > 0) break;
      }

      const personaSignals = this._calcPersonaSignals(rankedMembers, insightData, networkData);

      const networkNodes = (networkData.nodes || []).map(n => ({
        ...n,
        avatarColor: getColor(n.nickname)
      }));
      const networkLinks = networkData.links || [];

      const now = new Date();
      const settleTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      this.setData({
        timestamps, series, visibleUsers, eventMarkers,
        rankedMembers, roomNo: roomData.roomNo || '', settleTime,
        winner, loser, maxSingle,
        totalTransfer: insightData ? insightData.totalTransfer : 0,
        transferCount: insightData ? insightData.transferCount : 0,
        memberCount: rankedMembers.length,
        networkNodes, networkLinks,
        insight: insightData || null,
        personaSignals,
        loading: false
      });
    } catch (e) {
      console.error('加载战局报告失败', e);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  _calcPersonaSignals(rankedMembers, insight, network) {
    if (!rankedMembers || rankedMembers.length === 0) {
      return { socialActivity: '中', riskPreference: '中', resourceControl: '中', allianceTendency: '低' };
    }
    const n = rankedMembers.length;
    const myData = rankedMembers.find(m => String(m.userId) === String(this.data.myUserId));

    let socialActivity = '中';
    if (insight && insight.transferCount) {
      const avg = insight.transferCount / Math.max(n, 1);
      if (avg > 3) socialActivity = '高';
      else if (avg < 1.5) socialActivity = '低';
    }

    let riskPreference = '中';
    if (myData) {
      const absScore = Math.abs(myData.finalScore);
      const avgScore = rankedMembers.reduce((s, m) => s + Math.abs(m.finalScore), 0) / n;
      if (absScore > avgScore * 1.5) riskPreference = '高';
      else if (absScore < avgScore * 0.5) riskPreference = '低';
    }

    let resourceControl = '中';
    if (myData) {
      const rank = rankedMembers.indexOf(myData);
      if (rank === 0) resourceControl = '高';
      else if (rank >= n - 1) resourceControl = '低';
    }

    let allianceTendency = '低';
    if (network && network.links && n > 2) {
      const pairs = new Set(network.links.map(l => [l.from, l.to].sort().join(':')));
      const max = (n * (n - 1)) / 2;
      const ratio = pairs.size / max;
      if (ratio > 0.5) allianceTendency = '高';
      else if (ratio > 0.2) allianceTendency = '中';
    }

    return { socialActivity, riskPreference, resourceControl, allianceTendency };
  },

  handleClose() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/room/room' });
    }
  }
});
