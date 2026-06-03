const { get, put } = require('../../utils/request');
const { getColor, getFirstChar } = require('../../utils/avatar');
const { generateNickname } = require('../../utils/nickname');
const { getSettings, saveSettings } = require('../../utils/voice');
const config = require('../../config');
const app = getApp();

// 音频单例 — 全局唯一，避免内存泄漏和重叠播放
const audioCtx = wx.createInnerAudioContext();
audioCtx.obeyMuteSwitch = false;

Page({
  data: {
    isLoggedIn: false,
    nickname: '',
    avatarUrl: '',
    avatarColor: '',
    avatarChar: '',
    voiceEnabled: true,
    voiceName: '晓晓',
    selectedVoiceId: 'std_01',
    animationEnabled: true,
    saving: false,
    // 音色抽屉
    voiceSheetVisible: false,
    voiceCategories: [],
    activeCatIndex: 0,
    scrollToCat: '',
    playingVoiceId: ''
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
      voiceName: settings.voiceName,
      selectedVoiceId: settings.voiceId
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

  async loadVoiceCatalog() {
    if (this.data.voiceCategories.length > 0) return; // 已缓存
    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: config.baseUrl + '/voice/catalog',
          success: resolve,
          fail: reject
        });
      });
      if (res.statusCode === 200 && res.data && res.data.data) {
        this.setData({ voiceCategories: res.data.data.categories || [] });
      }
    } catch (e) {
      console.error('加载音色目录失败', e);
    }
  },

  openVoiceSheet() {
    this.loadVoiceCatalog();
    this.setData({ voiceSheetVisible: true });
  },

  closeVoiceSheet() {
    this.setData({ voiceSheetVisible: false });
    audioCtx.stop();
    this.setData({ playingVoiceId: '' });
  },

  onCatTap(e) {
    const index = e.currentTarget.dataset.index;
    const cat = this.data.voiceCategories[index];
    this.setData({
      activeCatIndex: index,
      scrollToCat: 'cat-' + cat.id
    });
  },

  onVoiceTap(e) {
    const voice = e.currentTarget.dataset.voice;

    // 更新选中状态并持久化
    this.setData({
      selectedVoiceId: voice.id,
      voiceName: voice.name
    });
    saveSettings({
      voiceId: voice.id,
      voiceName: voice.name,
      voice: voice.voice
    });

    // 试听：stop → src → play，严格顺序
    audioCtx.stop();
    this.setData({ playingVoiceId: voice.id });
    audioCtx.src = config.baseUrl + '/voice/preview?file=' + encodeURIComponent(voice.file);
    audioCtx.play();

    // 播放结束清除状态
    audioCtx.offEnded();
    audioCtx.onEnded(() => {
      this.setData({ playingVoiceId: '' });
    });
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
  },

  onUnload() {
    audioCtx.stop();
    audioCtx.destroy();
  }
});
