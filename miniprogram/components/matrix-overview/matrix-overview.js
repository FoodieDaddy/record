/**
 * 脉冲总览组件 — 矩阵面板 + 折线图 + 脉冲明细弹窗
 * 两段式平滑卸载 · 列表懒加载
 */
const { get } = require('../../utils/request');
const { getAvatarView } = require('../../utils/avatar');

const LIST_PAGE_SIZE = 30;

Component({
  properties: {
    visible: { type: Boolean, value: false },
    roomId: { type: String, value: '' },
    memberGrid: { type: Array, value: [] },
    scoreRecords: { type: Array, value: [] },
    myUserId: { type: String, value: '' }
  },

  data: {
    active: false,
    chartHidden: true,
    playerCount: 0,

    // 一维关系列表
    relationList: [],
    relationListDisplay: [],  // 懒加载截断后的显示列表
    relationHasMore: false,

    // 折线图
    chartTimestamps: [],
    chartSeries: [],
    chartVisibleUsers: [],

    // 脉冲明细
    showMatrixDetail: false,
    detailFrom: {},
    detailTo: {},
    detailNet: 0,
    detailRecords: []
  },

  observers: {
    visible(val) {
      if (val) {
        const count = this.data.memberGrid ? this.data.memberGrid.length : 0;
        this.setData({ active: true, chartHidden: false, playerCount: count });
        this._scheduleBuild();
        if (this.data.roomId) {
          this.loadChartData(this.data.roomId);
        }
      } else {
        // 两段式退场：1) 隐藏 canvas 2) 延迟销毁 DOM
        this.setData({ showMatrixDetail: false, chartHidden: true });
        if (this._closeTimer) clearTimeout(this._closeTimer);
        this._closeTimer = setTimeout(() => {
          this.setData({ active: false });
        }, 320);
      }
    },

    scoreRecords() {
      if (this.data.visible) this._scheduleBuild();
    },

    memberGrid() {
      if (this.data.visible) {
        const count = this.data.memberGrid ? this.data.memberGrid.length : 0;
        this.setData({ playerCount: count });
        this._scheduleBuild();
      }
    }
  },

  lifetimes: {
    detached() {
      if (this._closeTimer) clearTimeout(this._closeTimer);
      if (this._buildTimer) clearTimeout(this._buildTimer);
    }
  },

  methods: {
    // ========== 异步构建 ==========

    _scheduleBuild() {
      if (this._buildTimer) clearTimeout(this._buildTimer);
      this._buildTimer = setTimeout(() => this.buildRelationList(), 50);
    },

    /** 构建一维关系列表 */
    buildRelationList() {
      const members = this.data.memberGrid;
      if (!members || members.length < 2) {
        this.setData({ relationList: [], relationListDisplay: [], relationHasMore: false });
        return;
      }

      const records = this.data.scoreRecords;
      const myId = this.data.myUserId;
      if (!myId) {
        this.setData({ relationList: [], relationListDisplay: [], relationHasMore: false });
        return;
      }

      const isSessionData = records.length > 0 && String(records[0].fromUserId) === String(records[0].toUserId);

      setTimeout(() => {
        const list = [];

        if (isSessionData) {
          const scoreMap = {};
          records.forEach(r => { scoreMap[String(r.fromUserId)] = r.amount; });
          const myScore = scoreMap[String(myId)] || 0;
          members.forEach(m => {
            if (String(m.userId) === String(myId)) return;
            const otherScore = scoreMap[String(m.userId)] || 0;
            const diff = myScore - otherScore;
            if (diff === 0) return;
            list.push({
              userId: m.userId, nickname: m.nickname,
              ...getAvatarView(m.nickname, m.avatarUrl),
              netScore: diff, display: this.formatScore(diff)
            });
          });
        } else {
          members.forEach(m => {
            if (String(m.userId) === String(myId)) return;
            let net = 0;
            records.forEach(r => {
              if (String(r.fromUserId) === String(myId) && String(r.toUserId) === String(m.userId)) net -= r.amount;
              if (String(r.fromUserId) === String(m.userId) && String(r.toUserId) === String(myId)) net += r.amount;
            });
            if (net === 0) return;
            list.push({
              userId: m.userId, nickname: m.nickname,
              ...getAvatarView(m.nickname, m.avatarUrl),
              netScore: net, display: this.formatScore(net)
            });
          });
        }

        list.sort((a, b) => Math.abs(b.netScore) - Math.abs(a.netScore));
        const display = list.slice(0, LIST_PAGE_SIZE);
        this.setData({
          relationList: list,
          relationListDisplay: display,
          relationHasMore: list.length > LIST_PAGE_SIZE
        });
      }, 0);
    },

    /** 滚动到底部加载更多 */
    onRelationScrollLower() {
      if (!this.data.relationHasMore) return;
      const current = this.data.relationListDisplay.length;
      const all = this.data.relationList;
      const next = all.slice(0, current + LIST_PAGE_SIZE);
      this.setData({
        relationListDisplay: next,
        relationHasMore: next.length < all.length
      });
    },

    formatScore(val) {
      if (val === 0) return '0';
      const abs = Math.abs(val);
      const sign = val > 0 ? '+' : '-';
      if (abs >= 100000000) return sign + (Math.round(abs / 10000000) / 10) + '亿';
      if (abs >= 10000) return sign + (Math.round(abs / 1000) / 10) + '万';
      return (val > 0 ? '+' : '') + val;
    },

    // ========== 图表 ==========

    async loadChartData(roomId) {
      try {
        const data = await get(`/score/room/${roomId}/chart`);
        if (data && data.series && data.series.length > 0) {
          const timestamps = data.timestamps || [];
          const myId = this.data.myUserId;
          // 传入全部 series 用于 tooltip 解析对手昵称，visibleUsers 控制只画自己的线
          this.setData({
            chartTimestamps: timestamps,
            chartSeries: data.series,
            chartVisibleUsers: [String(myId)]
          });
        } else {
          this.setData({ chartTimestamps: [], chartSeries: [], chartVisibleUsers: [] });
        }
      } catch (e) {
        console.error('[matrix-overview] 加载图表数据失败', e);
        this.setData({ chartTimestamps: [], chartSeries: [], chartVisibleUsers: [] });
      }
    },

  // ========== 脉冲明细 ==========

    onRelationTap(e) {
      const { userId } = e.currentTarget.dataset;
      if (!userId) return;
      const myId = this.data.myUserId;
      const members = this.data.memberGrid;
      const me = members.find(m => String(m.userId) === String(myId));
      const other = members.find(m => String(m.userId) === String(userId));
      if (!me || !other) return;

      const records = this.data.scoreRecords;
      const pairRecords = records.filter(r =>
        (String(r.fromUserId) === String(myId) && String(r.toUserId) === String(userId)) ||
        (String(r.fromUserId) === String(userId) && String(r.toUserId) === String(myId))
      ).map(r => {
        const isForward = String(r.fromUserId) === String(myId);
        return { id: r.id, amount: isForward ? -r.amount : r.amount, timeFormatted: r.timeFormatted };
      }).sort((a, b) => (b.timeFormatted || '').localeCompare(a.timeFormatted || ''));

      const net = pairRecords.reduce((sum, r) => sum + r.amount, 0);
      this.setData({ showMatrixDetail: true, detailFrom: me, detailTo: other, detailNet: net, detailRecords: pairRecords });
    },

    closeMatrixDetail() {
      this.setData({ showMatrixDetail: false });
    },

    // ========== 面板开关 ==========

    closePanel() {
      this.triggerEvent('close');
    },

    preventClose(e) {
      // 阻止触摸事件穿透到页面背后的 scroll-view
      if (e && e.preventDefault) e.preventDefault();
    }
  }
});
