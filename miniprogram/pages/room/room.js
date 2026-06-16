const { retryWithBackoff } = require('../../utils/retry');
const scoreWS = require('../../utils/score-ws');
const roomService = require('../../services/room-service');
const scoreService = require('../../services/score-service');
const roundService = require('../../services/round-service');
const { getColor, getFirstChar, getAvatarView } = require('../../utils/avatar');
const { resolveAvatarSrcBatch } = require('../../utils/avatar-storage');
const { speakTransfer } = require('../../utils/voice');
const { getAudioManager } = require('../../utils/audio-manager');
const { vibrateShort } = require('../../utils/haptic');
const { createPatchScheduler } = require('./room-patch-scheduler');
const { debounce } = require('../../utils/throttle-debounce');
const { withErrorHandling, showError } = require('../../utils/error-handler');
const pulseHandler = require('./pulse-handler');
const roomActionHandler = require('./room-action-handler');
const roomWsHandler = require('./room-ws-handler');
const roomSettleHandler = require('./room-settle-handler');
const roomTransferHandler = require('./room-transfer-handler');
const roomRoundHandler = require('./room-round-handler');
const roomRecordHandler = require('./room-record-handler');
const {
  FORMATION_SAFE_ZONE,
  SPARKLINE_EMPTY_POINTS,
  buildCockpitView: buildCockpitViewModel,
  deriveFormationShips: deriveFormationShipsModel,
  deriveModeLabel: deriveModeLabelModel,
  derivePhaseLabel: derivePhaseLabelModel,
  deriveStageText: deriveStageTextModel,
  deriveLinkLabel: deriveLinkLabelModel,
  buildSeatList: buildSeatListModel,
  getPresenceClass: getPresenceClassModel,
  getPresenceLabel: getPresenceLabelModel,
  getSeatLayoutMode: getSeatLayoutModeModel,
  formatCrewName: formatCrewNameModel,
  formatCallSign: formatCallSignModel,
  formatPulseValue: formatPulseValueModel
} = require('./room-view-model');
const app = getApp();

