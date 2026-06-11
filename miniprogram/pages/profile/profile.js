const profileService = require('../../services/profile-service');
const { get } = require('../../utils/request');
const { getColor, getFirstChar, normalizeAvatarUrl } = require('../../utils/avatar');
const { uploadAvatar, resolveAvatarSrc } = require('../../utils/avatar-storage');
const { generateNickname } = require('../../utils/nickname');
const { truncate, getWidth } = require('../../utils/nickname-width');
const { getMirrorProfile } = require('../../utils/mirror-api');
const { getSettings, saveSettings, clear: clearVoiceQueue } = require('../../utils/voice');
const { vibrateShort } = require('../../utils/haptic');
const config = require('../../config');
const app = getApp();

const SAVE_DELAY = 2000;
const HUD_FADE_DELAY = 1600;

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

    // 本舰呼号展示
    isLongCrewName: false,

    // HUD 状态条
    hudVisible: false,
    hudText: '',
    hudType: 'info', // info | error | warning
    identityBayState: 'standby',
    identityBayLabel: '识别舱待机中',

    // 呼号校准
    nicknameDrawerVisible: false,
    drawerNickname: '',
    drawerNicknameOverflow: false,
    callsignKeyboardHeight: 0,

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

  onLoad() {
    this.audioCtx = wx.createInnerAudioContext();
    this.audioCtx.obeyMuteSwitch = false;
    this._saveTimer = null;
    this._uploadingAvatar = false;
    this._settingsTimer = null;
    this._pendingSettings = {};
    this._hudHideTimer = null;
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
    }
    app.globalData.activeTabKey = 'identity'
    const loggedIn = !!app.globalData.token;
    this.setData({
      isLoggedIn: loggedIn,
      animationEnabled: app.globalData.animationEnabled !== false,
      identityBayState: loggedIn ? 'starting' : 'standby',
      identityBayLabel: loggedIn ? '识别舱启动中' : '识别舱待机中'
    });
    if (!loggedIn) return;

    // 缓存优先
    const cached = app.globalData.userInfo;
    let userTask = Promise.resolve();
    if (cached && cached.nickname) {
      const rawAvatar = cached.avatarUrl || '';
      const avatar = normalizeAvatarUrl(rawAvatar);
      const name = cached.nickname;
      this.setData({
        nickname: name,
        avatarUrl: avatar,
        isLongCrewName: name.length >= 5,
        _lastSavedNickname: name,
        _lastSavedAvatar: avatar
      });
      this.updateAvatar();
      // cloud:// 头像异步解析为 https 临时 URL
      if (avatar.startsWith('cloud://')) {
        resolveAvatarSrc(avatar).then(resolved => {
          if (resolved) {
            this.setData({ avatarUrl: resolved });
            this.updateAvatar();
          }
        });
      }
    } else {
      userTask = this.loadUserInfo();
    }

    // 并行加载数据
    const levelTask = this.loadIdentityLevel();
    const mbtiTask = this.loadMbtiStatus();
    this.loadSettings();
    Promise.allSettled([userTask, levelTask, mbtiTask]).then(() => {
      if (!this.data.isLoggedIn) return;
      this.setData({
        identityBayState: 'online',
        identityBayLabel: '识别舱已接入'
      });
    });
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
    if (this._hudHideTimer) {
      clearTimeout(this._hudHideTimer);
      this._hudHideTimer = null;
    }
    this.setData({ hudVisible: true, hudText: text, hudType: type || 'info' });
    if (autoHide !== false) {
      this._hudHideTimer = setTimeout(() => {
        this._hudHideTimer = null;
        this.setData({ hudVisible: false });
      }, HUD_FADE_DELAY);
    }
  },

  hideHud() {
    if (this._hudHideTimer) {
      clearTimeout(this._hudHideTimer);
      this._hudHideTimer = null;
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

  // ========== 呼号校准 ==========

  openNicknameDrawer() {
    this.setData({
      nicknameDrawerVisible: true,
      drawerNickname: this.data.nickname,
      drawerNicknameOverflow: false
    });
  },

  closeNicknameDrawer() {
    this.setData({ nicknameDrawerVisible: false, callsignKeyboardHeight: 0 });
  },

  noop() {},

  onCallsignKeyboardHeightChange(e) {
    const height = e.detail && e.detail.height ? e.detail.height : 0;
    this.setData({ callsignKeyboardHeight: height });
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
      const user = await profileService.getCurrentUser();
      if (user) {
        const loadedNick = user.nickname || '';
        const rawAvatar = user.avatarUrl || '';
        const loadedAvatar = normalizeAvatarUrl(rawAvatar);
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

        // cloud:// 头像异步解析为 https 临时 URL
        if (loadedAvatar.startsWith('cloud://')) {
          resolveAvatarSrc(loadedAvatar).then(resolved => {
            if (resolved) {
              this.setData({ avatarUrl: resolved });
              this.updateAvatar();
            }
          });
        }

        const uid = String(user.userId || '');
        this.setData({ playerCode: 'SR-' + uid.slice(-4).padStart(4, '0') });

        if (user.createdAt) {
          const safeCreatedAt = typeof user.createdAt === 'string' ? user.createdAt.replace(/-/g, '/') : user.createdAt;
          const created = new Date(safeCreatedAt).getTime();
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
      const res = await profileService.getIdentityLevel();
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
    this.audioCtx.stop();
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

    this.audioCtx.stop();
    this.setData({ playingVoiceId: voice.id });
    this.audioCtx.src = config.baseUrl + '/voice/preview?file=' + encodeURIComponent(voice.file);
    this.audioCtx.play();

    this.audioCtx.offEnded();
    this.audioCtx.onEnded(() => {
      this.setData({ playingVoiceId: '' });
    });
  },

  debouncedSaveSettings(partial) {
    Object.assign(this._pendingSettings, partial);
    if (this._settingsTimer) clearTimeout(this._settingsTimer);
    this._settingsTimer = setTimeout(() => {
      this._settingsTimer = null;
      this.flushSaveSettings();
    }, SAVE_DELAY);
  },

  flushSaveSettings() {
    if (this._settingsTimer) {
      clearTimeout(this._settingsTimer);
      this._settingsTimer = null;
    }
    if (Object.keys(this._pendingSettings).length === 0) return;
    const payload = { ...this._pendingSettings };
    this._pendingSettings = {};
    profileService.saveUserSettings(payload).catch(() => {});
  },

  // ========== 识别徽标 ==========

  onChooseAvatar(e) {
    const tempPath = e.detail && e.detail.avatarUrl;
    if (tempPath) {
      this.applyBadgeTempPath(tempPath);
    }
  },

  async applyBadgeTempPath(tempPath) {
    if (!tempPath) return;
    this.setData({ avatarUrl: tempPath });
    this.updateAvatar();
    this.showHud('识别徽标上传中', 'info', false);
    this._uploadingAvatar = true;
    try {
      const avatarUrlResult = await uploadAvatar(tempPath);
      this.setData({ avatarUrl: avatarUrlResult });
      this.updateAvatar();
      this.showHud('识别徽标已更新', 'info');
    } catch (err) {
      console.error('识别徽标上传失败', err);
      this.showHud('识别徽标更新失败，请稍后重试', 'error');
    } finally {
      this._uploadingAvatar = false;
    }
    this.debouncedSave();
  },

  // ========== 自动保存 ==========

  debouncedSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.saveProfile();
    }, SAVE_DELAY);
  },

  flushSave() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    this.saveProfile();
  },

  async saveProfile() {
    if (this._uploadingAvatar) return;
    const { nickname, avatarUrl } = this.data;
    if (!nickname || !nickname.trim()) return;

    const trimmed = nickname.trim();
    if (trimmed === this.data._lastSavedNickname && avatarUrl === this.data._lastSavedAvatar) {
      // 无变化，清除待同步状态
      this.hideHud();
      return;
    }

    this.setData({ identityBayState: 'starting', identityBayLabel: '识别舱启动中' });
    this.showHud('协议同步中', 'info', false);
    try {
      const normalizedAvatarUrl = normalizeAvatarUrl(avatarUrl);
      let finalAvatarUrl = normalizedAvatarUrl;
      // 未标准化的本地路径（wxfile:// 临时文件）需要先上传
      if (avatarUrl && !normalizedAvatarUrl && !/^https?:\/\//.test(avatarUrl) && !/^cloud:\/\//.test(avatarUrl)) {
        try {
          finalAvatarUrl = await uploadAvatar(avatarUrl);
        } catch (uploadErr) {
          console.error('识别徽标补传失败', uploadErr);
          finalAvatarUrl = this.data._lastSavedAvatar || '';
        }
      }

      await profileService.saveProfile({
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
      this.setData({ identityBayState: 'online', identityBayLabel: '识别舱已接入' });
      this.showHud('本舰呼号已同步', 'info');
    } catch (e) {
      console.error('自动保存失败', e);
      this.setData({ identityBayState: 'online', identityBayLabel: '识别舱已接入' });
      this.showHud('同步失败，点击重试', 'error', false);
    }
  },

  // ========== 导航 ==========

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goLevelArchive() {
    wx.navigateTo({ url: '/pages-ext/level-archive/level-archive' });
  },

  // ========== 断开终端 ==========

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
    this.hideHud();
    if (this.data.nicknameDrawerVisible) {
      this.closeNicknameDrawer();
    }
    if (this.data.voiceSheetVisible) {
      this.closeVoiceSheet();
    }
    this.flushSaveSettings();
    this.setData({ playingVoiceId: '' });
    this.audioCtx.stop();
  },

  onUnload() {
    // 清理所有 timer
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    if (this._settingsTimer) {
      clearTimeout(this._settingsTimer);
      this._settingsTimer = null;
    }
    if (this._hudHideTimer) {
      clearTimeout(this._hudHideTimer);
      this._hudHideTimer = null;
    }
    this.flushSave();
    this.flushSaveSettings();
    clearVoiceQueue();
    if (this.data.pendingVoice) {
      saveSettings(this.data.pendingVoice);
    }
    this.audioCtx.stop();
    this.audioCtx.destroy();
  },

  noop() {
  }
});
