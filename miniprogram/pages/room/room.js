const { get, post, del } = require('../../utils/request');
const scoreWS = require('../../utils/score-ws');
const { getColor, getFirstChar } = require('../../utils/avatar');
const { speakTransfer } = require('../../utils/voice');
const { getAudioManager } = require('../../utils/audio-manager');
const app = getApp();

Page({
  data: {
    isLoggedIn: false,
    currentRoom: null,
    isOwner: false,
    baseScore: 1,
    joinRoomNo: '',
    creating: false,
    loading: false,
    ranking: [],
    selectedImages: [],
    submitting: false,
    audioEnabled: true,
    // 成员网格
    memberGrid: [],
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
    // 积分表格
    matrixMembers: [],
    matrixData: [],
    // 积分明细
    showMatrixDetail: false,
    detailFrom: {},
    detailTo: {},
    detailNet: 0,
    detailRecords: [],
    // 积分总览弹窗
    showMatrixPanel: false,
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
      audioEnabled
    });
    this.calcScoreRecordHeight();
    // 订阅 WebSocket 消息（绑定稳定引用）
    if (!this._onWsMessage) {
      this._onWsMessage = this.onWsMessage.bind(this);
    }
    scoreWS.on('message', this._onWsMessage);
    if (app.globalData.token) {
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
      const sys = wx.getSystemInfoSync();
      // 屏幕高度 px → rpx，取 40% 作为积分记录区域高度
      const rpxRatio = 750 / sys.windowWidth;
      const screenH = sys.windowHeight * rpxRatio;
      this.setData({ scoreRecordHeight: Math.round(screenH * 0.4) });
    } catch (e) {}
  },

  // ========== 房间加载 ==========

  async loadMyRooms() {
    this.setData({ loading: true });
    try {
      const rooms = await get('/room/my');
      if (rooms && rooms.length > 0) {
        const room = rooms[0];
        this.setData({
          currentRoom: room,
          isOwner: room.ownerId === app.globalData.userId
        });
        this.enrichMembers(room);
        this.loadRoomData(room.roomId);
        this.connectWS(room.roomId);
      } else {
        this.setData({ currentRoom: null, ranking: [], scoreRecords: [], memberGrid: [], matrixData: [] });
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
    this.buildMemberGrid();
  },

  buildMemberGrid() {
    const room = this.data.currentRoom;
    if (!room || !room.members) return;
    const rankingMap = {};
    this.data.ranking.forEach(r => { rankingMap[r.userId] = r.score || 0; });
    const scores = room.members.map(m => rankingMap[m.userId] || 0);
    // 使用页面级 map 判断动画状态（setData 异步，item 级 _animating 可能未生效）
    const animMap = this._animatingScores || {};
    const grid = room.members.map((m, i) => {
      const score = scores[i];
      const style = this.getScoreStyle(score);
      const isAnimating = m.userId in animMap;
      return {
        ...m,
        score,
        displayScore: isAnimating ? animMap[m.userId] : score,
        scoreFontSize: style.fontSize,
        scoreColor: style.color
      };
    });
    this.setData({ memberGrid: grid });
  },

  async loadRoomData(roomId) {
    await Promise.all([
      this.loadRanking(roomId),
      this.loadScoreRecords(roomId)
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

  async loadScoreRecords(roomId) {
    try {
      const transfers = await get(`/transfer/room/${roomId}`);
      if (!transfers) {
        this.setData({ scoreRecords: [] });
        return;
      }

      const myId = app.globalData.userId;
      const records = transfers
        .filter(t => t.status === 0)
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
          timeFormatted: this.formatTime(t.createdAt),
          fromUserId: t.fromUser.userId,
          toUserId: t.toUser.userId,
          myRole: t.fromUser.userId === myId ? 'from' : t.toUser.userId === myId ? 'to' : ''
        }));

      this.setData({ scoreRecords: records });
    } catch (e) {
      console.error('加载积分记录失败', e);
    }
  },

  // ========== 积分格式化 ==========

  /** 大数字格式化：>= 10000 转为"万"单位 */
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

  // ========== 积分表格 ==========

  buildMatrix() {
    const members = this.data.memberGrid;
    if (!members || members.length < 2) {
      this.setData({ matrixMembers: [], matrixData: [] });
      return;
    }

    const records = this.data.scoreRecords;
    // 构建 from→to 累计积分映射
    const pairMap = {};
    records.forEach(r => {
      const key = `${r.fromUserId}_${r.toUserId}`;
      pairMap[key] = (pairMap[key] || 0) + r.amount;
    });

    // 矩阵成员（带 avatar info）
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
          return { toUserId: to.userId, value: 0, display: '—' };
        }
        const key = `${from.userId}_${to.userId}`;
        const val = pairMap[key] || 0;
        return {
          toUserId: to.userId,
          value: val,
          display: val === 0 ? '0' : this.formatScore(val)
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
  },

  onMatrixCell(e) {
    const { from, to } = e.currentTarget.dataset;
    if (!from || !to || from === to) return;

    const members = this.data.memberGrid;
    const fromMember = members.find(m => m.userId === from);
    const toMember = members.find(m => m.userId === to);
    if (!fromMember || !toMember) return;

    // 筛选两人间的积分记录
    const records = this.data.scoreRecords;
    const pairRecords = records.filter(r =>
      (r.fromUserId === from && r.toUserId === to) ||
      (r.fromUserId === to && r.toUserId === from)
    ).map(r => {
      const isForward = r.fromUserId === from;
      return {
        id: r.id,
        direction: isForward ? `${fromMember.nickname} → ${toMember.nickname}` : `${toMember.nickname} → ${fromMember.nickname}`,
        amount: r.amount,
        timeFormatted: r.timeFormatted,
        isForward
      };
    });

    // 计算净积分（from 视角：收到的 - 付出的）
    const keyForward = `${from}_${to}`;
    const keyReverse = `${to}_${from}`;
    let forwardTotal = 0, reverseTotal = 0;
    records.forEach(r => {
      if (r.fromUserId === from && r.toUserId === to) forwardTotal += r.amount;
      if (r.fromUserId === to && r.toUserId === from) reverseTotal += r.amount;
    });
    const net = reverseTotal - forwardTotal;

    this.setData({
      showMatrixDetail: true,
      detailFrom: fromMember,
      detailTo: toMember,
      detailNet: net,
      detailRecords: pairRecords
    });
  },

  closeMatrixDetail() {
    this.setData({ showMatrixDetail: false });
  },

  async openMatrixPanel() {
    const room = this.data.currentRoom;
    if (!room) return;
    this.setData({ showMatrixPanel: true });
    // 按需加载：刷新数据后构建矩阵
    await this.updateAllData(room.roomId);
    this.buildMatrix();
  },

  closeMatrixPanel() {
    this.setData({ showMatrixPanel: false });
  },

  // ========== WebSocket ==========

  /** 连接房间 WebSocket（通过全局单例） */
  connectWS(roomId) {
    app.connectWS(roomId);
  },

  /** WebSocket 消息处理（通过 scoreWS.on 绑定） */
  onWsMessage(data) {
    if (!this.data.currentRoom) return;
    const roomId = this.data.currentRoom.roomId;

    if (data.type === 'SCORE_UPDATE' || data.type === 'MEMBER_UPDATE' || data.type === 'TRANSFER') {
      if (data.type === 'TRANSFER' && data.fromUserId && data.toUserId && data.amount) {
        this.playTransferAnimation(data.fromUserId, data.toUserId, data.amount);
        // 收分方语音播报
        const myId = String(app.globalData.userId);
        if (String(data.toUserId) === myId && app.globalData.audioEnabled) {
          const members = this.data.currentRoom.members || [];
          const fromMember = members.find(m => String(m.userId) === String(data.fromUserId));
          const toMember = members.find(m => String(m.userId) === myId);
          const fromName = fromMember ? fromMember.nickname : '未知';
          const toName = toMember ? toMember.nickname : '我';
          speakTransfer(fromName, toName, String(data.amount));
        }
      }
      this.updateAllData(roomId);

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
      this.loadScoreRecords(roomId),
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
          isOwner: room.ownerId === app.globalData.userId
        });
        this.enrichMembers(room);
      }
    } catch (e) {
      console.error('刷新房间信息失败', e);
    }
  },

  // ========== 创建/加入房间 ==========

  onBaseScoreInput(e) {
    this.setData({ baseScore: parseInt(e.detail.value) || 1 });
  },

  onJoinInput(e) {
    this.setData({ joinRoomNo: e.detail.value.toUpperCase() });
  },

  async createRoom() {
    if (this.data.creating) return;
    this.setData({ creating: true });
    try {
      const room = await post('/room', { baseScore: this.data.baseScore });
      this.setData({ currentRoom: room, isOwner: true });
      this.enrichMembers(room);
      this.loadRoomData(room.roomId);
      this.connectWS(room.roomId);
      wx.showToast({ title: '房间已创建', icon: 'success' });
    } catch (e) {
      console.error('创建房间失败', e);
    } finally {
      this.setData({ creating: false });
    }
  },

  async joinByNo() {
    const roomNo = this.data.joinRoomNo.trim();
    if (!roomNo) {
      wx.showToast({ title: '请输入房间号', icon: 'none' });
      return;
    }
    await this.joinByRoomNo(roomNo);
  },

  async joinByRoomNo(roomNo) {
    try {
      const room = await post('/room/join', { roomNo });
      this.setData({
        currentRoom: room,
        isOwner: room.ownerId === app.globalData.userId
      });
      this.enrichMembers(room);
      this.loadRoomData(room.roomId);
      this.connectWS(room.roomId);
      wx.showToast({ title: '已加入房间', icon: 'success' });
    } catch (e) {
      console.error('加入房间失败', e);
    }
  },

  scanJoin() {
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
    if (userId === app.globalData.userId) return;
    const info = this.data.memberGrid.find(m => m.userId === userId);
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
      numpadValue: 0,
      selectedImages: []
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
    try {
      await post('/transfer', {
        roomId: room.roomId,
        toUserId: transferTo,
        amount
      });

      // 上传图片（如有）
      if (this.data.selectedImages.length > 0) {
        await this.uploadImages(room.roomId);
      }

      this.showToast('计分成功');
      this.playTransferAnimation(app.globalData.userId, transferTo, amount);
      this.cancelTransfer();
      this.updateAllData(room.roomId);
    } catch (e) {
      console.error('计分失败', e);
    } finally {
      this.setData({ submitting: false });
    }
  },

  // ========== 图片 ==========

  chooseImage() {
    const remaining = 9 - this.data.selectedImages.length;
    if (remaining <= 0) return;
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFiles.map(f => f.tempFilePath);
        this.setData({
          selectedImages: [...this.data.selectedImages, ...newImages]
        });
      }
    });
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.selectedImages];
    images.splice(index, 1);
    this.setData({ selectedImages: images });
  },

  previewImage(e) {
    const src = e.currentTarget.dataset.src;
    wx.previewImage({ current: src, urls: this.data.selectedImages });
  },

  async uploadImages(roomId) {
    // TODO: 上传到 MinIO，暂留
  },

  // ========== 结算 ==========

  async settleRoom() {
    const room = this.data.currentRoom;
    if (!room) return;

    const { confirm } = await wx.showModal({
      title: '结束本轮？',
      content: '当前轮次记分将被锁定，开始新一轮'
    });
    if (!confirm) return;

    try {
      await post(`/score/room/${room.roomId}/settle`);
      wx.showToast({ title: '本轮结束', icon: 'success' });
      this.loadMyRooms();
    } catch (e) {
      console.error('结算失败', e);
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

  async quitRoom() {
    const { confirm } = await wx.showModal({ title: '确认退出？' });
    if (!confirm) return;
    try {
      await del(`/room/${this.data.currentRoom.roomId}/quit`);
      app.disconnectWS();
      this.setData({ currentRoom: null, ranking: [], scoreRecords: [], memberGrid: [], matrixData: [] });
      wx.showToast({ title: '已退出', icon: 'success' });
    } catch (e) {}
  },

  async dissolveRoom() {
    const { confirm } = await wx.showModal({ title: '确认解散？', content: '所有数据将归档' });
    if (!confirm) return;
    try {
      await del(`/room/${this.data.currentRoom.roomId}`);
      app.disconnectWS();
      this.setData({ currentRoom: null, ranking: [], scoreRecords: [], memberGrid: [], matrixData: [] });
      wx.showToast({ title: '已解散', icon: 'success' });
    } catch (e) {}
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

  playTransferAnimation(fromUserId, toUserId, amount) {
    if (!app.globalData.animationEnabled) return;

    // 快照动画前的分数，用于滚动动画（必须在 updateAllData 之前）
    const grid = this.data.memberGrid;
    const fromMember = grid.find(m => m.userId === fromUserId);
    const toMember = grid.find(m => m.userId === toUserId);
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

    wx.createSelectorQuery()
      .selectAll('.mg-cell')
      .boundingClientRect()
      .exec((res) => {
        if (!res || !res[0]) return;
        const rects = res[0];
        const members = this.data.memberGrid;
        const fromIdx = members.findIndex(m => m.userId === fromUserId);
        const toIdx = members.findIndex(m => m.userId === toUserId);
        if (fromIdx < 0 || toIdx < 0 || !rects[fromIdx] || !rects[toIdx]) return;

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

        // 贝塞尔曲线求值
        const bezier = (p0, p1, p2, t) => {
          const u = 1 - t;
          return u * u * p0 + 2 * u * t * p1 + t * t * p2;
        };

        // 初始化
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

        // 闪屏快速消失
        setTimeout(() => this.setData({ animFlashOpacity: 0 }), 120);

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const t = Math.min(elapsed / duration, 1);

          // 缓出曲线
          const ease = 1 - Math.pow(1 - t, 3);

          // 主粒子位置
          const cx = bezier(startX, midX, endX, ease);
          const cy = bezier(startY, midY, endY, ease);

          // 主粒子缩放：先放大再缩小，峰值 1.8
          const scale = 0.5 + 1.3 * Math.sin(t * Math.PI);

          // 主粒子透明度
          const opacity = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;

          // 拖尾1（延迟 80ms）
          const t1 = Math.max(0, (elapsed - 80) / duration);
          const ease1 = 1 - Math.pow(1 - Math.min(t1, 1), 3);
          const t1x = bezier(startX, midX, endX, ease1);
          const t1y = bezier(startY, midY, endY, ease1);

          // 拖尾2（延迟 160ms）
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
            // 粒子动画结束后触发分数滚动动画
            this.playScoreRollAnimation(this._rollFromUserId, this._rollToUserId, this._rollAmount);
          }
        };

        animate();
      });
  },

  /** 分数滚动动画：从旧值逐步滚动到新值 */
  playScoreRollAnimation(fromUserId, toUserId, amount) {
    // 已有动画在播放，跳过（等待当前动画结束）
    if (this._rollTimer) return;

    const grid = this.data.memberGrid;
    const fromIdx = grid.findIndex(m => m.userId === fromUserId);
    const toIdx = grid.findIndex(m => m.userId === toUserId);
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
      if (m.userId === userId) {
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
    return {
      title: `房间 ${roomNo} 邀请你来打麻将`,
      path: `/pages/room/room?roomNo=${roomNo}`
    };
  }
});
