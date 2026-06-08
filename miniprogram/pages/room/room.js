const { get, post, del } = require('../../utils/request');
const { retryWithBackoff } = require('../../utils/retry');
const scoreWS = require('../../utils/score-ws');
const { getColor, getFirstChar, getAvatarView, normalizeAvatarUrl } = require('../../utils/avatar');
const { speakTransfer } = require('../../utils/voice');
const { getAudioManager } = require('../../utils/audio-manager');
const { vibrateShort } = require('../../utils/haptic');
const app = getApp();

// 舷窗目标安全区：外部航船保持在驾驶台上方。
const FORMATION_SAFE_ZONE = { minY: 18, maxY: 44, minX: 18, maxX: 82 };
const SPARKLINE_EMPTY_POINTS = [
  { x: 0, y: 35 },
  { x: 25, y: 45 },
  { x: 50, y: 38 },
  { x: 75, y: 55 },
  { x: 100, y: 42 }
];
const FORMATION_LAYOUTS = {
  1: [{ x: 50, y: 34, sizeClass: 'ship-craft--solo' }],
  2: [
    { x: 34, y: 36, sizeClass: 'ship-craft--duo' },
    { x: 68, y: 28, sizeClass: 'ship-craft--duo' }
  ],
  3: [
    { x: 26, y: 38, sizeClass: 'ship-craft--normal' },
    { x: 50, y: 26, sizeClass: 'ship-craft--normal' },
    { x: 74, y: 36, sizeClass: 'ship-craft--normal' }
  ],
  4: [
    { x: 24, y: 38, sizeClass: 'ship-craft--compact' },
    { x: 44, y: 24, sizeClass: 'ship-craft--compact' },
    { x: 64, y: 26, sizeClass: 'ship-craft--compact' },
    { x: 82, y: 38, sizeClass: 'ship-craft--compact' }
  ]
};
const FORMATION_POSITIONS = [
  { x: 24, y: 38 },
  { x: 44, y: 24 },
  { x: 64, y: 26 },
  { x: 82, y: 38 },
  { x: 31, y: 36 },
  { x: 54, y: 34 },
  { x: 72, y: 40 },
  { x: 20, y: 42 },
  { x: 82, y: 24 },
  { x: 38, y: 28 },
  { x: 58, y: 26 },
  { x: 69, y: 18 },
  { x: 28, y: 20 },
  { x: 48, y: 41 },
  { x: 80, y: 41 }
];

/** 将编队坐标限制在舷窗安全区内 */
function clampFormationPosition(pos) {
  const z = FORMATION_SAFE_ZONE;
  return {
    x: Math.max(z.minX, Math.min(z.maxX, pos.x)),
    y: Math.max(z.minY, Math.min(z.maxY, pos.y))
  };
}

function getTraceSortValue(trace) {
  if (!trace) return 0;
  const time = new Date(trace.createdAt || '').getTime();
  if (!Number.isNaN(time)) return time;
  return Number(trace.id || 0);
}

function pickLatestTrace(traces = []) {
  return traces.reduce((latest, trace) => (
    getTraceSortValue(trace) >= getTraceSortValue(latest) ? trace : latest
  ), null);
}

