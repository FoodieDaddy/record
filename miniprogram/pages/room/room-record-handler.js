/**
 * Room pulse record data, bounded live stream, and panel interactions.
 * Mixed into the room Page; methods use the page instance as this.
 */
const scoreService = require('../../services/score-service');
const { getColor, getFirstChar, normalizeAvatarUrl } = require('../../utils/avatar');
const { vibrateShort } = require('../../utils/haptic');
const { showError } = require('../../utils/error-handler');
const { SPARKLINE_EMPTY_POINTS, pickLatestTrace } = require('./room-view-model');
const app = getApp();

const roomRecordHandler = {
  appendLocalTransferRecord(fromUserId, toUserId, amount, now = Date.now()) {
    const room = this.data.currentRoom;
    if (!room || !room.members) return;

    const fromMember = room.members.find(m => String(m.userId) === String(fromUserId));
    const toMember = room.members.find(m => String(m.userId) === String(toUserId));
    if (!fromMember || !toMember) return;

    const myId = String(app.globalData.userId || '');
    const newRecord = {
      id: now,
      fromName: fromMember.nickname,
      fromAvatarUrl: normalizeAvatarUrl(fromMember.avatarUrl),
      fromColor: fromMember.avatarUrl ? '' : getColor(fromMember.nickname),
      fromChar: fromMember.avatarUrl ? '' : getFirstChar(fromMember.nickname),
      toName: toMember.nickname,
      toAvatarUrl: normalizeAvatarUrl(toMember.avatarUrl),
      toColor: toMember.avatarUrl ? '' : getColor(toMember.nickname),
      toChar: toMember.avatarUrl ? '' : getFirstChar(toMember.nickname),
      amount: amount,
      createdAt: now,
      timeFormatted: '刚刚',
      fromUserId: String(fromUserId),
      toUserId: String(toUserId),
      myRole: String(fromUserId) === myId ? 'from' : String(toUserId) === myId ? 'to' : '',
      isNew: true
    };

    const exists = (this.data.scoreRecords || []).some(r => {
      return String(r.fromUserId) === String(fromUserId) &&
             String(r.toUserId) === String(toUserId) &&
             Math.abs(r.amount) === Math.abs(amount) &&
             Math.abs(r.createdAt - now) < 2000;
    });

    if (exists) return;

    const allRecords = [newRecord, ...(this.data.scoreRecords || [])];
    if (allRecords.length > 24) {
      allRecords.length = 24;
    }

    this.setData({
      scoreRecords: allRecords,
      relationMap: this.buildRelationMap(allRecords)
    });
    this.rebuildPulseStats();
    this.rebuildRoomInsight();
    this.updateCanSealRoom();
    setTimeout(() => {
      if (this._destroyed) return;
      const settledRecords = (this.data.scoreRecords || []).map(record => (
        record.id === newRecord.id ? { ...record, isNew: false } : record
      ));
      this.setData({ scoreRecords: settledRecords });
      this.rebuildPulseStats();
    }, 2800);
  },

  rebuildRoomInsight() {
    const records = this.data.scoreRecords || [];
    let totalTransfer = 0;
    let maxSingle = 0;
    const userCount = {};

    records.forEach(r => {
      const amount = Math.abs(r.amount);
      totalTransfer += amount;
      if (amount > maxSingle) maxSingle = amount;
      userCount[r.fromUserId] = (userCount[r.fromUserId] || 0) + 1;
      userCount[r.toUserId] = (userCount[r.toUserId] || 0) + 1;
    });

    let topUserId = null;
    let topCount = 0;
    Object.keys(userCount).forEach(uid => {
      if (userCount[uid] > topCount) {
        topCount = userCount[uid];
        topUserId = uid;
      }
    });

    let activeUser = null;
    if (topUserId) {
      const member = (this.data.currentRoom?.members || []).find(m => String(m.userId) === String(topUserId));
      activeUser = {
        userId: topUserId,
        nickname: member ? member.nickname : '未知',
        avatarUrl: member ? member.avatarUrl : null,
        count: topCount
      };
    }

    const memberIds = new Set();
    records.forEach(r => {
      memberIds.add(String(r.fromUserId));
      memberIds.add(String(r.toUserId));
    });
    const n = memberIds.size;
    const eventCount = records.length;
    const density = (n > 1) ? eventCount / (n * (n - 1)) : 0;
    const densityLevel = density > 0.3 ? 'HIGH' : density > 0.1 ? 'MEDIUM' : 'LOW';

    this.setData({
      roomInsight: {
        totalTransfer,
        maxSingleTransfer: maxSingle,
        mostActiveUser: activeUser,
        transferCount: eventCount,
        networkDensity: densityLevel
      }
    });
  },

  async loadScoreRecords(roomId, reset) {
    if (!roomId) return;
    this.setData({ pulseRecordsLoading: true });
    try {
      const preloads = app.globalData.preloads || {};
      let resPromise = reset ? preloads.roomTransfers : null;
      
      if (resPromise) {
        delete preloads.roomTransfers;
      } else {
        resPromise = scoreService.getRoomTransfers(roomId, 1, 18);
      }

      const res = await resPromise;
      if (!res) return;

      const myId = app.globalData.userId;
      const pageRecords = (res.records || [])
        .map(t => {
          const fromAvatarUrl = normalizeAvatarUrl(t.fromUser.avatarUrl);
          const toAvatarUrl = normalizeAvatarUrl(t.toUser.avatarUrl);
          return {
            id: t.id,
            fromName: t.fromUser.nickname,
            fromAvatarUrl,
            fromColor: fromAvatarUrl ? '' : getColor(t.fromUser.nickname),
            fromChar: fromAvatarUrl ? '' : getFirstChar(t.fromUser.nickname),
            toName: t.toUser.nickname,
            toAvatarUrl,
            toColor: toAvatarUrl ? '' : getColor(t.toUser.nickname),
            toChar: toAvatarUrl ? '' : getFirstChar(t.toUser.nickname),
            amount: t.amount,
            createdAt: t.createdAt,
            timeFormatted: this.formatTime(t.createdAt),
            fromUserId: t.fromUser.userId,
            toUserId: t.toUser.userId,
            myRole: String(t.fromUser.userId) === String(myId) ? 'from' : String(t.toUser.userId) === String(myId) ? 'to' : ''
          };
        });

      const allRecords = pageRecords.slice(0, 18);

      this.setData({
        scoreRecords: allRecords,
        relationMap: this.buildRelationMap(allRecords)
      });
      this.rebuildPulseStats();
      this.updateCanSealRoom();
    } catch (e) {
      console.error('加载脉冲记录失败', e);
      if (e && (e.message === '编队不存在' || e.message === '房间已关闭' || e.code === 400)) {
        this.handleRoomNotFoundError(e);
        throw e;
      } else {
        showError('加载脉冲记录失败');
      }
    } finally {
      this.setData({ pulseRecordsLoading: false });
    }
  },

  buildRelationMap(records = []) {
    const map = {};
    records.forEach(record => {
      const from = String(record.fromUserId || record.fromId || '');
      const to = String(record.toUserId || record.toId || '');
      const amount = Number(record.amount || record.score || 0);
      if (!from || !to || Number.isNaN(amount)) return;
      const key = `${from}->${to}`;
      map[key] = (map[key] || 0) + amount;
    });
    return map;
  },

  rebuildPulseStats(memberGridOverride) {
    const patch = this._calcPulseStatsPatch(memberGridOverride);
    this.scheduleRoomPatch(patch, { immediate: true });
  },

  _calcPulseStatsPatch(memberGridOverride) {
    const records = this.data.scoreRecords || [];
    const members = memberGridOverride || this.data.memberGrid || [];
    const myId = String(this.data.myUserId || app.globalData.userId || '');

    const traces = records.map(r => {
      const fromUserId = String(r.fromUserId);
      const toUserId = String(r.toUserId);
      const myRole = fromUserId === myId ? 'from' : toUserId === myId ? 'to' : '';
      const isMine = !!myRole;
      return {
        id: r.id,
        title: `${this.formatCrewName(r.fromName)} → ${this.formatCrewName(r.toName)}`,
        desc: r.timeFormatted || '',
        fromName: this.formatCrewName(r.fromName),
        fromAvatarUrl: r.fromAvatarUrl || '',
        toName: this.formatCrewName(r.toName),
        toAvatarUrl: r.toAvatarUrl || '',
        createdAt: r.createdAt,
        timeFormatted: r.timeFormatted || '',
        valueText: this.formatPulseValue(Math.abs(Number(r.amount || 0))),
        valueClass: isMine ? 'is-related' : '',
        myRole,
        isMine,
        isNew: !!r.isNew
      };
    });

    const totalAmount = records.reduce((sum, r) => sum + Math.abs(Number(r.amount || 0)), 0);
    const maxAmount = records.reduce((max, r) => Math.max(max, Math.abs(Number(r.amount || 0))), 0);
    const relatedCount = records.filter(r => String(r.fromUserId) === myId || String(r.toUserId) === myId).length;
    const filteredPulseTraces = this.data.traceFilterMine ? traces.filter(t => t.isMine) : traces;

    const chronological = records.slice().sort((a, b) => {
      const at = new Date(typeof a.createdAt === 'string' ? a.createdAt.replace(/-/g, '/') : (a.createdAt || 0)).getTime();
      const bt = new Date(typeof b.createdAt === 'string' ? b.createdAt.replace(/-/g, '/') : (b.createdAt || 0)).getTime();
      return at - bt;
    });
    const activeMembers = members.length ? members : (this.data.currentRoom && this.data.currentRoom.members || []);
    const memberIds = activeMembers.map(m => String(m.userId));
    const scoreMap = {};
    memberIds.forEach(uid => { scoreMap[uid] = 0; });

    const traceChartTimestamps = chronological.length ? ['起点'] : [];
    const seriesMap = {};
    activeMembers.forEach(m => {
      seriesMap[String(m.userId)] = {
        userId: m.userId,
        nickname: m.nickname,
        scores: chronological.length ? [0] : []
      };
    });

    chronological.forEach(r => {
      const fromId = String(r.fromUserId);
      const toId = String(r.toUserId);
      if (scoreMap[fromId] === undefined) scoreMap[fromId] = 0;
      if (scoreMap[toId] === undefined) scoreMap[toId] = 0;
      if (!seriesMap[fromId]) {
        seriesMap[fromId] = { userId: r.fromUserId, nickname: r.fromName, scores: traceChartTimestamps.map(() => 0) };
      }
      if (!seriesMap[toId]) {
        seriesMap[toId] = { userId: r.toUserId, nickname: r.toName, scores: traceChartTimestamps.map(() => 0) };
      }

      scoreMap[fromId] -= Number(r.amount || 0);
      scoreMap[toId] += Number(r.amount || 0);
      traceChartTimestamps.push(this.formatTraceTime(r.createdAt));
      Object.keys(seriesMap).forEach(uid => {
        seriesMap[uid].scores.push(scoreMap[uid] || 0);
      });
    });

    const traceChartSeries = Object.values(seriesMap).filter(s => s.scores.length > 0);
    const traceChartVisibleUsers = traceChartSeries.map(s => String(s.userId)).slice(0, 8);

    const selfSeries = traceChartSeries.find(s => String(s.userId) === myId) || traceChartSeries[0];
    let traceChartSparkline = [];
    if (selfSeries && selfSeries.scores.length > 1) {
      const raw = selfSeries.scores.slice(-8);
      const pointCount = Math.min(8, Math.max(5, raw.length));
      const sampled = Array.from({ length: pointCount }, (_, i) => {
        const sourceIndex = pointCount > 1
          ? Math.round((i / (pointCount - 1)) * (raw.length - 1))
          : 0;
        return raw[sourceIndex] || 0;
      });
      const min = Math.min(...sampled);
      const max = Math.max(...sampled);
      const range = max - min || 1;
      traceChartSparkline = sampled.map((v, i) => ({
        y: Math.round(((v - min) / range) * 64 + 18),
        x: pointCount > 1 ? Math.round((i / (pointCount - 1)) * 100) : 50
      }));
    }

    const lastTrace = pickLatestTrace(traces);
    const sparklinePoints = traceChartSparkline.length > 0
      ? traceChartSparkline.slice(-8)
      : SPARKLINE_EMPTY_POINTS;

    return {
      pulseTraces: traces,
      filteredPulseTraces,
      pulseStats: {
        transferCount: records.length,
        relatedCount,
        totalAmount: this.formatPulseValue(totalAmount),
        maxAmount: this.formatPulseValue(maxAmount)
      },
      traceChartTimestamps,
      traceChartSeries,
      traceChartVisibleUsers,
      traceChartSparkline,
      'cockpitView.transferCount': records.length,
      'cockpitView.totalPulse': this.formatPulseValue(totalAmount),
      'cockpitView.lastPulseText': lastTrace ? lastTrace.title : '等待更多脉冲写入',
      'cockpitView.lastPulseAmount': lastTrace ? lastTrace.valueText : '',
      'cockpitView.sparklinePoints': sparklinePoints,
      'cockpitView.hasTrajectory': traceChartSparkline.length > 0
    };
  },

  setTraceFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ traceFilterMine: filter === 'mine' });
    this.rebuildPulseStats();
  },

  toggleBlackboxPanel() {
    const nextOpen = !this.data.blackboxPanelOpen;
    this.setData({ blackboxPanelOpen: nextOpen });
    if (nextOpen && this.data.currentRoom) {
      this.loadTransferAmountSuggestions(this.data.currentRoom.roomId);
    }
  },

  togglePulsePanel() {
    this.setData({ showPulsePanel: !this.data.showPulsePanel });
  },

  goPulseTrajectory() {
    vibrateShort('light');
    if (!this.data.scoreRecords.length) {
      this.showToast('等待更多脉冲写入');
      return;
    }
    this.openMatrixPanel();
  },

  setBlackboxView(e) {
    const view = e.currentTarget.dataset.view || 'trace';
    this.setData({ blackboxView: view });
  },

  openPulseLogPanel() {
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    this.setData({ filterMine: false, showPulseLogPanel: true });
  },

  closePulseLogPanel() {
    this.setData({ showPulseLogPanel: false }, () => {
      wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    });
  },

};

module.exports = roomRecordHandler;
