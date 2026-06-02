/**
 * 积分总览组件 — 矩阵面板 + 折线图 + 积分明细弹窗
 * 单例全局组件，可被任意页面复用
 */
const { get } = require('../../utils/request');
const { getColor, getFirstChar } = require('../../utils/avatar');

/** 人数阈值：超过此值切换为一维列表模式 */
const MAX_MATRIX_SIZE = 4;

Component({
  properties: {
    visible: { type: Boolean, value: false },
    roomId: { type: String, value: '' },
    sessionId: { type: String, value: '' },
    memberGrid: { type: Array, value: [] },
    scoreRecords: { type: Array, value: [] },
    myUserId: { type: String, value: '' }
  },

  data: {
    active: false,         // 控制 DOM 存在（延迟于 visible 关闭）
    chartHidden: true,     // 折线图显隐
    playerCount: 0,        // 当前人数
    animEnabled: true,     // 是否启用动画（>4人时关闭）

    // 矩阵模式（≤4人）
    matrixMembers: [],
    matrixData: [],

    // 一维关系列表模式（>4人）
    relationList: [],

    // 折线图
    chartTimestamps: [],
    chartSeries: [],
    chartVisibleUsers: [],

    // 积分明细
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
        this.setData({ active: true, chartHidden: false, playerCount: count, animEnabled: count <= MAX_MATRIX_SIZE });
        if (this.data.sessionId) {
          this.loadSessionData(this.data.sessionId);
        } else {
          this._scheduleBuild();
          if (this.data.roomId) {
            this.loadChartData(this.data.roomId);
          }
        }
      } else {
        this.setData({ showMatrixDetail: false });
        if (this._closeTimer) clearTimeout(this._closeTimer);
        this._closeTimer = setTimeout(() => {
          this.setData({ active: false, chartHidden: true });
        }, 320);
      }
    },

    scoreRecords() {
      if (this.data.visible) this._scheduleBuild();
    },

    memberGrid() {
      if (this.data.visible) {
        const count = this.data.memberGrid ? this.data.memberGrid.length : 0;
        this.setData({ playerCount: count, animEnabled: count <= MAX_MATRIX_SIZE });
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
      this._buildTimer = setTimeout(() => {
        const count = this.data.playerCount;
        if (count > MAX_MATRIX_SIZE) {
          this.buildRelationList();
        } else {
          this.buildMatrix();
        }
      }, 50);
    },

    /** 构建矩阵（≤4人）：含对角线总分 */
    buildMatrix() {
      const members = this.data.memberGrid;
      if (!members || members.length < 2) {
        this.setData({ matrixMembers: [], matrixData: [] });
        return;
      }

      const records = this.data.scoreRecords;
      setTimeout(() => {
        // from→to 累计积分映射
        const pairMap = {};
        records.forEach(r => {
          const key = `${r.fromUserId}_${r.toUserId}`;
          pairMap[key] = (pairMap[key] || 0) + r.amount;
        });

        // 每人总净积分（对角线数据）
        // 判断是否为场次数据（fromUserId === toUserId 表示累计分记录）
        const isSessionData = records.length > 0 && String(records[0].fromUserId) === String(records[0].toUserId);
        const totalMap = {};
        if (isSessionData) {
          // 场次模式：amount 直接就是该用户在该批次的累计分，取最后一条即总分
          const lastMap = {};
          records.forEach(r => {
            lastMap[String(r.fromUserId)] = r.amount;
          });
          members.forEach(m => {
            totalMap[m.userId] = lastMap[String(m.userId)] || 0;
          });
        } else {
          // 房间模式：计算收到 - 付出
          members.forEach(m => {
            let net = 0;
            records.forEach(r => {
              if (String(r.toUserId) === String(m.userId)) net += r.amount;
              if (String(r.fromUserId) === String(m.userId)) net -= r.amount;
            });
            totalMap[m.userId] = net;
          });
        }

        // 矩阵成员
        const matrixMembers = members.map(m => ({
          userId: m.userId,
          nickname: m.nickname,
          avatarUrl: m.avatarUrl || '',
          avatarColor: m.avatarUrl ? '' : getColor(m.nickname),
          avatarChar: m.avatarUrl ? '' : getFirstChar(m.nickname)
        }));

        // 构建矩阵数据
        const matrixData = members.map(from => {
          const cells = members.map(to => {
            if (from.userId === to.userId) {
              // 对角线：展示该玩家总净积分
              const total = totalMap[to.userId] || 0;
              return {
                toUserId: to.userId,
                value: total,
                display: total === 0 ? '0' : this.formatScore(total),
                isDiagonal: true
              };
            }
            const received = pairMap[`${to.userId}_${from.userId}`] || 0;
            const sent = pairMap[`${from.userId}_${to.userId}`] || 0;
            const val = received - sent;
            return {
              toUserId: to.userId,
              value: val,
              display: val === 0 ? '0' : this.formatScore(val),
              isDiagonal: false
            };
          });
          return {
            fromUserId: from.userId,
            fromColor: from.avatarUrl ? '' : getColor(from.nickname),
            fromChar: from.avatarUrl ? '' : getFirstChar(from.nickname),
            fromAvatarUrl: from.avatarUrl || '',
            cells
          };
        });

        this.setData({ matrixMembers, matrixData });
      }, 0);
    },

    /** 构建一维关系列表（>4人）：我与他人的积分往来 */
    buildRelationList() {
      const members = this.data.memberGrid;
      if (!members || members.length < 2) {
        this.setData({ relationList: [] });
        return;
      }

      const records = this.data.scoreRecords;
      const myId = this.data.myUserId;
      if (!myId) {
        this.setData({ relationList: [] });
        return;
      }

      // 判断是否为场次数据
      const isSessionData = records.length > 0 && String(records[0].fromUserId) === String(records[0].toUserId);

      setTimeout(() => {
        const list = [];

        if (isSessionData) {
          // 场次模式：每人总分，我与他人的分差
          const scoreMap = {};
          records.forEach(r => {
            scoreMap[String(r.fromUserId)] = r.amount;
          });
          const myScore = scoreMap[String(myId)] || 0;
          members.forEach(m => {
            if (String(m.userId) === String(myId)) return;
            const otherScore = scoreMap[String(m.userId)] || 0;
            const diff = myScore - otherScore;
            if (diff === 0) return;
            list.push({
              userId: m.userId,
              nickname: m.nickname,
              avatarUrl: m.avatarUrl || '',
              avatarColor: m.avatarUrl ? '' : getColor(m.nickname),
              avatarChar: m.avatarUrl ? '' : getFirstChar(m.nickname),
              netScore: diff,
              display: this.formatScore(diff)
            });
          });
        } else {
          // 房间模式：计算收到 - 付出
          members.forEach(m => {
            if (String(m.userId) === String(myId)) return;
            let net = 0;
            records.forEach(r => {
              if (String(r.fromUserId) === String(myId) && String(r.toUserId) === String(m.userId)) {
                net -= r.amount;
              }
              if (String(r.fromUserId) === String(m.userId) && String(r.toUserId) === String(myId)) {
                net += r.amount;
              }
            });
            if (net === 0) return;
            list.push({
              userId: m.userId,
              nickname: m.nickname,
              avatarUrl: m.avatarUrl || '',
              avatarColor: m.avatarUrl ? '' : getColor(m.nickname),
              avatarChar: m.avatarUrl ? '' : getFirstChar(m.nickname),
              netScore: net,
              display: this.formatScore(net)
            });
          });
        }

        list.sort((a, b) => Math.abs(b.netScore) - Math.abs(a.netScore));
        this.setData({ relationList: list });
      }, 0);
    },

    /** 大数字格式化 */
    formatScore(val) {
      if (val === 0) return '0';
      const abs = Math.abs(val);
      const sign = val > 0 ? '+' : '-';
      if (abs >= 100000000) {
        const yi = Math.round(abs / 10000000) / 10;
        return sign + yi + '亿';
      }
      if (abs >= 10000) {
        const wan = Math.round(abs / 1000) / 10;
        return sign + wan + '万';
      }
      return (val > 0 ? '+' : '') + val;
    },

    // ========== 图表 ==========

    async loadChartData(roomId) {
      try {
        const data = await get(`/score/room/${roomId}/chart`);
        if (data && data.series && data.series.length > 0) {
          const series = data.series;
          const timestamps = data.timestamps || [];

          if (this.data.playerCount > MAX_MATRIX_SIZE) {
            // 聚焦模式：只显示第一名、最后一名、我、平均分
            const focusData = this.buildChartFocusData(series, timestamps);
            this.setData({
              chartTimestamps: timestamps,
              chartSeries: focusData.series,
              chartVisibleUsers: focusData.visibleIds
            });
          } else {
            this.setData({
              chartTimestamps: timestamps,
              chartSeries: series,
              chartVisibleUsers: series.map(s => String(s.userId))
            });
          }
        } else {
          this.setData({ chartTimestamps: [], chartSeries: [], chartVisibleUsers: [] });
        }
      } catch (e) {
        console.error('[matrix-overview] 加载图表数据失败', e);
        this.setData({ chartTimestamps: [], chartSeries: [], chartVisibleUsers: [] });
      }
    },

    /** 构建图表聚焦数据：第一名、最后一名、我、平均分 */
    buildChartFocusData(series, timestamps) {
      const myId = this.data.myUserId;
      const n = timestamps.length;
      if (n === 0 || series.length === 0) return { series, visibleIds: series.map(s => String(s.userId)) };

      // 按最终得分排序
      const sorted = [...series].sort((a, b) => {
        const aLast = a.scores[a.scores.length - 1] || 0;
        const bLast = b.scores[b.scores.length - 1] || 0;
        return bLast - aLast;
      });

      const focusSet = new Set();
      // 第一名
      if (sorted[0]) focusSet.add(String(sorted[0].userId));
      // 最后一名
      if (sorted.length > 1) focusSet.add(String(sorted[sorted.length - 1].userId));
      // 我
      const meInSeries = series.find(s => String(s.userId) === String(myId));
      if (meInSeries) focusSet.add(String(myId));
      // 如果不足2人，补上
      if (focusSet.size < 2 && sorted.length > 1) {
        focusSet.add(String(sorted[1].userId));
      }

      // 计算平均分 series
      const avgScores = [];
      for (let i = 0; i < n; i++) {
        let sum = 0;
        series.forEach(s => { sum += (s.scores[i] || 0); });
        avgScores.push(Math.round(sum / series.length));
      }
      const avgSeries = {
        userId: '__avg__',
        nickname: '平均分',
        scores: avgScores
      };

      const resultSeries = [...series.filter(s => focusSet.has(String(s.userId))), avgSeries];
      const visibleIds = resultSeries.map(s => String(s.userId));

      return { series: resultSeries, visibleIds };
    },

    toggleChartMember(e) {
      const userId = String(e.currentTarget.dataset.userId);
      let visible = [...this.data.chartVisibleUsers];
      const idx = visible.indexOf(userId);
      if (idx >= 0) {
        visible.splice(idx, 1);
      } else {
        visible.push(userId);
      }
      this.setData({ chartVisibleUsers: visible });
    },

    /** 加载场次数据：从 batches 构建 scoreRecords 和图表数据 */
    async loadSessionData(sessionId) {
      try {
        const data = await get(`/score/session/${sessionId}`);
        if (!data) return;

        const batches = data.batches || [];
        const playerTotals = data.playerTotals || {};
        const members = this.data.memberGrid || [];

        // batches API 返回时间倒序，转为正序
        const sortedBatches = [...batches].reverse();

        // 从 batches 构建 scoreRecords（每条记录 = 一个用户在一个批次的累计分）
        const records = [];
        sortedBatches.forEach(batch => {
          const time = batch.batchTime;
          (batch.scores || []).forEach(s => {
            records.push({
              id: `${sessionId}_${batch.batchTime}_${s.userId}`,
              fromUserId: s.userId,
              toUserId: s.userId,
              amount: s.score || 0,
              timeFormatted: time ? this._fmtBatchTime(time) : '',
              createdAt: time
            });
          });
        });

        // 从 batches 构建图表数据（时间轴 + 每人累计分曲线）
        const timestamps = sortedBatches.map(b => b.batchTime);
        const userMap = {};
        sortedBatches.forEach(batch => {
          (batch.scores || []).forEach(s => {
            const uid = String(s.userId);
            if (!userMap[uid]) userMap[uid] = { userId: s.userId, nickname: s.nickname || '', scores: [] };
            userMap[uid].scores.push(s.score || 0);
          });
        });
        const series = Object.values(userMap);

        const count = members.length;
        this.setData({
          scoreRecords: records,
          chartTimestamps: timestamps,
          chartSeries: series,
          chartVisibleUsers: series.map(s => String(s.userId)),
          playerCount: count,
          animEnabled: count <= MAX_MATRIX_SIZE
        });
        this._scheduleBuild();
      } catch (e) {
        console.error('[matrix-overview] 加载场次数据失败', e);
      }
    },

    _fmtBatchTime(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      const pad = n => String(n).padStart(2, '0');
      return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    // ========== 积分明细 ==========

    onMatrixCell(e) {
      const { from, to } = e.currentTarget.dataset;
      if (!from || !to) return;
      // 场次模式下对角线无明细，跳过
      const isSessionData = this.data.scoreRecords.length > 0 &&
        String(this.data.scoreRecords[0].fromUserId) === String(this.data.scoreRecords[0].toUserId);
      if (isSessionData) return;
      if (from === to) return;

      const members = this.data.memberGrid;
      const fromMember = members.find(m => String(m.userId) === String(from));
      const toMember = members.find(m => String(m.userId) === String(to));
      if (!fromMember || !toMember) return;

      const records = this.data.scoreRecords;
      const pairRecords = records.filter(r =>
        (String(r.fromUserId) === String(from) && String(r.toUserId) === String(to)) ||
        (String(r.fromUserId) === String(to) && String(r.toUserId) === String(from))
      ).map(r => {
        const isForward = String(r.fromUserId) === String(from);
        return {
          id: r.id,
          amount: isForward ? -r.amount : r.amount,
          timeFormatted: r.timeFormatted
        };
      }).sort((a, b) => (b.timeFormatted || '').localeCompare(a.timeFormatted || ''));

      const net = pairRecords.reduce((sum, r) => sum + r.amount, 0);

      this.setData({
        showMatrixDetail: true,
        detailFrom: fromMember,
        detailTo: toMember,
        detailNet: net,
        detailRecords: pairRecords
      });
    },

    /** 从一维列表点击查看详情 */
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
        return {
          id: r.id,
          amount: isForward ? -r.amount : r.amount,
          timeFormatted: r.timeFormatted
        };
      }).sort((a, b) => (b.timeFormatted || '').localeCompare(a.timeFormatted || ''));

      const net = pairRecords.reduce((sum, r) => sum + r.amount, 0);

      this.setData({
        showMatrixDetail: true,
        detailFrom: me,
        detailTo: other,
        detailNet: net,
        detailRecords: pairRecords
      });
    },

    closeMatrixDetail() {
      this.setData({ showMatrixDetail: false });
    },

    // ========== 面板开关 ==========

    closePanel() {
      this.triggerEvent('close');
    },

    preventClose() {}
  }
});
