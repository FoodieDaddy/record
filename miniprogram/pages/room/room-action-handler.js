/**
 * 房间操作处理器
 * 从 room.js 提取，负责房间创建、加入、离开、封存等用户交互逻辑
 * 使用时通过 Object.assign 混入 Page 对象，this 指向页面实例
 */
const { vibrateShort } = require('../../utils/haptic');
const app = getApp();

/** 订阅消息模板 ID（需在微信公众平台申请） */
const SUBSCRIBE_MESSAGE_TEMPLATES = [
  // 记分提醒模板 ID（待申请）
  // 'your_template_id_here'
];

/**
 * 请求订阅消息权限
 * 需在用户手势回调中调用（如 tap）
 * @returns {Promise<Object>} 授权结果
 */
function requestSubscribePermission() {
  // 如果没有配置模板 ID，跳过请求
  if (!SUBSCRIBE_MESSAGE_TEMPLATES.length) {
    return Promise.resolve({});
  }
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: SUBSCRIBE_MESSAGE_TEMPLATES,
      success: (res) => {
        console.log('[订阅消息] 授权结果', res);
        resolve(res);
      },
      fail: (err) => {
        console.warn('[订阅消息] 授权失败', err);
        resolve(err);
      }
    });
  });
}

const roomActionHandler = {
  /** 启动太空（创建房间） */
  handleStartSpace() {
    if (this.data.launching) return;
    vibrateShort('light');
    
    // 请求订阅消息权限（需在用户手势中调用）
    requestSubscribePermission();
    
    this.setData({ launching: true, isLaunching: true, launchPhase: 'linking' });

    // 启动过渡动画：linking → window → hud → 执行创建
    const t1 = setTimeout(() => {
      this.setData({ launchPhase: 'window' });
    }, 400);
    const t2 = setTimeout(() => {
      this.setData({ launchPhase: 'hud' });
    }, 800);
    const tSlow = setTimeout(() => {
      if (this.data.launching) {
        this.setData({ launchPhase: 'slow' });
      }
    }, 6000);
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
    this._transitionTimers.push(t1, t2, t3, tSlow);
  },

  /** 取消启动等待 */
  cancelLaunchWait() {
    this._clearTransitionTimers();
    this.setData({ launching: false, joining: false, isLaunching: false, launchPhase: '' });
    this.updateCockpitState('idle');
  },

  /** 重试启动 */
  retryLaunchWait() {
    this.cancelLaunchWait();
    this.handleStartSpace();
  },

  /** 打开加入面板 */
  openJoinPanel() {
    this.setData({ joinPanelVisible: true, joinCode: '' });
  },

  /** 关闭加入面板 */
  closeJoinPanel() {
    this.setData({ joinPanelVisible: false, joinCode: '' });
  },

  /** 加入码输入处理 */
  onJoinCodeInput(e) {
    const value = String(e.detail.value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
    this.setData({ joinCode: value });
  },

  /** 处理加入太空 */
  async handleJoinSpace() {
    const code = this.data.joinCode.trim();
    if (!code || code.length < 6 || this.data.joining) return;
    vibrateShort('light');
    
    // 请求订阅消息权限（需在用户手势中调用）
    requestSubscribePermission();
    
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

  /** 处理结算 */
  handleSettle() {
    vibrateShort('light');
    if (this.data.isOwner) {
      this.openSealConfirm();
      return;
    }
    this.quitRoom();
  },

  /** 确认离开或解散 */
  confirmLeaveOrDisband() {
    vibrateShort('light');
    this.setData({ leaveConfirmVisible: true });
  },

  /** 关闭离开确认 */
  closeLeaveConfirm() {
    this.setData({ leaveConfirmVisible: false });
  },

  /** 执行离开或解散 */
  executeLeaveOrDisband() {
    this.setData({ leaveConfirmVisible: false });
    this.quitRoom();
  },

  /** 打开封存确认 */
  openSealConfirm() {
    this.setData({ sealConfirmVisible: true });
  },

  /** 关闭封存确认 */
  closeSealConfirm() {
    this.setData({ sealConfirmVisible: false });
  },

  /** 处理房间封存 */
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
      const settleResp = await require('../../services/score-service').settleRoom(roomId);
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
          relationMap: {},
          matrixChartData: null,
          matrixChartRoomId: '',
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
          relationMap: {},
          matrixChartData: null,
          matrixChartRoomId: '',
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

  /** 开始封存心跳 */
  startSealHeartbeat() {
    this.setData({ sealHeartbeatText: '航迹档案写入中' });
  },

  /** 停止封存心跳 */
  stopSealHeartbeat() {
    this._sealHeartbeatTimer = null;
  },

  /** 清理过渡定时器 */
  _clearTransitionTimers() {
    if (this._transitionTimers) {
      this._transitionTimers.forEach(t => clearTimeout(t));
      this._transitionTimers = [];
    }
  }
};

module.exports = roomActionHandler;
