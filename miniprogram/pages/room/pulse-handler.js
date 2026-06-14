/**
 * 脉冲输入交互处理器
 * 从 room.js 提取，负责脉冲记录相关的用户交互逻辑
 * 使用时通过 Object.assign 混入 Page 对象，this 指向页面实例
 */
const { vibrateShort } = require('../../utils/haptic');
const app = getApp();

const pulseHandler = {
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

  /** 将后端错误映射为舰载终端文案（优先使用错误码，降级用文案匹配） */
  normalizeRoomActionError(err) {
    const code = err && err.code;
    const msg = (err && err.message) || '';
    // 优先按错误码匹配
    if (code === 4043 || code === 4042 || code === 4607 || code === 4608) return '航程已封存，无法继续记录';
    if (code === 4041) return '编队链路已断开，请返回后重试';
    if (code === 4031) return '目标航船已断开';
    if (code === 4201 || code === 4202 || code === 4203) return '请输入脉冲数值';
    if (code === 4206 || code === 409) return '脉冲正在发送，请勿重复提交';
    // 降级：按文案匹配
    if (msg.includes('已封存') || msg.includes('已关闭') || msg.includes('不可重复')) return '航程已封存，无法继续记录';
    if (msg.includes('不存在')) return '编队链路已断开，请返回后重试';
    if (msg.includes('目标') && msg.includes('不存在')) return '目标航船已断开';
    if (msg.includes('分值') || msg.includes('金额') || msg.includes('数值')) return '请输入脉冲数值';
    if (msg.includes('网络') || msg.includes('timeout') || msg.includes('超时')) return '网络波动，请稍后重试';
    return '记录失败，请稍后重试';
  },

  /** 聚焦编队区域以准备脉冲输入 */
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

  /** 打开脉冲记录器（入口） */
  openPulseRecorder() {
    vibrateShort('light');
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

  /** 打开脉冲写入面板 */
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
      transferPreview: null,
      isInputOpen: true,
      pulseReadoutDisplay: (this.data.cockpitView || {}).selfPulseDisplay || ''
    });
  },

  /** 脉冲值输入框输入事件 */
  onPulseValueInput(e) {
    const value = String(e.detail.value || '').replace(/\D/g, '').slice(0, 7);
    this.setData({ pulseValue: value });
  },

  /** 点击脉冲预设值 */
  tapPulsePreset(e) {
    const value = Number(e.currentTarget.dataset.value || 0);
    if (!value) return;
    this.setData({ pulseValue: String(value) });
    vibrateShort('light');
  },

  /** 清除脉冲值 */
  clearPulseValue() {
    if (!this.data.pulseValue) return;
    this.setData({ pulseValue: '' });
    vibrateShort('light');
  },

  /** 提交脉冲记录 */
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
        fromUserId: selfId,
        toUserId: targetId,
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
  }
};

module.exports = pulseHandler;
