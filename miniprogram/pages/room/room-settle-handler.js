/**
 * 结算、退出与分享交互处理器
 * 从 room.js 提取，负责结算封存、微信分享、保存相册及退出编队等逻辑
 * 使用时通过 Object.assign 混入 Page 对象，this 指向页面实例
 */
const { vibrateShort } = require('../../utils/haptic');
const { getAvatarView } = require('../../utils/avatar');
const { retryWithBackoff } = require('../../utils/retry');
const roomService = require('../../services/room-service');
const scoreService = require('../../services/score-service');
const app = getApp();

/** 统一编队页状态重置数据（退出/封存/错误/关闭弹层共用） */
function resetRoomData() {
  return {
    currentRoom: null,
    viewingRoom: false,
    isOwner: false,
    ranking: [],
    scoreRecords: [],
    relationMap: {},
    matrixChartData: null,
    matrixChartRoomId: '',
    memberGrid: [],
    seatList: [],
    selectedCrew: null,
    cockpitScrollTarget: '',
    matrixData: [],
    roundRecord: null,
    canSealRoom: false,
    showHostFill: false,
    showMemberFill: false,
    showRoundConfirm: false,
    showRejectConfirm: false,
    wsReconnecting: false,
    wsConnected: false,
    cockpitState: 'idle',
    pulseValue: '',
    pulseTraces: [],
    showSettleOverlay: false,
    showMatrixPanel: false,
    showPulsePanel: false,
    showNumpad: false,
    showShareSheet: false,
    showMorePanel: false
  };
}

