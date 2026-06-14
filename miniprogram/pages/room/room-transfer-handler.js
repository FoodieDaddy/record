/**
 * 脉冲流向与键盘输入处理器
 * 从 room.js 提取，负责数字键盘、预设值建议、数值流向提交与本地分值乐观更新逻辑
 * 使用时通过 Object.assign 混入 Page 对象，this 指向页面实例
 */
const { vibrateShort } = require('../../utils/haptic');
const scoreService = require('../../services/score-service');
const { createRequestId } = require('../../utils/request');
const app = getApp();

const roomTransferHandler = {
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
      transferPreview: null,
      isInputOpen: true,
      pulseReadoutDisplay: (this.data.cockpitView || {}).selfPulseDisplay || ''
    });
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
    if (this._transferSubmitLocked) return;
    const key = e.currentTarget.dataset.key;
    let val = this.data.numpadValue;
    const str = String(val);
    const newVal = str === '0' ? key : str + key;
    if (newVal.length > 8) return;
    val = parseInt(newVal);
    if (val > 99999999) val = 99999999;
    this.setData({ numpadValue: val, transferPreview: this.buildTransferPreview(val) });
  },

  tapTransferSuggestion(e) {
    if (this._transferSubmitLocked) return;
    const amount = Number(e.currentTarget.dataset.amount || 0);
    if (!amount) return;
    this.setData({
      numpadValue: amount,
      transferPreview: this.buildTransferPreview(amount)
    });
    vibrateShort('light');
  },

  confirmNumpad() {
    if (this._transferSubmitLocked) return;
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
    // 不要在这里关闭键盘，等待发射动画执行
    this.submitTransfer(amount);
  },

  /** 键盘统一点击事件处理 */
  onTransferKeyTap(e) {
    if (this._transferSubmitLocked) return;
    const type = e.currentTarget.dataset.type;
    const value = e.currentTarget.dataset.value;
    
    if (type === 'number') {
      // 构造事件对象，调用现有的 onNumpadKey
      this.onNumpadKey({ currentTarget: { dataset: { key: String(value) } } });
    } else if (type === 'close') {
      this.cancelTransfer();
    } else if (type === 'submit') {
      this.confirmNumpad();
    }
  },

  closeNumpad() {
    this.setData({ showNumpad: false });
  },

  preventClose() {},

  cancelTransfer(preserveReadout) {
    if (this._transferSubmitLocked && preserveReadout !== true) return;
    this.setData({
      transferTo: '',
      transferToInfo: null,
      transferFromInfo: null,
      transferPreview: null,
      showNumpad: false,
      numpadValue: 0,
      isInputOpen: false,
      numpadLaunching: false,
      submitting: false,
      pulseReadoutDisplay: preserveReadout === true ? this.data.pulseReadoutDisplay : ''
    });
  },

  releaseTransferSubmission() {
    if (this._transferLockTimer) {
      clearTimeout(this._transferLockTimer);
      this._transferLockTimer = null;
    }
    this._transferSubmitLocked = false;
    this._activeTransferRequestId = '';
    this.setData({ submitting: false, numpadLaunching: false });
  },

  triggerPulseReadoutRoll(nextDisplay) {
    if (this._pulseReadoutTimer) {
      clearTimeout(this._pulseReadoutTimer);
      this._pulseReadoutTimer = null;
    }
    this.setData({ pulseReadoutRolling: false }, () => {
      wx.nextTick(() => {
        if (this._destroyed) return;
        this.setData({
          pulseReadoutRolling: true,
          pulseReadoutDisplay: nextDisplay === undefined || nextDisplay === null
            ? ((this.data.cockpitView || {}).selfPulseDisplay || '')
            : String(nextDisplay)
        });
        this._pulseReadoutTimer = setTimeout(() => {
          if (this._destroyed) return;
          this.setData({
            pulseReadoutRolling: false,
            pulseReadoutDisplay: ''
          });
          this._pulseReadoutTimer = null;
        }, 920);
      });
    });
  },

  async submitTransfer(amount) {
    if (this._transferSubmitLocked) return;
    const room = this.data.currentRoom;
    if (!room) return;

    const transferTo = this.data.transferTo;
    if (!transferTo) {
      wx.showToast({ title: '请选择接收航船', icon: 'none' });
      return;
    }

    this._transferSubmitLocked = true;
    const clientRequestId = createRequestId();
    this._activeTransferRequestId = clientRequestId;
    this._transferLockTimer = setTimeout(() => {
      if (this._destroyed || !this._transferSubmitLocked) return;
      this.releaseTransferSubmission();
      this.updateAllData(room.roomId);
    }, 15000);

    this.setData({ submitting: true, numpadLaunching: true });
    const fromUserId = app.globalData.userId;

    // 请求确认前冻结旧分数；后端成功后才播放激光并更新本地数值。
    const grid = this.data.memberGrid;
    const fromMember = grid.find(m => String(m.userId) === String(fromUserId));
    const toMember = grid.find(m => String(m.userId) === String(transferTo));
    const oldFromScore = fromMember ? Number(fromMember.displayScore || 0) : 0;
    this.setData({ pulseReadoutDisplay: this.formatPulseValue(oldFromScore) });

    try {
      await scoreService.transferScore({
        roomId: room.roomId,
        toUserId: transferTo,
        amount,
        clientRequestId
      });

      this._animatingScores = {};
      this._animatingScores[fromUserId] = fromMember ? fromMember.displayScore : 0;
      this._animatingScores[transferTo] = toMember ? toMember.displayScore : 0;
      this._optimisticScoreUpdate(fromUserId, transferTo, amount);

      this.playTransferAnimation(fromUserId, transferTo, amount, () => {
        this.cancelTransfer(true);
        this.appendLocalTransferRecord(fromUserId, transferTo, amount);
        this.buildMemberGrid();
        this.triggerPulseReadoutRoll(this.formatPulseValue(this.getLocalScore(fromUserId)));
        this.releaseTransferSubmission();
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
      this.releaseTransferSubmission();
    }
  },

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
  }
};

module.exports = roomTransferHandler;
