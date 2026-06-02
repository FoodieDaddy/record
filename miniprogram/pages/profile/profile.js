const { get, put } = require('../../utils/request');
const { getColor, getFirstChar } = require('../../utils/avatar');
const { generateNickname } = require('../../utils/nickname');
const { getSettings, saveSettings } = require('../../utils/voice');
const app = getApp();

Page({
  data: {
    isLoggedIn: false,
    nickname: '',
    avatarUrl: '',
    avatarColor: '',
    avatarChar: '',
    voiceEnabled: true,
    voiceType: 'female',
    animationEnabled: true,
    saving: false,
    historyRooms: []
  },

  onShow() {
    const loggedIn = !!app.globalData.token;
    this.setData({ isLoggedIn: loggedIn });
    if (loggedIn) {
      this.loadUserInfo();
      this.loadVoiceSettings();
      this.loadHistory();
      this.setData({ animationEnabled: app.globalData.animationEnabled });
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  async loadUserInfo() {
    try {
      const user = await get('/user/me');
      if (user) {
        this.setData({
          nickname: user.nickname || '',
          avatarUrl: user.avatarUrl || ''
        });
        app.globalData.userInfo = {
          nickname: user.nickname,
          avatarUrl: user.avatarUrl
        };
        this.updateAvatar();
      }
    } catch (e) {
      console.error('加载用户信息失败', e);
    }
  },

  loadVoiceSettings() {
    const settings = getSettings();
    this.setData({
      voiceEnabled: settings.enabled,
      voiceType: settings.voiceType
    });
  },

  async loadHistory() {
    try {
      const rooms = await get('/room/my');
      if (!rooms) return;
      const pad = n => String(n).padStart(2, '0');
      const formatted = rooms.map(r => {
        const d = new Date(r.createdAt);
        return {
          ...r,
          createdAtFormatted: `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
          memberCount: r.members ? r.members.length : 0
        };
      });
      this.setData({ historyRooms: formatted });
    } catch (e) {
      console.error('加载历史房间失败', e);
    }
  },

  updateAvatar() {
    const { nickname, avatarUrl } = this.data;
    if (!avatarUrl) {
      this.setData({
        avatarColor: getColor(nickname),
        avatarChar: getFirstChar(nickname)
      });
    }
  },

  // ========== 头像 ==========

  onChangeAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath;
        this.setData({ avatarUrl: tempPath });
      }
    });
  },

  // ========== 昵称 ==========

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  shuffleNickname() {
    const nickname = generateNickname();
    this.setData({ nickname });
    this.updateAvatar();
  },

  // ========== 语音设置 ==========

  onVoiceToggle(e) {
    const enabled = e.detail.value;
    this.setData({ voiceEnabled: enabled });
    saveSettings({ enabled });
  },

  setVoiceType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ voiceType: type });
    saveSettings({ voiceType: type });
  },

  onAnimationToggle(e) {
    const enabled = e.detail.value;
    this.setData({ animationEnabled: enabled });
    app.globalData.animationEnabled = enabled;
    wx.setStorageSync('animationEnabled', enabled);
  },

  // ========== 保存 ==========

  async saveProfile() {
    if (this.data.saving) return;
    const { nickname, avatarUrl } = this.data;

    if (!nickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    try {
      let finalAvatarUrl = avatarUrl;
      if (avatarUrl && (avatarUrl.startsWith('wxfile://') || avatarUrl.startsWith('http://tmp/'))) {
        finalAvatarUrl = await this.uploadAvatar(avatarUrl);
      }

      await put('/user/me', {
        nickname: nickname.trim(),
        avatarUrl: finalAvatarUrl || ''
      });

      app.globalData.userInfo = {
        nickname: nickname.trim(),
        avatarUrl: finalAvatarUrl || ''
      };

      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (e) {
      console.error('保存失败', e);
    } finally {
      this.setData({ saving: false });
    }
  },

  async uploadAvatar(filePath) {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${app.globalData.baseUrl}/user/avatar`,
        filePath,
        name: 'file',
        header: {
          Authorization: `Bearer ${app.globalData.token}`
        },
        success(res) {
          try {
            const data = JSON.parse(res.data);
            if (data.code === 200) {
              resolve(data.data);
            } else {
              reject(new Error(data.message));
            }
          } catch (e) {
            reject(e);
          }
        },
        fail: reject
      });
    });
  },

  // ========== 退出登录 ==========

  async onLogout() {
    const { confirm } = await wx.showModal({
      title: '确认退出？',
      content: '退出后需要重新登录'
    });
    if (!confirm) return;

    app.logout();
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