Page({
  data: {
    isLoggedIn: false,
    currentRoom: null,
    viewingRoom: false,
    isOwner: false,
    joinRoomNo: '',
    joining: false,
    showNameCollisionModal: false,
    // 记分模式：1=自由流转 2=本局录入
    scoreMode: 1,
    // 本局录入配置
    roundInputMethod: 1,
    trustMode: 1,
    zeroSumRequired: 1,
    autoTimeoutSeconds: 30,
    autoTimeoutAction: 1,
    // 结算确认弹窗
    showSettleConfirm: false,
    // 终端输入
    roomCodeRaw: '',
    terminalFocused: false,
    roomLookupValid: false,
    roomLookupMsg: '',
    roomPreview: null,
    recentRooms: [],
    creating: false,
    loading: false,
    ranking: [],
    submitting: false,
    audioEnabled: true,
    animationEnabled: true,
    wsReconnecting: false,
    // 成员网格
    memberGrid: [],
    myUserId: '',
    // 计分目标
    transferTo: '',
    transferToInfo: null,
    transferFromInfo: null,
    transferPreview: null,
    showNumpad: false,
    numpadValue: 0,
    // 战局洞察
    roomInsight: null,
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
    // 脉冲记录
    scoreRecords: [],
    groupedRecords: [],
    filterMine: false,
    loadingMore: false,
    noMore: false,
    // 脉冲总览弹窗
    showMatrixPanel: false,
    // 结算弹层
    showSettleOverlay: false,
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
    settleEventMarkers: [],
    // 历史场次
    // 分享面板
    showShareSheet: false,
    qrLoading: false,
    qrFailed: false,
    // 脉冲记录滚动高度（rpx）
    scoreRecordHeight: 400,
    // 本局录入
    roundRecord: null,
    showHostFill: false,
    showMemberFill: false,
    showRoundConfirm: false,
    showRejectConfirm: false,
    // 顶部提示
    toastMsg: '',
    toastType: 'success',
    // ===== 驾驶舱视图 =====
    cockpitView: {
      hasFormation: false,
      statusLabel: '驾驶舱待机中',
      subtitle: '创建编队，记录脉冲',
      formationCode: '--',
      formationCount: 0,
      maxMembers: 16,
      modeLabel: '自由流转',
      phaseLabel: '待机',
      linkLabel: '链路待接入',
      myPulse: 0,
      myPulseText: '0',
      myPulseDisplay: '0',
      selfPulseDisplay: '0',
      myPulseTone: 'zero',
      selfPulseClass: 'is-positive',
      myCallSign: '未命名本舰',
      isOwner: false,
      roleLabel: '编队成员',
      externalShips: [],
      transferCount: 0,
      totalPulse: '0',
      lastPulseText: '等待更多脉冲写入',
      lastPulseAmount: '',
      sparklinePoints: SPARKLINE_EMPTY_POINTS,
      hasTrajectory: false
    },
    cockpitState: 'idle',       // 'idle' | 'connecting' | 'active' | 'sealing' | 'sealed'
    shipNewMap: {},
    wsConnected: false,
    cockpitScrollTarget: '',
    seatList: [],
    selectedCrew: null,
    pulseValue: '',
    quickPulseValues: [1, 5, 10, 50],
    pulseTraces: [],
    pulseStats: {
      transferCount: 0,
      relatedCount: 0,
      totalAmount: 0,
      maxAmount: 0
    },
    myPulseValue: 0,
    myPulseText: '0',
    myPulseTone: 'zero',
    blackboxPanelOpen: false,
    blackboxView: 'trace',
    traceChartTimestamps: [],
    traceChartSeries: [],
    traceChartVisibleUsers: [],
    traceChartSparkline: [],
    traceFilterMine: false,
    showPulsePanel: false,
    filteredPulseTraces: [],
    traceAnchor: '',
    transferAmountSuggestions: [],
    hasPresenceSnapshot: false,
    onlineUserMap: {},
    joinPanelVisible: false,
    joinCode: '',
    launching: false,
    isLaunching: false,
    launchPhase: '',
    submittingPulse: false,
    sealConfirmVisible: false,
    sealing: false,
    canSealRoom: false,
    sealHeartbeatText: '脉冲轨迹封装中',
    seatLayoutMode: 'solo',
    pulseFlight: { visible: false, fromX: 0, fromY: 0, dx: 0, dy: 0, value: '' },
    impactCrewId: null
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    app.globalData.activeTabKey = 'cockpit'
    const audioEnabled = wx.getStorageSync('audioEnabled') !== false;
    app.globalData.audioEnabled = audioEnabled;
    this.setData({
      isLoggedIn: !!app.globalData.token,
      audioEnabled,
      animationEnabled: app.globalData.animationEnabled !== false,
      myUserId: String(app.globalData.userId || ''),
      wsConnected: scoreWS.isConnected
    });
    this.calcScoreRecordHeight();
    // 订阅 WebSocket 消息（绑定稳定引用）
    if (!this._onWsMessage) {
      this._onWsMessage = this.onWsMessage.bind(this);
    }
    scoreWS.on('message', this._onWsMessage);
    // WS 断线/重连状态
    if (!this._onWsClose) {
      this._onWsClose = () => {
        this.setData({
          wsReconnecting: this.shouldShowWsReconnect(),
          wsConnected: false,
          hasPresenceSnapshot: false,
          onlineUserMap: {}
        });
        this.buildMemberGrid();
      };
      this._onWsOpen = () => {
        this.setData({ wsReconnecting: false, wsConnected: true });
        this.buildMemberGrid();
      };
    }
    scoreWS.on('close', this._onWsClose);
    scoreWS.on('open', this._onWsOpen);
    // 如果 WS 已经是断开状态，立即显示遮罩
    this.setData({ wsReconnecting: this.shouldShowWsReconnect() });
    if (app.globalData.token && !this.data.viewingRoom) {
      this.loadMyRooms();
      this.loadRecentRooms();
    }
    this.updateCockpitState();
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
    if (this._onWsClose) {
      scoreWS.off('close', this._onWsClose);
      scoreWS.off('open', this._onWsOpen);
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
    this.stopSealHeartbeat();
    if (this._autoJoinTimer) {
      clearTimeout(this._autoJoinTimer);
      this._autoJoinTimer = null;
    }
    if (this._particleTimer) {
      clearTimeout(this._particleTimer);
      this._particleTimer = null;
    }
    this._clearTransitionTimers();
    this.clearPageTimers();
  },

  onHide() {
    if (this._autoJoinTimer) {
      clearTimeout(this._autoJoinTimer);
      this._autoJoinTimer = null;
    }
    this.stopSealHeartbeat();
    this._clearTransitionTimers();
    this.clearPageTimers();
    // 清理 fixed 叠加层，避免切 tab 时泄漏到其他页面
    this.setData({
      showShareSheet: false,
      showNumpad: false,
      joinPanelVisible: false,
      sealConfirmVisible: false,
      showNameCollisionModal: false,
      showSettleOverlay: false,
      wsReconnecting: false,
      toastMsg: '',
      animActive: false,
    });
  },

  updateCockpitState(forceState) {
    let cockpitState;
    if (forceState) {
      cockpitState = forceState;
    } else if (!this.data.currentRoom) {
      cockpitState = 'idle';
    } else if (this.data.sealing) {
      cockpitState = 'sealing';
    } else {
      cockpitState = 'active';
    }
    this.setData({
      cockpitState,
      cockpitView: this.buildCockpitView(null, cockpitState)
    });
  },

  buildCockpitView(memberGridOverride, cockpitStateOverride) {
    const room = this.data.currentRoom;
    const state = cockpitStateOverride || this.data.cockpitState;
    const grid = memberGridOverride || this.data.memberGrid || [];
    const hasFormation = !!(room && this.data.viewingRoom);
    const isConnecting = state === 'connecting';
    const selfId = String(this.data.myUserId || app.globalData.userId || '');
    const selfMember = grid.find(m => String(m.userId) === selfId) ||
      (room && room.members || []).find(m => String(m.userId) === selfId) ||
      {};
    const rawPulse = selfMember.displayScore !== undefined ? selfMember.displayScore : selfMember.score;
    const myPulse = Number(rawPulse || 0);
    const formationCount = hasFormation
      ? (grid.length || (room && room.members ? room.members.length : 0))
      : 0;
    const linkLabel = this.deriveLinkLabel(hasFormation, state);
    const phaseLabel = this.derivePhaseLabel(hasFormation, state);
    const externalShips = this.deriveFormationShips(grid, selfId);

    let statusLabel, statusDot, statusSubtitle;
    if (isConnecting || state === 'sealing') {
      statusLabel = '驾驶舱启动中';
      statusDot = 'connecting';
      statusSubtitle = '';
    } else if (hasFormation) {
      statusLabel = '驾驶舱已接入';
      statusSubtitle = externalShips.length > 0 ? '' : '暂无外部航船';
      statusDot = 'online';
    } else {
      statusLabel = '驾驶舱待机中';
      statusDot = 'idle';
      statusSubtitle = '';
    }

    const stageText = this.deriveStageText(hasFormation, state);
    const lastTrace = pickLatestTrace(this.data.pulseTraces || []);
    const sparklineSrc = this.data.traceChartSparkline || [];
    const sparklinePoints = sparklineSrc.length > 0
      ? sparklineSrc.slice(-8)
      : SPARKLINE_EMPTY_POINTS;

    return {
      hasFormation: hasFormation || isConnecting,
      isConnecting,
      statusLabel,
      statusDot,
      statusSubtitle,
      formationCode: hasFormation && room ? room.roomNo : '--',
      roomNo: hasFormation && room ? room.roomNo : '--',
      formationCount,
      memberCountText: `${formationCount}/16`,
      maxMembers: 16,
      modeLabel: this.deriveModeLabel(room),
      modeText: this.deriveModeLabel(room),
      phaseLabel,
      stageText,
      linkLabel,
      linkText: this.deriveLinkLabel(hasFormation, state),
      myPulse,
      myPulseText: this.formatPulseValue(myPulse),
      myPulseDisplay: this.formatPulseValue(myPulse),
      selfPulseDisplay: this.formatPulseValue(myPulse),
      myPulseTone: myPulse > 0 ? 'positive' : myPulse < 0 ? 'negative' : 'zero',
      selfPulseClass: myPulse > 0 ? 'is-positive' : myPulse < 0 ? 'is-negative' : 'is-zero',
      myCallSign: this.formatCallSign(selfMember.nickname || app.globalData.userInfo?.nickname || ''),
      isOwner: !!this.data.isOwner,
      roleLabel: this.data.isOwner ? '编队主控' : '编队成员',
      externalShips,
      transferCount: (this.data.scoreRecords || []).length,
      totalPulse: this.data.pulseStats ? this.data.pulseStats.totalAmount : '0',
      lastPulseText: lastTrace ? lastTrace.title : '等待更多脉冲写入',
      lastPulseAmount: lastTrace ? lastTrace.valueText : '',
      sparklinePoints,
      hasTrajectory: sparklineSrc.length > 0
    };
  },

  syncCockpitView(memberGridOverride) {
    this.setData({
      cockpitView: this.buildCockpitView(memberGridOverride)
    });
  },

  deriveFormationShips(members = [], selfId = '') {
    const externalMembers = (members || [])
      .filter(member => String(member.userId || member.id || '') !== String(selfId))
      .slice(0, FORMATION_POSITIONS.length);
    const count = externalMembers.length;
    const layout = FORMATION_LAYOUTS[count] || FORMATION_POSITIONS.map(pos => ({
      ...pos,
      sizeClass: count <= 6 ? 'ship-craft--normal' : 'ship-craft--compact'
    }));
    const newMap = this.data.shipNewMap || {};
    return externalMembers
      .map((member, index) => {
        const rawPos = layout[index] || { x: 50, y: 30, sizeClass: 'ship-craft--compact' };
        const pos = clampFormationPosition(rawPos);
        const rawPulse = member.displayScore !== undefined ? member.displayScore : member.score;
        const pulse = Number(rawPulse || 0);
        const uid = member.userId || member.id;
        const presenceClass = member.presenceClass || this.getPresenceClass(uid, this.data.onlineUserMap || {}, !!this.data.hasPresenceSnapshot);
        const callsign = this.formatCallSign(member.nickname);
        const pulseClass = pulse > 0 ? 'is-positive' : pulse < 0 ? 'is-negative' : 'is-zero';
        const pulseDisplay = this.formatPulseValue(pulse);
        return {
          userId: uid,
          callSign: callsign,
          callsign,
          avatarUrl: member.avatarUrl || '',
          avatarChar: getFirstChar(member.nickname || '?'),
          pulse: pulseDisplay,
          pulseDisplay,
          pulseTone: pulse > 0 ? 'positive' : pulse < 0 ? 'negative' : 'zero',
          pulseClass,
          online: presenceClass !== 'offline',
          presenceClass,
          isNew: !!newMap[uid],
          linkLabel: member.presenceLabel || this.getPresenceLabel(uid, this.data.onlineUserMap || {}, !!this.data.hasPresenceSnapshot),
          roleLabel: member.isHost ? '主控' : '编队',
          scaleClass: rawPos.sizeClass,
          orbSizeClass: rawPos.sizeClass,
          sizeClass: rawPos.sizeClass,
          x: pos.x,
          y: pos.y,
          slotIndex: index + 1
        };
      });
  },

  deriveModeLabel(room) {
    if (!room) return this.data.scoreMode === 2 ? '本局录入' : '自由流转';
    return Number(room.scoreMode) === 2 ? '本局录入' : '自由流转';
  },

  derivePhaseLabel(hasFormation, state) {
    if (!hasFormation) return '待机';
    if (state === 'sealing') return '封存中';
    if (state === 'sealed') return '已封存';
    return this.data.roundRecord ? '录入中' : '记录中';
  },

  deriveStageText(hasFormation, state) {
    if (!hasFormation) return '编队记录中';
    if (state === 'sealing' || state === 'sealed') return '航程已封存';
    return '编队记录中';
  },

  deriveLinkLabel(hasFormation, state) {
    if (!hasFormation) return '链路待接入';
    if (this.data.wsReconnecting) return '通讯链路波动';
    if (state === 'sealing') return '封存链路保持';
    return this.data.wsConnected ? '通讯链路在线' : '通讯链路待接入';
  },

  shouldShowWsReconnect() {
    const room = this.data.currentRoom;
    if (!room || !this.data.viewingRoom) return false;
    if (this._suppressWsReconnect || this._settling || this.data.sealing) return false;
    if (this.data.cockpitState !== 'active') return false;
    if (scoreWS.manualClose || scoreWS.isConnected || scoreWS.isConnecting) return false;
    return String(scoreWS.roomId || '') === String(room.roomId || '');
  },

  suppressWsReconnect() {
    this._suppressWsReconnect = true;
    this.setData({ wsReconnecting: false, wsConnected: false });
  },

  buildSeatList(members = []) {
    const onlineMap = this.data.onlineUserMap || {};
    const hasPresenceSnapshot = !!this.data.hasPresenceSnapshot;
    const safeMembers = (members || []).slice(0, 16).map(m => ({
      userId: m.userId || m.id,
      nickname: m.nickname,
      avatarUrl: m.avatarUrl || '',
      score: m.score || 0,
      displayName: this.formatCrewName(m.nickname),
      scoreText: this.formatPulseValue(m.displayScore !== undefined ? m.displayScore : m.score),
      active: true,
      seatKey: `crew-${m.userId || m.id}`,
      isSelf: String(m.userId || m.id) === String(this.data.myUserId),
      isHost: m.isHost || false,
      presenceClass: this.getPresenceClass(m.userId || m.id, onlineMap, hasPresenceSnapshot),
      presenceLabel: this.getPresenceLabel(m.userId || m.id, onlineMap, hasPresenceSnapshot)
    }));
    return safeMembers;
  },

  getPresenceClass(userId, onlineMap, hasPresenceSnapshot) {
    const uid = String(userId || '');
    if (!hasPresenceSnapshot) {
      return uid === String(this.data.myUserId) ? 'online' : 'syncing';
    }
    return onlineMap[uid] ? 'online' : 'offline';
  },

  getPresenceLabel(userId, onlineMap, hasPresenceSnapshot) {
    const uid = String(userId || '');
    if (!hasPresenceSnapshot) {
      return uid === String(this.data.myUserId) ? '链路在线' : '链路同步中';
    }
    return onlineMap[uid] ? '链路在线' : '链路离线';
  },

  getSeatLayoutMode(count) {
    if (count <= 1) return 'solo';
    if (count === 2) return 'duo';
    if (count <= 4) return 'compact';
    if (count <= 8) return 'wide';
    return 'matrix';
  },

  formatCrewName(name = '') {
    const text = String(name || '成员').trim();
    return text.length > 6 ? text.slice(0, 6) : text;
  },

  formatCallSign(name = '') {
    const text = String(name || '未命名').trim();
    return text.length > 5 ? text.slice(0, 5) : text;
  },

  formatPulseValue(value = 0) {
    const num = Number(value || 0);
    if (Math.abs(num) >= 100000) return `${(num / 10000).toFixed(1)}w`;
    return `${num}`;
  },

  /** 校验当前是否可记录脉冲，返回 { ok, reason } */
  canRecordPulse(targetUserId) {
    const room = this.data.currentRoom;
    if (!room) return { ok: false, reason: '编队链路已断开，请返回后重试' };
    if (room.status === 2 || room.status === 'sealed') return { ok: false, reason: '航程已封存，无法继续记录' };
    const selfId = String(this.data.myUserId || app.globalData.userId || '');
    if (!targetUserId) return { ok: false, reason: '请选择目标航船' };
    if (String(targetUserId) === selfId) return { ok: false, reason: '无需向自身流转脉冲' };
    const target = this.data.memberGrid.find(m => String(m.userId) === String(targetUserId));
    if (!target) return { ok: false, reason: '目标航船已断开' };
    const ships = (this.data.cockpitView || {}).externalShips || [];
    if (ships.length === 0) return { ok: false, reason: '暂无外部航船' };
    return { ok: true };
  },

  /** 将后端错误映射为舰载终端文案 */
  normalizeRoomActionError(err) {
    const msg = (err && err.message) || '';
    if (msg.includes('已封存') || msg.includes('已关闭') || msg.includes('不可重复')) return '航程已封存，无法继续记录';
    if (msg.includes('不存在')) return '编队链路已断开，请返回后重试';
    if (msg.includes('目标') && msg.includes('不存在')) return '目标航船已断开';
    if (msg.includes('分值') || msg.includes('金额') || msg.includes('数值')) return '请输入脉冲数值';
    if (msg.includes('网络') || msg.includes('timeout') || msg.includes('超时')) return '网络波动，请稍后重试';
    return '记录失败，请稍后重试';
  },

  // ===== 驾驶舱交互 =====

  handleStartSpace() {
    if (this.data.launching) return;
    vibrateShort('light');
    this.setData({ launching: true, isLaunching: true, launchPhase: 'linking' });

    // 启动过渡动画：linking → window → hud → 执行创建
    const t1 = setTimeout(() => {
      this.setData({ launchPhase: 'window' });
    }, 400);
    const t2 = setTimeout(() => {
      this.setData({ launchPhase: 'hud' });
    }, 800);
    const t3 = setTimeout(() => {
      this.updateCockpitState('connecting');
      this.createRoom().then(() => {
        this.setData({ launching: false, isLaunching: false, launchPhase: '' });
        this.updateCockpitState('active');
        this._markNewShips();
      }).catch(() => {
        this.setData({ launching: false, isLaunching: false, launchPhase: '' });
        this.updateCockpitState('idle');
      });
    }, 1100);

    this._transitionTimers = this._transitionTimers || [];
    this._transitionTimers.push(t1, t2, t3);
  },

  openJoinPanel() {
    this.setData({ joinPanelVisible: true, joinCode: '' });
  },

  closeJoinPanel() {
    this.setData({ joinPanelVisible: false, joinCode: '' });
  },

  onJoinCodeInput(e) {
    const value = String(e.detail.value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    this.setData({ joinCode: value });
  },

  async handleJoinSpace() {
    const code = this.data.joinCode.trim();
    if (!code || code.length < 6 || this.data.joining) return;
    vibrateShort('light');
    this.setData({ joining: true, isLaunching: true, launchPhase: 'linking' });

    // 启动过渡动画
    const t1 = setTimeout(() => {
      this.setData({ launchPhase: 'window' });
    }, 400);
    const t2 = setTimeout(() => {
      this.setData({ launchPhase: 'hud' });
    }, 800);
    const t3 = setTimeout(async () => {
      this.closeJoinPanel();
      this.updateCockpitState('connecting');
      try {
        await this.joinByRoomNo(code);
        this.updateCockpitState('active');
        this._markNewShips();
      } catch (err) {
        this.updateCockpitState('idle');
      } finally {
        this.setData({ joining: false, isLaunching: false, launchPhase: '' });
      }
    }, 1100);

    this._transitionTimers = this._transitionTimers || [];
    this._transitionTimers.push(t1, t2, t3);
  },

  handleSelectCrew(e) {
    const userId = String(e.currentTarget.dataset.userId || '');
    const isActive = e.currentTarget.dataset.active;

    if (!userId || isActive === false || isActive === 'false') {
      return;
    }

    const selfId = String(this.data.myUserId || app.globalData.userId || '');
    if (userId === selfId) {
      wx.showToast({ title: '无需向自身流转脉冲', icon: 'none', duration: 1200 });
      return;
    }

    this.openTransferPad(userId);
  },

  _markNewShips() {
    const ships = (this.data.cockpitView || {}).externalShips || [];
    if (!ships.length) return;
    const newMap = {};
    ships.forEach(s => { newMap[s.userId] = true; });
    this.setData({ shipNewMap: newMap });
    setTimeout(() => {
      this.setData({ shipNewMap: {} });
    }, 600);
  },

  focusFormationForPulse() {
    const ships = this.data.cockpitView.externalShips || [];
    if (!ships.length) {
      this.showToast('暂无外部航船', 'error');
      return;
    }
    if (ships.length === 1) {
      this.openTransferPad(ships[0].userId);
      return;
    }
    this.setData({ cockpitScrollTarget: 'formation-window' });
    this.showToast('选择外部航船记录脉冲');
  },

  openPulseRecorder() {
    const room = this.data.currentRoom;
    if (room && Number(room.scoreMode) === 2) {
      if (this.data.roundRecord) {
        this.onRoundStatusTap();
        return;
      }
      if (this.data.isOwner) {
        this.startRound();
        return;
      }
      this.showToast('等待主控录入');
      return;
    }
    this.focusFormationForPulse();
  },

  openBeacon() {
    this.openShareSheet();
  },

  handleSettle() {
    if (this.data.isOwner) {
      this.openSealConfirm();
      return;
    }
    this.quitRoom();
  },

  goMirrorTrace() {
    wx.switchTab({ url: '/pages/mirror/index' });
  },

  openTransferPad(userId) {
    const targetId = String(userId || '');
    if (!targetId) return;
    const check = this.canRecordPulse(targetId);
    if (!check.ok) {
      this.showToast(check.reason, 'error');
      return;
    }
    const info = this.data.memberGrid.find(m => String(m.userId) === targetId);
    if (!info) return;
    const fromInfo = this.data.memberGrid.find(m => String(m.userId) === String(app.globalData.userId));
    vibrateShort('light');
    this.setData({
      selectedCrew: null,
      cockpitScrollTarget: '',
      pulseValue: '',
      transferTo: targetId,
      transferToInfo: info,
      transferFromInfo: fromInfo || null,
      showNumpad: true,
      numpadValue: 0,
      transferPreview: null
    });
    const roomId = this.data.currentRoom && this.data.currentRoom.roomId;
    if (roomId) {
      this.loadTransferAmountSuggestions(roomId);
    }
  },

  onPulseValueInput(e) {
    const value = String(e.detail.value || '').replace(/\D/g, '').slice(0, 7);
    this.setData({ pulseValue: value });
  },

  tapPulsePreset(e) {
    const value = Number(e.currentTarget.dataset.value || 0);
    if (!value) return;
    this.setData({ pulseValue: String(value) });
    vibrateShort('light');
  },

  clearPulseValue() {
    if (!this.data.pulseValue) return;
    this.setData({ pulseValue: '' });
    vibrateShort('light');
  },

  async handleSubmitPulse() {
    if (!this.data.selectedCrew) {
      this.showToast('请选择编队席位', 'error');
      return;
    }
    const selfId = String(this.data.myUserId || app.globalData.userId || '');
    const targetId = String(this.data.selectedCrew.userId || '');
    if (targetId === selfId) {
      wx.showToast({ title: '不能选择自身', icon: 'none' });
      return;
    }
    const amount = parseInt(this.data.pulseValue, 10);
    if (!amount || amount === 0) {
      this.showToast('请输入脉冲值', 'error');
      return;
    }
    if (this.data.submittingPulse) return;
    this.setData({ submittingPulse: true, transferTo: targetId });
    try {
      await this.submitTransfer(amount);
      const fromMember = this.data.memberGrid.find(m => String(m.userId) === selfId) || {};
      this.addPulseTrace('我', this.data.selectedCrew.displayName, amount, {
        fromAvatarUrl: fromMember.avatarUrl || '',
        toAvatarUrl: this.data.selectedCrew.avatarUrl || ''
      });
      // 脉冲飞行动画
      await this.playPulseFlightAnimation({
        fromUserId: selfId,
        toUserId: targetId,
        value: amount
      });
      this.setData({ pulseValue: '' });
    } catch (err) {
      // submitTransfer 内部已有错误处理
    } finally {
      this.setData({ submittingPulse: false });
    }
  },

  openSealConfirm() {
    this.setData({ sealConfirmVisible: true });
  },

  closeSealConfirm() {
    this.setData({ sealConfirmVisible: false });
  },

  async handleSealRoom() {
    if (this.data.sealing) return;
    this.closeSealConfirm();

    const roomId = this.data.currentRoom && this.data.currentRoom.roomId;
    if (!roomId) {
      this.showToast('编队信息缺失', 'error');
      return;
    }

    // 非房主不能封存，走退出流程
    if (!this.data.isOwner) {
      this.quitRoom();
      return;
    }

    this.setData({ sealing: true, cockpitState: 'sealing' });
    this.startSealHeartbeat();

    try {
      const settleResp = await post(`/score/room/${roomId}/settle`, null, { silent: true });
      this._settling = true;
      this.suppressWsReconnect();
      app.disconnectWS();
      this._settling = false;

      this.stopSealHeartbeat();
      this.setData({ sealing: false, cockpitState: 'active' });

      const hasData = settleResp && (
        (settleResp.timestamps && settleResp.timestamps.length > 0) ||
        (settleResp.series && settleResp.series.some(s => s.scores && s.scores.length > 0))
      );

      if (hasData) {
        this.showSettleFromResp(settleResp);
      } else {
        this.setData({
          currentRoom: null,
          viewingRoom: false,
          ranking: [],
          scoreRecords: [],
          memberGrid: [],
          seatList: [],
          matrixData: [],
          roundRecord: null,
          canSealRoom: false,
          showHostFill: false,
          showMemberFill: false,
          showRoundConfirm: false,
          showRejectConfirm: false,
          wsReconnecting: false,
          wsConnected: false
        });
        this.updateCockpitState();
        wx.showToast({ title: '编队已关闭', icon: 'none', duration: 2000 });
      }

    } catch (err) {
      this.stopSealHeartbeat();
      this.setData({ sealing: false, cockpitState: 'active' });
      const msg = err.message || '封存失败，请重试';
      // 编队已封存/已关闭时，清理本地状态回到待机
      if (msg.includes('已封存') || msg.includes('已关闭') || msg.includes('不可重复') || msg.includes('不存在')) {
        this.setData({
          currentRoom: null,
          viewingRoom: false,
          ranking: [],
          scoreRecords: [],
          memberGrid: [],
          seatList: [],
          matrixData: [],
          roundRecord: null,
          canSealRoom: false,
          showHostFill: false,
          showMemberFill: false,
          showRoundConfirm: false,
          showRejectConfirm: false,
          wsReconnecting: false,
          wsConnected: false
        });
        this.updateCockpitState();
        wx.showToast({ title: '航程已封存', icon: 'none', duration: 2000 });
      } else {
        wx.showToast({ title: msg, icon: 'none' });
      }
    }
  },

  startSealHeartbeat() {
    this.setData({ sealHeartbeatText: '航迹档案写入中' });
  },

  stopSealHeartbeat() {
    this._sealHeartbeatTimer = null;
  },

  /** 添加脉冲轨迹，自动截断旧记录并设置 isNew 标记 */
  addPulseTrace(fromName, toName, amount, extra = {}) {
    const MAX_TRACES = 50;
    const traces = this.data.pulseTraces.slice();
    this._traceSeq = (this._traceSeq || 0) + 1;
    const id = this._traceSeq;
    traces.push({
      id,
      title: `${fromName} → ${toName}`,
      desc: '',
      fromName: this.formatCrewName(fromName),
      fromAvatarUrl: extra.fromAvatarUrl || '',
      toName: this.formatCrewName(toName),
      toAvatarUrl: extra.toAvatarUrl || '',
      createdAt: Date.now(),
      timeFormatted: '刚刚',
      valueText: `${amount}`,
      valueClass: amount < 0 ? 'is-negative' : '',
      isNew: true
    });
    if (traces.length > MAX_TRACES) traces.splice(0, traces.length - MAX_TRACES);
    const filteredPulseTraces = this.data.traceFilterMine ? traces.filter(t => t.isMine) : traces;
    this.setData({
      pulseTraces: traces,
      filteredPulseTraces,
      traceAnchor: `trace-${id}`
    });
    const clearNewTimer = setTimeout(() => {
      const current = this.data.pulseTraces.map(t =>
        t.id === id ? { ...t, isNew: false } : t
      );
      this.setData({ pulseTraces: current });
    }, 3000);
    this.addPageTimer(clearNewTimer);
    this.updateCanSealRoom();
  },

  /** 更新封存可用状态：有轨迹/记录/已生效本局录时可封存 */
  updateCanSealRoom() {
    const hasTraces = this.data.pulseTraces.length > 0;
    const hasRecords = this.data.scoreRecords.length > 0;
    const hasRound = this.data.roundRecord && this.data.roundRecord.status === 'applied';
    this.setData({ canSealRoom: hasTraces || hasRecords || hasRound });
  },

  /** 页面级定时器管理，onHide/onUnload 统一清理 */
  addPageTimer(timer) {
    if (!this._pageTimers) this._pageTimers = [];
    this._pageTimers.push(timer);
  },

  clearPageTimers() {
    if (this._pageTimers) {
      this._pageTimers.forEach(t => clearTimeout(t));
      this._pageTimers = [];
    }
  },

  _clearTransitionTimers() {
    if (this._transitionTimers) {
      this._transitionTimers.forEach(t => clearTimeout(t));
      this._transitionTimers = [];
    }
  },

  /** 脉冲飞行动画：从自己席位飞向目标席位 */
  playPulseFlightAnimation({ fromUserId, toUserId, value }) {
    const app2 = getApp();
    if (app2.globalData.animationEnabled === false) {
      this.flashTargetSeat(toUserId);
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const query = wx.createSelectorQuery().in(this);
      query
        .select(`#seat-${fromUserId}`)
        .boundingClientRect()
        .select(`#seat-${toUserId}`)
        .boundingClientRect()
        .exec(res => {
          const fromRect = res && res[0];
          const toRect = res && res[1];

          if (!fromRect || !toRect) {
            this.flashTargetSeat(toUserId);
            resolve();
            return;
          }

          const fromX = fromRect.left + fromRect.width / 2;
          const fromY = fromRect.top + fromRect.height / 2;
          const toX = toRect.left + toRect.width / 2;
          const toY = toRect.top + toRect.height / 2;

          this.setData({
            pulseFlight: {
              visible: true,
              fromX,
              fromY,
              dx: toX - fromX,
              dy: toY - fromY,
              value: String(value)
            }
          });

          const timer = setTimeout(() => {
            this.setData({
              pulseFlight: { visible: false, fromX: 0, fromY: 0, dx: 0, dy: 0, value: '' }
            });
            this.flashTargetSeat(toUserId);
            resolve();
          }, 760);
          this.addPageTimer(timer);
        });
    });
  },

  /** 目标席位 impact 闪光 */
  flashTargetSeat(userId) {
    this.setData({ impactCrewId: String(userId) });
    this.refreshSeatLayoutWithImpact(userId);
    const timer = setTimeout(() => {
      this.setData({ impactCrewId: null });
      const grid = this.data.memberGrid || [];
      this.setData({
        seatList: this.buildSeatList(grid),
        seatLayoutMode: this.getSeatLayoutMode(grid.length)
      });
    }, 460);
    this.addPageTimer(timer);
  },

  /** 带 impact 标记的席位列表 */
  refreshSeatLayoutWithImpact(userId) {
    const grid = this.data.memberGrid || [];
    const seatList = this.buildSeatList(grid).map(item => ({
      ...item,
      impact: String(item.userId) === String(userId)
    }));
    this.setData({
      seatList,
      seatLayoutMode: this.getSeatLayoutMode(grid.length)
    });
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
    // 屏幕高度 px -> rpx，取 40% 作为脉冲记录区域高度
      const rpxRatio = 750 / win.windowWidth;
      const screenH = win.windowHeight * rpxRatio;
      this.setData({ scoreRecordHeight: Math.round(screenH * 0.4) });
    } catch (e) {}
  },

  // ========== 编队加载 ==========

  async loadMyRooms() {
    // 结算弹层展示中，忽略编队列表刷新（避免覆盖结算状态）
    if (this._showingSettle) return;
    this.setData({ loading: true });
    try {
      const rooms = await get('/room/my');
      if (rooms && rooms.length > 0) {
        const room = rooms[0];
        this.setData({
          currentRoom: room,
          viewingRoom: true,
          isOwner: String(room.ownerId) === String(app.globalData.userId)
        });
        this.enrichMembers(room);
        this.loadRoomData(room.roomId);
        this.connectWS(room.roomId);
        this.updateCockpitState();
        if (room.scoreMode === 2) {
          this.loadPendingRound(room.roomId);
        }
      } else {
        this.setData({ currentRoom: null, viewingRoom: false, ranking: [], scoreRecords: [], memberGrid: [], seatList: [], selectedCrew: null, cockpitScrollTarget: '', pulseTraces: [], matrixData: [] });
        this.updateCockpitState();
      }
    } catch (e) {
      console.error('加载编队失败', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  enrichMembers(room) {
    if (!room || !room.members) return;
    room.members = room.members.map(m => ({
      ...m,
      ...getAvatarView(m.nickname, m.avatarUrl)
    }));
    this.setData({ currentRoom: room });
    this._cellRectsCache = null;
    this.buildMemberGrid();
  },

  buildMemberGrid() {
    const room = this.data.currentRoom;
    if (!room || !room.members) return;
    const sorted = [...room.members];
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
        scoreColor: style.color,
        isHost: String(m.userId) === String(room.ownerId)
      };
    });
    const selfId = String(this.data.myUserId || app.globalData.userId || '');
    const selfMember = grid.find(m => String(m.userId) === selfId);
    const myPulseValue = selfMember ? Number(selfMember.displayScore || selfMember.score || 0) : 0;
    const cockpitView = this.buildCockpitView(grid);
    const extraState = {};
    if (this.data.cockpitState === 'connecting') {
      extraState.cockpitState = 'active';
      cockpitView.statusLabel = '驾驶舱已接入';
      cockpitView.statusDot = 'online';
      cockpitView.isConnecting = false;
    }
    this.setData({
      memberGrid: grid,
      seatList: this.buildSeatList(grid),
      seatLayoutMode: this.getSeatLayoutMode(grid.length),
      myPulseValue,
      myPulseText: this.formatPulseValue(myPulseValue),
      myPulseTone: myPulseValue > 0 ? 'positive' : myPulseValue < 0 ? 'negative' : 'zero',
      cockpitView,
      ...extraState
    });
    this.rebuildPulseStats(grid);
  },

  async loadRoomData(roomId) {
    await Promise.all([
      this.loadRanking(roomId),
      this.loadScoreRecords(roomId, true)
    ]);
    this.loadInsightData(roomId);
    this.loadTransferAmountSuggestions(roomId);
  },

  async loadInsightData(roomId) {
    try {
      const insight = await get(`/score/room/${roomId}/insight`);
      this.setData({ roomInsight: insight });
    } catch (e) {
      // 静默失败，不影响主流程
    }
  },

  async loadTransferAmountSuggestions(roomId) {
    if (!roomId) return;
    try {
      const resp = await get(`/score/room/${roomId}/transfer-amount-suggestions`);
      const items = (resp && resp.items || [])
        .map(item => ({
          amount: Number(item.amount || 0),
          label: item.label || (item.source === 'crew' ? '常用' : '编队'),
          source: item.source || 'space'
        }))
        .filter(item => item.amount > 0)
        .slice(0, 6);
      this.setData({ transferAmountSuggestions: items });
    } catch (e) {
      // 推荐金额只是辅助输入，失败不影响记录脉冲
    }
  },

  async loadRanking(roomId) {
    try {
      const ranking = await get(`/score/room/${roomId}/ranking`);
      if (!ranking) return;

      const maxScore = Math.max(...ranking.map(r => Math.abs(r.score || 0)), 1);
      const enriched = ranking.map(r => ({
        ...r,
        ...getAvatarView(r.nickname, r.avatarUrl),
        barWidth: Math.round(Math.abs(r.score || 0) / maxScore * 100)
      }));
      this.setData({ ranking: enriched });
      this.buildMemberGrid();
    } catch (e) {
      console.error('加载排行榜失败', e);
    }
  },

  getLocalScore(userId) {
    const uid = String(userId);
    const rankingItem = (this.data.ranking || []).find(r => String(r.userId) === uid);
    if (rankingItem) return Number(rankingItem.score || 0);
    const gridItem = (this.data.memberGrid || []).find(m => String(m.userId) === uid);
    if (gridItem) return Number(gridItem.score || gridItem.displayScore || 0);
    const member = (this.data.currentRoom && this.data.currentRoom.members || []).find(m => String(m.userId) === uid);
    return Number(member && member.score || 0);
  },

  upsertScoreSnapshot(scoreMap = {}) {
    const normalized = {};
    Object.keys(scoreMap).forEach(userId => {
      const value = Number(scoreMap[userId]);
      if (!Number.isNaN(value)) {
        normalized[String(userId)] = value;
      }
    });
    if (!Object.keys(normalized).length) return;

    const room = this.data.currentRoom;
    const members = room && room.members ? room.members : [];
    const rankingById = new Map((this.data.ranking || []).map(r => [String(r.userId), { ...r }]));

    members.forEach(m => {
      const uid = String(m.userId);
      if (!rankingById.has(uid)) {
        rankingById.set(uid, {
          ...m,
          userId: m.userId,
          score: Number(m.score || 0),
          ...getAvatarView(m.nickname, m.avatarUrl)
        });
      }
    });

    Object.keys(normalized).forEach(uid => {
      const member = members.find(m => String(m.userId) === uid);
      const base = rankingById.get(uid) || member || { userId: uid, nickname: '' };
      rankingById.set(uid, {
        ...base,
        userId: base.userId || uid,
        score: normalized[uid],
        ...getAvatarView(base.nickname || '', base.avatarUrl || '')
      });
    });

    const maxScore = Math.max(...Array.from(rankingById.values()).map(r => Math.abs(r.score || 0)), 1);
    const ranking = Array.from(rankingById.values())
      .map(r => ({
        ...r,
        barWidth: Math.round(Math.abs(r.score || 0) / maxScore * 100)
      }))
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    const updatedRoom = room ? {
      ...room,
      members: members.map(m => {
        const uid = String(m.userId);
        return normalized[uid] !== undefined ? { ...m, score: normalized[uid] } : m;
      })
    } : room;

    this.setData({ ranking, currentRoom: updatedRoom });
    this.buildMemberGrid();
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

      const allRecords = reset ? pageRecords : [...this.data.scoreRecords, ...pageRecords];
      if (pageRecords.length < 20) {
        this._transferNoMore = true;
        this.setData({ noMore: true });
      }
      this._transferPage = page + 1;

      this.setData({ scoreRecords: allRecords });
      this.rebuildGroupedRecords();
      this.rebuildPulseStats();
      this.updateCanSealRoom();
    } catch (e) {
      console.error('加载脉冲记录失败', e);
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

  rebuildPulseStats(memberGridOverride) {
    const records = this.data.scoreRecords || [];
    const members = memberGridOverride || this.data.memberGrid || [];
    const myId = String(this.data.myUserId || app.globalData.userId || '');

    const traces = records.map(r => {
      const isMine = String(r.fromUserId) === myId || String(r.toUserId) === myId;
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
        valueText: this.formatPulseValue(r.amount),
        valueClass: isMine ? 'is-related' : '',
        isMine,
        isNew: false
      };
    });

    const totalAmount = records.reduce((sum, r) => sum + Math.abs(Number(r.amount || 0)), 0);
    const maxAmount = records.reduce((max, r) => Math.max(max, Math.abs(Number(r.amount || 0))), 0);
    const relatedCount = records.filter(r => String(r.fromUserId) === myId || String(r.toUserId) === myId).length;
    const filteredPulseTraces = this.data.traceFilterMine ? traces.filter(t => t.isMine) : traces;

    const chronological = records.slice().sort((a, b) => {
      const at = new Date(a.createdAt || 0).getTime();
      const bt = new Date(b.createdAt || 0).getTime();
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

    // 迷你轨迹预览：取本舰序列并压缩为 5-8 个点，归一化到 18%-82%。
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

    this.setData({
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
    });
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
    if (!this.data.scoreRecords.length) {
      this.showToast('等待更多脉冲写入');
      return;
    }
    this.openMatrixPanel();
  },

  handleTapShip(e) {
    const userId = String(e.currentTarget.dataset.userId || '');
    if (!userId) return;
    this.handleSelectCrew({
      currentTarget: {
        dataset: {
          userId,
          active: e.currentTarget.dataset.active !== false
        }
      }
    });
  },

  setBlackboxView(e) {
    const view = e.currentTarget.dataset.view || 'trace';
    this.setData({ blackboxView: view });
  },

  /** 过滤 toggle */
  toggleFilterMine() {
    this.setData({ filterMine: !this.data.filterMine });
    this.rebuildGroupedRecords();
  },

  /** 流向日志视角切换（组件事件） */
  onToggleFilter(e) {
    this.setData({ filterMine: e.detail.filterMine });
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

  // ========== 脉冲总览 ==========

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

  /** 连接编队 WebSocket（通过全局单例） */
  connectWS(roomId) {
    this._suppressWsReconnect = false;
    this.setData({ wsReconnecting: false });
    app.connectWS(roomId);
  },

  /** WebSocket 消息处理（通过 scoreWS.on 绑定） */
  onWsMessage(data) {
    if (!this.data.currentRoom) return;
    const roomId = this.data.currentRoom.roomId;

    if (data.type === 'PRESENCE_UPDATE') {
      const onlineMap = {};
      (data.onlineUserIds || []).forEach(uid => {
        onlineMap[String(uid)] = true;
      });
      this.setData({
        hasPresenceSnapshot: true,
        onlineUserMap: onlineMap
      });
      this.buildMemberGrid();
      return;
    }

    // 结算通知：房主已在 quitRoom 中处理，其他人拉取结算数据展示弹层
    if (data.type === 'SETTLE') {
      if (!this._settling && !this.data.showSettleOverlay) {
        this.fetchAndShowSettle(roomId);
      }
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
          score: 0,
          ...getAvatarView(data.nickname || '', data.avatarUrl)
        });
        room.members = members;
        this.enrichMembers(room);
        this.upsertScoreSnapshot({ [data.userId]: 0 });
        // 标记新加入航船，触发接入动画
        const newMap = { ...this.data.shipNewMap, [String(data.userId)]: true };
        this.setData({ shipNewMap: newMap });
        setTimeout(() => {
          const cur = { ...this.data.shipNewMap };
          delete cur[String(data.userId)];
          this.setData({ shipNewMap: cur });
        }, 600);
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

    // ===== 本局录入 WS 消息 =====
    if (data.type === 'ROUND_STARTED') {
      // 发起者已在 API 响应中处理，跳过 WS 重复
      if (data.round && String(data.round.createdBy) === String(app.globalData.userId)) return;
      this.setRoundRecord(data.round);
      return;
    }
    if (data.type === 'ROUND_MEMBER_SUBMITTED') {
      const rr = this.data.roundRecord;
      if (rr) {
        this.setData({
          'roundRecord.memberSubmitted': data.submitted,
          'roundRecord.memberTotal': data.total
        });
      }
      return;
    }
    if (data.type === 'ROUND_CONFIRM_PROGRESS') {
      const rr = this.data.roundRecord;
      if (rr) {
        const updates = {
          'roundRecord.confirmCount': data.confirmCount,
          'roundRecord.confirmTotal': data.total
        };
        // 更新确认者的 confirmed 状态
        if (data.userId && rr.details) {
          const idx = rr.details.findIndex(d => String(d.userId) === String(data.userId));
          if (idx >= 0) {
            updates[`roundRecord.details[${idx}].confirmed`] = true;
          }
        }
        this.setData(updates);
      }
      return;
    }
    if (data.type === 'ROUND_APPLIED') {
      this.setData({ roundRecord: null, showHostFill: false, showMemberFill: false, showRoundConfirm: false, showRejectConfirm: false });
      this.updateAllData(roomId);
      // 播放情绪音频
      if (app.globalData.audioEnabled && data.scores) {
        const myId = String(app.globalData.userId);
        const myScore = data.scores.find(s => String(s.userId) === myId);
        if (myScore && myScore.emotionAudioUrl) {
          getAudioManager().play(myScore.emotionAudioUrl);
        }
      }
      return;
    }
    if (data.type === 'ROUND_REJECTED') {
      if (this._toastTimer) { clearTimeout(this._toastTimer); this._toastTimer = null; }
      this.setData({
        roundRecord: null,
        showHostFill: false,
        showMemberFill: false,
        showRoundConfirm: false,
        showRejectConfirm: false,
        toastMsg: ''
      });
      this.showToast('本轮录入已被驳回', 'error');
      return;
    }
    if (data.type === 'ROUND_CANCELLED') {
      this.setData({ roundRecord: null, showHostFill: false, showMemberFill: false, showRoundConfirm: false, showRejectConfirm: false });
      return;
    }
    if (data.type === 'ROUND_TIMEOUT') {
      this.setData({ roundRecord: null, showHostFill: false, showMemberFill: false, showRoundConfirm: false, showRejectConfirm: false });
      if (data.action === 'auto_approve') {
        this.showToast('超时自动通过');
        this.updateAllData(roomId);
      } else {
        this.showToast('超时已自动取消', 'error');
      }
      return;
    }
    if (data.type === 'SETTINGS_CHANGED') {
      this.reloadRoomInfo(roomId);
      return;
    }

    if (data.type === 'SCORE_UPDATE' || data.type === 'MEMBER_UPDATE' || data.type === 'TRANSFER') {
      // MEMBER_UPDATE：内存更新呼号和识别徽标，无需 HTTP 请求
      if (data.type === 'MEMBER_UPDATE' && data.userId) {
        const members = (this.data.currentRoom.members || []).map(m => {
          if (String(m.userId) === String(data.userId)) {
            const nickname = data.nickname || m.nickname;
            return { ...m, nickname, ...getAvatarView(nickname, data.avatarUrl || m.avatarUrl) };
          }
          return m;
        });
        this.setData({ 'currentRoom.members': members });
        this.buildMemberGrid();
        return;
      }

      if (data.type === 'TRANSFER' && data.fromUserId && data.toUserId && data.amount) {
        const myId = String(app.globalData.userId);
        const isSender = String(data.fromUserId) === myId;

        // 出分方已在 submitTransfer 中本地处理动画和数据刷新，跳过
        if (isSender) return;

        // 驾驶舱轨迹：非出分方（收分方/旁观者）写入脉冲轨迹
        const fromMember = (this.data.currentRoom.members || []).find(m => String(m.userId) === String(data.fromUserId));
        const toMember = (this.data.currentRoom.members || []).find(m => String(m.userId) === String(data.toUserId));
        if (fromMember && toMember) {
          this.addPulseTrace(this.formatCrewName(fromMember.nickname), this.formatCrewName(toMember.nickname), data.amount, {
            fromAvatarUrl: fromMember.avatarUrl || '',
            toAvatarUrl: toMember.avatarUrl || ''
          });
        }

        // 仅收分方语音播报（旁观者不播放）
        const isReceiver = String(data.toUserId) === myId;
        if (isReceiver && app.globalData.audioEnabled) {
          const members = this.data.currentRoom.members || [];
          const audioFrom = members.find(m => String(m.userId) === String(data.fromUserId));
          const audioTo = members.find(m => String(m.userId) === myId);
          const fromName = audioFrom ? audioFrom.nickname : '未知';
          const toName = audioTo ? audioTo.nickname : '未知';
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
            return this.loadScoreRecords(roomId, true).finally(() => { this.buildMemberGrid(); this.loadInsightData(roomId); });
          });
        } else {
          // 兼容：旧版后端未携带分数时，走 updateAllData
          this.playTransferAnimation(data.fromUserId, data.toUserId, data.amount, () => {
            return this.updateAllData(roomId).then(() => this.loadInsightData(roomId));
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

  /** 刷新编队全部数据：排行榜 + 脉冲记录 + 编队信息 */
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
          isOwner: String(room.ownerId) === String(app.globalData.userId)
        });
        this.enrichMembers(room);
      }
    } catch (e) {
      console.error('刷新编队信息失败', e);
    }
  },

  // ========== 创建/加入编队 ==========

  enterRoom() {
    const room = this.data.currentRoom;
    if (!room) return;
    this.setData({ viewingRoom: true, isLaunching: true, launchPhase: 'linking' });

    // 短过渡动画（进入已有编队）
    const t1 = setTimeout(() => {
      this.setData({ launchPhase: 'hud' });
    }, 300);
    const t2 = setTimeout(() => {
      this.setData({ isLaunching: false, launchPhase: '' });
      this.updateCockpitState('connecting');
      this.loadRoomData(room.roomId);
      this.connectWS(room.roomId);
      if (room.scoreMode === 2) {
        this.loadPendingRound(room.roomId);
      }
    }, 600);

    this._transitionTimers = this._transitionTimers || [];
    this._transitionTimers.push(t1, t2);
  },

  onJoinInput(e) {
    this.setData({ joinRoomNo: e.detail.value.toUpperCase() });
  },

  // ========== 记分模式选择 ==========
  selectScoreMode(e) {
    vibrateShort('light');
    const mode = Number(e.currentTarget.dataset.mode);
    if (mode === this.data.scoreMode) return;
    this.setData({ scoreMode: mode });
  },

  selectRoundInputMethod(e) {
    vibrateShort('light');
    this.setData({ roundInputMethod: Number(e.currentTarget.dataset.value) });
  },

  selectTrustMode(e) {
    vibrateShort('light');
    this.setData({ trustMode: Number(e.currentTarget.dataset.value) });
  },

  selectZeroSum(e) {
    vibrateShort('light');
    this.setData({ zeroSumRequired: Number(e.currentTarget.dataset.value) });
  },

  selectAutoTimeoutAction(e) {
    vibrateShort('light');
    this.setData({ autoTimeoutAction: Number(e.currentTarget.dataset.value) });
  },

  selectTimeout(e) {
    vibrateShort('light');
    this.setData({ autoTimeoutSeconds: Number(e.currentTarget.dataset.value) });
  },

  // ========== 终端输入 ==========
  onTerminalTap() {
    this.setData({ terminalFocused: true });
  },

  onRoomCodeInput(e) {
    const raw = (e.detail.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.setData({
      roomCodeRaw: raw,
      joinRoomNo: raw,
      roomLookupValid: false,
      roomLookupMsg: '',
      roomPreview: null
    });
    // 输入满 6 位自动加入
    if (raw.length >= 6) {
      this.setData({ terminalFocused: false });
      clearTimeout(this._autoJoinTimer);
      this._autoJoinTimer = setTimeout(() => {
        this.joinByNo();
      }, 100);
    }
  },

  onRoomCodeBlur() {
    this.setData({ terminalFocused: false });
  },

  resetJoinState() {
    clearTimeout(this._autoJoinTimer);
    this.setData({
      roomCodeRaw: '',
      joinRoomNo: '',
      terminalFocused: false,
      roomLookupValid: false,
      roomLookupMsg: '',
      roomPreview: null
    });
  },

  // ========== 最近编队 ==========
  loadRecentRooms() {
    try {
      const list = wx.getStorageSync('recentRooms') || [];
      this.setData({ recentRooms: list.slice(0, 3) });
    } catch (e) {}
  },

  saveRecentRoom(roomNo, scoreMode) {
    try {
      let list = wx.getStorageSync('recentRooms') || [];
      list = list.filter(r => r.roomNo !== roomNo);
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      list.unshift({ roomNo, timeLabel: `${hh}:${mm}` });
      wx.setStorageSync('recentRooms', list.slice(0, 5));
      this.setData({ recentRooms: list.slice(0, 3) });
    } catch (e) {}
  },

  onRecentTap(e) {
    const roomNo = e.currentTarget.dataset.roomNo;
    if (roomNo) {
      this.setData({ roomCodeRaw: roomNo, joinRoomNo: roomNo });
      this.joinByNo();
    }
  },

  async createRoom() {
    if (this.data.creating) return;
    this.setData({ creating: true });
    try {
      const payload = { scoreMode: this.data.scoreMode };
      if (this.data.scoreMode === 2) {
        payload.roundInputMethod = this.data.roundInputMethod;
        payload.trustMode = this.data.trustMode;
        payload.zeroSumRequired = this.data.zeroSumRequired;
        payload.autoTimeoutSeconds = this.data.autoTimeoutSeconds;
        payload.autoTimeoutAction = this.data.autoTimeoutAction;
      }
      const room = await post('/room', payload);
      this.resetJoinState();
      this.setData({ currentRoom: room, viewingRoom: true, isOwner: true });
      await this.reloadRoomInfo(room.roomId);
      this.loadRoomData(room.roomId);
      this.connectWS(room.roomId);
      this.updateCockpitState();
      this.showToast('编队已创建');
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '启动失败', icon: 'none', duration: 2000 });
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
        isOwner: String(room.ownerId) === String(app.globalData.userId)
      });
      this.resetJoinState();
      this.saveRecentRoom(roomNo, room.scoreMode);
      // 先加载排名数据（含成员信息），再构建成员网格，避免 0 分闪烁
      await this.loadRoomData(room.roomId);
      // 刷新完整编队信息（成员列表可能比 join 响应更完整）
      this.reloadRoomInfo(room.roomId);
      this.connectWS(room.roomId);
      this.updateCockpitState();
      if (room.scoreMode === 2) {
        this.loadPendingRound(room.roomId);
      }
      wx.showToast({ title: '已加入编队', icon: 'success' });
    } catch (e) {
      if (e && e.code === 4003) {
        // 编队已满
        wx.showToast({ title: '当前编队已满员（最多16人）', icon: 'none', duration: 2500 });
        this.setData({ roomCodeRaw: roomNo.slice(0, 5), joinRoomNo: roomNo.slice(0, 5), terminalFocused: true });
      } else if (e && e.code === 4009) {
        // 身份重叠：弹窗引导修改呼号
        this.setData({ showNameCollisionModal: true });
      } else {
        wx.showToast({ title: (e && e.message) || '接入失败', icon: 'none', duration: 2000 });
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
    const fromInfo = this.data.memberGrid.find(m => String(m.userId) === String(app.globalData.userId));
    vibrateShort('light');
    this.setData({
      transferTo: userId,
      transferToInfo: info,
      transferFromInfo: fromInfo || null,
      showNumpad: true,
      numpadValue: 0,
      transferPreview: null
    });
    const roomId = this.data.currentRoom && this.data.currentRoom.roomId;
    if (roomId) {
      this.loadTransferAmountSuggestions(roomId);
    }
  },

  buildTransferPreview(val) {
    if (val > 0 && this.data.transferFromInfo && this.data.transferToInfo) {
      const fromScore = this.data.transferFromInfo.score || 0;
      const toScore = this.data.transferToInfo.score || 0;
      return {
        fromName: this.data.transferFromInfo.nickname,
        fromOldScore: fromScore,
        fromNewScore: fromScore - val,
        toName: this.data.transferToInfo.nickname,
        toOldScore: toScore,
        toNewScore: toScore + val
      };
    }
    return null;
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

    this.setData({ numpadValue: val, transferPreview: this.buildTransferPreview(val) });
  },

  tapTransferSuggestion(e) {
    const amount = Number(e.currentTarget.dataset.amount || 0);
    if (!amount) return;
    this.setData({
      numpadValue: amount,
      transferPreview: this.buildTransferPreview(amount)
    });
    vibrateShort('light');
  },

  confirmNumpad() {
    const amount = this.data.numpadValue;
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入数值', icon: 'none' });
      return;
    }
    if (amount > 99999999) {
      wx.showToast({ title: '最高 99999999', icon: 'none' });
      return;
    }
    if (!this.data.transferTo) {
      wx.showToast({ title: '请选择接收航船', icon: 'none' });
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
      transferFromInfo: null,
      transferPreview: null,
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
      wx.showToast({ title: '请选择接收航船', icon: 'none' });
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
      this.loadTransferAmountSuggestions(room.roomId);
      this.showToast('脉冲已记录');
    } catch (e) {
      console.error('记录失败', e);
      // 回滚：重新拉取权威数据
      this.updateAllData(room.roomId);
      const errMsg = this.normalizeRoomActionError(e);
      // 编队已封存或链路断开时，关闭面板并清理状态
      if (errMsg.includes('已封存') || errMsg.includes('已断开')) {
        this.setData({ showNumpad: false, numpadValue: 0, transferTo: '', transferToInfo: null, pulseValue: '' });
        if (errMsg.includes('已封存')) {
          this.setData({ currentRoom: null, viewingRoom: false, cockpitState: 'idle' });
          this.updateCockpitState();
        }
      }
      this.showToast(errMsg, 'error');
    } finally {
      this.setData({ submitting: false });
    }
  },

  // ========== 本局录入 ==========

  async startRound() {
    const room = this.data.currentRoom;
    if (!room) return;
    try {
      const resp = await post('/round/start', { roomId: room.roomId });
      this.setRoundRecord(resp);
      // 根据输入方式打开对应弹窗
      const isOwner = this.data.isOwner;
      if (room.roundInputMethod === 1 && isOwner) {
        // 房主填写
        this.setData({ showHostFill: true });
      } else if (room.roundInputMethod === 2) {
        // 成员自填（房主也是成员，也需要填写）
        this.setData({ showMemberFill: true });
      }
    } catch (e) {
      wx.showToast({ title: e.message || '操作失败', icon: 'none' });
    }
  },

  async submitHostFill(e) {
    const { scores } = e.detail;
    const room = this.data.currentRoom;
    if (!room) return;
    try {
      const resp = await post('/round/submit', { roomId: room.roomId, scores });
      this.setRoundRecord(resp);
      this.setData({ showHostFill: false });
      // 信任模式关闭 → 打开确认弹窗
      if (room.trustMode === 0 && resp.status === 2) {
        this.setData({ showRoundConfirm: true });
      }
      this.showToast('录入已提交');
    } catch (e) {
      wx.showToast({ title: e.message || '提交失败', icon: 'none' });
    }
  },

  async submitMemberFill(e) {
    const { score } = e.detail;
    const room = this.data.currentRoom;
    if (!room) return;
    try {
      const resp = await post('/round/submit', {
        roomId: room.roomId,
        scores: [{ userId: app.globalData.userId, score }]
      });
      this.setRoundRecord(resp);
      this.setData({ showMemberFill: false });
      if (room.trustMode === 0 && resp.status === 2) {
        this.setData({ showRoundConfirm: true });
      }
    } catch (e) {
      wx.showToast({ title: e.message || '提交失败', icon: 'none' });
    }
  },

  async confirmRound() {
    const room = this.data.currentRoom;
    if (!room) return;
    try {
      const resp = await post('/round/confirm', { roomId: room.roomId, agree: true });
      this.setRoundRecord(resp);
      if (resp.status === 3 || resp.status === 4) {
        this.setData({ showRoundConfirm: false });
      }
    } catch (e) {
      wx.showToast({ title: e.message || '操作失败', icon: 'none' });
    }
  },

  async cancelRound() {
    const room = this.data.currentRoom;
    if (!room) return;
    try {
      await post(`/round/cancel?roomId=${room.roomId}`);
      this.setData({ roundRecord: null, showHostFill: false, showMemberFill: false, showRoundConfirm: false, showRejectConfirm: false });
    } catch (e) {
      wx.showToast({ title: e.message || '操作失败', icon: 'none' });
    }
  },

  onRoundStatusTap() {
    const rr = this.data.roundRecord;
    if (!rr) return;
    const room = this.data.currentRoom;
    const isOwner = this.data.isOwner;
    // 根据状态和角色打开对应弹窗
    if (rr.status === 1) {
      // PENDING_MEMBER_INPUT
      if (room.roundInputMethod === 2) {
        this.setData({ showMemberFill: true });
      } else if (isOwner) {
        this.setData({ showHostFill: true });
      }
    } else if (rr.status === 2) {
      // PENDING_CONFIRM
      this.setData({ showRoundConfirm: true });
    }
  },

  onRoundCancel() {
    this.cancelRound();
  },

  onHostFillClose() {
    this.setData({ showHostFill: false });
  },

  onMemberFillClose() {
    this.setData({ showMemberFill: false });
  },

  onRoundConfirmClose() {
    this.setData({ showRoundConfirm: false });
  },

  /** round-confirm-modal 请求驳回，打开终端确认弹窗 */
  onRoundReject() {
    this.setData({ showRejectConfirm: true });
  },

  closeRejectConfirm() {
    this.setData({ showRejectConfirm: false });
  },

  /** 确认驳回本轮 */
  async confirmRoundReject() {
    const room = this.data.currentRoom;
    if (!room) return;
    this.setData({ showRejectConfirm: false });
    try {
      const resp = await post('/round/confirm', { roomId: room.roomId, agree: false });
      this.setRoundRecord(resp);
      if (resp.status === 4) {
        this.setData({ showRoundConfirm: false });
      }
    } catch (e) {
      wx.showToast({ title: e.message || '操作失败', icon: 'none' });
    }
  },

  async loadPendingRound(roomId) {
    try {
      const resp = await get(`/round/pending?roomId=${roomId}`);
      if (resp && resp.status !== 4) {
        this.setRoundRecord(resp);
      } else {
        this.setRoundRecord(null);
      }
    } catch (e) {
      // 无待处理录，忽略
    }
  },

  /** 设置 roundRecord 并计算当前用户的提交状态 */
  setRoundRecord(rr) {
    if (!rr) {
      this.setData({ roundRecord: null });
      this.updateCanSealRoom();
      this.syncCockpitView();
      return;
    }
    const myId = String(app.globalData.userId);
    const myDetail = (rr.details || []).find(d => String(d.userId) === myId);
    rr.mySubmitted = myDetail ? !!myDetail.submitted : false;
    rr.myScore = myDetail ? myDetail.score : 0;
    this.setData({ roundRecord: rr });
    this.updateCanSealRoom();
    this.syncCockpitView();
  },

  // ========== 退出/解散 ==========

  copyRoomNo() {
    if (!this.data.currentRoom) return;
    wx.setClipboardData({
      data: this.data.currentRoom.roomNo,
      success: () => this.showToast('编队码已复制')
    });
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
      const resp = await get(`/room/${roomId}`);
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
    // 非房主退出需要确认（房主已通过 SYSTEM WARNING 弹窗确认）
    if (!isOwner) {
      const { confirm } = await wx.showModal({ title: '确认退出当前编队？', content: '' });
      if (!confirm) return;
    }
    const roomId = this.data.currentRoom.roomId;
    try {
      if (isOwner) {
        this._settling = true;
        wx.showLoading({ title: '正在封存航程...' });
        // 1. 先归档数据
        const settleResp = await post(`/score/room/${roomId}/settle`, null, { silent: true });
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
          this.setData({ currentRoom: null, viewingRoom: false, ranking: [], scoreRecords: [], memberGrid: [], seatList: [], selectedCrew: null, cockpitScrollTarget: '', matrixData: [], roundRecord: null, canSealRoom: false, showHostFill: false, showMemberFill: false, showRoundConfirm: false, showRejectConfirm: false, wsReconnecting: false, wsConnected: false });
          wx.showToast({ title: '编队已关闭', icon: 'none', duration: 2000 });
        }
      } else {
        await del(`/room/${roomId}/quit`);
        this.suppressWsReconnect();
        app.disconnectWS();
        this.setData({ currentRoom: null, viewingRoom: false, ranking: [], scoreRecords: [], memberGrid: [], seatList: [], selectedCrew: null, cockpitScrollTarget: '', matrixData: [], roundRecord: null, showHostFill: false, showMemberFill: false, showRoundConfirm: false, showRejectConfirm: false, wsReconnecting: false, wsConnected: false });
        wx.showToast({ title: '已断开', icon: 'success' });
      }
    } catch (e) {
      this._settling = false;
      wx.hideLoading();
      const msg = e.message || '操作失败';
      // 编队已封存/已关闭时，清理本地状态回到待机
      if (msg.includes('已封存') || msg.includes('已关闭') || msg.includes('不可重复') || msg.includes('不存在')) {
        this.setData({
          currentRoom: null,
          viewingRoom: false,
          ranking: [],
          scoreRecords: [],
          memberGrid: [],
          seatList: [],
          matrixData: [],
          roundRecord: null,
          canSealRoom: false,
          showHostFill: false,
          showMemberFill: false,
          showRoundConfirm: false,
          showRejectConfirm: false,
          wsReconnecting: false,
          wsConnected: false
        });
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
        get(`/score/room/${roomId}/insight`).catch(() => null),
        get(`/score/room/${roomId}/network`).catch(() => null)
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

  /** 关闭结算弹层，回到编队待机 */
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
      settleEventMarkers: [],
      currentRoom: null,
      viewingRoom: false,
      ranking: [],
      scoreRecords: [],
      memberGrid: [],
      seatList: [],
      matrixData: [],
      roundRecord: null,
      showHostFill: false,
      showMemberFill: false,
      showRoundConfirm: false,
      showRejectConfirm: false,
      cockpitState: 'idle',
      selectedCrew: null,
      cockpitScrollTarget: '',
      pulseValue: '',
      pulseTraces: [],
      wsReconnecting: false,
      wsConnected: false
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
  },

  // ========== 音效开关 ==========

  toggleAudioSwitch() {
    const enabled = !app.globalData.audioEnabled;
    app.globalData.audioEnabled = enabled;
    wx.setStorageSync('audioEnabled', enabled);
    this.setData({ audioEnabled: enabled });
    vibrateShort('light');
    if (!enabled) {
      getAudioManager().stop();
    }
  },

  // ========== 动态脉冲样式（统一字号，颜色渐变） ==========

  getScoreStyle(score) {
    const fontSize = 28;
    let color;
    if (score === 0) {
      color = '#7C8698';
    } else if (score > 0) {
      color = '#36FF74';
    } else {
      color = '#FF4D4F';
    }
    return { fontSize, color };
  },

  // ========== 计分动画 ==========

  /** 乐观更新本地分数（发送者路径） */
  _optimisticScoreUpdate(fromUserId, toUserId, amount) {
    const fromScore = this.getLocalScore(fromUserId) - amount;
    const toScore = this.getLocalScore(toUserId) + amount;
    this.upsertScoreSnapshot({
      [fromUserId]: fromScore,
      [toUserId]: toScore
    });
  },

  /** 用 WebSocket 推送的权威分数更新本地（观察者路径） */
  _optimisticScoreUpdateFromWS(fromUserId, toUserId, fromNewScore, toNewScore) {
    this.upsertScoreSnapshot({
      [fromUserId]: fromNewScore,
      [toUserId]: toNewScore
    });
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
    const cellSelector = '.mg-cell';
    const cacheKey = '' + (this.data.memberGrid || []).length;
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
      animAmount: String(amount),
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
        this._particleTimer = setTimeout(animate, 16);
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

  /** 分数跳变动画：淡出 → 新值淡入 + scale */
  playScoreRollAnimation(fromUserId, toUserId, amount) {
    if (this._rollTimer) return;

    const grid = this.data.memberGrid;
    const fromIdx = grid.findIndex(m => String(m.userId) === String(fromUserId));
    const toIdx = grid.findIndex(m => String(m.userId) === String(toUserId));
    if (fromIdx < 0 || toIdx < 0) return;

    const fromOld = this._rollOldFromScore;
    const toOld = this._rollOldToScore;
    const fromNew = grid[fromIdx].score;
    const toNew = grid[toIdx].score;

    if (fromOld === fromNew && toOld === toNew) {
      this._animatingScores = {};
      return;
    }

    if (!app.globalData.animationEnabled) {
      const updates = {};
      updates[`memberGrid[${fromIdx}].displayScore`] = fromNew;
      updates[`memberGrid[${toIdx}].displayScore`] = toNew;
      this.setData(updates);
      this._animatingScores = {};
      return;
    }

    const duration = 300;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);

      const updates = {};
      // 前半段显示旧值，后半段显示新值
      if (t < 0.5) {
        updates[`memberGrid[${fromIdx}].displayScore`] = fromOld;
        updates[`memberGrid[${toIdx}].displayScore`] = toOld;
      } else {
        updates[`memberGrid[${fromIdx}].displayScore`] = fromNew;
        updates[`memberGrid[${toIdx}].displayScore`] = toNew;
      }
      this.setData(updates);

      if (t < 1) {
        this._rollTimer = setTimeout(animate, 16);
      } else {
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

  // ========== 识别徽标加载失败兜底 ==========

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

  formatTraceTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  // ===== 身份重叠弹窗 =====

  closeNameCollisionModal() {
    this.setData({ showNameCollisionModal: false });
  },

  goToProfile() {
    this.setData({ showNameCollisionModal: false });
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  onShareAppMessage() {
    const roomNo = this.data.currentRoom?.roomNo || '';
    this.closeShareSheet();
    return {
      title: `任务编队 ${roomNo} 邀请你加入`,
      path: `/pages/room/room?roomNo=${roomNo}`
    };
  }
});
