const { get, put } = require('../../utils/request');
const { getColor, getFirstChar } = require('../../utils/avatar');
const { generateNickname } = require('../../utils/nickname');
const { getMirrorProfile } = require('../../utils/mirror-api');
const { getSettings, saveSettings } = require('../../utils/voice');
const { vibrateShort } = require('../../utils/haptic');
const config = require('../../config');
const app = getApp();

const SAVE_DELAY = 2000;
const audioCtx = wx.createInnerAudioContext();
audioCtx.obeyMuteSwitch = false;

let _saveTimer = null;
let _uploadingAvatar = false;
let _settingsTimer = null;
let _pendingSettings = {};

// 音色分类标签映射（后端 ID → 终端显示）
const CATEGORY_LABELS = {
  female:  { en: 'STANDARD', zh: '标准' },
  male:    { en: 'MALE',     zh: '男声' },
  funny:   { en: 'SPECIAL',  zh: '特殊' }
};

// 成就配置
const BADGE_CONFIG = [
  { id: 'first_match',   name: '首次封存',   code: '首任',     icon: 'circle',  desc: '完成第一次任务封存',    field: 'matchCount',  target: 1 },
  { id: 'match_10',      name: '累计十任',   code: 'x10',      icon: 'layers',  desc: '累计完成10次封存',    field: 'matchCount',  target: 10 },
  { id: 'match_50',      name: '半百任务',   code: 'x50',      icon: 'layers',  desc: '累计完成50次封存',    field: 'matchCount',  target: 50 },
  { id: 'score_100',     name: '百分成员',   code: '100+',     icon: 'star',    desc: '累计净数值达到100',   field: 'totalScore',  target: 100 },
  { id: 'score_1000',    name: '数值破千',   code: '1000+',    icon: 'diamond', desc: '累计净数值达到1000',  field: 'totalScore',  target: 1000 },
  { id: 'win_3_streak',  name: '连续三胜',   code: '3 连胜',   icon: 'bolt',    desc: '连续3场获得正向反馈',   field: 'winStreak',   target: 3 },
  { id: 'win_10',        name: '连续十局',   code: '10 连胜',  icon: 'bolt',    desc: '连续10场获得正向反馈',  field: 'winStreak',   target: 10 },
  { id: 'win_rate_50',   name: '胜率过半',   code: '50%+',     icon: 'target',  desc: '胜率达到50%',         field: 'winRate',     target: 50 },
  { id: 'mirror_sync',   name: '镜像同步',   code: '已同步',   icon: 'scan',    desc: '完成MBTI校准',        field: 'mbtiSync',    target: 1 },
  { id: 'level_2',       name: '等级提升',   code: 'Lv.2',     icon: 'arrow-up',desc: '身份等级达到2级',     field: 'level',       target: 2 },
  { id: 'level_3',       name: '策略执行者', code: 'Lv.3',     icon: 'arrow-up',desc: '身份等级达到3级',     field: 'level',       target: 3 },
  { id: 'stability_80',  name: '稳定执行者', code: '稳定',     icon: 'shield',  desc: '稳定度达到80',        field: 'stability',   target: 80 }
];

