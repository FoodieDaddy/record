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
    saving: false
  },

  onShow() {
    const loggedIn = !!app.globalData.token;
    this.setData({ isLoggedIn: loggedIn });
    if (loggedIn) {
      this.loadUserInfo();
      this.loadVoiceSettings();
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

  onChooseAvatar(e) {
    const tempPath = e.detail.avatarUrl;
    this.setData({ avatarUrl: tempPath });
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
    app.globalData.audioEnabled = enabled;
    wx.setStorageSync('audioEnabled', enabled);
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

  // ========== 导航 ==========

  goScoreRecords() {
    // 切换到房间 tab，显示积分记录
    wx.switchTab({ url: '/pages/room/room' });
  },

  goHistoryRooms() {
    // 切换到房间 tab，显示历史房间
    wx.switchTab({ url: '/pages/room/room' });
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
      // 非 OSS URL 的本地临时文件需要先上传
      if (avatarUrl && avatarUrl.indexOf('aliyuncs.com') === -1) {
        finalAvatarUrl = await this.uploadToOSS(avatarUrl);
      }

      await put('/user/me', {
        nickname: nickname.trim(),
        avatarUrl: finalAvatarUrl || ''
      });

      app.globalData.userInfo = {
        nickname: nickname.trim(),
        avatarUrl: finalAvatarUrl || ''
      };

      // 更新本地显示
      this.setData({ avatarUrl: finalAvatarUrl || '' });
      this.updateAvatar();

      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (e) {
      console.error('保存失败', e);
    } finally {
      this.setData({ saving: false });
    }
  },

  // ========== 上传 ==========

  async uploadToOSS(filePath) {
    // 1. 获取预签名 URL
    const presignData = await get('/storage/presign?contentType=' + encodeURIComponent('image/jpeg'));

    if (!presignData || !presignData.uploadUrl) {
      throw new Error('获取预签名 URL 失败');
    }

    // 2. 读取文件为 ArrayBuffer
    const fileData = await new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        success: res => resolve(res.data),
        fail: reject
      });
    });

    // 3. PUT 上传到 OSS
    await new Promise((resolve, reject) => {
      wx.request({
        url: presignData.uploadUrl,
        method: 'PUT',
        data: fileData,
        header: {
          'Content-Type': 'image/jpeg'
        },
        success(res) {
          if (res.statusCode === 200) resolve();
          else reject(new Error('上传到 OSS 失败, statusCode: ' + res.statusCode));
        },
        fail: reject
      });
    });

    // 4. 返回 objectKey（不存完整 URL，节省空间）
    return presignData.objectKey;
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
