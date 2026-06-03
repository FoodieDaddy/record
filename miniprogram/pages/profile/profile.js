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
    activeVoiceCatId: 'female',
    scrollToCat: '',
    playingVoiceId: '',
    // 待保存的音色（关闭抽屉时才持久化）
    pendingVoice: null,
    // 自动保存：记录上次保存的值，避免冗余请求
    _lastSavedNickname: '',
    _lastSavedAvatar: ''
  },

  onShow() {
    const loggedIn = !!app.globalData.token;
    this.setData({ isLoggedIn: loggedIn });
    if (loggedIn) {
      this.loadUserInfo();
      this.loadVoiceSettings();
      this.setData({ animationEnabled: app.globalData.animationEnabled });
      // 预加载音色分类（供 Segmented Control 使用）
      this.loadVoiceCatalog();
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  async loadUserInfo() {
    try {
      const user = await get('/user/me');
      if (user) {
        const loadedNick = user.nickname || '';
        const loadedAvatar = user.avatarUrl || '';
        this.setData({
          nickname: loadedNick,
          avatarUrl: loadedAvatar,
          _lastSavedNickname: loadedNick,
          _lastSavedAvatar: loadedAvatar
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

  // ========== 头像（选择后自动保存） ==========

  onChooseAvatar(e) {
    const tempPath = e.detail.avatarUrl;
    this.setData({ avatarUrl: tempPath });
    this.updateAvatar();
    // 头像变更是明确的用户操作，立即自动保存
    this.saveProfile();
  },

  // ========== 昵称（失焦自动保存） ==========

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  onNicknameBlur() {
    this.saveProfile();
  },

  shuffleNickname() {
    const nickname = generateNickname();
    this.setData({ nickname });
    this.updateAvatar();
    // 随机昵称后自动保存
    this.saveProfile();
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
    if (this.data.voiceCategories.length > 0) return;
    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: config.baseUrl + '/voice/catalog',
          success: resolve,
          fail: reject
        });
      });
      if (res.statusCode === 200 && res.data && res.data.data) {
        const categories = res.data.data.categories || [];
        this.setData({ voiceCategories: categories });
        // 确保 activeVoiceCatId 在分类列表中有效
        if (categories.length > 0 && !categories.find(c => c.id === this.data.activeVoiceCatId)) {
          this.setData({ activeVoiceCatId: categories[0].id });
        }
      }
    } catch (e) {
      console.error('加载音色目录失败', e);
    }
  },

  // 分段控制器点击（女声/男声）
  onSegmentTap(e) {
    const catId = e.currentTarget.dataset.catId;
    this.setData({ activeVoiceCatId: catId });
    // 同步滚动到对应分类
    const cats = this.data.voiceCategories;
    const target = cats.find(c => c.id === catId);
    if (target) {
      this.setData({ scrollToCat: 'cat-' + target.id });
    } else if (cats.length > 0) {
      // fallback: 按索引（female=0, male=1）
      const idx = catId === 'male' ? 1 : 0;
      if (cats[idx]) {
        this.setData({
          activeVoiceCatId: cats[idx].id,
          scrollToCat: 'cat-' + cats[idx].id
        });
      }
    }
  },

  openVoiceSheet() {
    this.loadVoiceCatalog();
    this.setData({ voiceSheetVisible: true });
  },

  closeVoiceSheet() {
    if (this.data.pendingVoice) {
      saveSettings(this.data.pendingVoice);
      this.setData({ pendingVoice: null });
    }
    this.setData({ voiceSheetVisible: false });
    audioCtx.stop();
    this.setData({ playingVoiceId: '' });
  },

  onCatTap(e) {
    const catId = e.currentTarget.dataset.catId;
    this.setData({
      activeVoiceCatId: catId,
      scrollToCat: 'cat-' + catId
    });
  },

  onVoiceTap(e) {
    const voice = e.currentTarget.dataset.voice;
    const catId = e.currentTarget.dataset.catId;

    this.setData({
      selectedVoiceId: voice.id,
      voiceName: voice.name,
      activeVoiceCatId: catId,
      pendingVoice: { voiceId: voice.id, voiceName: voice.name, voice: voice.voice }
    });

    // 试听：stop → src → play
    audioCtx.stop();
    this.setData({ playingVoiceId: voice.id });
    audioCtx.src = config.baseUrl + '/voice/preview?file=' + encodeURIComponent(voice.file);
    audioCtx.play();

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
    wx.switchTab({ url: '/pages/room/room' });
  },

  goHistoryRooms() {
    wx.switchTab({ url: '/pages/room/room' });
  },

  // ========== 自动保存 ==========

  async saveProfile() {
    if (this.data.saving) return;
    const { nickname, avatarUrl } = this.data;

    if (!nickname || !nickname.trim()) return;

    // 值未变化时跳过保存
    const trimmed = nickname.trim();
    if (trimmed === this.data._lastSavedNickname && avatarUrl === this.data._lastSavedAvatar) return;

    this.setData({ saving: true });
    try {
      let finalAvatarUrl = avatarUrl;
      // 非 OSS URL 视为本地临时文件，需上传
      if (avatarUrl && avatarUrl.indexOf('aliyuncs.com') === -1 && avatarUrl.indexOf('.com/') === -1) {
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

      this.setData({
        avatarUrl: finalAvatarUrl || '',
        _lastSavedNickname: trimmed,
        _lastSavedAvatar: finalAvatarUrl || ''
      });
      this.updateAvatar();
    } catch (e) {
      console.error('自动保存失败', e);
    } finally {
      this.setData({ saving: false });
    }
  },

  // ========== 上传 ==========

  async uploadToOSS(filePath) {
    const presignData = await get('/storage/presign?contentType=' + encodeURIComponent('image/jpeg'));

    if (!presignData || !presignData.uploadUrl) {
      throw new Error('获取预签名 URL 失败');
    }

    const fileData = await new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        success: res => resolve(res.data),
        fail: reject
      });
    });

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
    if (this.data.pendingVoice) {
      saveSettings(this.data.pendingVoice);
    }
    audioCtx.stop();
    audioCtx.destroy();
  }
});
