/**
 * WebSocket 消息处理与连接辅助器
 * 从 room.js 提取，负责 WebSocket 数据通信与重连状态落态
 * 使用时通过 Object.assign 混入 Page 对象，this 指向页面实例
 */
const { getAvatarView } = require('../../utils/avatar');
const { speakTransfer } = require('../../utils/voice');
const { getAudioManager } = require('../../utils/audio-manager');
const app = getApp();

const roomWsHandler = {
  /** 连接编队 WebSocket（通过全局单例） */
  connectWS(roomId, force = false) {
    this._suppressWsReconnect = false;
    this.setData({ wsReconnecting: false });
    app.connectWS(roomId, force);
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

    // 房间解散通知
    if (data.type === 'ROOM_DISBANDED') {
      // 成员收到解散通知，清除驾驶舱状态
      // 为了彻底关闭视图，我们重置整个 room 数据，但保留 showSettleOverlay 的处理
      const room = this.data.currentRoom;
      this.setData({
        currentRoom: null,
        viewingRoom: false,
        cockpitState: 'idle',
        memberGrid: [],
        seatList: [],
        ranking: [],
        scoreRecords: []
      });
      
      if (!this._settling && !this.data.showSettleOverlay) {
        this.fetchAndShowSettle(roomId);
      }
      wx.showToast({ title: '编队已解散', icon: 'none', duration: 3000 });
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

        if (data.avatarUrl && data.avatarUrl.startsWith('cloud://')) {
          this._resolveCloudAvatars(room);
        } else {
          this.buildMemberGrid();
        }
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
        let hasCloud = false;
        const members = (this.data.currentRoom.members || []).map(m => {
          if (String(m.userId) === String(data.userId)) {
            const nickname = data.nickname || m.nickname;
            const avatarUrl = data.avatarUrl || m.avatarUrl;
            if (avatarUrl && avatarUrl.startsWith('cloud://')) {
              hasCloud = true;
            }
            return { ...m, nickname, avatarUrl, ...getAvatarView(nickname, avatarUrl) };
          }
          return m;
        });
        this.setData({ 'currentRoom.members': members });
        
        if (hasCloud) {
          this._resolveCloudAvatars(this.data.currentRoom);
        } else {
          this.buildMemberGrid();
        }
        return;
      }

      if (data.type === 'TRANSFER' && data.fromUserId && data.toUserId && data.amount) {
        const myId = String(app.globalData.userId);
        const transferEventId = String(
          data.clientRequestId ||
          data.transferId ||
          `${data.roomId}:${data.fromUserId}:${data.toUserId}:${data.amount}:${data.fromNewScore}:${data.toNewScore}`
        );
        const now = Date.now();
        this._seenTransferEvents = this._seenTransferEvents || new Map();
        for (const [eventId, seenAt] of this._seenTransferEvents) {
          if (now - seenAt > 60000) this._seenTransferEvents.delete(eventId);
        }
        if (this._seenTransferEvents.has(transferEventId)) return;
        this._seenTransferEvents.set(transferEventId, now);

        const isSender = String(data.fromUserId) === myId;

        // 出分方已在 submitTransfer 中本地处理动画和数据刷新，跳过
        if (isSender) return;

        // 驾驶舱轨迹：非出分方（收分方/旁观者）写入脉冲轨迹
        const fromMember = (this.data.currentRoom.members || []).find(m => String(m.userId) === String(data.fromUserId));
        const toMember = (this.data.currentRoom.members || []).find(m => String(m.userId) === String(data.toUserId));
        if (fromMember && toMember) {
          this.addPulseTrace(this.formatCrewName(fromMember.nickname), this.formatCrewName(toMember.nickname), data.amount, {
            fromUserId: data.fromUserId,
            toUserId: data.toUserId,
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
        if (isReceiver && typeof this.triggerPulseReadoutRoll === 'function') {
          this.triggerPulseReadoutRoll();
        }

        // 优先用 WS 推送的权威分数更新本地，避免额外 HTTP 请求
        if (data.fromNewScore !== undefined && data.toNewScore !== undefined) {
          this.pushWsTransferToQueue({
            fromUserId: data.fromUserId,
            toUserId: data.toUserId,
            amount: data.amount,
            fromNewScore: data.fromNewScore,
            toNewScore: data.toNewScore,
            now: Date.now()
          });
        } else {
          // 兼容：旧版后端未携带分数时，走 updateAllData
          this.playTransferAnimation(data.fromUserId, data.toUserId, data.amount, () => {
            this.updateAllData(roomId);
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
  }
};

module.exports = roomWsHandler;