Page(Object.assign(
  createPatchScheduler(),
  pulseHandler,
  roomActionHandler,
  roomWsHandler,
  roomSettleHandler,
  roomTransferHandler,
  roomRoundHandler,
  roomRecordHandler,
  {
    data: {
      isReady: false,
      isLoggedIn: !!app.globalData.token,
      pageVisible: false,
      customNavTop: 44,
      customNavBarHeight: 44,
      customNavHeight: 88,
      currentRoom: null,
      viewingRoom: false,
      isOwner: false,
      joinRoomNo: '',
      joining: false,
      showNameCollisionModal: false,
      // 记分模式：1=自由流转 2=本局录入
      scoreMode: 1,
      // 确认弹窗状态
      leaveConfirmVisible: false,
      showRejectConfirm: false,
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
      // 拖拽自定义位置
      draggingUserId: '',
      customPositions: {},
      // 计分目标
      transferTo: '',
      transferToInfo: null,
      transferFromInfo: null,
      transferPreview: null,
      showNumpad: false,
      numpadValue: 0,
      isInputOpen: false,
      // 战局洞察
      roomInsight: null,
      // 计分动画（CSS 驱动）
      animActive: false,
      animFlying: false,
      animStartX: 0,
      animStartY: 0,
      animDx: 0,
      animDy: 0,
      animArc: -80,
      animAmount: 0,
      // 脉冲记录
      scoreRecords: [],
      filterMine: false,
      showPulseLogPanel: false,
      pulseRecordsLoading: false,
      pulseReadoutRolling: false,
      pulseReadoutDisplay: '',
      pulseReadoutDirection: '',
      pulseReadoutColumns: [],
      contactFxUserId: '',
      contactFxRole: '',
      // 脉冲总览弹窗
      showMatrixPanel: false,
      relationMap: {},
      matrixChartData: null,
      matrixChartRoomId: '',
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
      settleActiveCard: 'overview',
      settleRoomId: '',
      settleNetworkLoading: false,
      settleNetworkLoaded: false,
      // 分享面板
      showShareSheet: false,
      qrLoading: false,
      qrFailed: false,
      // 更多操作面板
      showMorePanel: false,
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
      // 键盘布局数据（二维，用于嵌套渲染）
      transferKeyRows: [
        [
          { type: 'number', value: 1, text: '1' },
          { type: 'number', value: 2, text: '2' },
          { type: 'number', value: 3, text: '3' }
        ],
        [
          { type: 'number', value: 4, text: '4' },
          { type: 'number', value: 5, text: '5' },
          { type: 'number', value: 6, text: '6' }
        ],
        [
          { type: 'number', value: 7, text: '7' },
          { type: 'number', value: 8, text: '8' },
          { type: 'number', value: 9, text: '9' }
        ],
        [
          { type: 'close', text: '×' },
          { type: 'number', value: 0, text: '0' },
          { type: 'submit', text: '发射' }
        ]
      ],
      // 扁平化键盘数据（一维，用于 CSS Grid 渲染）
      flatKeyboardKeys: [
        { type: 'number', value: 1, text: '1' },
        { type: 'number', value: 2, text: '2' },
        { type: 'number', value: 3, text: '3' },
        { type: 'number', value: 4, text: '4' },
        { type: 'number', value: 5, text: '5' },
        { type: 'number', value: 6, text: '6' },
        { type: 'number', value: 7, text: '7' },
        { type: 'number', value: 8, text: '8' },
        { type: 'number', value: 9, text: '9' },
        { type: 'close', text: '×' },
        { type: 'number', value: 0, text: '0' },
        { type: 'submit', text: '发射' }
      ],
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
        selfPulseSizeClass: 'is-standard',
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
        hasTrajectory: false,
        terminalLogEntries: [],
        hudLogEntries: []
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
      leaveConfirmVisible: false,
      sealing: false,
      canSealRoom: false,
      sealHeartbeatText: '脉冲轨迹封装中',
      seatLayoutMode: 'solo',
      pulseFlight: { visible: false, fromX: 0, fromY: 0, dx: 0, dy: 0, value: '' },
      impactCrewId: null,
      showCommandCenter: false
    },

    toggleCommandCenter() {
      vibrateShort('light');
      const newState = !this.data.showCommandCenter;
      this.setData({ showCommandCenter: newState });
      if (newState) {
        this.syncCockpitView();
      }
    },

    hideCommandCenter() {
      if (this.data.showCommandCenter) {
        this.setData({ showCommandCenter: false });
      }
    },

    noop() {},

    async onShow() {
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setData({ selected: 0 })
      }
      this.setData({ routeAnimating: true });
      setTimeout(() => {
        this.setData({ routeAnimating: false });
      }, 450);
      app.globalData.activeTabKey = 'cockpit'
      const audioEnabled = wx.getStorageSync('audioEnabled') !== false;
      app.globalData.audioEnabled = audioEnabled;
      this.setData({
        isLoggedIn: !!app.globalData.token,
        pageVisible: true,
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
      // 重连成功后主动拉取最新状态，恢复编队数据链路
      if (!this._onWsReconnected) {
        this._onWsReconnected = () => {
          console.log('[room] WebSocket重连成功，恢复编队数据链路');
          // 重新连接WebSocket到当前编队
          const roomId = this.data.currentRoom?.roomId || wx.getStorageSync('currentRoomId');
          if (roomId) {
            scoreWS.switchRoom(roomId);
          }
          // 刷新编队状态
          this.refreshRoomState();
        };
      }
      scoreWS.on('reconnected', this._onWsReconnected);
      // 如果 WS 已经是断开状态，立即显示遮罩
      this.setData({ wsReconnecting: this.shouldShowWsReconnect() });
      // 前后台切换恢复策略
      if (this._hideTime && this.data.viewingRoom) {
        const elapsed = Date.now() - this._hideTime;
        if (elapsed > 300000) {
          // >5min：强制重连
          scoreWS.switchRoom(this.data.currentRoom?.roomId || this.data.currentRoom?.id);
        } else if (elapsed > 30000) {
          // 30s-5min：静默刷新数据
          this.buildMemberGrid();
        }
        // <30s：无需处理，WS 保持连接
      }
      this._hideTime = 0;
      // 如果正在通过 onLoad 的参数加入房间，暂缓执行 onShow 的恢复逻辑
      if (this._isJoiningFromOptions) {
        this.setData({ isReady: true });
        return;
      }

      // 如果已有当前房间且正在查看（说明是切回来的），但结算层还开着，保持不变
      // 如果没有当前房间（说明刚退出了），保持结算层开着（作为任务报告）
      // 如果后续逻辑识别到进入了新房间，会自动在 restore/join 时触发数据重置
      
      // 检查是否需要恢复房间状态
      if (app.globalData.token && (!this.data.viewingRoom || !this.data.currentRoom)) {
        const savedRoomId = wx.getStorageSync('currentRoomId');
        console.log('[room.onShow] 尝试恢复编队状态', {
          savedRoomId,
          viewingRoom: this.data.viewingRoom
        });
        if (savedRoomId && String(savedRoomId) !== 'undefined') {
          // 恢复用户自定义布局
          const customPosKey = `custom_pos_${savedRoomId}`;
          const customPositions = wx.getStorageSync(customPosKey) || {};
          this.setData({ customPositions });
          
          await this.restoreRoom(savedRoomId);
        } else {
          await this.loadMyRooms();
          this.loadRecentRooms();
        }
      } else if (app.globalData.token && this.data.viewingRoom && this.data.currentRoom) {
        console.log('[room.onShow] 已在房间中，检查WebSocket连接', {
          roomId: this.data.currentRoom.roomId,
          wsConnected: scoreWS.isConnected
        });
        if (!scoreWS.isConnected || !scoreWS.isConnecting) {
          this.connectWS(this.data.currentRoom.roomId, true);
        }
      }
      this.updateCockpitState();
      this.setData({ isReady: true });
    },

    onLoad(options) {
      this._animationQueue = [];
      this._animating = false;
      this.initCustomNav();
      let hasJoinParam = false;
      if (options.scene) {
        hasJoinParam = true;
        this.joinByRoomNo(decodeURIComponent(options.scene));
      } else if (options.roomNo) {
        hasJoinParam = true;
        this.joinByRoomNo(options.roomNo);
      }
      this._isJoiningFromOptions = hasJoinParam;
    },

    initCustomNav() {
      let statusBarHeight = 44;
      let navBarHeight = 44;
      try {
        const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        statusBarHeight = windowInfo.statusBarHeight || statusBarHeight;
        const menuRect = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
        if (menuRect && menuRect.height && menuRect.top > statusBarHeight) {
          navBarHeight = (menuRect.top - statusBarHeight) * 2 + menuRect.height;
        }
      } catch (e) {
        // 使用导航默认高度兜底
      }
      this.setData({
        customNavTop: statusBarHeight,
        customNavBarHeight: navBarHeight,
        customNavHeight: statusBarHeight + navBarHeight
      });
    },

    onUnload() {
      this._destroyed = true;
      this._animationQueue = [];
      this._animating = false;
      if (this._onWsMessage) {
        scoreWS.off('message', this._onWsMessage);
      }
      if (this._onWsClose) {
        scoreWS.off('close', this._onWsClose);
        scoreWS.off('open', this._onWsOpen);
      }
      if (this._onWsReconnected) {
        scoreWS.off('reconnected', this._onWsReconnected);
      }
      // 清理 patch scheduler
      if (this._roomPatchTimer) {
        clearTimeout(this._roomPatchTimer);
        this._roomPatchTimer = null;
      }
      // 清理定时器
      if (this._rollTimer) {
        clearTimeout(this._rollTimer);
        this._rollTimer = null;
      }
      if (this._pulseReadoutTimer) {
        clearTimeout(this._pulseReadoutTimer);
        this._pulseReadoutTimer = null;
      }
      if (this._contactFxTimer) {
        clearTimeout(this._contactFxTimer);
        this._contactFxTimer = null;
      }
      if (this._transferLockTimer) {
        clearTimeout(this._transferLockTimer);
        this._transferLockTimer = null;
      }
      this._transferSubmitLocked = false;
      this._activeTransferRequestId = '';
      if (this._seenTransferEvents) {
        this._seenTransferEvents.clear();
        this._seenTransferEvents = null;
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
    },

    onHide() {
      wx.hideLoading();
      wx.hideToast();
      this.setData({ routeAnimating: 'prepare' });
      if (this._autoJoinTimer) {
        clearTimeout(this._autoJoinTimer);
        this._autoJoinTimer = null;
      }
      this.stopSealHeartbeat();
      this._clearTransitionTimers();
      // 清理 fixed 叠加层，避免切 tab 时泄漏到其他页面
      this.setData({
        showShareSheet: false,
        showNumpad: false,
        joinPanelVisible: false,
        leaveConfirmVisible: false,
        showNameCollisionModal: false,
        pageVisible: false,
        wsReconnecting: false,
        toastMsg: '',
        animActive: false,
        animFlying: false,
        loading: false,
      });
      this._hideTime = Date.now();
      if (this._onWsMessage) {
        scoreWS.off('message', this._onWsMessage);
      }
      if (this._onWsClose) {
        scoreWS.off('close', this._onWsClose);
        scoreWS.off('open', this._onWsOpen);
      }
      if (this._onWsReconnected) {
        scoreWS.off('reconnected', this._onWsReconnected);
      }
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
      return buildCockpitViewModel({
        currentRoom: this.data.currentRoom,
        cockpitState: cockpitStateOverride || this.data.cockpitState,
        memberGrid: memberGridOverride || this.data.memberGrid || [],
        viewingRoom: this.data.viewingRoom,
        myUserId: this.data.myUserId || app.globalData.userId || '',
        userInfo: app.globalData.userInfo || {},
        scoreMode: this.data.scoreMode,
        isOwner: this.data.isOwner,
        scoreRecords: this.data.scoreRecords || [],
        pulseStats: this.data.pulseStats,
        pulseTraces: this.data.pulseTraces || [],
        filterMine: this.data.filterMine,
        traceChartSparkline: this.data.traceChartSparkline || [],
        wsReconnecting: this.data.wsReconnecting,
        wsConnected: this.data.wsConnected,
        roundRecord: this.data.roundRecord,
        shipNewMap: this.data.shipNewMap || {},
        onlineUserMap: this.data.onlineUserMap || {},
        hasPresenceSnapshot: !!this.data.hasPresenceSnapshot,
        customPositions: this.data.customPositions
      });
    },

    // ========== 拖拽排布 ==========

    handleShipTouchStart(e) {
      const userId = String(e.currentTarget.dataset.userId || '');
      if (!userId) return;
      
      const touch = e.touches[0];
      const ship = (this.data.cockpitView.externalShips || []).find(s => String(s.userId) === userId);
      if (!ship) return;

      // 动态获取容器宽高，以支持更精确的百分比换算
      const query = this.createSelectorQuery();
      query.select('#formation-window').boundingClientRect(rect => {
        if (!rect) return;
        this._dragData = {
          userId,
          startX: touch.pageX,
          startY: touch.pageY,
          initialX: ship.x,
          initialY: ship.y,
          containerWidth: rect.width,
          containerHeight: rect.height,
          moved: false
        };
        this.setData({ draggingUserId: userId });
      }).exec();
    },

    handleShipTouchMove(e) {
      if (!this._dragData) return;
      const touch = e.touches[0];
      const dx = touch.pageX - this._dragData.startX;
      const dy = touch.pageY - this._dragData.startY;

      // 判定是否发生了移动（防抖/防误点）
      if (!this._dragData.moved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        this._dragData.moved = true;
      }

      if (!this._dragData.moved) return;

      // 计算百分比位移
      const pxToPercentX = (dx / this._dragData.containerWidth) * 100;
      const pxToPercentY = (dy / this._dragData.containerHeight) * 100;

      const newX = Math.max(
        FORMATION_SAFE_ZONE.minX,
        Math.min(FORMATION_SAFE_ZONE.maxX, this._dragData.initialX + pxToPercentX)
      );
      const newY = Math.max(
        FORMATION_SAFE_ZONE.minY,
        Math.min(FORMATION_SAFE_ZONE.maxY, this._dragData.initialY + pxToPercentY)
      );

      // ===== 1. 物理碰撞检测 (防重叠) =====
      const COLLISION_THRESHOLD = 14;
      const otherShips = (this.data.cockpitView.externalShips || [])
        .filter(s => String(s.userId) !== this._dragData.userId);

      const isCollidingWithOthers = otherShips.some(s => {
        const dist = Math.sqrt(Math.pow(newX - s.x, 2) + Math.pow(newY - s.y, 2));
        return dist < COLLISION_THRESHOLD;
      });

      if (isCollidingWithOthers) return;

      const customPositions = { ...this.data.customPositions };
      customPositions[this._dragData.userId] = { x: newX, y: newY };

      this.setData({ customPositions });
      this.syncCockpitView();
    },

    handleShipTouchEnd(e) {
      if (!this._dragData) return;
      
      // 如果没有实质移动，视作点击，触发原有的选中逻辑
      if (!this._dragData.moved) {
        this.handleTapShip(e);
      } else {
        // 拖拽结束，持久化位置偏好
        const roomId = this.data.currentRoom?.roomId;
        if (roomId) {
          const key = `custom_pos_${roomId}`;
          wx.setStorageSync(key, this.data.customPositions);
        }
      }

      this._dragData = null;
      this.setData({ draggingUserId: '' });
    },

    syncCockpitView(memberGridOverride) {
      this.setData({
        cockpitView: this.buildCockpitView(memberGridOverride)
      });
    },

    deriveFormationShips(members = [], selfId = '') {
      return deriveFormationShipsModel(members, selfId, {
        shipNewMap: this.data.shipNewMap || {},
        onlineUserMap: this.data.onlineUserMap || {},
        hasPresenceSnapshot: !!this.data.hasPresenceSnapshot,
        myUserId: this.data.myUserId
      });
    },

    deriveModeLabel(room) {
      return deriveModeLabelModel(room, this.data.scoreMode);
    },

    derivePhaseLabel(hasFormation, state) {
      return derivePhaseLabelModel(hasFormation, state, this.data.roundRecord);
    },

    deriveStageText(hasFormation, state) {
      return deriveStageTextModel(hasFormation, state);
    },

    deriveLinkLabel(hasFormation, state) {
      return deriveLinkLabelModel(hasFormation, state, {
        wsReconnecting: this.data.wsReconnecting,
        wsConnected: this.data.wsConnected
      });
    },

    shouldShowWsReconnect() {
      const room = this.data.currentRoom;
      if (!this.data.pageVisible || app.globalData.activeTabKey !== 'cockpit') return false;
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
      return buildSeatListModel(members, {
        onlineUserMap: this.data.onlineUserMap || {},
        hasPresenceSnapshot: !!this.data.hasPresenceSnapshot,
        myUserId: this.data.myUserId
      });
    },

    getPresenceClass(userId, onlineMap, hasPresenceSnapshot) {
      return getPresenceClassModel(userId, onlineMap, hasPresenceSnapshot, this.data.myUserId);
    },

    getPresenceLabel(userId, onlineMap, hasPresenceSnapshot) {
      return getPresenceLabelModel(userId, onlineMap, hasPresenceSnapshot, this.data.myUserId);
    },

    getSeatLayoutMode(count) {
      return getSeatLayoutModeModel(count);
    },

    formatCrewName(name = '') {
      return formatCrewNameModel(name);
    },

    formatCallSign(name = '') {
      return formatCallSignModel(name);
    },

    formatPulseValue(value = 0) {
      return formatPulseValueModel(value);
    },

    // ===== 驾驶舱交互 =====

    handleSelectCrew(e) {
      const userId = String(e.currentTarget.dataset.userId || '');
      // 移除对 isActive 的严格校验，允许点击任何成员
      if (!userId) {
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

    openBeacon() {
      vibrateShort('light');
      this.openShareSheet();
    },

    goMirrorTrace() {
      wx.switchTab({ url: '/pages/mirror/index' });
    },

    goTrace() {
      vibrateShort('light');
      this.openMatrixPanel();
    },

    /** 添加脉冲轨迹，自动截断旧记录并设置 isNew 标记 */
    addPulseTrace(fromName, toName, amount, extra = {}) {
      const MAX_TRACES = 50;
      const traces = this.data.pulseTraces.slice();
      this._traceSeq = (this._traceSeq || 0) + 1;
      const id = this._traceSeq;
      const myId = String(app.globalData.userId || '');
      const fromUserId = String(extra.fromUserId || '');
      const toUserId = String(extra.toUserId || '');
      const isMine = fromUserId || toUserId
        ? fromUserId === myId || toUserId === myId
        : fromName === '我' || toName === '我';
      const myRole = fromUserId === myId || fromName === '我'
        ? 'from'
        : toUserId === myId || toName === '我'
          ? 'to'
          : '';
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
        fromUserId,
        toUserId,
        myRole,
        isMine,
        isNew: true
      });
      if (traces.length > MAX_TRACES) traces.splice(0, traces.length - MAX_TRACES);
      const filteredPulseTraces = this.data.traceFilterMine ? traces.filter(t => t.isMine) : traces;
      this.setData({
        pulseTraces: traces,
        filteredPulseTraces,
        traceAnchor: `trace-${id}`
      });
      setTimeout(() => {
        const current = this.data.pulseTraces.map(t =>
          t.id === id ? { ...t, isNew: false } : t
        );
        this.setData({ pulseTraces: current });
      }, 3000);
      this.updateCanSealRoom();
    },

    /** 更新封存可用状态：有轨迹/记录/已生效本局录时可封存 */
    updateCanSealRoom() {
      const hasTraces = this.data.pulseTraces.length > 0;
      const hasRecords = this.data.scoreRecords.length > 0;
      const hasRound = this.data.roundRecord && this.data.roundRecord.status === 'applied';
      this.setData({ canSealRoom: hasTraces || hasRecords || hasRound });
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

            setTimeout(() => {
              this.setData({
                pulseFlight: { visible: false, fromX: 0, fromY: 0, dx: 0, dy: 0, value: '' }
              });
              this.flashTargetSeat(toUserId);
              resolve();
            }, 760);
          });
      });
    },

    /** 目标席位 impact 闪光 */
    flashTargetSeat(userId, force = false) {
      if (!force && this.data.animActive && String(this._rollToUserId) === String(userId)) {
        // 如果当前正在播放飞向该用户的粒子动画，不要提前被 WS 事件闪烁，等粒子落地时强制闪烁
        return;
      }
      this.setData({ impactCrewId: String(userId) });
      this.refreshSeatLayoutWithImpact(userId);
      setTimeout(() => {
        if (!this._destroyed) this.setData({ impactCrewId: null });
      }, 1200); // 增加时长以匹配 floatUpDecrypt (1000ms) 和 ripple (500ms)
    },

    /** 带 impact 标记的席位列表 */
    refreshSeatLayoutWithImpact(userId) {
      // cockpitView.externalShips 通过 impactCrewId 驱动 CSS class，无需额外 setData
    },

    goLogin() {
      wx.navigateTo({ url: '/pages/login/login' });
    },

    showToast(msg, type = 'success') {
      wx.showToast({
        title: msg,
        icon: type === 'error' ? 'error' : type === 'success' ? 'success' : 'none'
      });
    },

    calcScoreRecordHeight() {
      try {
        const win = wx.getWindowInfo();
        const rpxRatio = 750 / win.windowWidth;
        const screenH = win.windowHeight * rpxRatio;
        this.setData({ scoreRecordHeight: Math.round(screenH * 0.4) });
      } catch (e) {}
    },

    // ========== 编队加载 ==========

    /** 重新编译后从本地存储恢复房间状态 */
    async restoreRoom(roomId) {
      try {
        const preloads = app.globalData.preloads || {};
        let roomPromise = preloads.roomDetail;
        
        // 校验预加载是否匹配当前要恢复的 roomId
        // 注意：preloads.roomDetail 可能是 Promise，也可能是 null
        if (roomPromise) {
          // 清理，防止重复使用旧数据
          delete preloads.roomDetail;
        } else {
          roomPromise = roomService.getRoomDetail(roomId);
        }

        const room = await roomPromise;
        if (!room) {
          wx.removeStorageSync('currentRoomId');
          this.loadMyRooms();
          this.loadRecentRooms();
          return;
        }
        if (room.status !== 0) {
          this.handleRoomNotFoundError({ message: '房间已关闭' });
          return;
        }
        wx.setStorageSync('currentRoomId', room.roomId);
        this.setData({
          currentRoom: room,
          viewingRoom: true,
          isOwner: String(room.ownerId) === String(app.globalData.userId)
        });
        this.enrichMembers(room);
        this._resolveCloudAvatars(room);
        this.loadRoomData(room.roomId);
        this.connectWS(room.roomId, true);
        this.updateCockpitState();
        if (room.scoreMode === 2) {
          this.loadPendingRound(room.roomId);
        }
      } catch (e) {
        console.error('[restoreRoom] 恢复房间详情失败', e);
        // 如果是因为权限（403）或其他原因导致详情拉取失败，
        // 尝试通过 loadMyRooms 进行一次全量对账，而不是直接清除存储。
        if (e && (e.message === '编队不存在' || e.message === '房间已关闭' || e.code === 400 || e.code === 403)) {
          this.handleRoomNotFoundError(e);
        } else {
          // 网络抖动等其他异常：尝试二次恢复
          this.loadMyRooms();
        }
      }
    },

    async loadMyRooms() {
      if (this._showingSettle) return;
      this.setData({ loading: true });

      if (this._loadRoomsTimer) clearTimeout(this._loadRoomsTimer);
      this._loadRoomsTimer = setTimeout(() => {
        if (this.data.loading) {
          this.setData({ loading: false });
        }
      }, 6000);

      try {
        const preloads = app.globalData.preloads || {};
        let roomsPromise = preloads.myRooms;
        
        if (roomsPromise) {
          delete preloads.myRooms;
        } else {
          roomsPromise = roomService.getMyRooms();
        }

        const rooms = await roomsPromise;
        if (rooms && rooms.length > 0) {
          const room = rooms[0];
          wx.setStorageSync('currentRoomId', room.roomId);
          this.setData({
            currentRoom: room,
            viewingRoom: true,
            isOwner: String(room.ownerId) === String(app.globalData.userId)
          });
          this.enrichMembers(room);
          this._resolveCloudAvatars(room);
          this.loadRoomData(room.roomId);
          this.connectWS(room.roomId, true);
          this.updateCockpitState();
          if (room.scoreMode === 2) {
            this.loadPendingRound(room.roomId);
          }
        } else {
          wx.removeStorageSync('currentRoomId');
          this.setData({
            currentRoom: null,
            viewingRoom: false,
            ranking: [],
            scoreRecords: [],
            relationMap: {},
            matrixChartData: null,
            matrixChartRoomId: '',
            memberGrid: [],
            seatList: [],
            selectedCrew: null,
            cockpitScrollTarget: '',
            pulseTraces: [],
            matrixData: []
          });
          this.updateCockpitState();
        }
      } catch (e) {
        console.error('加载编队失败', e);
        if (e && (e.message === '编队不存在' || e.message === '房间已关闭' || e.code === 400)) {
          this.handleRoomNotFoundError(e);
        }
      } finally {
        if (this._loadRoomsTimer) {
          clearTimeout(this._loadRoomsTimer);
          this._loadRoomsTimer = null;
        }
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
      this._resolveCloudAvatars(room);
    },

    /** 批量解析 cloud:// 格式的成员头像 */
    async _resolveCloudAvatars(room) {
      if (!room || !room.members) return;
      
      const cloudUrls = new Set(
        room.members
          .map(m => m.avatarUrl)
          .filter(u => u && u.startsWith('cloud://'))
      );

      // 也将用户自身的头像纳入解析
      const myAvatar = app.globalData.userInfo?.avatarUrl;
      if (myAvatar && myAvatar.startsWith('cloud://')) {
        cloudUrls.add(myAvatar);
      }

      if (cloudUrls.size === 0) return;

      try {
        const resolved = await resolveAvatarSrcBatch(Array.from(cloudUrls));
        
        const members = (this.data.currentRoom.members || []).map(m => {
          if (m.avatarUrl && m.avatarUrl.startsWith('cloud://')) {
            return { ...m, avatarUrl: resolved[m.avatarUrl] || '' };
          }
          return m;
        });

        // 只要处理过 cloud 链接，无论成功失败都进行全量刷新
        this.setData({ 'currentRoom.members': members });

        // 如果我自己的头像也被解析了，同步更新 globalData，这样派生模型就能拿到 https 链接
        if (myAvatar && myAvatar.startsWith('cloud://') && resolved[myAvatar]) {
           app.globalData.userInfo.avatarUrl = resolved[myAvatar];
        }

        this.buildMemberGrid();
      } catch (e) {
        console.error('[room] 批量解析云头像失败', e);
      }
    },

    async updateAllData(roomId) {
      if (!roomId) return;
      try {
        await this.loadRoomData(roomId);
        this.buildMemberGrid();
        if (this.data.currentRoom) {
          this._resolveCloudAvatars(this.data.currentRoom);
        }
      } catch (e) {
        console.error('[updateAllData] 全量更新数据失败', e);
      }
    },

    pushWsTransferToQueue(task) {
      if (!this._animationQueue) this._animationQueue = [];
      
      if (this._animationQueue.length >= 3) {
        console.log('[Queue] 动画积压严重，快速丢弃动画并执行直接落态: size=', this._animationQueue.length);
        this._animationQueue.forEach(t => {
          this._optimisticScoreUpdateFromWS(t.fromUserId, t.toUserId, t.fromNewScore, t.toNewScore);
          this.appendLocalTransferRecord(t.fromUserId, t.toUserId, t.amount, t.now || Date.now());
        });
        this._animationQueue = [];
        this._animating = false;

        this.setData({
          pulseReadoutDisplay: this.formatPulseValue(this.getLocalScore(task.toUserId))
        });
        this._optimisticScoreUpdateFromWS(task.fromUserId, task.toUserId, task.fromNewScore, task.toNewScore);
        this.appendLocalTransferRecord(task.fromUserId, task.toUserId, task.amount, task.now || Date.now());
        this.buildMemberGrid();
        this.triggerContactTransferFx(task.fromUserId, 'sending');
        this.triggerPulseReadoutRoll(this.formatPulseValue(task.toNewScore), 'gain');
        return;
      }

      this._animationQueue.push(task);
      this._processAnimationQueue();
    },

    _processAnimationQueue() {
      if (this._animating || !this._animationQueue || this._animationQueue.length === 0) return;
      
      this._animating = true;
      const t = this._animationQueue.shift();

      const g = this.data.memberGrid;
      const fM = g.find(m => String(m.userId) === String(t.fromUserId));
      const tM = g.find(m => String(m.userId) === String(t.toUserId));
      this._animatingScores = {};
      this._animatingScores[t.fromUserId] = fM ? fM.displayScore : 0;
      this._animatingScores[t.toUserId] = tM ? tM.displayScore : 0;

      this.setData({
        pulseReadoutDisplay: this.formatPulseValue(tM ? tM.displayScore : this.getLocalScore(t.toUserId))
      });
      this._optimisticScoreUpdateFromWS(t.fromUserId, t.toUserId, t.fromNewScore, t.toNewScore);
      this.triggerContactTransferFx(t.fromUserId, 'sending');

      this.playTransferAnimation(t.fromUserId, t.toUserId, t.amount, () => {
        this.appendLocalTransferRecord(t.fromUserId, t.toUserId, t.amount, t.now || Date.now());
        this.buildMemberGrid();
        this.triggerPulseReadoutRoll(this.formatPulseValue(t.toNewScore), 'gain');
        
        setTimeout(() => {
          this._animating = false;
          this._processAnimationQueue();
        }, 300);
      });
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
          const old = oldGrid.find(g => g.userId === m.userId);
          displayScore = old ? old.displayScore : score;
        } else if (isAnimating) {
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
      const memberPatch = {
        memberGrid: grid,
        seatList: this.buildSeatList(grid),
        seatLayoutMode: this.getSeatLayoutMode(grid.length),
        myPulseValue,
        myPulseText: this.formatPulseValue(myPulseValue),
        myPulseTone: myPulseValue > 0 ? 'positive' : myPulseValue < 0 ? 'negative' : 'zero',
        cockpitView,
        ...extraState
      };
      const pulsePatch = this._calcPulseStatsPatch(grid);
      const isBusy = this._animating || (this._animationQueue && this._animationQueue.length > 0);
      this.scheduleRoomPatch({ ...memberPatch, ...pulsePatch }, { immediate: !isBusy, delay: 60 });
    },

    async loadRoomData(roomId) {
      await Promise.all([
        this.loadRanking(roomId),
        this.loadScoreRecords(roomId, true)
      ]);
      this.loadInsightData(roomId);
      this.loadTransferAmountSuggestions(roomId);
    },

    /** 刷新编队基本信息 */
    async reloadRoomInfo(roomId) {
      if (!roomId) return;
      try {
        const room = await roomService.getRoomDetail(roomId);
        if (room) {
          this.setData({
            currentRoom: room,
            isOwner: String(room.ownerId) === String(app.globalData.userId)
          });
          this.buildMemberGrid();
          this._resolveCloudAvatars(room);
        }
      } catch (e) {
        console.error('[room] 刷新编队信息失败', e);
      }
    },

    /** 重连后主动拉取最新状态，恢复编队数据链路 */
    async refreshRoomState() {
      const room = this.data.currentRoom;
      const roomId = room?.roomId || wx.getStorageSync('currentRoomId');
      
      if (!roomId) {
        console.warn('[room] 无编队ID，无法恢复编队数据');
        return;
      }
      
      try {
        console.log('[room] 开始恢复编队数据', { roomId });
        await this.loadRoomData(roomId);
        this.buildMemberGrid();
        console.log('[room] 编队数据恢复完成');
      } catch (e) {
        if (e && (e.message === '编队不存在' || e.message === '房间已关闭' || e.code === 400)) {
          this.handleRoomNotFoundError(e);
        }
      }
    },

    async loadInsightData(roomId) {
      try {
        const insight = await scoreService.getRoomInsight(roomId);
        this.setData({ roomInsight: insight });
      } catch (e) {}
    },

    async loadTransferAmountSuggestions(roomId) {
      if (!roomId) return;
      try {
        const resp = await scoreService.getTransferAmountSuggestions(roomId);
        const items = (resp && resp.items || [])
          .map(item => ({
            amount: Number(item.amount || 0),
            label: item.label || (item.source === 'crew' ? '常用' : '编队'),
            source: item.source || 'space'
          }))
          .filter(item => item.amount > 0)
          .slice(0, 6);
        this.setData({ transferAmountSuggestions: items });
      } catch (e) {}
    },

    async loadRanking(roomId) {
      try {
        const preloads = app.globalData.preloads || {};
        let rankingPromise = preloads.roomRanking;
        
        if (rankingPromise) {
          delete preloads.roomRanking;
        } else {
          rankingPromise = scoreService.getRoomRanking(roomId);
        }

        const ranking = await rankingPromise;
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
        if (e && (e.message === '编队不存在' || e.message === '房间已关闭' || e.code === 400)) {
          this.handleRoomNotFoundError(e);
          throw e;
        } else {
          showError('加载排行榜失败');
        }
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

    /** 按分钟分组 + 过滤 */

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

    openFormationManageFromBeacon() {
      this.closeShareSheet();
      setTimeout(() => this.confirmLeaveOrDisband(), 180);
    },

    // ========== 脉冲总览 ==========

    openMatrixPanel() {
      const room = this.data.currentRoom;
      if (!room) return;
      const sameRoomChart = String(this.data.matrixChartRoomId || '') === String(room.roomId);
      this.setData({
        showMatrixPanel: true,
        matrixChartRoomId: room.roomId,
        matrixChartData: sameRoomChart ? this.data.matrixChartData : null
      });
      if (!sameRoomChart || !this.data.matrixChartData) {
        this.scheduleMatrixChartLoad(room.roomId);
      }
    },

    closeMatrixPanel() {
      if (this._matrixChartTimer) {
        clearTimeout(this._matrixChartTimer);
        this._matrixChartTimer = null;
      }
      this.setData({ showMatrixPanel: false });
    },

    onMatrixClose() {
      this.closeMatrixPanel();
    },

    scheduleMatrixChartLoad(roomId) {
      if (!roomId) return;
      if (this._matrixChartTimer) clearTimeout(this._matrixChartTimer);
      this._matrixChartTimer = setTimeout(() => {
        this._matrixChartTimer = null;
        this.loadMatrixChart(roomId);
      }, 260);
    },

    async loadMatrixChart(roomId) {
      if (!roomId) return;
      try {
        const data = await scoreService.getRoomChart(roomId);
        const currentRoomId = this.data.currentRoom && this.data.currentRoom.roomId;
        if (!this.data.showMatrixPanel || String(currentRoomId || '') !== String(roomId)) return;
        const series = data && Array.isArray(data.series) ? data.series : [];
        this.setData({
          matrixChartRoomId: roomId,
          matrixChartData: series.length > 0 ? {
            timestamps: data.timestamps || [],
            series,
            visibleUsers: [String(this.data.myUserId || app.globalData.userId || '')].filter(Boolean)
          } : null
        });
      } catch (e) {
        console.error('加载数值总览图表失败', e);
        if (this.data.showMatrixPanel) {
          this.setData({ matrixChartRoomId: roomId, matrixChartData: null });
        }
      }
    },

    enterRoom() {
      const room = this.data.currentRoom;
      if (!room) return;
      this.setData({ viewingRoom: true, isLaunching: true, launchPhase: 'linking' });

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
        const room = await roomService.createRoom(payload);
        this.resetJoinState();
        this.setData({ currentRoom: room, viewingRoom: true, isOwner: true });
        wx.setStorageSync('currentRoomId', room.roomId);
        wx.setStorageSync('currentRoomNo', room.roomNo);
        wx.setStorageSync('currentMemberCount', room.members ? room.members.length : 1);
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
        const room = await roomService.joinRoom(roomNo);
        this.setData({
          currentRoom: room,
          viewingRoom: true,
          isOwner: String(room.ownerId) === String(app.globalData.userId)
        });
        this.resetJoinState();
        wx.setStorageSync('currentRoomId', room.roomId);
        wx.setStorageSync('currentRoomNo', room.roomNo);
        wx.setStorageSync('currentMemberCount', room.members ? room.members.length : 0);
        this.saveRecentRoom(roomNo, room.scoreMode);
        await this.loadRoomData(room.roomId);
        this.reloadRoomInfo(room.roomId);
        this.connectWS(room.roomId);
        this.updateCockpitState();
        if (room.scoreMode === 2) {
          this.loadPendingRound(room.roomId);
        }
        wx.showToast({ title: '已加入编队', icon: 'success' });
      } catch (e) {
        if (e && e.code === 4003) {
          wx.showToast({ title: '当前编队已满员（最多16人）', icon: 'none', duration: 2500 });
          this.setData({ roomCodeRaw: roomNo.slice(0, 5), joinRoomNo: roomNo.slice(0, 5), terminalFocused: true });
        } else if (e && e.code === 4009) {
          this.setData({ showNameCollisionModal: true });
        } else {
          wx.showToast({ title: (e && e.message) || '接入失败', icon: 'none', duration: 2000 });
        }
        throw e;
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

    playTransferAnimation(fromUserId, toUserId, amount, onParticleDone) {
      if (!app.globalData.animationEnabled) {
        this._animatingScores = {};
        if (onParticleDone) onParticleDone();
        return;
      }

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

      this._animatingScores = {};
      this._animatingScores[fromUserId] = oldFromScore;
      this._animatingScores[toUserId] = oldToScore;

      const vrSelector = '.pulse-vr-cluster';
      const fromSelector = `#seat-${fromUserId}`;
      const toSelector = `#seat-${toUserId}`;

      wx.createSelectorQuery()
        .select(fromSelector)
        .boundingClientRect()
        .select(toSelector)
        .boundingClientRect()
        .select(vrSelector)
        .boundingClientRect()
        .exec((res) => {
          if (!res) {
            if (onParticleDone) onParticleDone();
            return;
          }
          const fromRect = res[0];
          const toRect = res[1];
          const vrCluster = res[2];
          
          this._runParticleWithRects(fromUserId, toUserId, amount, fromRect, toRect, vrCluster, onParticleDone);
        });
    },

    _runParticleWithRects(fromUserId, toUserId, amount, fromRect, toRect, vrCluster, onParticleDone) {
      let startX, startY;
      const fromIsMe = String(fromUserId) === String(app.globalData.userId);
      
      // 起点：如果有 Numpad 且是我发出的，则从 Numpad 发射
      if (fromIsMe && this.data.showNumpad && vrCluster) {
        startX = vrCluster.left + vrCluster.width / 2;
        startY = vrCluster.top + 20; 
      } else if (fromRect) {
        startX = fromRect.left + fromRect.width / 2;
        startY = fromRect.top + fromRect.height * 0.3;
      } else {
        // Fallback start position (e.g. bottom center)
        const sysInfo = wx.getSystemInfoSync();
        startX = sysInfo.windowWidth / 2;
        startY = sysInfo.windowHeight - 100;
      }

      // 终点：目标座舱
      let endX, endY;
      if (toRect) {
        endX = toRect.left + toRect.width / 2;
        endY = toRect.top + toRect.height * 0.3;
      } else {
        // Fallback end position (e.g. center)
        const sysInfo = wx.getSystemInfoSync();
        endX = sysInfo.windowWidth / 2;
        endY = sysInfo.windowHeight / 2;
      }

      const arc = Math.min(startY, endY) - 80 - (startY + endY) / 2;
      const dx = endX - startX;
      const dy = endY - startY;
      
      // Calculate rotation angle to point toward target (in degrees)
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      this._particleOnDone = onParticleDone;

      this.setData({
        animActive: true,
        animFlying: false,
        animStartX: startX - 10,
        animStartY: startY - 10,
        animDx: dx,
        animDy: dy,
        animArc: arc,
        animAngle: angle,
        animAmount: String(amount)
      });

      wx.nextTick(() => {
        if (this._destroyed) return;
        this.setData({ animFlying: true });
      });
    },

    onParticleAnimEnd() {
      if (this._destroyed) return;
      
      // 光束飞行结束，立刻触发目标位置的冲击与特效
      this.setData({ animFlying: false });
      if (this._rollToUserId) {
        this.flashTargetSeat(this._rollToUserId, true);
      }

      // 延迟关闭 animActive，等待涟漪和浮动文字动画结束（约 1000ms）
      setTimeout(() => {
        if (!this._destroyed) {
          this.setData({ animActive: false });
        }
      }, 1000);

      const afterUpdate = () => {
        this.playScoreRollAnimation(this._rollFromUserId, this._rollToUserId, this._rollAmount);
      };
      
      const onDone = this._particleOnDone;
      this._particleOnDone = null;
      if (onDone) {
        const result = onDone();
        if (result && typeof result.then === 'function') {
          result.then(afterUpdate);
        } else {
          afterUpdate();
        }
      } else {
        afterUpdate();
      }
    },

    playScoreRollAnimation(fromUserId, toUserId, amount) {
      if (this._rollTimer) {
        clearTimeout(this._rollTimer);
        this._rollTimer = null;
      }
      this._animatingScores = {};
      this._rollOldFromScore = null;
      this._rollOldToScore = null;
      this.buildMemberGrid();
    },

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

    onHudAvatarError(e) {
      const userId = e.currentTarget.dataset.userId;
      if (!userId) return;
      const ships = (this.data.cockpitView.externalShips || []).map(s => {
        if (String(s.userId) === String(userId)) {
          return { ...s, avatarUrl: '' };
        }
        return s;
      });
      if (ships.length) {
        this.setData({ 'cockpitView.externalShips': ships });
      }
      this.onAvatarError(e);
    },

    formatTime(dateStr) {
      if (!dateStr) return '';
      const safeDateStr = typeof dateStr === 'string' ? dateStr.replace(/-/g, '/') : dateStr;
      const d = new Date(safeDateStr);
      const pad = n => String(n).padStart(2, '0');
      return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    formatTraceTime(dateStr) {
      if (!dateStr) return '';
      const safeDateStr = typeof dateStr === 'string' ? dateStr.replace(/-/g, '/') : dateStr;
      const d = new Date(safeDateStr);
      const pad = n => String(n).padStart(2, '0');
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

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
  }
));
