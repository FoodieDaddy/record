const { get, put } = require('../../utils/request');
const { getColor, getFirstChar } = require('../../utils/avatar');
const { generateNickname } = require('../../utils/nickname');
const { truncate, getWidth } = require('../../utils/nickname-width');
const { getMirrorProfile } = require('../../utils/mirror-api');
const { getSettings, saveSettings } = require('../../utils/voice');
const { vibrateShort } = require('../../utils/haptic');
const config = require('../../config');
const app = getApp();

const SAVE_DELAY = 2000;
const HUD_FADE_DELAY = 1600;
const audioCtx = wx.createInnerAudioContext();
audioCtx.obeyMuteSwitch = false;

let _saveTimer = null;
let _uploadingAvatar = false;
let _settingsTimer = null;
let _pendingSettings = {};
let _hudHideTimer = null;

// 音色分类标签映射（后端 ID → 终端显示）
const CATEGORY_LABELS = {
  female:  { en: 'STANDARD', zh: '标准' },
  male:    { en: 'MALE',     zh: '男声' },
  funny:   { en: 'SPECIAL',  zh: '特殊' }
};

// 等级名称映射
const LEVEL_TITLES = {
  1: '观察员',
  2: '参与者',
  3: '执行者',
  4: '掌控者',
  5: '候选者'
};

