const { get, put } = require('../../utils/request');
const { getColor, getFirstChar } = require('../../utils/avatar');
const { generateNickname } = require('../../utils/nickname');
const { getMirrorProfile } = require('../../utils/mirror-api');
const { MBTI_MAP, MBTI_TRAITS } = require('../../utils/mbti-const');
const app = getApp();

const SAVE_DELAY = 2000;
let _saveTimer = null;
let _uploadingAvatar = false;

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
    playerTag: '',       // #SR-1234
    daysSinceJoined: 0,

    // 积分统计（来自 /score/trend）
    totalScore: 0,
    winRate: 0,
    matchCount: 0,

    // 镜像数据（来自 /mirror/profile）
    mbtiType: '',
    mbtiTitle: '',
    mbtiCalibrated: false,
    traits: [],

    // 战斗人格维度
    battleDimensions: [],

    // 成就
    achievements: [],

    // 动画开关（用于 reduce-motion 类）
    animationEnabled: true
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

    // 并行加载镜像和积分数据
    this.loadMirrorData();
    this.loadScoreStats();
  },

  async onPullDownRefresh() {
    if (!app.globalData.token) {
      wx.stopPullDownRefresh();
      return;
    }
    try {
      await Promise.all([
        this.loadUserInfo(),
        this.loadMirrorData(),
        this.loadScoreStats()
      ]);
    } finally {
      wx.stopPullDownRefresh();
    }
  },

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

        // 玩家标签
        const uid = String(user.userId || '');
        this.setData({ playerTag: '#SR-' + uid.slice(-4) });

        // 注册天数
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

  async loadMirrorData() {
    try {
      const res = await getMirrorProfile();
      if (!res) return;

      const mbti = res.mbti || {};
      const mbtiInfo = mbti.mbtiCode ? MBTI_MAP[mbti.mbtiCode] : null;
      const traits = (res.traits && res.traits.length > 0)
        ? res.traits
        : (mbtiInfo ? (MBTI_TRAITS[mbtiInfo.type] || []) : []);

      const dimensions = (res.battlePersona && res.battlePersona.generated)
        ? (res.dimensions || [])
        : [];

      this.setData({
        mbtiType: mbtiInfo ? mbtiInfo.type : '',
        mbtiTitle: mbtiInfo ? mbtiInfo.title : '',
        mbtiCalibrated: !!mbti.calibrated,
        traits: traits,
        battleDimensions: dimensions
      });
      this.computeAchievements();
    } catch (e) {
      console.error('加载镜像数据失败', e);
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

      this.setData({ totalScore, winRate, matchCount });
      this.computeAchievements();
    } catch (e) {
      console.error('加载积分数据失败', e);
    }
  },

  computeAchievements() {
    const { matchCount, totalScore, winRate, mbtiCalibrated } = this.data;
    const achievements = [
      { key: 'first_game',  label: '首局完成', unlocked: matchCount >= 1 },
      { key: 'century',     label: '百分玩家', unlocked: totalScore >= 100 },
      { key: 'score_1000',  label: '积分破千', unlocked: totalScore >= 1000 },
      { key: 'ten_streak',  label: '连续十局', unlocked: matchCount >= 10 },
      { key: 'win_half',    label: '胜率过半', unlocked: winRate >= 50 },
      { key: 'mirror_sync', label: '镜像同步', unlocked: mbtiCalibrated }
    ];
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
  },

  // ========== 导航 ==========

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' });
  },

  goScoreRecords() {
    wx.navigateTo({ url: '/pages/score-records/score-records' });
  },

  goBattleFile() {
    wx.switchTab({ url: '/pages/mirror/index' });
  },

  goExportData() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
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
      title: '确认退出？',
      content: '退出后需要重新登录'
    });
    if (!confirm) return;
    app.logout();
    wx.reLaunch({ url: '/pages/login/login' });
  },

  onHide() {
    this.flushSave();
  },

  onUnload() {
    this.flushSave();
  }
});
