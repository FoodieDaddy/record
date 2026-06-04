const { get, post, del } = require('../../utils/request');
const { retryWithBackoff } = require('../../utils/retry');
const scoreWS = require('../../utils/score-ws');
const { getColor, getFirstChar } = require('../../utils/avatar');
const { speakTransfer } = require('../../utils/voice');
const { getAudioManager } = require('../../utils/audio-manager');
const app = getApp();

Page({
  data: {
    isLoggedIn: false,
    currentRoom: null,
    viewingRoom: false,
    isOwner: false,
    joinRoomNo: '',
    joining: false,
    // 记分模式：1=自由流转 2=赢家统录
    scoreMode: 1,
    // 6 格 OTP 输入
    otpValues: ['', '', '', '', '', ''],
    otpBoxes: [0, 1, 2, 3, 4, 5],
    otpFocusIndex: 0,
    otpInputFocused: false,
    otpRawValue: '',
    creating: false,
    loading: false,
    ranking: [],
    submitting: false,
    audioEnabled: true,
    // 成员网格
    memberGrid: [],
    // 视图模式：grid=简易网格 seat=座位模式
    viewMode: 'grid',
    seatScoreMap: {},
    myUserId: '',
    // 座位编辑模式
    seatEditMode: false,
    editSelectedUserId: '',
    seatLayoutType: 'circle',
    // 计分目标
    transferTo: '',
    transferToInfo: null,
    showNumpad: false,
    numpadValue: 0,
    // 计分动画
    animActive: false,
    animCurX: 0,
    animCurY: 0,
    animCurOpacity: 1,
    animCurScale: 1,
    animAmount: 0,
    animFlashOpacity: 0,
    animTrail1X: 0,
    animTrail1Y: 0,
    animTrail1Opacity: 0,
    animTrail1Scale: 0.6,
    animTrail2X: 0,
    animTrail2Y: 0,
    animTrail2Opacity: 0,
    animTrail2Scale: 0.4,
    // 积分记录
    scoreRecords: [],
    groupedRecords: [],
    filterMine: false,
    loadingMore: false,
    noMore: false,
    // 积分总览弹窗
    showMatrixPanel: false,
    // 结算弹层
    showSettleOverlay: false,
    settleTimestamps: [],
    settleSeries: [],
    settleVisibleUsers: [],
    settleRankedMembers: [],
    settleRoomNo: '',
    // 历史场次
    // 分享面板
    showShareSheet: false,
    // 积分记录滚动高度（rpx）
    scoreRecordHeight: 400,
    // 顶部提示
    toastMsg: '',
    toastType: 'success'
  },

  onShow() {
    const audioEnabled = wx.getStorageSync('audioEnabled') !== false;
    app.globalData.audioEnabled = audioEnabled;
    this.setData({
      isLoggedIn: !!app.globalData.token,
      audioEnabled,
      myUserId: String(app.globalData.userId || '')
    });
    this.calcScoreRecordHeight();
    // 订阅 WebSocket 消息（绑定稳定引用）
    if (!this._onWsMessage) {
      this._onWsMessage = this.onWsMessage.bind(this);
    }
    scoreWS.on('message', this._onWsMessage);
    if (app.globalData.token && !this.data.viewingRoom) {
      this.loadMyRooms();
    }
  },

  onLoad(options) {
    if (options.scene) {
      this.joinByRoomNo(decodeURIComponent(options.scene));
    }
    if (options.roomNo) {
      this.joinByRoomNo(options.roomNo);
    }
  },

  onUnload() {
    // 仅取消订阅，不销毁全局连接
    if (this._onWsMessage) {
      scoreWS.off('message', this._onWsMessage);
    }
    // 清理定时器
    if (this._rollTimer) {
      clearTimeout(this._rollTimer);
      this._rollTimer = null;
    }
    if (this._toastTimer) {
      clearTimeout(this._toastTimer);
      this._toastTimer = null;
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  showToast(msg, type = 'success') {
    this.setData({ toastMsg: msg, toastType: type });
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.setData({ toastMsg: '' });
      this._toastTimer = null;
    }, 1500);
  },

  calcScoreRecordHeight() {
    try {
      const win = wx.getWindowInfo();
      // 屏幕高度 px → rpx，取 40% 作为积分记录区域高度
      const rpxRatio = 750 / win.windowWidth;
      const screenH = win.windowHeight * rpxRatio;
      this.setData({ scoreRecordHeight: Math.round(screenH * 0.4) });
    } catch (e) {}
  },

  // ========== 房间加载 ==========

  async loadMyRooms() {
    // 结算弹层展示中，忽略房间列表刷新（避免覆盖结算状态）
    if (this._showingSettle) return;
    this.setData({ loading: true });
    try {
      const rooms = await get('/room/my');
      if (rooms && rooms.length > 0) {
        const room = rooms[0];
        this.setData({
          currentRoom: room,
          viewingRoom: true,
          isOwner: String(room.ownerId) === String(app.globalData.userId),
          seatLayoutType: room.layoutType || 'circle'
        });
        this.enrichMembers(room);
        this.loadRoomData(room.roomId);
        this.connectWS(room.roomId);
      } else {
        this.setData({ currentRoom: null, viewingRoom: false, ranking: [], scoreRecords: [], memberGrid: [], matrixData: [] });
      }
    } catch (e) {
      console.error('加载房间失败', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  enrichMembers(room) {
    if (!room || !room.members) return;
    room.members = room.members.map(m => ({
      ...m,
      avatarColor: m.avatarUrl ? '' : getColor(m.nickname),
      avatarChar: m.avatarUrl ? '' : getFirstChar(m.nickname)
    }));
    this.setData({ currentRoom: room });
    this._cellRectsCache = null;
    this.buildMemberGrid();
  },

  buildMemberGrid() {
    const room = this.data.currentRoom;
    if (!room || !room.members) return;
    // 按座位号排序，确保座位布局一致
    const sorted = [...room.members].sort((a, b) => (a.seatNo || 0) - (b.seatNo || 0));
    const rankingMap = {};
    this.data.ranking.forEach(r => { rankingMap[r.userId] = r.score || 0; });
    const scores = sorted.map(m => rankingMap[m.userId] || 0);
    const animMap = this._animatingScores || {};
    const oldGrid = this.data.memberGrid || [];
    const isRolling = !!this._rollTimer;
    const grid = sorted.map((m, i) => {
      const score = scores[i];
      const style = this.getScoreStyle(score);
      const isAnimating = m.userId in animMap;
      let displayScore;
      if (isRolling && isAnimating) {
        // 滚动动画进行中，保留当前帧的 displayScore
        const old = oldGrid.find(g => g.userId === m.userId);
        displayScore = old ? old.displayScore : score;
      } else if (isAnimating) {
        // 粒子动画阶段，使用快照的旧分
        displayScore = animMap[m.userId];
      } else {
        displayScore = score;
      }
      return {
        ...m,
        score,
        displayScore,
        scoreFontSize: style.fontSize,
        scoreColor: style.color
      };
    });
    const seatScoreMap = {};
    grid.forEach(m => { seatScoreMap[m.userId] = m.score; });
    this.setData({ memberGrid: grid, seatScoreMap });
  },

  async loadRoomData(roomId) {
    await Promise.all([
      this.loadRanking(roomId),
      this.loadScoreRecords(roomId, true)
    ]);
  },

  async loadRanking(roomId) {
    try {
      const ranking = await get(`/score/room/${roomId}/ranking`);
      if (!ranking) return;

      const maxScore = Math.max(...ranking.map(r => Math.abs(r.score || 0)), 1);
      const enriched = ranking.map(r => ({
        ...r,
        avatarColor: r.avatarUrl ? '' : getColor(r.nickname),
        avatarChar: r.avatarUrl ? '' : getFirstChar(r.nickname),
        barWidth: Math.round(Math.abs(r.score || 0) / maxScore * 100)
      }));
      this.setData({ ranking: enriched });
      this.buildMemberGrid();
    } catch (e) {
      console.error('加载排行榜失败', e);
    }
  },

  async loadScoreRecords(roomId, reset) {
    if (!roomId) return;
    if (reset) {
      this._transferPage = 1;
      this._transferNoMore = false;
      this.setData({ noMore: false });
    } else if (this._transferNoMore) {
      return;
    }
    const page = this._transferPage || 1;
    try {
      const res = await get(`/score/transfer/room/${roomId}?page=${page}&size=20`);
      if (!res) return;

      const myId = app.globalData.userId;
      const pageRecords = (res.records || [])
        .map(t => ({
          id: t.id,
          fromName: t.fromUser.nickname,
          fromAvatarUrl: t.fromUser.avatarUrl || '',
          fromColor: t.fromUser.avatarUrl ? '' : getColor(t.fromUser.nickname),
          fromChar: t.fromUser.avatarUrl ? '' : getFirstChar(t.fromUser.nickname),
          toName: t.toUser.nickname,
          toAvatarUrl: t.toUser.avatarUrl || '',
          toColor: t.toUser.avatarUrl ? '' : getColor(t.toUser.nickname),
          toChar: t.toUser.avatarUrl ? '' : getFirstChar(t.toUser.nickname),
          amount: t.amount,
          createdAt: t.createdAt,
          timeFormatted: this.formatTime(t.createdAt),
          fromUserId: t.fromUser.userId,
          toUserId: t.toUser.userId,
          myRole: String(t.fromUser.userId) === String(myId) ? 'from' : String(t.toUser.userId) === String(myId) ? 'to' : ''
        }));

      const allRecords = reset ? pageRecords : [...this.data.scoreRecords, ...pageRecords];
      if (pageRecords.length < 20) {
        this._transferNoMore = true;
        this.setData({ noMore: true });
      }
      this._transferPage = page + 1;

      this.setData({ scoreRecords: allRecords });
      this.rebuildGroupedRecords();
    } catch (e) {
      console.error('加载积分记录失败', e);
    }
  },

  /** 按分钟分组 + 过滤 */
  rebuildGroupedRecords() {
    const records = this.data.scoreRecords;
    const filtered = this.data.filterMine
      ? records.filter(r => r.myRole === 'from' || r.myRole === 'to')
      : records;

    const today = this.formatDay(new Date());
    const groups = filtered.reduce((acc, r) => {
      const d = new Date(r.createdAt);
      const key = this.formatTime(r.createdAt);
      const day = this.formatDay(d);
      const display = day === today
        ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        : key;
      const last = acc[acc.length - 1];
      if (last && last.timeKey === key) {
        last.records.push(r);
      } else {
        acc.push({ timeKey: key, timeDisplay: display, records: [r] });
      }
      return acc;
    }, []);

    this.setData({ groupedRecords: groups });
  },

  /** 过滤 toggle */
  toggleFilterMine() {
    this.setData({ filterMine: !this.data.filterMine });
    this.rebuildGroupedRecords();
  },

  /** 滚动到底加载更多 */
  onScoreScrollToLower() {
    if (this.data.loadingMore || this._transferNoMore) return;
    const roomId = this.data.currentRoom?.roomId;
    if (!roomId) return;
    this.setData({ loadingMore: true });
    this.loadScoreRecords(roomId, false).finally(() => {
      this.setData({ loadingMore: false });
    });
  },

  formatDay(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },

  // ========== 积分总览 ==========

  async openMatrixPanel() {
    const room = this.data.currentRoom;
    if (!room) return;
    await this.updateAllData(room.roomId);
    this.setData({ showMatrixPanel: true });
  },

  closeMatrixPanel() {
    this.setData({ showMatrixPanel: false });
  },

  onMatrixClose() {
    this.setData({ showMatrixPanel: false });
  },

  // ========== 历史场次 ==========

  // ========== WebSocket ==========

  /** 连接房间 WebSocket（通过全局单例） */
  connectWS(roomId) {
    app.connectWS(roomId);
  },

  /** WebSocket 消息处理（通过 scoreWS.on 绑定） */
  onWsMessage(data) {
    if (!this.data.currentRoom) return;
    const roomId = this.data.currentRoom.roomId;

    // 结算通知：房主已在 quitRoom 中处理，其他人拉取结算数据展示弹层
    if (data.type === 'SETTLE') {
      if (!this._settling && !this.data.showSettleOverlay) {
        this.fetchAndShowSettle(roomId);
      }
      return;
    }

    // 布局更新
    if (data.type === 'LAYOUT_UPDATE' && data.layoutType) {
      this.setData({ seatLayoutType: data.layoutType });
      return;
    }

    // 新成员加入
    if (data.type === 'MEMBER_JOIN' && data.userId) {
      const room = this.data.currentRoom;
      const members = room.members || [];
      const exists = members.some(m => String(m.userId) === String(data.userId));
      if (!exists) {
        members.push({
          userId: data.userId,
          nickname: data.nickname || '',
          avatarUrl: data.avatarUrl || '',
          seatNo: data.seatNo || 0
        });
        room.members = members;
        this.enrichMembers(room);
      }
      return;
    }

    // 成员离开
    if (data.type === 'MEMBER_LEAVE' && data.userId) {
      const room = this.data.currentRoom;
      room.members = (room.members || [])
        .filter(m => String(m.userId) !== String(data.userId));
      this.enrichMembers(room);
      return;
    }

    // 座位变更（换座/重排），刷新全部数据
    if (data.type === 'SEAT_UPDATE') {
      this.updateAllData(roomId);
      return;
    }

    if (data.type === 'SCORE_UPDATE' || data.type === 'MEMBER_UPDATE' || data.type === 'TRANSFER') {
      // MEMBER_UPDATE：内存更新成员昵称头像，无需 HTTP 请求
      if (data.type === 'MEMBER_UPDATE' && data.userId) {
        const members = (this.data.currentRoom.members || []).map(m => {
          if (String(m.userId) === String(data.userId)) {
            return { ...m, nickname: data.nickname || m.nickname, avatarUrl: data.avatarUrl || m.avatarUrl };
          }
          return m;
        });
        this.setData({ 'currentRoom.members': members });
        return;
      }

      if (data.type === 'TRANSFER' && data.fromUserId && data.toUserId && data.amount) {
        console.log('[WS] TRANSFER:', JSON.stringify(data), 'myUserId:', app.globalData.userId, 'audioEnabled:', app.globalData.audioEnabled);
        const myId = String(app.globalData.userId);
        const isSender = String(data.fromUserId) === myId;

        // 出分方已在 submitTransfer 中本地处理动画和数据刷新，跳过
        if (isSender) return;

        // 仅收分方语音播报（旁观者不播放）
        const isReceiver = String(data.toUserId) === myId;
        if (isReceiver && app.globalData.audioEnabled) {
          const members = this.data.currentRoom.members || [];
          const fromMember = members.find(m => String(m.userId) === String(data.fromUserId));
          const toMember = members.find(m => String(m.userId) === myId);
          const fromName = fromMember ? fromMember.nickname : '未知';
          const toName = toMember ? toMember.nickname : '未知';
          speakTransfer(fromName, toName, String(data.amount));
        }

        // 优先用 WS 推送的权威分数更新本地，避免额外 HTTP 请求
        if (data.fromNewScore !== undefined && data.toNewScore !== undefined) {
          // 先冻结旧分数（粒子动画期间保持显示旧值）
          const g = this.data.memberGrid;
          const fM = g.find(m => String(m.userId) === String(data.fromUserId));
          const tM = g.find(m => String(m.userId) === String(data.toUserId));
          this._animatingScores = {};
          this._animatingScores[data.fromUserId] = fM ? fM.displayScore : 0;
          this._animatingScores[data.toUserId] = tM ? tM.displayScore : 0;
          this._optimisticScoreUpdateFromWS(data.fromUserId, data.toUserId, data.fromNewScore, data.toNewScore);
          this.playTransferAnimation(data.fromUserId, data.toUserId, data.amount, () => {
            return this.loadScoreRecords(roomId, true).finally(() => this.buildMemberGrid());
          });
        } else {
          // 兼容：旧版后端未携带分数时，走 updateAllData
          this.playTransferAnimation(data.fromUserId, data.toUserId, data.amount, () => {
            return this.updateAllData(roomId);
          });
        }
      } else {
        this.updateAllData(roomId);
      }

      // SCORE_UPDATE 时播放情绪音频（优先级高于收款提示）
      if (data.type === 'SCORE_UPDATE' && app.globalData.audioEnabled && data.scores) {
        const myId = app.globalData.userId;
        const myScore = data.scores.find(s => String(s.userId) === String(myId));
        if (myScore && myScore.emotionAudioUrl) {
          getAudioManager().play(myScore.emotionAudioUrl);
        }
      }
    }
  },

  /** 刷新房间全部数据：排行榜 + 积分记录 + 房间信息（含成员列表） */
  async updateAllData(roomId) {
    await Promise.all([
      this.loadRanking(roomId),
      this.loadScoreRecords(roomId, true),
      this.reloadRoomInfo(roomId)
    ]);
  },

  async reloadRoomInfo(roomId) {
    try {
      const rooms = await get('/room/my');
      if (rooms && rooms.length > 0) {
        const room = rooms[0];
        this.setData({
          currentRoom: room,
          isOwner: String(room.ownerId) === String(app.globalData.userId),
          seatLayoutType: room.layoutType || 'circle'
        });
        this.enrichMembers(room);
      }
    } catch (e) {
      console.error('刷新房间信息失败', e);
    }
  },

  // ========== 创建/加入房间 ==========

  enterRoom() {
    const room = this.data.currentRoom;
    if (!room) return;
    this.setData({ viewingRoom: true });
    this.loadRoomData(room.roomId);
    this.connectWS(room.roomId);
  },

  onJoinInput(e) {
    this.setData({ joinRoomNo: e.detail.value.toUpperCase() });
  },

  // ========== 记分模式选择 ==========
  selectScoreMode(e) {
    const mode = Number(e.currentTarget.dataset.mode);
    if (mode === this.data.scoreMode) return;
    this.setData({ scoreMode: mode });
  },

  // ========== 6 格 OTP 输入 ==========
  onOtpBoxTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ otpFocusIndex: index, otpInputFocused: true });
  },

  onOtpInput(e) {
    const raw = (e.detail.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const chars = raw.split('');
    const values = ['', '', '', '', '', ''];
    for (let i = 0; i < 6 && i < chars.length; i++) {
      values[i] = chars[i];
    }
    const focusIndex = Math.min(chars.length, 5);
    this.setData({
      otpValues: values,
      otpRawValue: raw,
      otpFocusIndex: focusIndex,
      joinRoomNo: raw,
      otpInputFocused: raw.length < 6
    });
    // 输入满 6 位自动加入
    if (raw.length >= 6) {
      this.setData({ otpInputFocused: false });
      clearTimeout(this._autoJoinTimer);
      this._autoJoinTimer = setTimeout(() => {
        this.joinByNo();
      }, 100);
    }
  },

  onOtpBlur() {
    this.setData({ otpInputFocused: false });
  },

  resetOtpState() {
    clearTimeout(this._autoJoinTimer);
    this.setData({
      otpValues: ['', '', '', '', '', ''],
      otpFocusIndex: 0,
      otpInputFocused: false,
      otpRawValue: '',
      joinRoomNo: ''
    });
  },

  async createRoom() {
    if (this.data.creating) return;
    this.setData({ creating: true });
    try {
      const room = await post('/room', { scoreMode: this.data.scoreMode });
      this.resetOtpState();
      this.setData({ currentRoom: room, viewingRoom: true, isOwner: true, seatLayoutType: room.layoutType || 'circle' });
      await this.reloadRoomInfo(room.roomId);
      this.loadRoomData(room.roomId);
      this.connectWS(room.roomId);
      wx.showToast({ title: '房间已创建', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '创建失败', icon: 'none', duration: 2000 });
    } finally {
      this.setData({ creating: false });
    }
  },

  async joinByNo() {
    const roomNo = this.data.joinRoomNo.trim();
    if (!roomNo || roomNo.length < 6 || this.data.joining) return;
    this.setData({ joining: true });
    try {
      await this.joinByRoomNo(roomNo);
    } finally {
      this.setData({ joining: false });
    }
  },

  async joinByRoomNo(roomNo) {
    try {
      const room = await post('/room/join', { roomNo });
      this.setData({
        currentRoom: room,
        viewingRoom: true,
        isOwner: String(room.ownerId) === String(app.globalData.userId),
        seatLayoutType: room.layoutType || 'circle'
      });
      this.resetOtpState();
      // 先加载排名数据（含成员信息），再构建成员网格，避免 0 分闪烁
      await this.loadRoomData(room.roomId);
      // 刷新完整房间信息（成员列表可能比 join 响应更完整）
      this.reloadRoomInfo(room.roomId);
      this.connectWS(room.roomId);
      wx.showToast({ title: '已加入房间', icon: 'success' });
    } catch (e) {
      if (e && e.code === 4003) {
        // 房间已满：温柔提示 + 退回最后一位输入
        wx.showToast({ title: '当前房间已满员（最多16人）', icon: 'none', duration: 2500 });
        const vals = this.data.otpValues.slice();
        vals[5] = '';
        this.setData({
          otpValues: vals,
          otpRawValue: vals.join(''),
          joinRoomNo: vals.join(''),
          otpFocusIndex: 5,
          otpInputFocused: true
        });
      } else {
        wx.showToast({ title: (e && e.message) || '加入失败', icon: 'none', duration: 2000 });
      }
    }
  },

  scanJoin() {
    this.closeShareSheet();
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode'],
      success: (res) => {
        const roomNo = res.result;
        if (roomNo && roomNo.length <= 8) {
          this.joinByRoomNo(roomNo);
        } else {
          wx.showToast({ title: '无效的二维码', icon: 'none' });
        }
      }
    });
  },

  // ========== 计分（点击成员 → 键盘 → 确认直接提交） ==========

  onTapMember(e) {
    const { userId } = e.currentTarget.dataset;
    if (String(userId) === String(app.globalData.userId)) return;
    const info = this.data.memberGrid.find(m => String(m.userId) === String(userId));
    if (!info) return;
    try { wx.vibrateShort({ type: 'light' }); } catch (err) {}
    this.setData({
      transferTo: userId,
      transferToInfo: info,
      showNumpad: true,
      numpadValue: 0
    });
  },

  onNumpadKey(e) {
    const key = e.currentTarget.dataset.key;
    let val = this.data.numpadValue;
    const str = String(val);

    if (key === 'clear') {
      val = 0;
    } else if (key === 'del') {
      const sliced = str.slice(0, -1);
      val = parseInt(sliced) || 0;
    } else {
      const newVal = str === '0' ? key : str + key;
      if (newVal.length > 8) return;
      val = parseInt(newVal);
      if (val > 99999999) val = 99999999;
    }
    this.setData({ numpadValue: val });
  },

  confirmNumpad() {
    const amount = this.data.numpadValue;
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入积分', icon: 'none' });
      return;
    }
    if (amount > 99999999) {
      wx.showToast({ title: '最高 99999999', icon: 'none' });
      return;
    }
    if (!this.data.transferTo) {
      wx.showToast({ title: '请选择得分方', icon: 'none' });
      return;
    }
    this.setData({ showNumpad: false });
    this.submitTransfer(amount);
  },

  closeNumpad() {
    this.setData({ showNumpad: false });
  },

  preventClose() {},

  cancelTransfer() {
    this.setData({
      transferTo: '',
      transferToInfo: null,
      showNumpad: false,
      numpadValue: 0
    });
  },

  async submitTransfer(amount) {
    if (this.data.submitting) return;
    const room = this.data.currentRoom;
    if (!room) return;

    const transferTo = this.data.transferTo;
    if (!transferTo) {
      wx.showToast({ title: '请选择得分方', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    const fromUserId = app.globalData.userId;

    // 先冻结旧分数（粒子动画期间保持显示旧值），再更新 ranking
    const grid = this.data.memberGrid;
    const fromMember = grid.find(m => String(m.userId) === String(fromUserId));
    const toMember = grid.find(m => String(m.userId) === String(transferTo));
    this._animatingScores = {};
    this._animatingScores[fromUserId] = fromMember ? fromMember.displayScore : 0;
    this._animatingScores[transferTo] = toMember ? toMember.displayScore : 0;
    this._optimisticScoreUpdate(fromUserId, transferTo, amount);
    this.cancelTransfer();
    this.playTransferAnimation(fromUserId, transferTo, amount, () => {
      return this.loadScoreRecords(room.roomId, true).finally(() => this.buildMemberGrid());
    });

    // API 请求并行执行
    try {
      await post('/score/transfer', {
        roomId: room.roomId,
        toUserId: transferTo,
        amount
      });
      this.showToast('计分成功');
    } catch (e) {
      console.error('计分失败', e);
      // 回滚：重新拉取权威数据
      this.updateAllData(room.roomId);
      wx.showToast({ title: '计分失败，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  // ========== 退出/解散 ==========

  copyRoomNo() {
    if (!this.data.currentRoom) return;
    wx.setClipboardData({
      data: this.data.currentRoom.roomNo,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    });
  },

  // ========== 分享面板 ==========

  async getQrCodeUrl(roomNo, roomId) {
    const cacheKey = `qr:${roomNo}`;
    const cached = wx.getStorageSync(cacheKey);
    if (cached && Date.now() - cached.ts < 3600000) {
      return cached.url;
    }

    const fetchUrl = async () => {
      const resp = await get(`/room/${roomId}`);
      return resp?.data?.qrCodeUrl || null;
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

    this.setData({ showShareSheet: true });

    // 已有二维码则跳过
    if (this.data.currentRoom.qrCodeUrl) return;

    const url = await this.getQrCodeUrl(roomNo, roomId);
    if (url) {
      this.setData({ 'currentRoom.qrCodeUrl': url });
    }
  },

  closeShareSheet() {
    this.setData({ showShareSheet: false });
  },

  copyRoomLink() {
    const roomNo = this.data.currentRoom?.roomNo || '';
    wx.setClipboardData({
      data: `pages/room/room?roomNo=${roomNo}`,
      success: () => {
        wx.showToast({ title: '链接已复制', icon: 'success' });
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

  async quitRoom() {
    const isOwner = this.data.isOwner;
    const title = isOwner ? '确认解散房间？' : '确认退出？';
    const content = isOwner ? '解散后将归档所有计分数据并展示积分总览' : '';
    const { confirm } = await wx.showModal({ title, content });
    if (!confirm) return;
    const roomId = this.data.currentRoom.roomId;
    try {
      if (isOwner) {
        this._settling = true;
        wx.showLoading({ title: '正在归档...' });
        // 1. 先归档数据
        const settleResp = await post(`/score/room/${roomId}/settle`);
        // 2. 解散房间（必须 await，确保后端清理完成）
        await del(`/room/${roomId}/quit`);
        wx.hideLoading();
        // 3. 断开 WS
        app.disconnectWS();
        this._settling = false;
        // 4. 有记分数据则展示结算弹层，否则直接回到房间列表
        const hasData = settleResp && settleResp.memberScores && settleResp.memberScores.length > 0;
        if (hasData) {
          this.showSettleFromResp(settleResp);
        } else {
          this.setData({ currentRoom: null, viewingRoom: false, ranking: [], scoreRecords: [], memberGrid: [], matrixData: [] });
        }
      } else {
        await del(`/room/${roomId}/quit`);
        app.disconnectWS();
        this.setData({ currentRoom: null, viewingRoom: false, ranking: [], scoreRecords: [], memberGrid: [], matrixData: [] });
        wx.showToast({ title: '已退出', icon: 'success' });
      }
    } catch (e) {
      this._settling = false;
      wx.hideLoading();
      wx.showToast({ title: e.message || '操作失败', icon: 'none' });
    }
  },

  /** 从 SettleResp 构建结算弹层数据并展示 */
  showSettleFromResp(resp) {
    this._showingSettle = true;
    const timestamps = resp.timestamps || [];
    const series = resp.series || [];
    const visibleUsers = series.map(s => String(s.userId));
    const rankedMembers = (resp.memberScores || []).map(m => ({
      userId: m.userId,
      nickname: m.nickname || '?',
      avatarChar: getFirstChar(m.nickname),
      avatarUrl: m.avatarUrl || '',
      finalScore: m.finalScore || 0,
      avatarColor: getColor(m.nickname)
    }));
    this.setData({
      showSettleOverlay: true,
      settleTimestamps: timestamps,
      settleSeries: series,
      settleVisibleUsers: visibleUsers,
      settleRankedMembers: rankedMembers,
      settleRoomNo: resp.roomNo || ''
    });
  },

  /** 非房主收到 SETTLE WS 通知后拉取结算数据 */
  async fetchAndShowSettle(roomId) {
    try {
      const [chartData, roomData] = await Promise.all([
        get(`/score/room/${roomId}/chart`),
        get(`/room/${roomId}`)
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
          avatarChar: getFirstChar(nickname),
          avatarUrl: member.avatarUrl || '',
          finalScore,
          avatarColor: getColor(nickname)
        };
      }).sort((a, b) => b.finalScore - a.finalScore);

      this._showingSettle = true;
      this.setData({
        showSettleOverlay: true,
        settleTimestamps: timestamps,
        settleSeries: series,
        settleVisibleUsers: visibleUsers,
        settleRankedMembers: rankedMembers,
        settleRoomNo: roomData.roomNo || ''
      });
    } catch (e) {
      console.error('加载结算数据失败', e);
    }
  },

  /** 关闭结算弹层，回到房间列表 */
  closeSettleOverlay() {
    this._showingSettle = false;
    this._settling = false;
    this.setData({
      showSettleOverlay: false,
      settleTimestamps: [],
      settleSeries: [],
      settleVisibleUsers: [],
      settleRankedMembers: [],
      settleRoomNo: '',
      currentRoom: null,
      viewingRoom: false,
      ranking: [],
      scoreRecords: [],
      memberGrid: [],
      matrixData: []
    });
  },

  // ========== 音效开关 ==========

  toggleAudioSwitch() {
    const enabled = !app.globalData.audioEnabled;
    app.globalData.audioEnabled = enabled;
    wx.setStorageSync('audioEnabled', enabled);
    this.setData({ audioEnabled: enabled });
    try { wx.vibrateShort({ type: 'light' }); } catch (e) {}
    if (!enabled) {
      getAudioManager().stop();
    }
  },

  // ========== 视图模式切换 ==========

  toggleViewMode() {
    const next = this.data.viewMode === 'grid' ? 'seat' : 'grid';
    this.setData({ viewMode: next });
    try { wx.vibrateShort({ type: 'light' }); } catch (e) {}
  },

  onSeatTap(e) {
    const { userId } = e.detail;
    if (!userId || String(userId) === String(app.globalData.userId)) return;
    const info = this.data.memberGrid.find(m => String(m.userId) === String(userId));
    if (!info) return;
    try { wx.vibrateShort({ type: 'light' }); } catch (err) {}
    this.setData({
      transferTo: info.userId,
      transferToInfo: info,
      showNumpad: true,
      numpadValue: 0
    });
  },

  onSeatSwap(e) {
    const { toIndex } = e.detail;
    const targetSeatNo = toIndex + 1;
    const roomId = this.data.currentRoom && this.data.currentRoom.roomId;
    if (!roomId) return;
    post(`/room/${roomId}/swap-seat`, { targetSeatNo });
  },

  // ========== 座位编辑模式 ==========

  enterSeatEditMode() {
    if (!this.data.isOwner) return;
    this.setData({ seatEditMode: true, editSelectedUserId: '' });
    try { wx.vibrateShort({ type: 'medium' }); } catch (e) {}
  },

  exitSeatEditMode() {
    this.setData({ seatEditMode: false, editSelectedUserId: '' });
  },

  onEditSeatTap(e) {
    const { userId } = e.detail;
    const selected = this.data.editSelectedUserId;

    if (!selected) {
      // 第一次点击：选中一个玩家
      if (userId && !String(userId).startsWith('empty_')) {
        this.setData({ editSelectedUserId: String(userId) });
        try { wx.vibrateShort({ type: 'light' }); } catch (e) {}
      }
    } else if (String(userId) === selected) {
      // 点击已选中的玩家：取消选中
      this.setData({ editSelectedUserId: '' });
    } else {
      // 第二次点击：与目标玩家互换座位
      const members = (this.data.currentRoom && this.data.currentRoom.members) || [];
      const selectedMember = members.find(m => String(m.userId) === selected);
      const targetMember = members.find(m => String(m.userId) === String(userId));

      if (selectedMember && targetMember) {
        this.submitRearrange([
          { userId: selectedMember.userId, targetSeatNo: targetMember.seatNo },
          { userId: targetMember.userId, targetSeatNo: selectedMember.seatNo }
        ]);
      }
      this.setData({ editSelectedUserId: '' });
    }
  },

  submitRearrange(assignments) {
    const roomId = this.data.currentRoom && this.data.currentRoom.roomId;
    if (!roomId || assignments.length === 0) return;
    post(`/room/${roomId}/rearrange-seats`, { assignments });
  },

  switchSeatLayout(e) {
    const layoutType = e.currentTarget.dataset.layout;
    const roomId = this.data.currentRoom && this.data.currentRoom.roomId;
    if (!roomId || !this.data.isOwner) return;
    this.setData({ seatLayoutType: layoutType });
    try { wx.vibrateShort({ type: 'light' }); } catch (e) {}
    put(`/room/${roomId}/layout`, { layoutType });
  },

  // ========== 动态积分样式（统一字号，颜色渐变） ==========

  getScoreStyle(score) {
    const fontSize = 26;
    const abs = Math.abs(score);
    // 0→5000 映射 0%→100% 饱和度
    const t = Math.min(abs / 5000, 1);
    let color;
    if (score === 0) {
      color = 'rgb(140,140,140)';
    } else if (score > 0) {
      // 绿色：从暗绿 → 亮绿
      const r = Math.round(60 - t * 20);
      const g = Math.round(160 + t * 80);
      const b = Math.round(60 - t * 20);
      color = `rgb(${r},${g},${b})`;
    } else {
      // 红色：从暗红 → 亮红
      const r = Math.round(180 + t * 75);
      const g = Math.round(80 - t * 30);
      const b = Math.round(80 - t * 30);
      color = `rgb(${r},${g},${b})`;
    }
    return { fontSize, color };
  },

  // ========== 计分动画 ==========

  /** 乐观更新本地分数（发送者路径） */
  _optimisticScoreUpdate(fromUserId, toUserId, amount) {
    const ranking = this.data.ranking.map(r => {
      const uid = String(r.userId);
      if (uid === String(fromUserId)) {
        return { ...r, score: (r.score || 0) - amount };
      }
      if (uid === String(toUserId)) {
        return { ...r, score: (r.score || 0) + amount };
      }
      return r;
    });
    this.setData({ ranking });
    this.buildMemberGrid();
  },

  /** 用 WebSocket 推送的权威分数更新本地（观察者路径） */
  _optimisticScoreUpdateFromWS(fromUserId, toUserId, fromNewScore, toNewScore) {
    const ranking = this.data.ranking.map(r => {
      const uid = String(r.userId);
      if (uid === String(fromUserId)) {
        return { ...r, score: fromNewScore };
      }
      if (uid === String(toUserId)) {
        return { ...r, score: toNewScore };
      }
      return r;
    });
    this.setData({ ranking });
    this.buildMemberGrid();
  },

  playTransferAnimation(fromUserId, toUserId, amount, onParticleDone) {
    if (!app.globalData.animationEnabled) {
      this._animatingScores = {};
      if (onParticleDone) onParticleDone();
      return;
    }

    // 快照动画前的分数，用于滚动动画
    const grid = this.data.memberGrid;
    const fromMember = grid.find(m => String(m.userId) === String(fromUserId));
    const toMember = grid.find(m => String(m.userId) === String(toUserId));
    this._rollFromUserId = fromUserId;
    this._rollToUserId = toUserId;
    this._rollAmount = amount;
    const oldFromScore = fromMember ? fromMember.displayScore : 0;
    const oldToScore = toMember ? toMember.displayScore : 0;
    this._rollOldFromScore = oldFromScore;
    this._rollOldToScore = oldToScore;

    // 立即标记动画中（页面级 map，不依赖 setData 异步更新）
    this._animatingScores = {};
    this._animatingScores[fromUserId] = oldFromScore;
    this._animatingScores[toUserId] = oldToScore;

    // 优先使用缓存的 DOM 位置，避免每次动画都触发布局查询
    const cellSelector = this.data.viewMode === 'seat' ? '.seat-item' : '.mg-cell';
    const cacheKey = this.data.viewMode + ':' + (this.data.memberGrid || []).length;
    if (this._cellRectsCache && this._cellRectsCacheKey === cacheKey) {
      this._runParticleWithRects(fromUserId, toUserId, amount, this._cellRectsCache, onParticleDone);
    } else {
      wx.createSelectorQuery()
        .selectAll(cellSelector)
        .boundingClientRect()
        .exec((res) => {
          if (!res || !res[0]) {
            if (onParticleDone) onParticleDone();
            return;
          }
          this._cellRectsCache = res[0];
          this._cellRectsCacheKey = cacheKey;
          this._runParticleWithRects(fromUserId, toUserId, amount, res[0], onParticleDone);
        });
    }
  },

  /** 粒子动画核心逻辑（使用已获取的 DOM 位置信息） */
  _runParticleWithRects(fromUserId, toUserId, amount, rects, onParticleDone) {
    const members = this.data.memberGrid;
    const fromIdx = members.findIndex(m => String(m.userId) === String(fromUserId));
    const toIdx = members.findIndex(m => String(m.userId) === String(toUserId));
    if (fromIdx < 0 || toIdx < 0 || !rects[fromIdx] || !rects[toIdx]) {
      if (onParticleDone) onParticleDone();
      return;
    }

    const fromRect = rects[fromIdx];
    const toRect = rects[toIdx];
    const startX = fromRect.left + fromRect.width / 2;
    const startY = fromRect.top + fromRect.height * 0.3;
    const endX = toRect.left + toRect.width / 2;
    const endY = toRect.top + toRect.height * 0.3;

    const duration = 900;
    const startTime = Date.now();
    const midX = (startX + endX) / 2;
    const midY = Math.min(startY, endY) - 80;

    const bezier = (p0, p1, p2, t) => {
      const u = 1 - t;
      return u * u * p0 + 2 * u * t * p1 + t * t * p2;
    };

    this.setData({
      animActive: true,
      animAmount: '+' + amount,
      animFlashOpacity: 0.6,
      animCurX: startX - 10,
      animCurY: startY - 10,
      animCurOpacity: 1,
      animCurScale: 0.5,
      animTrail1X: startX - 6,
      animTrail1Y: startY - 6,
      animTrail1Opacity: 0.7,
      animTrail1Scale: 0.5,
      animTrail2X: startX - 4,
      animTrail2Y: startY - 4,
      animTrail2Opacity: 0.5,
      animTrail2Scale: 0.4
    });

    setTimeout(() => this.setData({ animFlashOpacity: 0 }), 120);

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);

      const cx = bezier(startX, midX, endX, ease);
      const cy = bezier(startY, midY, endY, ease);
      const scale = 0.5 + 1.3 * Math.sin(t * Math.PI);
      const opacity = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;

      const t1 = Math.max(0, (elapsed - 80) / duration);
      const ease1 = 1 - Math.pow(1 - Math.min(t1, 1), 3);
      const t1x = bezier(startX, midX, endX, ease1);
      const t1y = bezier(startY, midY, endY, ease1);

      const t2 = Math.max(0, (elapsed - 160) / duration);
      const ease2 = 1 - Math.pow(1 - Math.min(t2, 1), 3);
      const t2x = bezier(startX, midX, endX, ease2);
      const t2y = bezier(startY, midY, endY, ease2);

      this.setData({
        animCurX: cx - 10,
        animCurY: cy - 10,
        animCurOpacity: opacity,
        animCurScale: scale,
        animTrail1X: t1x - 6,
        animTrail1Y: t1y - 6,
        animTrail1Opacity: t1 < 1 ? Math.max(0, 0.6 - t1 * 0.5) : 0,
        animTrail1Scale: 0.3 + 0.4 * Math.sin(Math.min(t1, 1) * Math.PI),
        animTrail2X: t2x - 4,
        animTrail2Y: t2y - 4,
        animTrail2Opacity: t2 < 1 ? Math.max(0, 0.4 - t2 * 0.4) : 0,
        animTrail2Scale: 0.2 + 0.3 * Math.sin(Math.min(t2, 1) * Math.PI)
      });

      if (t < 1) {
        setTimeout(animate, 16);
      } else {
        this.setData({ animActive: false });
        const afterUpdate = () => {
          this.playScoreRollAnimation(this._rollFromUserId, this._rollToUserId, this._rollAmount);
        };
        if (onParticleDone) {
          const result = onParticleDone();
          if (result && typeof result.then === 'function') {
            result.then(afterUpdate);
          } else {
            afterUpdate();
          }
        } else {
          afterUpdate();
        }
      }
    };

    animate();
  },

  /** 分数滚动动画：从旧值逐步滚动到新值 */
  playScoreRollAnimation(fromUserId, toUserId, amount) {
    // 已有动画在播放，跳过（等待当前动画结束）
    if (this._rollTimer) return;

    const grid = this.data.memberGrid;
    const fromIdx = grid.findIndex(m => String(m.userId) === String(fromUserId));
    const toIdx = grid.findIndex(m => String(m.userId) === String(toUserId));
    if (fromIdx < 0 || toIdx < 0) return;

    // 使用快照的旧分数（在 playTransferAnimation 开头保存）
    const fromOld = this._rollOldFromScore;
    const toOld = this._rollOldToScore;
    const fromNew = grid[fromIdx].score;
    const toNew = grid[toIdx].score;

    // 分数没有变化，跳过
    if (fromOld === fromNew && toOld === toNew) {
      this._animatingScores = {};
      return;
    }

    // 非动画模式，直接设置最终值
    if (!app.globalData.animationEnabled) {
      const updates = {};
      updates[`memberGrid[${fromIdx}].displayScore`] = fromNew;
      updates[`memberGrid[${toIdx}].displayScore`] = toNew;
      this.setData(updates);
      this._animatingScores = {};
      return;
    }

    const duration = 600;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      // easeOutExpo: 前期快后期慢
      const ease = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

      const updates = {};
      updates[`memberGrid[${fromIdx}].displayScore`] = Math.round(fromOld + (fromNew - fromOld) * ease);
      updates[`memberGrid[${toIdx}].displayScore`] = Math.round(toOld + (toNew - toOld) * ease);
      this.setData(updates);

      if (t < 1) {
        this._rollTimer = setTimeout(animate, 16);
      } else {
        // 动画结束：确保最终值精确
        const finalUpdates = {};
        finalUpdates[`memberGrid[${fromIdx}].displayScore`] = fromNew;
        finalUpdates[`memberGrid[${toIdx}].displayScore`] = toNew;
        this.setData(finalUpdates);
        this._rollTimer = null;
        this._animatingScores = {};
      }
    };

    this._rollTimer = setTimeout(animate, 16);
  },

  // ========== 头像加载失败兜底 ==========

  onAvatarError(e) {
    const userId = e.currentTarget.dataset.userId;
    const grid = this.data.memberGrid.map(m => {
      if (String(m.userId) === String(userId)) {
        return {
          ...m,
          avatarUrl: '',
          avatarColor: getColor(m.nickname),
          avatarChar: getFirstChar(m.nickname)
        };
      }
      return m;
    });
    this.setData({ memberGrid: grid });
  },

  // ========== 工具函数 ==========

  formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  onShareAppMessage() {
    const roomNo = this.data.currentRoom?.roomNo || '';
    this.closeShareSheet();
    return {
      title: `房间 ${roomNo} 邀请你来打麻将`,
      path: `/pages/room/room?roomNo=${roomNo}`
    };
  }
});
