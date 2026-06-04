const { get, put } = require('../../utils/request');
const { getColor, getFirstChar } = require('../../utils/avatar');
const { generateNickname } = require('../../utils/nickname');
const { getSettings, saveSettings, syncFromServer } = require('../../utils/voice');
const { vibrateShort } = require('../../utils/haptic');
const config = require('../../config');
const app = getApp();

const SAVE_DELAY = 2000; // 自动保存防抖延迟（毫秒）
// 音频单例 — 全局唯一，避免内存泄漏和重叠播放
const audioCtx = wx.createInnerAudioContext();
audioCtx.obeyMuteSwitch = false;

// 防抖定时器（页面实例变量，不进 data 避免渲染开销）
let _saveTimer = null;
let _settingsTimer = null;
let _pendingSettings = {};
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
    vibrateEnabled: true,
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
    if (!loggedIn) return;

    // 缓存优先：globalData 或 Storage 中有 userInfo 则直接渲染，不发请求
    const cached = app.globalData.userInfo;
    if (cached && cached.nickname) {
      const rawAvatar = cached.avatarUrl || '';
      const avatar = rawAvatar.startsWith('http') ? rawAvatar : '';
      this.setData({
        nickname: cached.nickname,
        avatarUrl: avatar,
        _lastSavedNickname: cached.nickname,
        _lastSavedAvatar: avatar
      });
      this.updateAvatar();
    } else {
      // 首次冷启动（login 后 globalData 已有，这里兜底）
      this.loadUserInfo();
    }

    this.loadVoiceSettings();
    this.setData({
      animationEnabled: app.globalData.animationEnabled,
      vibrateEnabled: app.globalData.vibrateEnabled !== false
    });
    // 预加载音色分类（供音色抽屉使用），加载完成后重新解析音色名
    this.loadVoiceCatalog().then(() => {
      this.resolveVoiceName(this.data.selectedVoiceId);
    });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  /** 下拉刷新：强制从服务端拉取最新数据 */
  async onPullDownRefresh() {
    if (!app.globalData.token) {
      wx.stopPullDownRefresh();
      return;
    }
    try {
      await this.loadUserInfo();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  async loadUserInfo() {
    try {
      const user = await get('/user/me');
      if (user) {
        const loadedNick = user.nickname || '';
        // 过滤非远程 URL（旧数据可能存了 objectKey 或本地临时路径）
        const rawAvatar = user.avatarUrl || '';
        const loadedAvatar = rawAvatar.startsWith('http') ? rawAvatar : '';
        this.setData({
          nickname: loadedNick,
          avatarUrl: loadedAvatar,
          _lastSavedNickname: loadedNick,
          _lastSavedAvatar: loadedAvatar
        });
        app.updateUserInfo({
          nickname: user.nickname,
          avatarUrl: loadedAvatar
        });
        this.updateAvatar();
        // 同步服务端设置到本地
        if (user.userDetail) {
          syncFromServer(user.userDetail);
          const d = user.userDetail;
          this.setData({
            voiceEnabled: d.voiceEnabled !== false,
            selectedVoiceId: d.voiceId || 'std_01',
            animationEnabled: d.animEnabled !== false,
            vibrateEnabled: d.vibrateEnabled !== false
          });
          this.resolveVoiceName(d.voiceId || 'std_01');
          app.globalData.animationEnabled = d.animEnabled !== false;
          app.globalData.vibrateEnabled = d.vibrateEnabled !== false;
          wx.setStorageSync('animationEnabled', d.animEnabled !== false);
          wx.setStorageSync('vibrateEnabled', d.vibrateEnabled !== false);
        }
      }
    } catch (e) {
      console.error('加载用户信息失败', e);
    }
  },

  loadVoiceSettings() {
    const settings = getSettings();
    this.setData({
      voiceEnabled: settings.enabled,
      selectedVoiceId: settings.voiceId
    });
    this.resolveVoiceName(settings.voiceId);
  },

  resolveVoiceName(voiceId) {
    const cats = this.data.voiceCategories;
    if (!cats.length) {
      // 目录未加载，先用 ID 兜底，等 loadVoiceCatalog 完成后再解析
      this.setData({ voiceName: voiceId });
      return;
    }
    for (const cat of cats) {
      const found = (cat.voices || []).find(v => v.id === voiceId);
      if (found) {
        this.setData({ voiceName: found.name });
        return;
      }
    }
    this.setData({ voiceName: voiceId });
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
    let val = e.detail.value || '';
    if (val.length > 6) val = val.substring(0, 6);
    this.setData({ nickname: val });
    this.debouncedSave();
  },

  onNicknameBlur() {
    this.flushSave();
  },

  shuffleNickname() {
    let nickname = generateNickname();
    if (nickname.length > 6) nickname = nickname.substring(0, 6);
    this.setData({ nickname });
    this.updateAvatar();
    this.debouncedSave();
  },

  // ========== 语音设置 ==========

  onVoiceToggle() {
    const enabled = !this.data.voiceEnabled;
    this.setData({ voiceEnabled: enabled });
    saveSettings({ enabled });
    app.globalData.audioEnabled = enabled;
    wx.setStorageSync('audioEnabled', enabled);
    this.debouncedSaveSettings({ voiceEnabled: enabled });
    vibrateShort('light');
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
      const pv = this.data.pendingVoice;
      saveSettings({ voiceId: pv.voiceId });
      this.debouncedSaveSettings({ voiceId: pv.voiceId });
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
      pendingVoice: { voiceId: voice.id }
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

  onAnimationToggle() {
    const enabled = !this.data.animationEnabled;
    this.setData({ animationEnabled: enabled });
    app.globalData.animationEnabled = enabled;
    wx.setStorageSync('animationEnabled', enabled);
    this.debouncedSaveSettings({ animEnabled: enabled });
    vibrateShort('light');
  },

  onVibrateToggle() {
    const enabled = !this.data.vibrateEnabled;
    this.setData({ vibrateEnabled: enabled });
    app.globalData.vibrateEnabled = enabled;
    wx.setStorageSync('vibrateEnabled', enabled);
    this.debouncedSaveSettings({ vibrateEnabled: enabled });
    vibrateShort('light');
  },

  // ========== 导航 ==========

  goScoreRecords() {
    wx.switchTab({ url: '/pages/room/room' });
  },

  goHistoryRooms() {
    wx.navigateTo({ url: '/pages/history/history' });
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
    this.flushSaveSettings();
  },

  // 设置防抖
  debouncedSaveSettings(partial) {
    Object.assign(_pendingSettings, partial);
    if (_settingsTimer) clearTimeout(_settingsTimer);
    _settingsTimer = setTimeout(() => {
      _settingsTimer = null;
      this.flushSaveSettings();
    }, SAVE_DELAY);
  },

  flushSaveSettings() {
    if (_settingsTimer) {
      clearTimeout(_settingsTimer);
      _settingsTimer = null;
    }
    if (Object.keys(_pendingSettings).length === 0) return;
    const payload = { ..._pendingSettings };
    _pendingSettings = {};
    put('/user/detail', payload).catch(() => {});
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
      // 非远程 URL 视为本地临时文件，需上传（正常情况 onChooseAvatar 已立即上传）
      if (avatarUrl && !avatarUrl.startsWith('http')) {
        try {
          finalAvatarUrl = await this.uploadToOSS(avatarUrl);
        } catch (uploadErr) {
          console.error('头像补传失败，跳过头像保存', uploadErr);
          finalAvatarUrl = this.data._lastSavedAvatar || '';
        }
      }

      await put('/user/me', {
        nickname: nickname.trim().substring(0, 6),
        avatarUrl: finalAvatarUrl || ''
      });

      // 乐观更新：同步写入 globalData + Storage，不发额外请求
      app.updateUserInfo({
        nickname: nickname.trim().substring(0, 6),
        avatarUrl: finalAvatarUrl || ''
      });

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

    // 返回完整公开 URL，而非 objectKey（避免相对路径被当作本地文件）
    return presignData.accessUrl || presignData.objectKey;
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