Page({
  data: {
    isLoggedIn: false,
    nickname: '',
    avatarUrl: '',
    avatarColor: '',
    avatarChar: '',
    saving: false,
    _lastSavedNickname: '',
    _lastSavedAvatar: '',

    // 身份信息
    playerCode: '',
    daysSinceJoined: 0,

    // 积分统计
    totalScore: 0,
    winRate: 0,
    matchCount: 0,

    // 身份等级
    level: 1,
    levelTitle: '新人观察员',
    levelExp: 0,          // 等级内已获得经验
    levelExpDisplay: 0,   // 展示用经验，限制在等级区间内
    levelExpRange: 0,     // 等级所需经验区间
    levelRemainingExp: 0,
    nextLevelExp: 100,    // 下一级累计阈值
    levelProgress: 0,
    stability: null,

    // 成就
    achievements: [],

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
      this.setData({
        nickname: cached.nickname,
        avatarUrl: avatar,
        _lastSavedNickname: cached.nickname,
        _lastSavedAvatar: avatar
      });
      this.updateAvatar();
    } else {
      this.loadUserInfo();
    }

    // 并行加载数据
    this.loadScoreStats();
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
        this.loadScoreStats(),
        this.loadIdentityLevel()
      ]);
    } finally {
      wx.stopPullDownRefresh();
    }
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

  async loadScoreStats() {
    try {
      const resp = await get('/score/trend?limit=50');
      const points = (resp && resp.points) || [];
      const totalScore = points.reduce((sum, p) => sum + (p.netScore || 0), 0);
      const wins = points.filter(p => p.netScore > 0).length;
      const matchCount = points.length;
      const winRate = matchCount > 0 ? Math.round((wins / matchCount) * 100) : 0;

      // 计算最大连胜
      let winStreak = 0;
      let maxWinStreak = 0;
      for (const p of points) {
        if (p.netScore > 0) {
          winStreak++;
          maxWinStreak = Math.max(maxWinStreak, winStreak);
        } else {
          winStreak = 0;
        }
      }

      this.setData({ totalScore, winRate, matchCount, maxWinStreak });
      this.computeAchievements();
    } catch (e) {
      console.error('加载积分数据失败', e);
    }
  },

  async loadIdentityLevel() {
    try {
      const res = await get('/user/identity-level');
      if (!res) return;
      const levelExp = Math.max(0, res.currentLevelExp || 0);
      const levelExpRange = Math.max(0, res.requiredExpInLevel || 0);
      const levelExpDisplay = levelExpRange > 0 ? Math.min(levelExp, levelExpRange) : levelExp;
      const levelRemainingExp = Math.max(0, levelExpRange - levelExp);
      const levelProgress = Math.max(0, Math.min(100, res.progress || 0));
      this.setData({
        level: res.level || 1,
        levelTitle: res.title || '新人观察员',
        levelExp,
        levelExpDisplay,
        levelExpRange,
        levelRemainingExp,
        nextLevelExp: res.nextLevelExp || 100,
        levelProgress,
        stability: res.stability
      });
      this.computeAchievements();
    } catch (e) {
      console.error('加载身份等级失败', e);
    }
  },

  async loadMbtiStatus() {
    try {
      const res = await getMirrorProfile();
      if (res && res.mbti) {
        app.globalData.mbtiCalibrated = !!res.mbti.calibrated;
        this.computeAchievements();
      }
    } catch (e) {
      // 镜像数据加载失败不影响主流程
    }
  },

  computeAchievements() {
    const { matchCount, totalScore, winRate, maxWinStreak, level, stability } = this.data;
    const mbtiSync = app.globalData.mbtiCalibrated ? 1 : 0;

    const statsMap = {
      matchCount, totalScore, winRate,
      winStreak: maxWinStreak || 0,
      mbtiSync,
      level,
      stability: stability || 0
    };

    const achievements = BADGE_CONFIG.map(badge => {
      const current = Math.max(0, statsMap[badge.field] || 0);
      const progress = Math.max(0, Math.min(current, badge.target));
      const progressPct = badge.target > 0 ? Math.round(progress * 100 / badge.target) : 0;
      return {
        id: badge.id,
        name: badge.name,
        code: badge.code,
        icon: badge.icon,
        desc: badge.desc,
        progress,
        progressPct,
        progressText: progress + '/' + badge.target,
        target: badge.target,
        unlocked: current >= badge.target
      };
    });

    this.setData({ achievements });
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
      // 为每个分类添加终端标签
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

  onVoiceToggle() {
    const enabled = !this.data.voiceEnabled;
    this.setData({ voiceEnabled: enabled });
    saveSettings({ enabled });
    app.globalData.audioEnabled = enabled;
    wx.setStorageSync('audioEnabled', enabled);
    this.debouncedSaveSettings({ voiceEnabled: enabled });
    vibrateShort('light');
  },

  onAnimToggle() {
    const enabled = !this.data.animEnabled;
    this.setData({ animEnabled: enabled, animationEnabled: enabled });
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

  // ========== 昵称 ==========

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
    wx.showToast({ title: '代号已更新', icon: 'none', duration: 1200 });
  },

  // ========== 导航 ==========

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goScoreRecords() {
    wx.navigateTo({ url: '/pages/score-records/score-records' });
  },

  goAbout() {
    wx.showToast({ title: '脉冲终端 v1.0', icon: 'none' });
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
    if (this.data.saving || _uploadingAvatar) return;
    const { nickname, avatarUrl } = this.data;
    if (!nickname || !nickname.trim()) return;

    const trimmed = nickname.trim();
    if (trimmed === this.data._lastSavedNickname && avatarUrl === this.data._lastSavedAvatar) return;

    this.setData({ saving: true });
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
        nickname: nickname.trim().substring(0, 6),
        avatarUrl: finalAvatarUrl || ''
      });

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

  // ========== 退出登录 ==========

  async onLogout() {
    const { confirm } = await wx.showModal({
      title: '系统警告',
      content: '确认结束当前会话？退出后需要重新授权接入。',
      confirmText: '结束会话',
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
  },

  onUnload() {
    this.flushSave();
    this.flushSaveSettings();
    if (this.data.pendingVoice) {
      saveSettings(this.data.pendingVoice);
    }
    audioCtx.stop();
    audioCtx.destroy();
  }
});
