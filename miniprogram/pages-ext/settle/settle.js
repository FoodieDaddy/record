const { get } = require('../../utils/request');
const { getColor, getFirstChar, getAvatarView } = require('../../utils/avatar');
const app = getApp();

Page({
  data: {
    roomId: '',
    roomNo: '',
    loading: true,
    loadError: false,
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
    // 行为信号
    behaviorSignals: null,
    lowSample: false
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
    this.setData({ loading: true, loadError: false });
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
          ...getAvatarView(nickname, member.avatarUrl),
          finalScore,
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

      // 构建网络数据（带头像）
      const networkNodes = ((networkData && networkData.nodes) || []).map(n => {
        const member = memberMap[String(n.userId)] || {};
        const nickname = n.nickname || member.nickname || '?';
        return {
          userId: n.userId,
          nickname,
          score: n.score || 0,
          avatarUrl: n.avatarUrl || member.avatarUrl || ''
        };
      });
      const networkLinks = (networkData && networkData.links) || [];

      const transferCount = insightData ? insightData.transferCount : 0;
      const behaviorSignals = this._calcBehaviorSignals(
        rankedMembers, transferCount, networkLinks, series
      );

      const now = new Date();
      const settleTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      this.setData({
        timestamps, series, visibleUsers, eventMarkers,
        rankedMembers, roomNo: roomData.roomNo || '', settleTime,
        winner, loser, maxSingle,
        totalTransfer: insightData ? insightData.totalTransfer : 0,
        transferCount,
        memberCount: rankedMembers.length,
        networkNodes, networkLinks,
        behaviorSignals,
        lowSample: transferCount < 5,
        loading: false
      });
    } catch (e) {
      console.error('加载战局报告失败', e);
      this.setData({ loading: false, loadError: true });
      wx.showToast({ title: '航程数据加载失败', icon: 'none' });
    }
  },

  _calcBehaviorSignals(rankedMembers, transferCount, networkLinks, series) {
    const n = rankedMembers.length;
    if (n === 0) return null;

    const myUserId = this.data.myUserId;
    const myData = rankedMembers.find(m => String(m.userId) === String(myUserId));
    const mySeries = series.find(s => String(s.userId) === String(myUserId));

    // 参与活跃度：用户参与的流转次数 / 总流转次数
    let activity = '中';
    if (transferCount > 0 && myUserId) {
      const myLinks = networkLinks.filter(
        l => String(l.from) === String(myUserId) || String(l.to) === String(myUserId)
      );
      const myCount = myLinks.reduce((s, l) => s + (l.count || 1), 0);
      const ratio = myCount / transferCount;
      if (ratio > 0.4) activity = '高';
      else if (ratio < 0.2) activity = '低';
    }

    // 波动强度：用户积分变化的标准差
    let volatility = '中';
    if (mySeries && mySeries.scores && mySeries.scores.length > 2) {
      const deltas = [];
      for (let i = 1; i < mySeries.scores.length; i++) {
        deltas.push(Math.abs(mySeries.scores[i] - mySeries.scores[i - 1]));
      }
      const avg = deltas.reduce((s, v) => s + v, 0) / deltas.length;
      const variance = deltas.reduce((s, v) => s + (v - avg) * (v - avg), 0) / deltas.length;
      const std = Math.sqrt(variance);
      const avgScore = Math.abs(myData ? myData.finalScore : 0) / Math.max(n, 1);
      const ratio = avgScore > 0 ? std / avgScore : 0;
      if (ratio > 1.2) volatility = '高';
      else if (ratio < 0.4) volatility = '低';
    }

    // 集中流向：最大单向流转额 / 总流转额
    let concentration = '中';
    if (myUserId && networkLinks.length > 0) {
      const myLinks = networkLinks.filter(
        l => String(l.from) === String(myUserId) || String(l.to) === String(myUserId)
      );
      if (myLinks.length > 0) {
        const amounts = myLinks.map(l => Math.abs(l.netAmount || 0));
        const maxAmount = Math.max(...amounts);
        const totalAmount = amounts.reduce((s, v) => s + v, 0);
        const ratio = totalAmount > 0 ? maxAmount / totalAmount : 0;
        if (ratio > 0.6) concentration = '集中';
        else if (ratio < 0.3) concentration = '分散';
      }
    }

    // 互动密度：互动过的人数 / (总人数 - 1)
    let density = '中';
    if (myUserId && n > 1) {
      const interacted = new Set();
      networkLinks.forEach(l => {
        if (String(l.from) === String(myUserId)) interacted.add(String(l.to));
        if (String(l.to) === String(myUserId)) interacted.add(String(l.from));
      });
      const ratio = interacted.size / (n - 1);
      if (ratio > 0.7) density = '高';
      else if (ratio < 0.3) density = '低';
    }

    return { activity, volatility, concentration, density };
  },

});
