const { get, post, del } = require('../../utils/request');
const { getScoreWS } = require('../../utils/score-ws');
const app = getApp();

Page({
  data: {
    isLoggedIn: false,
    currentRoom: null,
    sessions: [],
    baseScore: 1,
    joinRoomNo: '',
    creating: false,
    isOwner: false,
    loading: false
  },

  onShow() {
    this.setData({ isLoggedIn: !!app.globalData.token });
    if (app.globalData.token) {
      this.loadMyRooms();
    }
  },

  onLoad(options) {
    // 扫码进入：解析 scene 参数（从小程序码）
    if (options.scene) {
      const roomNo = decodeURIComponent(options.scene);
      this.joinByRoomNo(roomNo);
    }
    // 也支持直接 roomNo 参数（从分享链接）
    if (options.roomNo) {
      this.joinByRoomNo(options.roomNo);
    }
  },

  onUnload() {
    this.disconnectWS();
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

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
        this.loadSessions(room.roomId);
        this.connectWS(room.roomId);
      } else {
        this.setData({ currentRoom: null, sessions: [] });
      }
    } catch (e) {
      console.error('加载房间失败', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadSessions(roomId) {
    try {
      const sessions = await get(`/session/room/${roomId}`);
      this.setData({ sessions: sessions || [] });
    } catch (e) {
      console.error('加载场次失败', e);
    }
  },

  connectWS(roomId) {
    this.disconnectWS();
    this.ws = getScoreWS();
    this.ws.connect(roomId);
    this.ws.onScoreUpdate(this.onWsUpdate.bind(this));
  },

  disconnectWS() {
    if (this.ws) {
      this.ws.offScoreUpdate(this.onWsUpdate);
    }
  },

  onWsUpdate(data) {
    // 收到记分更新时刷新场次列表
    if (data.type === 'SCORE_UPDATE') {
      if (this.data.currentRoom) {
        this.loadSessions(this.data.currentRoom.roomId);
      }
    }
  },

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
      this.setData({
        currentRoom: room,
        isOwner: true
      });
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
      this.loadSessions(room.roomId);
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

  async createSession() {
    if (!this.data.currentRoom) return;
    try {
      await post('/session', { roomId: this.data.currentRoom.roomId });
      this.loadSessions(this.data.currentRoom.roomId);
      wx.showToast({ title: '场次已创建', icon: 'success' });
    } catch (e) {
      console.error('创建场次失败', e);
    }
  },

  goSession(e) {
    const sessionId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/session/session?sessionId=${sessionId}&roomId=${this.data.currentRoom.roomId}`
    });
  },

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
      this.disconnectWS();
      this.setData({ currentRoom: null, sessions: [] });
      wx.showToast({ title: '已退出', icon: 'success' });
    } catch (e) {}
  },

  async dissolveRoom() {
    const { confirm } = await wx.showModal({ title: '确认解散？', content: '所有数据将归档' });
    if (!confirm) return;
    try {
      await del(`/room/${this.data.currentRoom.roomId}`);
      this.disconnectWS();
      this.setData({ currentRoom: null, sessions: [] });
      wx.showToast({ title: '已解散', icon: 'success' });
    } catch (e) {}
  },

  onShareAppMessage() {
    return {
      title: `房间 ${this.data.currentRoom?.roomNo || ''} 邀请你来打麻将`,
      path: `/pages/room/room?roomNo=${this.data.currentRoom?.roomNo || ''}`
    };
  }
});
