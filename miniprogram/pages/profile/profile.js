const { get, put } = require('../../utils/request');
const { getColor, getFirstChar } = require('../../utils/avatar');
const { generateNickname } = require('../../utils/nickname');
const { getSettings, saveSettings } = require('../../utils/voice');
const config = require('../../config');
const app = getApp();

const SAVE_DELAY = 2000; // 自动保存防抖延迟（毫秒）
// 音频单例 — 全局唯一，避免内存泄漏和重叠播放
const audioCtx = wx.createInnerAudioContext();
audioCtx.obeyMuteSwitch = false;

// 防抖定时器（页面实例变量，不进 data 避免渲染开销）
let _saveTimer = null;
let _uploadingAvatar = false;

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
      // 预加载音色分类（供音色抽屉使用）
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

  async onChooseAvatar(e) {
    const tempPath = e.detail.avatarUrl;
    this.setData({ avatarUrl: tempPath });
    this.updateAvatar();
    // 立即上传临时文件，防止被系统清理
    _uploadingAvatar = true;
    try {
      const ossUrl = await this.uploadToOSS(tempPath);
      this.setData({ avatarUrl: ossUrl });
    } catch (err) {
      console.error('头像上传失败', err);
    } finally {
      _uploadingAvatar = false;
    }
    this.debouncedSave();
  },

  // ========== 昵称（防抖保存，失焦立即刷盘） ==========

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
    this.debouncedSave();
  },

  onNicknameBlur() {
    this.flushSave();
  },

  shuffleNickname() {
    const nickname = generateNickname();
    this.setData({ nickname });
    this.updateAvatar();
    this.debouncedSave();
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
      const catalog = await get('/voice/catalog');
      const categories = catalog.categories || [];
      this.setData({ voiceCategories: categories });
      // 确保 activeVoiceCatId 在分类列表中有效
      if (categories.length > 0 && !categories.find(c => c.id === this.data.activeVoiceCatId)) {
        this.setData({ activeVoiceCatId: categories[0].id });
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

  // ========== 自动保存（防抖 + 刷盘） ==========

  // 防抖：延迟 2 秒，重复调用重置计时
  debouncedSave() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      _saveTimer = null;
      this.saveProfile();
    }, SAVE_DELAY);
  },

  // 刷盘：取消防抖，立即保存
  flushSave() {
    if (_saveTimer) {
      clearTimeout(_saveTimer);
      _saveTimer = null;
    }
    this.saveProfile();
  },

  async saveProfile() {
    if (this.data.saving || _uploadingAvatar) return;
    const { nickname, avatarUrl } = this.data;

    if (!nickname || !nickname.trim()) return;

    // 值未变化时跳过保存
    const trimmed = nickname.trim();
    if (trimmed === this.data._lastSavedNickname && avatarUrl === this.data._lastSavedAvatar) return;

    this.setData({ saving: true });
    try {
      let finalAvatarUrl = avatarUrl;
      // 非 OSS URL 视为本地临时文件，需上传（正常情况 onChooseAvatar 已立即上传）
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

  onHide() {
    // 页面切后台时刷盘，防止丢失未保存的修改
    this.flushSave();
  },

  onUnload() {
    this.flushSave();
    if (this.data.pendingVoice) {
      saveSettings(this.data.pendingVoice);
    }
    audioCtx.stop();
    audioCtx.destroy();
  }
});