const roomSettleHandler = {
  copyRoomNo() {
    vibrateShort('light');
    if (!this.data.currentRoom) return;
    wx.setClipboardData({
      data: this.data.currentRoom.roomNo,
      success: () => this.showToast('编队码已复制')
    });
  },

  confirmLeaveOrDisband() {
    if (this.data.submitting) return;
    const room = this.data.currentRoom;
    if (!room) return;

    this.setData({ submitting: true, leaveConfirmVisible: false });
    const isOwner = this.data.isOwner;
    
    const doDisband = () => {
      wx.showLoading({ title: '正在解散...' });
      return roomService.quitRoom(room.roomId).then(resp => {
        wx.hideLoading();
        this.onDisbandSuccess(resp);
      }).catch(err => {
        wx.hideLoading();
        this.onDisbandFail(err);
      }).finally(() => {
        this.setData({ submitting: false });
      });
    };

    const doLeave = () => {
      return roomService.quitRoom(room.roomId).then(() => {
        this.onLeaveSuccess();
      }).catch(err => {
        this.onLeaveFail(err);
      }).finally(() => {
        this.setData({ submitting: false });
      });
    };

    if (isOwner) {
      doDisband();
    } else {
      doLeave();
    }
  },

  onDisbandSuccess(resp) {
    wx.removeStorageSync('currentRoomId');
    wx.showToast({ title: '编队已解散', icon: 'success' });
    this.setData(resetRoomData());
    this.updateCockpitState();
  },

  onDisbandFail(err) {
    wx.showToast({ title: err.message || '解散失败', icon: 'none' });
  },

  onLeaveSuccess() {
    wx.removeStorageSync('currentRoomId');
    wx.showToast({ title: '已撤离编队', icon: 'success' });
    this.setData(resetRoomData());
    this.updateCockpitState();
  },

  onLeaveFail(err) {
    wx.showToast({ title: err.message || '撤离失败', icon: 'none' });
  },

  // ========== 分享面板 ==========

  /** 兼容多种后端返回结构，提取二维码 URL */
  normalizeQrUrl(resp) {
    if (!resp) return null;
    // 直接字段
    if (resp.qrCodeUrl) return resp.qrCodeUrl;
    // 嵌套在 data 中
    if (resp.data && resp.data.qrCodeUrl) return resp.data.qrCodeUrl;
    if (resp.data && resp.data.url) return resp.data.url;
    if (resp.url) return resp.url;
    return null;
  },

  async getQrCodeUrl(roomNo, roomId) {
    const cacheKey = `qr:${roomNo}`;
    const cached = wx.getStorageSync(cacheKey);
    if (cached && Date.now() - cached.ts < 3600000) {
      return cached.url;
    }

    const fetchUrl = async () => {
      const resp = await roomService.getRoomDetail(roomId);
      return this.normalizeQrUrl(resp);
    };

    const url = await retryWithBackoff(fetchUrl, 3, 1000);
    if (url) {
      wx.setStorageSync(cacheKey, { url, ts: Date.now() });
    }
    return url;
  },

  async openShareSheet() {
    const roomNo = this.data.currentRoom?.roomNo;
    const roomId = this.data.currentRoom?.roomId;
    if (!roomNo || !roomId) return;

    this.setData({ showShareSheet: true, qrFailed: false });

    // 已有二维码则跳过
    if (this.data.currentRoom.qrCodeUrl) return;

    this.setData({ qrLoading: true });
    try {
      const url = await this.getQrCodeUrl(roomNo, roomId);
      if (url) {
        this.setData({ 'currentRoom.qrCodeUrl': url, qrFailed: false });
      } else {
        this.setData({ qrFailed: true });
      }
    } catch (e) {
      this.setData({ qrFailed: true });
    } finally {
      this.setData({ qrLoading: false });
    }
  },

  closeShareSheet() {
    this.setData({ showShareSheet: false });
  },

  async retryLoadQrCode() {
    if (this.data.qrLoading) return;
    const roomNo = this.data.currentRoom?.roomNo;
    const roomId = this.data.currentRoom?.roomId;
    if (!roomNo || !roomId) return;
    this.setData({ qrLoading: true, qrFailed: false });
    try {
      const url = await this.getQrCodeUrl(roomNo, roomId);
      if (url) {
        this.setData({ 'currentRoom.qrCodeUrl': url, qrFailed: false });
      } else {
        this.setData({ qrFailed: true });
      }
    } catch (e) {
      this.setData({ qrFailed: true });
    } finally {
      this.setData({ qrLoading: false });
    }
  },

  copyRoomLink() {
    const roomNo = this.data.currentRoom?.roomNo || '';
    wx.setClipboardData({
      data: roomNo,
      success: () => {
        wx.showToast({ title: '编队码已复制', icon: 'success' });
        this.closeShareSheet();
      }
    });
  },

  sharePoster() {
    // 保存二维码到相册
    const qrUrl = this.data.currentRoom?.qrCodeUrl;
    if (!qrUrl) {
      wx.showToast({ title: '暂无二维码', icon: 'none' });
      return;
    }
    wx.downloadFile({
      url: qrUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              wx.showToast({ title: '已保存到相册', icon: 'success' });
              this.closeShareSheet();
            },
            fail: () => {
              wx.showToast({ title: '保存失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  onSettleTap() {
    this.setData({ showSettleConfirm: true });
  },

  closeSettleConfirm() {
    this.setData({ showSettleConfirm: false });
  },

  confirmSettle() {
    this.setData({ showSettleConfirm: false });
    this.quitRoom();
  },

  async quitRoom() {
    const isOwner = this.data.isOwner;
    const roomId = this.data.currentRoom.roomId;
    try {
      if (isOwner) {
        this._settling = true;
        wx.showLoading({ title: '正在封存航程...' });
        // 1. 先归档数据
        const settleResp = await scoreService.settleRoom(roomId);
        wx.hideLoading();
        // 2. 断开 WS
        this.suppressWsReconnect();
        app.disconnectWS();
        this._settling = false;
        // 3. 有记分数据则展示结算弹层，否则提示空数据并回到编队待机
        const hasData = settleResp && (
          (settleResp.timestamps && settleResp.timestamps.length > 0) ||
          (settleResp.series && settleResp.series.some(s => s.scores && s.scores.length > 0))
        );
        if (hasData) {
          this.showSettleFromResp(settleResp);
        } else {
          this.setData(resetRoomData());
          wx.removeStorageSync('currentRoomId');
          wx.showToast({ title: '编队已关闭', icon: 'none', duration: 2000 });
        }
      } else {
        await roomService.quitRoom(roomId);
        this.suppressWsReconnect();
        app.disconnectWS();
        wx.removeStorageSync('currentRoomId');
        this.setData(resetRoomData());
        wx.showToast({ title: '已断开', icon: 'success' });
      }
    } catch (e) {
      this._settling = false;
      wx.hideLoading();
      const msg = e.message || '操作失败';
      // 编队已封存/已关闭时，清理本地状态回到待机
      if (msg.includes('已封存') || msg.includes('已关闭') || msg.includes('不可重复') || msg.includes('不存在')) {
        wx.removeStorageSync('currentRoomId');
        this.setData(resetRoomData());
        this.updateCockpitState();
        wx.showToast({ title: '航程已封存', icon: 'none', duration: 2000 });
      } else {
        wx.showToast({ title: msg, icon: 'none' });
      }
    }
  },

  /** 从 SettleResp 构建结算弹层数据并展示 */
  async showSettleFromResp(resp) {
    this._showingSettle = true;
    const timestamps = resp.timestamps || [];
    const series = resp.series || [];
    const visibleUsers = series.map(s => String(s.userId));
    const rankedMembers = (resp.memberScores || []).map(m => ({
      userId: m.userId,
      nickname: m.nickname || '?',
      ...getAvatarView(m.nickname, m.avatarUrl),
      finalScore: m.finalScore || 0,
    }));

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

    const now = new Date();
    const settleTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const eventMarkers = [];
    for (const s of series) {
      const scores = s.scores || [];
      for (let i = 1; i < scores.length; i++) {
        const delta = scores[i] - scores[i - 1];
        if (Math.abs(delta) === maxSingle && maxSingle > 0) {
          eventMarkers.push({ index: i, label: (delta > 0 ? '+' : '') + delta, color: delta > 0 ? '#32D74B' : '#FF453A' });
          break;
        }
      }
      if (eventMarkers.length > 0) break;
    }

    this.setData({
      showSettleOverlay: true,
      settleTimestamps: timestamps,
      settleSeries: series,
      settleVisibleUsers: visibleUsers,
      settleRankedMembers: rankedMembers,
      settleRoomNo: resp.roomNo || '',
      settleWinner: winner,
      settleLoser: loser,
      settleMaxSingle: maxSingle,
      settleMemberCount: rankedMembers.length,
      settleTime,
      settleEventMarkers: eventMarkers
    });

    const roomId = resp.roomId || (this.data.currentRoom && this.data.currentRoom.roomId);
    if (roomId) {
      Promise.all([
        scoreService.getRoomInsight(roomId).catch(() => null),
        scoreService.getRoomNetwork(roomId).catch(() => null)
      ]).then(([insightData, networkData]) => {
        const updates = {};
        if (insightData) {
          updates.settleInsight = insightData;
          updates.settleTotalTransfer = insightData.totalTransfer || 0;
          updates.settleTransferCount = insightData.transferCount || 0;
          if (insightData.maxSingleTransfer > maxSingle) {
            updates.settleMaxSingle = insightData.maxSingleTransfer;
          }
        }
        if (networkData) {
          updates.settleNetworkNodes = (networkData.nodes || []).map(n => ({
            ...n,
            ...getAvatarView(n.nickname, n.avatarUrl)
          }));
          updates.settleNetworkLinks = networkData.links || [];
        }
        updates.settlePersonaSignals = this._calcSettlePersonaSignals(rankedMembers, insightData, networkData);
        this.setData(updates);
      });
    }
  },

  /** 非房主收到 SETTLE WS 通知后拉取结算数据 */
  async fetchAndShowSettle(roomId) {
    try {
      const [chartData, roomData] = await Promise.all([
        scoreService.getRoomChart(roomId),
        roomService.getRoomDetail(roomId)
      ]);
      const timestamps = chartData.timestamps || [];
      const series = chartData.series || [];
      if (series.length === 0) return;
      const visibleUsers = series.map(s => String(s.userId));
      const memberMap = {};
      (roomData.members || []).forEach(m => { memberMap[String(m.userId)] = m; });
      const rankedMembers = series.map(s => {
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
      }).sort((a, b) => b.finalScore - a.finalScore);

      // 复用 showSettleFromResp 逻辑
      this.showSettleFromResp({
        timestamps,
        series,
        memberScores: rankedMembers.map(m => ({
          userId: m.userId,
          nickname: m.nickname,
          avatarUrl: m.avatarUrl,
          finalScore: m.finalScore
        })),
        roomNo: roomData.roomNo || '',
        roomId
      });
    } catch (e) {
      console.error('加载结算数据失败', e);
    }
  },

  /** 处理编队不存在错误，自动退出编队并返回基础页 */
  handleRoomNotFoundError(error) {
    console.warn('[room] 编队不存在，自动退出', error);
    // 清理本地存储
    wx.removeStorageSync('currentRoomId');
    // 断开WebSocket
    this.suppressWsReconnect();
    if (getApp()) {
      getApp().disconnectWS();
    }
    // 清理房间状态，返回基础页
    this.setData(resetRoomData());
    this.updateCockpitState();
    // 显示提示
    wx.showToast({
      title: error && error.message === '房间已关闭' ? '编队已关闭/解散，已自动退出' : '编队不存在，已自动退出',
      icon: 'none',
      duration: 2000
    });
    // 重新加载房间列表
    this.loadMyRooms();
    this.loadRecentRooms();

    // 优雅切回首页（避免卡在内页）
    const pages = getCurrentPages();
    if (pages.length > 0) {
      const currentPage = pages[pages.length - 1];
      if (currentPage.route !== 'pages/room/room') {
        wx.switchTab({ url: '/pages/room/room' });
      }
    }
  },

  /** 关闭结算弹层，回到编队待机 */
  closeSettleOverlay() {
    this._showingSettle = false;
    this._settling = false;
    this.setData({
      ...resetRoomData(),
      settleTimestamps: [],
      settleSeries: [],
      settleVisibleUsers: [],
      settleRankedMembers: [],
      settleRoomNo: '',
      settleWinner: null,
      settleLoser: null,
      settleMaxSingle: 0,
      settleTotalTransfer: 0,
      settleTransferCount: 0,
      settleMemberCount: 0,
      settleTime: '',
      settleNetworkNodes: [],
      settleNetworkLinks: [],
      settleInsight: null,
      settlePersonaSignals: null,
      settleEventMarkers: []
    });
  },

  _calcSettlePersonaSignals(rankedMembers, insight, network) {
    if (!rankedMembers || rankedMembers.length === 0) {
      return { socialActivity: '中', riskPreference: '中', resourceControl: '中', allianceTendency: '低' };
    }
    const n = rankedMembers.length;
    const myId = String(this.data.myUserId);
    const myData = rankedMembers.find(m => String(m.userId) === myId);

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
  }
};

module.exports = roomSettleHandler;