Page({
  data: {
    isLoggedIn: false,
    nickname: '',
    avatarUrl: '',
    avatarColor: '',
    avatarChar: '',
    _lastSavedNickname: '',
    _lastSavedAvatar: '',

    // 身份信息
    playerCode: '',
    daysSinceJoined: 0,

    // 舰员代号展示
    isLongCrewName: false,

    // HUD 状态条
    hudVisible: false,
    hudText: '',
    hudType: 'info', // info | error | warning

    // 昵称抽屉
    nicknameDrawerVisible: false,
    drawerNickname: '',
    drawerNicknameOverflow: false,

    // 身份等级
    level: 1,
    levelTitle: '新人观察员',
    levelExp: 0,
    levelExpDisplay: 0,
    levelExpRange: 0,
    levelRemainingExp: 0,
    nextLevelExp: 100,
    levelProgress: 0,
    nextLevelTitle: '',
    stability: null,

    // 动画开关
    animationEnabled: true,

    // 设置
    voiceEnabled: true,
    voiceName: '晓晓',
    selectedVoiceId: 'std_01',
    animEnabled: true,
    vibrateEnabled: true,

    // 音色弹层
    voiceSheetVisible: false,
    voiceCategories: [],
    activeVoiceCatId: 'female',
    scrollToCat: '',
    playingVoiceId: '',
    pendingVoice: null
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    app.globalData.activeTabKey = 'identity'
    const loggedIn = !!app.globalData.token;
    this.setData({
      isLoggedIn: loggedIn,
      animationEnabled: app.globalData.animationEnabled !== false
    });
    if (!loggedIn) return;

    // 缓存优先
    const cached = app.globalData.userInfo;
    if (cached && cached.nickname) {
      const rawAvatar = cached.avatarUrl || '';
      const avatar = rawAvatar.startsWith('http') ? rawAvatar : '';
      const name = cached.nickname;
      this.setData({
        nickname: name,
        avatarUrl: avatar,
        isLongCrewName: name.length >= 5,
        _lastSavedNickname: name,
        _lastSavedAvatar: avatar
      });
      this.updateAvatar();
    } else {
      this.loadUserInfo();
    }

    // 并行加载数据
    this.loadIdentityLevel();
    this.loadMbtiStatus();
    this.loadSettings();
  },

  async onPullDownRefresh() {
    if (!app.globalData.token) {
      wx.stopPullDownRefresh();
      return;
    }
    try {
      await Promise.all([
        this.loadUserInfo(),
        this.loadIdentityLevel()
      ]);
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  // ========== HUD 状态条 ==========

  showHud(text, type, autoHide) {
    if (_hudHideTimer) {
      clearTimeout(_hudHideTimer);
      _hudHideTimer = null;
    }
    this.setData({ hudVisible: true, hudText: text, hudType: type || 'info' });
    if (autoHide !== false) {
      _hudHideTimer = setTimeout(() => {
        _hudHideTimer = null;
        this.setData({ hudVisible: false });
      }, HUD_FADE_DELAY);
    }
  },

  hideHud() {
    if (_hudHideTimer) {
      clearTimeout(_hudHideTimer);
      _hudHideTimer = null;
    }
    this.setData({ hudVisible: false });
  },

  onHudTap() {
    // 失败状态点击重试
    if (this.data.hudType === 'error') {
      this.hideHud();
      this.saveProfile();
    }
  },

  // ========== 昵称抽屉 ==========

  openNicknameDrawer() {
    this.setData({
      nicknameDrawerVisible: true,
      drawerNickname: this.data.nickname,
      drawerNicknameOverflow: false
    });
  },

  closeNicknameDrawer() {
    this.setData({ nicknameDrawerVisible: false });
  },

  onDrawerNicknameInput(e) {
    let val = e.detail.value || '';
    const overflow = getWidth(val) > 6;
    this.setData({
      drawerNickname: val,
      drawerNicknameOverflow: overflow
    });
  },

  onRandomNickname() {
    const name = generateNickname();
    this.setData({
      drawerNickname: name,
      drawerNicknameOverflow: false
    });
  },

  confirmNicknameDrawer() {
    const raw = this.data.drawerNickname || '';
    const trimmed = raw.trim();
    if (!trimmed) return;

    const finalName = truncate(trimmed);
    if (finalName === this.data.nickname) {
      this.closeNicknameDrawer();
      return;
    }

    this.setData({
      nickname: finalName,
      isLongCrewName: finalName.length >= 5,
      nicknameDrawerVisible: false
    });
    this.updateAvatar();
    this.showHud('协议待同步', 'info', false);
    this.debouncedSave();
  },

  // ========== 数据加载 ==========

  async loadUserInfo() {
    try {
      const user = await get('/user/me');
      if (user) {
        const loadedNick = user.nickname || '';
        const rawAvatar = user.avatarUrl || '';
        const loadedAvatar = rawAvatar.startsWith('http') ? rawAvatar : '';
        this.setData({
          nickname: loadedNick,
          avatarUrl: loadedAvatar,
          isLongCrewName: loadedNick.length >= 5,
          _lastSavedNickname: loadedNick,
          _lastSavedAvatar: loadedAvatar
        });
        app.updateUserInfo({
          nickname: user.nickname,
          avatarUrl: loadedAvatar
        });
        this.updateAvatar();

        const uid = String(user.userId || '');
        this.setData({ playerCode: 'SR-' + uid.slice(-4).padStart(4, '0') });

        if (user.createdAt) {
          const created = new Date(user.createdAt).getTime();
          const days = Math.floor((Date.now() - created) / 86400000);
          this.setData({ daysSinceJoined: days });
        }
      }
    } catch (e) {
      console.error('加载用户信息失败', e);
    }
  },

  async loadIdentityLevel() {
    try {
      const res = await get('/user/identity-level');
      if (!res) return;
      const levelExp = Math.max(0, Number(res.currentLevelExp) || 0);
      const levelExpRange = Math.max(0, Number(res.requiredExpInLevel) || 0);
      const levelExpDisplay = levelExpRange > 0 ? Math.min(levelExp, levelExpRange) : levelExp;
      const levelRemainingExp = Math.max(0, levelExpRange - levelExp);
      const levelProgress = Math.max(0, Math.min(100, Number(res.progress) || 0));
      const nextLevel = (Number(res.level) || 1) + 1;
      const stabilityVal = res.stability;
      const stability = (stabilityVal !== null && stabilityVal !== undefined && Number.isFinite(Number(stabilityVal)))
        ? Number(stabilityVal) : null;
      this.setData({
        level: Number(res.level) || 1,
        levelTitle: res.title || '观察员',
        nextLevelTitle: LEVEL_TITLES[nextLevel] || '',
        levelExp,
        levelExpDisplay,
        levelExpRange,
        levelRemainingExp,
        nextLevelExp: Number(res.nextLevelExp) || 100,
        levelProgress,
        stability
      });
    } catch (e) {
      console.error('加载身份等级失败', e);
    }
  },

  async loadMbtiStatus() {
    try {
      const res = await getMirrorProfile();
      if (res && res.mbti) {
        app.globalData.mbtiCalibrated = !!res.mbti.calibrated;
      }
    } catch (e) {
      // 镜像数据加载失败不影响主流程
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

  // ========== 设置 ==========

  loadSettings() {
    const settings = getSettings();
    this.setData({
      voiceEnabled: settings.enabled,
      selectedVoiceId: settings.voiceId,
      animEnabled: app.globalData.animationEnabled !== false,
      vibrateEnabled: app.globalData.vibrateEnabled !== false
    });
    this.resolveVoiceName(settings.voiceId);
    this.loadVoiceCatalog();
  },

  async loadVoiceCatalog() {
    if (this.data.voiceCategories.length > 0) return;
    try {
      const catalog = await get('/voice/catalog');
      const rawCategories = catalog.categories || [];
      const categories = rawCategories.map(cat => {
        const label = CATEGORY_LABELS[cat.id] || { en: cat.id.toUpperCase(), zh: cat.name };
        return { ...cat, enLabel: label.en, zhLabel: label.zh };
      });
      this.setData({ voiceCategories: categories });
      if (categories.length > 0 && !categories.find(c => c.id === this.data.activeVoiceCatId)) {
        this.setData({ activeVoiceCatId: categories[0].id });
      }
    } catch (e) {
      console.error('加载音色目录失败', e);
    }
  },

  resolveVoiceName(voiceId) {
    const cats = this.data.voiceCategories;
    if (!cats.length) {
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

  onVoiceSwitch() {
    const enabled = !this.data.voiceEnabled;
    this.setData({ voiceEnabled: enabled });
    saveSettings({ enabled });
    app.globalData.audioEnabled = enabled;
    wx.setStorageSync('audioEnabled', enabled);
    this.debouncedSaveSettings({ voiceEnabled: enabled });
    this.showHud(enabled ? '通讯协议已接入' : '通讯协议已断开', 'info');
    vibrateShort('light');
  },

  onAnimSwitch() {
    const enabled = !this.data.animEnabled;
    this.setData({ animEnabled: enabled, animationEnabled: enabled });
    app.globalData.animationEnabled = enabled;
    wx.setStorageSync('animationEnabled', enabled);
    this.debouncedSaveSettings({ animEnabled: enabled });
    this.showHud(enabled ? '视觉协议已开启' : '视觉协议已关闭', 'info');
    vibrateShort('light');
  },

  onVibrateSwitch() {
    const enabled = !this.data.vibrateEnabled;
    this.setData({ vibrateEnabled: enabled });
    app.globalData.vibrateEnabled = enabled;
    wx.setStorageSync('vibrateEnabled', enabled);
    this.debouncedSaveSettings({ vibrateEnabled: enabled });
    this.showHud(enabled ? '触感协议已开启' : '触感协议已关闭', 'info');
    vibrateShort('light');
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
      this.showHud('通讯音色已接入', 'info');
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

    audioCtx.stop();
    this.setData({ playingVoiceId: voice.id });
    audioCtx.src = config.baseUrl + '/voice/preview?file=' + encodeURIComponent(voice.file);
    audioCtx.play();

    audioCtx.offEnded();
    audioCtx.onEnded(() => {
      this.setData({ playingVoiceId: '' });
    });
  },

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

  // ========== 头像 ==========

  async onChooseAvatar(e) {
    const tempPath = e.detail.avatarUrl;
    this.setData({ avatarUrl: tempPath });
    this.updateAvatar();
    this.showHud('识别徽标上传中', 'info', false);
    _uploadingAvatar = true;
    try {
      const ossUrl = await this.uploadToOSS(tempPath);
      this.setData({ avatarUrl: ossUrl });
      this.showHud('识别徽标已更新', 'info');
    } catch (err) {
      console.error('头像上传失败', err);
      this.showHud('识别徽标上传失败', 'error');
    } finally {
      _uploadingAvatar = false;
    }
    this.debouncedSave();
  },

  // ========== 自动保存 ==========

  debouncedSave() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      _saveTimer = null;
      this.saveProfile();
    }, SAVE_DELAY);
  },

  flushSave() {
    if (_saveTimer) {
      clearTimeout(_saveTimer);
      _saveTimer = null;
    }
    this.saveProfile();
  },

  async saveProfile() {
    if (_uploadingAvatar) return;
    const { nickname, avatarUrl } = this.data;
    if (!nickname || !nickname.trim()) return;

    const trimmed = nickname.trim();
    if (trimmed === this.data._lastSavedNickname && avatarUrl === this.data._lastSavedAvatar) {
      // 无变化，清除待同步状态
      this.hideHud();
      return;
    }

    this.showHud('协议同步中', 'info', false);
    try {
      let finalAvatarUrl = avatarUrl;
      if (avatarUrl && !avatarUrl.startsWith('http')) {
        try {
          finalAvatarUrl = await this.uploadToOSS(avatarUrl);
        } catch (uploadErr) {
          console.error('头像补传失败', uploadErr);
          finalAvatarUrl = this.data._lastSavedAvatar || '';
        }
      }

      await put('/user/me', {
        nickname: truncate(nickname.trim()),
        avatarUrl: finalAvatarUrl || ''
      });

      app.updateUserInfo({
        nickname: truncate(nickname.trim()),
        avatarUrl: finalAvatarUrl || ''
      });

      this.setData({
        avatarUrl: finalAvatarUrl || '',
        _lastSavedNickname: trimmed,
        _lastSavedAvatar: finalAvatarUrl || ''
      });
      this.updateAvatar();
      this.showHud('呼号已同步', 'info');
    } catch (e) {
      console.error('自动保存失败', e);
      this.showHud('同步失败，点击重试', 'error', false);
    }
  },

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
        header: { 'Content-Type': 'image/jpeg' },
        success(res) {
          if (res.statusCode === 200) resolve();
          else reject(new Error('上传失败: ' + res.statusCode));
        },
        fail: reject
      });
    });

    return presignData.accessUrl || presignData.objectKey;
  },

  // ========== 导航 ==========

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goLevelArchive() {
    wx.navigateTo({ url: '/pages/level-archive/level-archive' });
  },

  // ========== 退出登录 ==========

  async onLogout() {
    const { confirm } = await wx.showModal({
      title: '断开识别舱？',
      content: '当前本地接入状态将被清除。',
      confirmText: '断开终端',
      confirmColor: '#FF4D4F',
      cancelText: '取消'
    });
    if (!confirm) return;
    app.logout();
    wx.reLaunch({ url: '/pages/login/login' });
  },

  onHide() {
    this.flushSave();
    this.flushSaveSettings();
    this.hideHud();
  },

  onUnload() {
    // 清理所有 timer
    if (_saveTimer) {
      clearTimeout(_saveTimer);
      _saveTimer = null;
    }
    if (_settingsTimer) {
      clearTimeout(_settingsTimer);
      _settingsTimer = null;
    }
    if (_hudHideTimer) {
      clearTimeout(_hudHideTimer);
      _hudHideTimer = null;
    }
    this.flushSave();
    this.flushSaveSettings();
    if (this.data.pendingVoice) {
      saveSettings(this.data.pendingVoice);
    }
    audioCtx.stop();
    audioCtx.destroy();
  }
});
