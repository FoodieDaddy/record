/**
 * 本局录入（航段写入）交互处理器
 * 从 room.js 提取，负责 Mode 2 轮次数据的开始、提交、确认、驳回与状态同步
 * 使用时通过 Object.assign 混入 Page 对象，this 指向页面实例
 */
const roundService = require('../../services/round-service');
const app = getApp();

const roomRoundHandler = {
  async startRound() {
    const room = this.data.currentRoom;
    if (!room) return;
    try {
      const resp = await roundService.startRound(room.roomId);
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
      const resp = await roundService.submitRoundScores(room.roomId, scores);
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
      const resp = await roundService.submitRoundScores(room.roomId, [{ userId: app.globalData.userId, score }]);
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
      const resp = await roundService.confirmRound(room.roomId, true);
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
      await roundService.cancelRound(room.roomId);
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
      const resp = await roundService.confirmRound(room.roomId, false);
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
      const resp = await roundService.getPendingRound(roomId);
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
  }
};

module.exports = roomRoundHandler;
