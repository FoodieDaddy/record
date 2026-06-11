const api = require('../../utils/mirror-api');
const scoreService = require('../../services/score-service');
const { MBTI_MAP, MBTI_TRAITS } = require('../../utils/mbti-const');
const { sanitizeMirrorText, sanitizeMirrorObject, sanitizeCrewName, truncateCanvasText } = require('../../utils/mirror-sanitize');
const { normalizeAvatarUrl } = require('../../utils/avatar');
const { vibrateShort } = require('../../utils/haptic');
const app = getApp();

var ZERO_DIMS = [
  { key: 'aggression', label: '推进倾向', value: 0, desc: '' },
  { key: 'stability', label: '舰体稳定', value: 0, desc: '' },
  { key: 'participation', label: '接入频率', value: 0, desc: '' },
  { key: 'comeback', label: '回稳能力', value: 0, desc: '' },
  { key: 'dominance', label: '场域控制', value: 0, desc: '' }
];

// 人格标签 → 信号关键词
var PERSONA_SIGNAL_MAP = {
  STABLE_CONTROL: ['节奏控制', '低失误', '稳健决策', '长期主义'],
  AGGRESSIVE_PUSH: ['主动推进', '窗口捕捉', '高频决策', '数值聚焦'],
  VOLATILE_BURST: ['波动响应', '高波动', '边界校准', '情绪感知'],
  DEFENSIVE_COUNTER: ['边界回稳', '耐心等待', '低频高效', '信息积累'],
  SLOW_OBSERVER: ['延迟响应', '信息导向', '节奏观察', '稳定输出'],
  EMOTIONAL_SWING: ['情绪敏感', '状态波动', '惯性影响', '需调节奏']
};

function resolveMbti(mbti) {
  if (!mbti || !mbti.mbtiCode || !MBTI_MAP[mbti.mbtiCode]) return mbti;
  var info = MBTI_MAP[mbti.mbtiCode];
  return sanitizeMirrorObject(Object.assign({}, mbti, { mbtiType: info.type, mbtiTitle: info.title }));
}

/**
 * 由 mirrorPhase 派生视图 boolean，WXML 中直接使用，避免复杂表达式。
 */
function deriveViewFlags(phase) {
  return {
    isInitialLoading: phase === 'initial_loading',
    calibrationVisible: phase === 'calibration_entering' || phase === 'calibrating' || phase === 'submitting_calibration',
    calibrationEntering: phase === 'calibration_entering',
    calibrationSubmitting: phase === 'submitting_calibration',
    mainDimmed: phase === 'calibration_entering' || phase === 'calibrating' || phase === 'submitting_calibration',
    cardOverlayVisible: phase === 'card_scanning' || phase === 'card_preview',
    isCardPreview: phase === 'card_preview',
    isQuickSyncing: phase === 'quick_syncing',
    isSilentSyncing: phase === 'silent_syncing',
    mainVisible: phase === 'main' || phase === 'silent_syncing' || phase === 'quick_syncing' || phase === 'card_scanning' || phase === 'card_preview'
  };
}

Page({
  data: {
    // 核心阶段状态机
    mirrorPhase: 'initial_loading',
    // 派生视图标志
    isInitialLoading: true,
    calibrationVisible: false,
    calibrationEntering: false,
    calibrationSubmitting: false,
    mainDimmed: false,
    cardOverlayVisible: false,
    isCardPreview: false,
    isQuickSyncing: false,
    isSilentSyncing: false,
    mainVisible: false,

    reduceMotion: false,
    animationEnabled: true,
    loadedOnce: false,

    // 入场动画
    headerOpacity: 0,
    heroOpacity: 0,
    sectionsOpacity: 0,

    // 舱位状态 Tab
    bayStatusState: 'starting',
    bayStatusText: '全息舱启动中',

    // 人格协议
    mbti: {
      calibrated: false,
      mbtiType: '',
      mbtiTitle: '',
      confidence: 0,
      mbtiSource: '',
      calibratedAt: ''
    },
    traits: [],
    syncActive: false,

    // 镜像投影
    battlePersona: {
      generated: false,
      sampleSize: 0,
      tag: 'INSUFFICIENT_DATA',
      title: '航迹样本不足',
      summary: ''
    },
    radarDimensions: [
      { key: 'aggression', label: '推进倾向', value: 0, desc: '' },
      { key: 'stability', label: '舰体稳定', value: 0, desc: '' },
      { key: 'participation', label: '接入频率', value: 0, desc: '' },
      { key: 'comeback', label: '回稳能力', value: 0, desc: '' },
      { key: 'dominance', label: '场域控制', value: 0, desc: '' }
    ],
    radarLocked: true,

    // 协议一致率
    personaConfidence: 0,

    // 协议偏移
    personaMatch: {
      available: false,
      matchPercentage: 0,
      prediction: '',
      actualSummary: '',
      summary: '',
      inferredMbtiType: '',
      inferredMbtiTitle: '',
      deviationPercent: 0
    },
    personaMatchDisplay: '待计算',
    personaMatchDisplayPending: true,

    // 系统判读
    reading: {
      available: false,
      text: '',
      observation: '',
      deviation: '',
      risk: '',
      growthAdvice: ''
    },

    // 信号标签
    personaSignals: [],

    // 协议演化
    evolution: [],

    // 协议分析折叠
    analysisExpanded: false,

    // 弹窗控制
    showMbtiPicker: false,
    showExitConfirm: false,

    // 校准进度
    calibrationProgress: '01 / 20',
    calibrationSubmitStep: 0,
    calibrationSubmitStepViews: [
      { text: '协议写入中', status: 'pending' },
      { text: '读取航迹样本', status: 'pending' },
      { text: '生成镜像投影', status: 'pending' },
      { text: '镜像投影已稳定', status: 'pending' }
    ],
    calibrationError: '',

    // 快速接入
    pickerSyncState: 'idle',
    pickerError: '',

    // 舰员身份
    crewProfile: {
      userId: '',
      nickname: '',
      avatarUrl: '',
      displayName: '未命名航船'
    },

    // 生成镜像卡
    cardError: '',
    cardTempPath: '',
    cardScanStep: 0,
    cardScanStepViews: [
      { text: '读取人格协议', status: 'pending' },
      { text: '接入识别徽标', status: 'pending' },
      { text: '封装镜像档案', status: 'pending' }
    ],
    showPermDialog: false,
    generatedAt: '',

    // 航迹档案摘要
    bbSampleCount: 0,
    bbRecentRoom: '--',
    bbRecentTime: '--'
  },

  onLoad() {
    var animEnabled = app.globalData.animationEnabled !== false;
    this.setData({ animationEnabled: animEnabled, reduceMotion: !animEnabled });
    this._toastRef = null;
    this._entryTimers = [];
    this._calibrationTimers = [];
    this._cardTimers = [];
    this._profileRunId = 0;
    this._calibrationRunId = 0;
    this._cardRunId = 0;
    this._unloaded = false;
    this._lastProfileLoadAt = 0;
    this._generatedAt = this._formatDate();
    this._loadProfile({ initial: true, reason: 'onLoad' });
    this._loadCrewProfile();
  },

  onUnload() {
    this._unloaded = true;
    this._cardRunId++;
    this._profileRunId++;
    this._clearAllTimers();
    this._showCustomTabBar();
    wx.hideLoading();
  },

  onHide() {
    this._clearAllTimers();
    this._showCustomTabBar();
    wx.hideLoading();
  },

  onReady() {
    this._toastRef = this.selectComponent('#srToast');
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    getApp().globalData.activeTabKey = 'holo'
    if (!this.data.loadedOnce) return;
    // 距离上次刷新 < 30s 不刷新
    var now = Date.now();
    if (now - this._lastProfileLoadAt < 30000) return;
    this._loadProfile({ silent: true, reason: 'onShow' });
  },

  _showToast(text, type, duration) {
    if (this._toastRef) {
      this._toastRef.show(text, type, duration);
    }
  },

  _clearAllTimers() {
    this._clearTimerGroup(this._entryTimers);
    this._clearTimerGroup(this._calibrationTimers);
    this._clearTimerGroup(this._cardTimers);
  },

  _clearTimerGroup(timers) {
    if (!timers) return;
    for (var i = 0; i < timers.length; i++) {
      clearTimeout(timers[i]);
    }
    timers.length = 0;
  },

  _delayCalibration(ms) {
    var self = this;
    return new Promise(function (resolve) {
      var t = setTimeout(function () {
        resolve();
      }, ms);
      self._calibrationTimers.push(t);
    });
  },

  _isMotionEnabled() {
    return app.globalData.animationEnabled !== false && this.data.reduceMotion !== true;
  },

  _playEntryAnimation() {
    if (!this._isMotionEnabled()) {
      this.setData({ headerOpacity: 1, heroOpacity: 1, sectionsOpacity: 1 });
      return;
    }
    var self = this;
    this._clearTimerGroup(this._entryTimers);
    var t1 = setTimeout(function () { self.setData({ headerOpacity: 1 }); }, 120);
    var t2 = setTimeout(function () { self.setData({ heroOpacity: 1 }); }, 240);
    var t3 = setTimeout(function () { self.setData({ sectionsOpacity: 1 }); }, 600);
    this._entryTimers.push(t1, t2, t3);
  },

  _formatDate() {
    var now = new Date();
    return now.getFullYear() + '.'
      + String(now.getMonth() + 1).padStart(2, '0') + '.'
      + String(now.getDate()).padStart(2, '0');
  },

  noop() {},

  toggleAnalysis() {
    this.setData({ analysisExpanded: !this.data.analysisExpanded });
  },

  _hideCustomTabBar() {
    // 只使用自定义 tabbar 的方法，不要用 wx.hideTabBar
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden: true });
    }
  },

  _showCustomTabBar() {
    // 只使用自定义 tabbar 的方法，不要用 wx.showTabBar
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden: false, selected: 2 });
    }
  },

  // ==================== 数据加载 ====================

  /**
   * 统一加载入口。options: { initial, silent, reason }
   * initial: 首次进入，显示 skeleton
   * silent: 后台刷新，不闪烁
   */
  async _loadProfile(options) {
    var opts = options || {};
    var initial = opts.initial === true;
    var silent = opts.silent === true;

    if (initial) {
      this.setData({
        mirrorPhase: 'initial_loading',
        bayStatusState: 'starting',
        bayStatusText: '全息舱启动中',
        ...deriveViewFlags('initial_loading')
      });
    } else if (!silent) {
      // 非静默非首次：轻量状态
      this.setData({
        isSilentSyncing: true,
        bayStatusState: 'starting',
        bayStatusText: '全息舱启动中'
      });
    }

    var runId = ++this._profileRunId;

    try {
      var results = await Promise.allSettled([
        this._fetchMirrorBundle(),
        this._fetchCrewProfile(),
        this._fetchBlackboxSummary()
      ]);

      var viewState = results[0].status === 'fulfilled' ? results[0].value : null;
      if (!viewState) throw new Error('mirror bundle failed');

      var crewState = results[1].status === 'fulfilled' ? results[1].value : null;
      var bbState = results[2].status === 'fulfilled' ? results[2].value : null;

      if (runId !== this._profileRunId || this._unloaded) return;

      this._lastProfileLoadAt = Date.now();

      var crewData = crewState ? { crewProfile: crewState } : {};
      var bbData = bbState || {};

      if (initial) {
        this.setData({
          ...viewState,
          ...crewData,
          ...bbData,
          mirrorPhase: 'main',
          ...deriveViewFlags('main'),
          loadedOnce: true
        });
        this._playEntryAnimation();
      } else {
        this.setData({
          ...viewState,
          ...crewData,
          ...bbData,
          loadedOnce: true
        });
      }
    } catch (e) {
      if (runId !== this._profileRunId || this._unloaded) return;
      if (initial) {
        this.setData({
          mirrorPhase: 'main',
          ...deriveViewFlags('main'),
          loadedOnce: true
        });
      }
      this._showToast('镜像数据加载失败', 'dot-error');
    }
  },

  /**
   * 并行获取 profile + stats，一次整理成完整 viewState。
   */
  async _fetchMirrorBundle() {
    var results = await Promise.allSettled([
      api.getMirrorProfile(),
      api.getMirrorStats()
    ]);

    var profileResult = results[0];
    var statsResult = results[1];

    return this._buildMirrorViewState(profileResult, statsResult);
  },

  /**
   * 将 profile 和 stats 结果整理为一次 setData 的 viewState。
   */
  _buildMirrorViewState(profileResult, statsResult) {
    // profile 必须成功
    if (profileResult.status === 'rejected') {
      throw profileResult.reason || new Error('profile failed');
    }

    var res = profileResult.value;
    var mbti = resolveMbti(res.mbti) || this.data.mbti;
    if (mbti.calibratedAt && mbti.calibratedAt.length > 10) {
      mbti = Object.assign({}, mbti, {
        updatedAtShort: mbti.calibratedAt.substring(11)
      });
    }

    var traits = (res.traits && res.traits.length > 0)
      ? res.traits
      : (mbti.mbtiType ? (MBTI_TRAITS[mbti.mbtiType] || []) : []);
    traits = traits.map(sanitizeMirrorText);

    var battle = sanitizeMirrorObject(res.battlePersona || this.data.battlePersona);
    var personaConfidence = res.personaConfidence || 0;
    var sampleSize = battle.sampleSize || 0;

    var reading = sanitizeMirrorObject(res.reading || this.data.reading);
    if (reading.available && !reading.observation && reading.text) {
      reading = Object.assign({}, reading, { observation: reading.text });
    }
    if (mbti.calibrated && sampleSize === 0) {
      reading = {
        available: true,
        text: '协议已接入，航迹样本不足，等待后续封存写入。',
        observation: '协议已接入，航迹样本不足，等待后续封存写入。',
        deviation: '',
        risk: '',
        growthAdvice: ''
      };
    }

    var signals = this._calcSignalTags(battle, traits);
    var evolution = res.evolution || [];

    var bayStatusState = 'online';
    var bayStatusText = '全息舱已接入';
    if (!mbti.calibrated) {
      bayStatusState = 'standby';
      bayStatusText = '全息舱待机中';
    } else if (battle.sampleSize < 3) {
      bayStatusState = 'starting';
      bayStatusText = '全息舱启动中';
    }

    // stats 可能失败，降级处理
    var radarDimensions = this.data.radarDimensions;
    var radarLocked = true;
    var personaMatch = sanitizeMirrorObject(res.personaMatch || this.data.personaMatch);
    var personaMatchPending = sampleSize === 0 || !personaMatch.available;
    var matchPct = personaMatch.matchPercentage || 0;
    var personaMatchDisplay = (personaMatchPending || matchPct <= 0) ? '待计算' : (matchPct + '%');

    if (statsResult.status === 'fulfilled' && statsResult.value) {
      var statsRes = statsResult.value;
      var dims = sampleSize >= 3 ? (statsRes.dimensions || []) : [];
      var labelMap = {
        aggression: '推进倾向',
        stability: '舰体稳定',
        participation: '接入频率',
        comeback: '回稳能力',
        dominance: '场域控制'
      };
      var normalized = dims.map(function (item) {
        return Object.assign({}, item, {
          label: labelMap[item.key] || item.label
        });
      });
      if (normalized.length > 0) {
        radarDimensions = normalized;
      }
      radarLocked = sampleSize < 3;
    }

    return {
      mbti: mbti,
      traits: traits,
      syncActive: mbti.calibrated,
      battlePersona: battle,
      personaMatch: personaMatch,
      personaMatchDisplay: personaMatchDisplay,
      personaMatchDisplayPending: personaMatchPending,
      reading: reading,
      personaConfidence: personaConfidence,
      personaSignals: signals,
      evolution: evolution,
      generatedAt: this._generatedAt,
      bayStatusState: bayStatusState,
      bayStatusText: bayStatusText,
      radarDimensions: radarDimensions,
      radarLocked: radarLocked,
      needRefresh: false,
      isSilentSyncing: false
    };
  },

  // 计算信号关键词标签
  _calcSignalTags(battle, traits) {
    if (!battle || !battle.generated) {
      return traits && traits.length > 0 ? traits.slice(0, 4) : [];
    }
    var tag = battle.tag || 'STABLE_CONTROL';
    var signalTags = PERSONA_SIGNAL_MAP[tag] || [];
    var all = signalTags.concat(traits || []);
    var unique = [];
    var seen = {};
    for (var i = 0; i < all.length; i++) {
      var item = sanitizeMirrorText(all[i]);
      if (!seen[item]) {
        seen[item] = true;
        unique.push(item);
      }
    }
    return unique.slice(0, 5);
  },

  // ==================== 舰员身份 ====================

  async _loadCrewProfile() {
    try {
      var crew = await this._fetchCrewProfile();
      if (this._unloaded) return;
      this.setData({ crewProfile: crew });
    } catch (e) {
      // 静默失败，使用默认值
    }
  },

  async _fetchCrewProfile() {
    // 多来源读取用户信息，确保和身份页一致
    var nickname = '';
    var avatarUrl = '';
    var userId = app.globalData.userId || '';

    // 来源 1: globalData.userInfo
    var cached = app.globalData.userInfo;
    if (cached) {
      nickname = cached.nickname || cached.nickName || '';
      avatarUrl = cached.avatarUrl || cached.avatar || '';
    }

    // 来源 2: storage（可能比 globalData 更新）
    if (!nickname || !avatarUrl) {
      try {
        var stored = wx.getStorageSync('userInfo') || wx.getStorageSync('user_info') || wx.getStorageSync('profile');
        if (stored) {
          nickname = nickname || stored.nickname || stored.nickName || stored.displayName || '';
          avatarUrl = avatarUrl || stored.avatarUrl || stored.avatar || stored.headUrl || '';
        }
      } catch (e) { /* ignore */ }
    }

    // 来源 3: API（兜底）
    if (!nickname || !avatarUrl) {
      try {
        var user = await api.getCurrentUser();
        if (user) {
          nickname = nickname || user.nickname || user.nickName || '';
          var rawAvatar = user.avatarUrl || user.avatar || user.headUrl || '';
          avatarUrl = avatarUrl || rawAvatar;
          userId = userId || String(user.userId || user.id || '');
          // 回写缓存
          app.updateUserInfo({ nickname: nickname, avatarUrl: rawAvatar });
        }
      } catch (e) {
        // API 失败，使用已有缓存
      }
    }

    avatarUrl = normalizeAvatarUrl(avatarUrl);
    var displayName = sanitizeCrewName(nickname);

    return {
      userId: userId,
      nickname: nickname,
      avatarUrl: avatarUrl,
      displayName: displayName
    };
  },

  async _ensureCrewProfile() {
    var crew = this.data.crewProfile;
    // displayName 有值即可用，userId 可能为空（缓存中未存）
    if (crew && crew.displayName && crew.displayName !== '未命名航船') return crew;
    try {
      var fresh = await this._fetchCrewProfile();
      if (this._unloaded) return crew;
      this.setData({ crewProfile: fresh });
      return fresh;
    } catch (e) {
      return crew;
    }
  },

  // ==================== 航迹档案摘要 ====================

  async _fetchBlackboxSummary() {
    try {
      var resp = await scoreService.getYieldLog();
      if (!resp) return null;
      var records = resp.records || [];
      var sampleCount = Number(resp.sampleCount) || 0;
      var recentRoom = '--';
      var recentTime = '--';
      if (records.length > 0) {
        var latest = records[0];
        recentRoom = latest.roomNo || latest.roomId || '--';
        if (typeof recentRoom === 'number') recentRoom = String(recentRoom);
        var dateSrc = latest.settledAt || latest.createdAt;
        if (dateSrc) {
          var dateStr = String(dateSrc).replace(/-/g, '/').replace('T', ' ');
          // Handle '2026.06.11' format if any
          dateStr = dateStr.replace(/\./g, '/');
          var t = new Date(dateStr);
          if (!isNaN(t.getTime())) {
            var m = t.getMonth() + 1;
            var d = t.getDate();
            var hh = String(t.getHours()).padStart(2, '0');
            var mm = String(t.getMinutes()).padStart(2, '0');
            recentTime = m + '/' + d + ' ' + hh + ':' + mm;
          }
        }
      }
      return { bbSampleCount: sampleCount, bbRecentRoom: recentRoom, bbRecentTime: recentTime };
    } catch (e) {
      return null;
    }
  },

  // ==================== 同步人格 ====================

  async refreshProfile() {
    vibrateShort('light');
    var runId = ++this._profileRunId;
    this.setData({ isSilentSyncing: true });
    wx.showLoading({ title: '同步中' });
    try {
      var res = await api.refreshMirrorProfile();
      if (runId !== this._profileRunId || this._unloaded) return;

      var viewState = this._buildMirrorViewState(
        { status: 'fulfilled', value: res },
        { status: 'rejected', reason: null }
      );
      this.setData({ ...viewState, isSilentSyncing: false });
      this._showToast('协议参数已写入镜像', 'dot-sync');
    } catch (e) {
      if (runId !== this._profileRunId || this._unloaded) return;
      this.setData({ isSilentSyncing: false });
      this._showToast('协议同步失败，请重试', 'dot-error');
    } finally {
      wx.hideLoading();
    }
  },

  // ==================== 校准流程 ====================

  startFullCalibration() {
    vibrateShort('light');
    this._hideCustomTabBar();
    if (this._isMotionEnabled()) {
      // 进入过渡：主页面暗化，校准层从核心展开
      this.setData({
        mirrorPhase: 'calibration_entering',
        ...deriveViewFlags('calibration_entering')
      });
      var self = this;
      var t = setTimeout(function () {
        self.setData({
          mirrorPhase: 'calibrating',
          ...deriveViewFlags('calibrating')
        });
      }, 220);
      this._calibrationTimers.push(t);
    } else {
      this.setData({
        mirrorPhase: 'calibrating',
        ...deriveViewFlags('calibrating')
      });
    }
  },

  closeMbtiTest() {
    this.setData({ showExitConfirm: true });
  },

  onExitConfirm() {
    this._exitCalibration();
  },

  onExitCancel() {
    this.setData({ showExitConfirm: false });
  },

  _exitCalibration() {
    this._showCustomTabBar();
    this.setData({ showExitConfirm: false });
    if (this._isMotionEnabled()) {
      // 校准层淡出
      this.setData({
        mirrorPhase: 'calibration_entering',
        ...deriveViewFlags('calibration_entering')
      });
      var self = this;
      var t = setTimeout(function () {
        self.setData({
          mirrorPhase: 'main',
          ...deriveViewFlags('main'),
          calibrationError: ''
        });
      }, 200);
      this._calibrationTimers.push(t);
    } else {
      this.setData({
        mirrorPhase: 'main',
        ...deriveViewFlags('main'),
        calibrationError: ''
      });
    }
  },

  async handleMbtiComplete(e) {
    var detail = e.detail;
    var runId = ++this._calibrationRunId;
    var self = this;

    this.setData({
      mirrorPhase: 'submitting_calibration',
      ...deriveViewFlags('submitting_calibration'),
      calibrationSubmitStep: 1,
      calibrationSubmitStepViews: this._buildCalibrationSubmitSteps(1),
      calibrationError: ''
    });

    try {
      await api.submitMbtiTest({ testVersion: detail.testVersion, answers: detail.answers });

      if (runId !== this._calibrationRunId || self._unloaded) return;
      this.setData({
        calibrationSubmitStep: 2,
        calibrationSubmitStepViews: this._buildCalibrationSubmitSteps(2)
      });

      // 并行拉取 profile + stats
      var viewState = await this._fetchMirrorBundle();

      if (runId !== this._calibrationRunId || self._unloaded) return;
      this.setData({
        calibrationSubmitStep: 3,
        calibrationSubmitStepViews: this._buildCalibrationSubmitSteps(3)
      });

      // 短暂展示"生成镜像投影"步骤后切到稳定态
      await this._delayCalibration(self._isMotionEnabled() ? 600 : 0);

      if (runId !== this._calibrationRunId || self._unloaded) return;
      this.setData({
        calibrationSubmitStep: 4,
        calibrationSubmitStepViews: this._buildCalibrationSubmitSteps(4)
      });

      // 短暂展示"已稳定"后回到主页面
      await this._delayCalibration(self._isMotionEnabled() ? 500 : 0);

      if (runId !== this._calibrationRunId || self._unloaded) return;
      this.setData({
        ...viewState,
        mirrorPhase: 'main',
        ...deriveViewFlags('main'),
        calibrationError: ''
      });
      this._showCustomTabBar();
      this._showToast('校准已完成', 'dot-sync');
    } catch (err) {
      if (runId !== this._calibrationRunId || self._unloaded) return;
      this._showToast('校准失败，请稍后重试', 'dot-error');
      this.setData({
        mirrorPhase: 'calibrating',
        ...deriveViewFlags('calibrating'),
        calibrationError: '校准失败，请稍后重试'
      });
    }
  },

  _buildCalibrationSubmitSteps(step) {
    var steps = [
      { text: '协议写入中', key: 'write' },
      { text: '读取航迹样本', key: 'read' },
      { text: '生成镜像投影', key: 'generate' },
      { text: '镜像投影已稳定', key: 'stable' }
    ];
    return steps.map(function (s, i) {
      var status = 'pending';
      if (step > i + 1) status = 'done';
      else if (step === i + 1) status = 'active';
      return { text: s.text, status: status };
    });
  },

  // ==================== 快速接入 ====================

  openMbtiPicker() {
    this.setData({ showMbtiPicker: true, pickerSyncState: 'idle', pickerError: '' });
  },

  closeMbtiPicker() {
    this.setData({ showMbtiPicker: false, pickerSyncState: 'idle', pickerError: '' });
  },

  async handleMbtiDirectInput(e) {
    var runId = ++this._profileRunId;

    this.setData({
      pickerSyncState: 'syncing',
      pickerError: '',
      mirrorPhase: 'quick_syncing',
      bayStatusState: 'starting',
      bayStatusText: '全息舱启动中'
    });

    try {
      await api.submitMbtiDirect({ mbtiCode: e.detail.mbtiCode });

      if (runId !== this._profileRunId || this._unloaded) return;

      // 并行拉取 profile + stats
      var viewState = await this._fetchMirrorBundle();

      if (runId !== this._profileRunId || this._unloaded) return;

      this.setData({
        ...viewState,
        pickerSyncState: 'success',
        mirrorPhase: 'main',
        ...deriveViewFlags('main')
      });

      // 300ms 后关闭弹窗
      var self = this;
      var t = setTimeout(function () {
        if (self._unloaded) return;
        self.setData({ showMbtiPicker: false, pickerSyncState: 'idle' });
      }, 300);
      this._entryTimers.push(t);

      this._showToast('协议已同步', 'dot-sync');
    } catch (err) {
      if (runId !== this._profileRunId || this._unloaded) return;
      this.setData({
        pickerSyncState: 'error',
        pickerError: '同步失败，请重试',
        mirrorPhase: 'main',
        ...deriveViewFlags('main')
      });
    }
  },

  // ==================== 镜像卡生成 ====================

  _buildScanStepViews(step) {
    var steps = [
      { text: '读取人格协议', key: 'protocol' },
      { text: '接入识别徽标', key: 'helmet' },
      { text: '封装镜像档案', key: 'package' }
    ];
    return steps.map(function (s, i) {
      var status = 'pending';
      if (step > i + 1) status = 'done';
      else if (step === i + 1) status = 'active';
      return { text: s.text, status: status };
    });
  },

  generateDossier() {
    vibrateShort('light');
    if (this.data.mirrorPhase === 'card_scanning' || this.data.mirrorPhase === 'card_preview') return;
    this._clearTimerGroup(this._cardTimers);

    var runId = ++this._cardRunId;

    this.setData({
      mirrorPhase: 'card_scanning',
      ...deriveViewFlags('card_scanning'),
      cardScanStep: 0,
      cardScanStepViews: this._buildScanStepViews(0),
      cardError: ''
    });

    var self = this;

    if (!this._isMotionEnabled()) {
      this.setData({ cardScanStep: 3, cardScanStepViews: this._buildScanStepViews(3) });
      this._doDrawCard(runId);
      return;
    }

    var t1 = setTimeout(function () {
      if (runId !== self._cardRunId || self._unloaded) return;
      self.setData({ cardScanStep: 1, cardScanStepViews: self._buildScanStepViews(1) });
    }, 400);
    var t2 = setTimeout(function () {
      if (runId !== self._cardRunId || self._unloaded) return;
      self.setData({ cardScanStep: 2, cardScanStepViews: self._buildScanStepViews(2) });
    }, 900);
    var t3 = setTimeout(function () {
      if (runId !== self._cardRunId || self._unloaded) return;
      self.setData({ cardScanStep: 3, cardScanStepViews: self._buildScanStepViews(3) });
      self._doDrawCard(runId);
    }, 1500);
    this._cardTimers.push(t1, t2, t3);
  },

  async _doDrawCard(runId) {
    try {
      var crew = await this._ensureCrewProfile();
      console.log('[mirror-card] _doDrawCard crew:', JSON.stringify({
        userId: crew.userId,
        nickname: crew.nickname,
        displayName: crew.displayName,
        avatarUrl: crew.avatarUrl ? crew.avatarUrl.substring(0, 80) : ''
      }));
      if (runId !== this._cardRunId || this._unloaded) return;

      var avatarTempPath = await this._prepareAvatarForCanvas(crew.avatarUrl);
      console.log('[mirror-card] avatarTempPath:', avatarTempPath ? avatarTempPath.substring(0, 80) : '(empty)');
      if (runId !== this._cardRunId || this._unloaded) return;

      var path = await this._drawPersonaCard({
        crewProfile: {
          userId: crew.userId,
          nickname: crew.nickname,
          avatarUrl: crew.avatarUrl,
          avatarTempPath: avatarTempPath,
          displayName: crew.displayName
        }
      });
      if (runId !== this._cardRunId || this._unloaded) return;
      this.setData({
        cardTempPath: path,
        mirrorPhase: 'card_preview',
        ...deriveViewFlags('card_preview')
      });
    } catch (e) {
      if (runId !== this._cardRunId || this._unloaded) return;
      this.setData({
        mirrorPhase: 'main',
        ...deriveViewFlags('main'),
        cardError: '镜像图片生成失败'
      });
      this._showToast('镜像图片生成失败，请稍后重试', 'dot-error');
    }
  },

  retryCard() {
    this.generateDossier();
  },

  closeCardPreview() {
    this.setData({
      cardTempPath: '',
      mirrorPhase: 'main',
      ...deriveViewFlags('main')
    });
  },

  closeCardError() {
    this.setData({
      cardError: '',
      mirrorPhase: 'main',
      ...deriveViewFlags('main')
    });
  },

  // ==================== Canvas 绘制 ====================

  _prepareAvatarForCanvas(avatarUrl) {
    return new Promise(function (resolve) {
      var url = normalizeAvatarUrl(avatarUrl);
      if (!url) {
        resolve('');
        return;
      }
      // base64 不支持 Canvas 绘制
      if (url.indexOf('data:image') === 0) {
        resolve('');
        return;
      }
      // 本地临时文件直接使用
      if (url.indexOf('wxfile://') === 0 || url.indexOf('http://tmp/') === 0 || url[0] === '/') {
        resolve(url);
        return;
      }
      // 远程 URL：优先 getImageInfo（返回本地路径），失败后 downloadFile 兜底
      wx.getImageInfo({
        src: url,
        success: function (info) {
          if (info && info.path) {
            resolve(info.path);
          } else {
            resolve('');
          }
        },
        fail: function () {
          wx.downloadFile({
            url: url,
            success: function (res) {
              if (res.statusCode === 200 && res.tempFilePath) {
                resolve(res.tempFilePath);
              } else {
                resolve('');
              }
            },
            fail: function () {
              resolve('');
            }
          });
        }
      });
    });
  },

  _loadCanvasImage(canvas, src) {
    return new Promise(function (resolve) {
      if (!src) {
        resolve(null);
        return;
      }
      var img = canvas.createImage();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  },

  async _drawPersonaCard(options) {
    var opts = options || {};
    var self = this;
    return new Promise(function (resolve, reject) {
      var query = wx.createSelectorQuery().in(self);
      query.select('#personaCardCanvas')
        .fields({ node: true, size: true })
        .exec(async function (res) {
          if (!res || !res[0]) {
            reject(new Error('canvas not found'));
            return;
          }

          var canvas = res[0].node;
          var ctx = canvas.getContext('2d');
          var dpr = wx.getSystemInfoSync().pixelRatio || 2;
          var W = 750;
          var H = 1200;

          canvas.width = W * dpr;
          canvas.height = H * dpr;
          ctx.scale(dpr, dpr);

          // 预加载头像图片
          var crew = opts.crewProfile || {};
          console.log('[mirror-card] crew profile:', JSON.stringify({
            userId: crew.userId,
            nickname: crew.nickname,
            displayName: crew.displayName,
            avatarUrl: crew.avatarUrl ? crew.avatarUrl.substring(0, 60) : '',
            avatarTempPath: crew.avatarTempPath ? crew.avatarTempPath.substring(0, 60) : ''
          }));
          var avatarImg = await self._loadCanvasImage(canvas, crew.avatarTempPath);
          console.log('[mirror-card] avatarImg loaded:', !!avatarImg);

          self._drawBg(ctx, W, H);
          self._drawCrewIdentity(ctx, W, H, crew, avatarImg);
          self._drawContent(ctx, W, H);

          wx.canvasToTempFilePath({
            canvas: canvas,
            x: 0,
            y: 0,
            width: W,
            height: H,
            destWidth: W * dpr,
            destHeight: H * dpr,
            success: function (fileRes) {
              resolve(fileRes.tempFilePath);
            },
            fail: reject
          }, self);
        });
    });
  },

  _drawBg(ctx, W, H) {
    ctx.fillStyle = '#0A0A0A';
    ctx.fillRect(0, 0, W, H);

    var grad = ctx.createRadialGradient(W / 2, 200, 0, W / 2, 200, 480);
    grad.addColorStop(0, 'rgba(0,200,255,0.10)');
    grad.addColorStop(0.6, 'rgba(10,132,255,0.06)');
    grad.addColorStop(1, 'rgba(10,132,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    var seed = W * 7 + H * 13;
    for (var i = 0; i < 30; i++) {
      seed = (seed * 16807 + 7) % 2147483647;
      var sx = (seed % 1000) / 1000;
      seed = (seed * 16807 + 7) % 2147483647;
      var sy = (seed % 1000) / 1000;
      seed = (seed * 16807 + 7) % 2147483647;
      var sb = 0.3 + (seed % 1000) / 1000 * 0.7;
      ctx.beginPath();
      ctx.arc(sx * W, sy * H, 0.5 + sb * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200, 220, 255, ' + (0.06 + sb * 0.10) + ')';
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(10,132,255,0.28)';
    ctx.lineWidth = 2;
    this._roundRect(ctx, 44, 44, W - 88, H - 88, 28);
    ctx.stroke();

    var cornerLen = 24;
    ctx.strokeStyle = 'rgba(0,200,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(44, 44 + cornerLen); ctx.lineTo(44, 44); ctx.lineTo(44 + cornerLen, 44); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W - 44 - cornerLen, 44); ctx.lineTo(W - 44, 44); ctx.lineTo(W - 44, 44 + cornerLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(44, H - 44 - cornerLen); ctx.lineTo(44, H - 44); ctx.lineTo(44 + cornerLen, H - 44); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W - 44 - cornerLen, H - 44); ctx.lineTo(W - 44, H - 44); ctx.lineTo(W - 44, H - 44 - cornerLen); ctx.stroke();

    ctx.strokeStyle = 'rgba(0,200,255,0.02)';
    ctx.lineWidth = 1;
    for (var y = 76; y < H - 76; y += 4) {
      ctx.beginPath();
      ctx.moveTo(60, y);
      ctx.lineTo(W - 60, y);
      ctx.stroke();
    }
  },

  _drawCrewIdentity(ctx, W, H, crew, avatarImg) {
    var displayName = sanitizeCrewName(crew.displayName || crew.nickname) || '未命名航船';
    var avatarSize = 72;
    var padL = 72;
    var x = padL;
    var y = 112;
    var barW = W - padL * 2;
    var barH = avatarSize + 28;
    var barX = x - 14;
    var barY = y - 14;

    console.log('[mirror-card] drawing identity:', displayName, 'avatar:', !!avatarImg);

    // 身份条背景 — 使用 fillRect 确保可见
    ctx.fillStyle = 'rgba(3,10,18,0.72)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = 'rgba(0,200,255,0.24)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // 头像
    if (avatarImg) {
      this._drawCircularAvatar(ctx, avatarImg, x, y, avatarSize);
    } else {
      this._drawAvatarFallback(ctx, x, y, avatarSize, displayName);
    }

    // 舰员代号
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = 'bold 30px sans-serif';
    var nameX = x + avatarSize + 24;
    var maxNameW = W - padL - nameX - 40;
    ctx.fillText(truncateCanvasText(ctx, displayName, maxNameW), nameX, y + 30);

    // 副标 IDENTITY
    ctx.fillStyle = 'rgba(0,200,255,0.58)';
    ctx.font = '16px sans-serif';
    this._fillLetterSpaced(ctx, 'IDENTITY', nameX, y + 58);

    // 状态点
    ctx.beginPath();
    ctx.arc(W - padL - 20, y + avatarSize / 2, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#30D158';
    ctx.fill();
  },

  _drawCircularAvatar(ctx, img, x, y, size) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,200,255,0.42)';
    ctx.lineWidth = 2;
    ctx.stroke();
  },

  _drawAvatarFallback(ctx, x, y, size, displayName) {
    var initial = (displayName || '舰').slice(0, 1);

    // 渐变圆背景
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    var grad = ctx.createRadialGradient(
      x + size / 2, y + size / 2, 0,
      x + size / 2, y + size / 2, size / 2
    );
    grad.addColorStop(0, 'rgba(0,200,255,0.28)');
    grad.addColorStop(1, 'rgba(10,132,255,0.08)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,200,255,0.42)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 首字占位
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, x + size / 2, y + size / 2 + 1);
    // 重置为 left/alphabetic，避免影响后续绘制
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  },

  _drawContent(ctx, W, H) {
    var d = this.data;
    var mbti = d.mbti || {};
    var battle = d.battlePersona || {};
    var reading = d.reading || {};
    var padL = 72;
    var contentW = W - padL * 2;
    var sampleSize = battle.sampleSize || 0;
    var radarLocked = d.radarLocked !== false && sampleSize < 3;

    // 重置文本状态，避免受 _drawCrewIdentity 影响
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // 顶部标识
    ctx.fillStyle = 'rgba(255,255,255,0.36)';
    ctx.font = '16px sans-serif';
    this._fillLetterSpaced(ctx, 'SPACE SCOREKEEPER', padL, 72);
    this._fillLetterSpacedRight(ctx, 'HOLO PROJECTION', W - padL, 72);

    // MBTI 核心
    var coreY = 280;
    ctx.fillStyle = '#00C8FF';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mbti.mbtiType || '----', W / 2, coreY);

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '32px sans-serif';
    ctx.fillText(sanitizeMirrorText(mbti.mbtiTitle || ''), W / 2, coreY + 52);
    ctx.textAlign = 'left';

    // 全息扫描区域
    var scanCenterX = W / 2;
    var scanCenterY = coreY + 170;
    var scanRadius = 100;
    var dims = d.radarDimensions || [];

    if (radarLocked) {
      // 样本不足：幽灵五边形 + 采集中提示
      this._drawRadarCollecting(ctx, scanCenterX, scanCenterY, scanRadius, sampleSize, 3);
    } else if (dims.length > 0) {
      // 样本充足：绘制完整雷达
      this._drawRadarFull(ctx, scanCenterX, scanCenterY, scanRadius, dims);
    }

    // 信息盒子
    var infoY = scanCenterY + scanRadius + 56;
    var infoBoxW = (contentW - 20) / 2;
    var infoBoxH = 72;

    this._roundRect(ctx, padL, infoY, infoBoxW, infoBoxH, 12);
    ctx.strokeStyle = 'rgba(10,132,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.font = '18px sans-serif';
    ctx.fillText('协议一致率', padL + 16, infoY + 28);
    ctx.fillStyle = '#00C8FF';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText((mbti.confidence || 0) + '%', padL + 16, infoY + 58);

    var infoRX = padL + infoBoxW + 20;
    this._roundRect(ctx, infoRX, infoY, infoBoxW, infoBoxH, 12);
    ctx.strokeStyle = 'rgba(10,132,255,0.18)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.font = '18px sans-serif';
    ctx.fillText('航迹样本', infoRX + 16, infoY + 28);
    ctx.fillStyle = '#00C8FF';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(sampleSize + ' / 3', infoRX + 16, infoY + 58);

    // 判读文字
    var readY = infoY + infoBoxH + 36;
    var readingText = this._buildReadingText(reading);
    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.font = '26px sans-serif';
    this._drawWrappedText(ctx, readingText, padL, readY, contentW, 38, 3);

    // 底部
    ctx.strokeStyle = 'rgba(10,132,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, H - 120);
    ctx.lineTo(W - padL, H - 120);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.36)';
    ctx.font = '18px sans-serif';
    ctx.fillText(d.generatedAt || '', padL, H - 80);

    ctx.fillStyle = 'rgba(10,132,255,0.42)';
    ctx.font = '16px sans-serif';
    this._fillLetterSpaced(ctx, 'SPACE SCOREKEEPER · HOLO BAY', padL, H - 50);
  },

  /**
   * 样本不足时绘制幽灵雷达 + 采集中提示
   */
  _drawRadarCollecting(ctx, cx, cy, radius, sampleSize, required) {
    var sides = 5;
    var startAngle = -Math.PI / 2;
    var remain = Math.max(0, required - sampleSize);

    // 幽灵网格
    var gridLevels = [0.33, 0.66, 1.0];
    for (var gi = 0; gi < gridLevels.length; gi++) {
      var gl = gridLevels[gi];
      ctx.beginPath();
      for (var si = 0; si < sides; si++) {
        var ga = startAngle + (Math.PI * 2 / sides) * si;
        var gx = cx + Math.cos(ga) * radius * gl;
        var gy = cy + Math.sin(ga) * radius * gl;
        if (si === 0) ctx.moveTo(gx, gy); else ctx.lineTo(gx, gy);
      }
      ctx.closePath();
      ctx.strokeStyle = gi === 2 ? 'rgba(0,200,255,0.12)' : 'rgba(0,200,255,0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 轴线
    for (var ai = 0; ai < sides; ai++) {
      var aa = startAngle + (Math.PI * 2 / sides) * ai;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(aa) * radius, cy + Math.sin(aa) * radius);
      ctx.strokeStyle = 'rgba(0,200,255,0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 幽灵五边形（虚线）
    ctx.beginPath();
    for (var di = 0; di < sides; di++) {
      var da = startAngle + (Math.PI * 2 / sides) * di;
      var dv = 0.45;
      var dx = cx + Math.cos(da) * radius * dv;
      var dy = cy + Math.sin(da) * radius * dv;
      if (di === 0) ctx.moveTo(dx, dy); else ctx.lineTo(dx, dy);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,200,255,0.03)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,200,255,0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 维度标签（幽灵态）
    var labelMap = ['推进倾向', '舰体稳定', '接入频率', '回稳能力', '场域控制'];
    for (var li = 0; li < sides; li++) {
      var la = startAngle + (Math.PI * 2 / sides) * li;
      var lr = radius + 32;
      var lx = cx + Math.cos(la) * lr;
      var ly = cy + Math.sin(la) * lr;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(0,200,255,0.28)';
      ctx.fillText(labelMap[li], lx, ly - 8);
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = 'rgba(0,200,255,0.22)';
      ctx.fillText('--', lx, ly + 10);
    }

    // 中心文字
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = 'rgba(0,200,255,0.62)';
    ctx.fillText('全息扫描中', cx, cy - 10);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(0,200,255,0.42)';
    ctx.fillText('航迹样本 ' + sampleSize + ' / ' + required, cx, cy + 10);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.fillText('还需 ' + remain + ' 次封存解锁完整扫描', cx, cy + 30);
  },

  /**
   * 样本充足时绘制完整雷达
   */
  _drawRadarFull(ctx, cx, cy, radius, dims) {
    var sides = 5;
    var startAngle = -Math.PI / 2;

    var gridLevels = [0.33, 0.66, 1.0];
    for (var gi = 0; gi < gridLevels.length; gi++) {
      var gl = gridLevels[gi];
      ctx.beginPath();
      for (var si = 0; si < sides; si++) {
        var ga = startAngle + (Math.PI * 2 / sides) * si;
        var gx = cx + Math.cos(ga) * radius * gl;
        var gy = cy + Math.sin(ga) * radius * gl;
        if (si === 0) ctx.moveTo(gx, gy); else ctx.lineTo(gx, gy);
      }
      ctx.closePath();
      ctx.strokeStyle = gi === 2 ? 'rgba(0,200,255,0.18)' : 'rgba(0,200,255,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (var ai = 0; ai < sides; ai++) {
      var aa = startAngle + (Math.PI * 2 / sides) * ai;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(aa) * radius, cy + Math.sin(aa) * radius);
      ctx.strokeStyle = 'rgba(0,200,255,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.beginPath();
    for (var di = 0; di < sides; di++) {
      var da = startAngle + (Math.PI * 2 / sides) * di;
      var dv = (dims[di] ? dims[di].value : 0) / 100;
      var dx = cx + Math.cos(da) * radius * dv;
      var dy = cy + Math.sin(da) * radius * dv;
      if (di === 0) ctx.moveTo(dx, dy); else ctx.lineTo(dx, dy);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,200,255,0.10)';
    ctx.fill();
    ctx.strokeStyle = '#00C8FF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    for (var ni = 0; ni < sides; ni++) {
      var na = startAngle + (Math.PI * 2 / sides) * ni;
      var nv = (dims[ni] ? dims[ni].value : 0) / 100;
      var nx = cx + Math.cos(na) * radius * nv;
      var ny = cy + Math.sin(na) * radius * nv;
      ctx.beginPath();
      ctx.arc(nx, ny, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00C8FF';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,200,255,0.60)';
    ctx.fill();
  },

  _buildReadingText(reading) {
    if (!reading || !reading.available) {
      return '暂无系统判读。完成更多对局后将生成更稳定的档案。';
    }
    var parts = [];
    if (reading.observation) parts.push(sanitizeMirrorText(reading.observation));
    if (reading.deviation) parts.push(sanitizeMirrorText(reading.deviation));
    if (reading.risk) parts.push(sanitizeMirrorText(reading.risk));
    if (reading.growthAdvice) parts.push(sanitizeMirrorText(reading.growthAdvice));
    if (parts.length === 0 && reading.text) parts.push(reading.text);
    return parts.length > 0
      ? parts.join('。')
      : '暂无系统判读。完成更多任务后将生成更稳定的档案。';
  },

  _fillLetterSpaced(ctx, text, x, y) {
    var chars = text.split('');
    var cx = x;
    for (var i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], cx, y);
      cx += ctx.measureText(chars[i]).width + 4;
    }
  },

  _fillLetterSpacedRight(ctx, text, x, y) {
    var chars = text.split('');
    var totalW = 0;
    for (var i = 0; i < chars.length; i++) {
      totalW += ctx.measureText(chars[i]).width + 4;
    }
    var cx = x - totalW;
    for (var j = 0; j < chars.length; j++) {
      ctx.fillText(chars[j], cx, y);
      cx += ctx.measureText(chars[j]).width + 4;
    }
  },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  _drawDivider(ctx, x, y, w) {
    ctx.strokeStyle = 'rgba(10,132,255,0.20)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
  },

  _drawWrappedText(ctx, text, x, y, maxW, lineH, maxLines) {
    var content = text || '';
    var line = '';
    var lineCount = 0;

    for (var i = 0; i < content.length; i++) {
      var ch = content[i];
      if (ch === '\n') {
        ctx.fillText(line, x, y);
        line = '';
        y += lineH;
        lineCount++;
        if (lineCount >= maxLines) return;
        continue;
      }

      if (ctx.measureText(line + ch).width > maxW && line.length > 0) {
        ctx.fillText(line, x, y);
        line = ch;
        y += lineH;
        lineCount++;
        if (lineCount >= maxLines) {
          ctx.fillText(line + '...', x, y);
          return;
        }
      } else {
        line += ch;
      }
    }

    if (line) {
      ctx.fillText(line, x, y);
    }
  },

  // ==================== 保存到相册 ====================

  saveCard() {
    var path = this.data.cardTempPath;
    if (!path) {
      this._showToast('请先生成镜像图片', 'dot-warn');
      return;
    }

    var self = this;
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success: function () {
        self._showToast('镜像图片已保存', 'dot-sync');
      },
      fail: function (err) {
        if (err.errMsg && err.errMsg.indexOf('auth deny') !== -1) {
          self.setData({ showPermDialog: true });
          return;
        }
        self._showToast('保存未完成，请稍后重试', 'dot-error');
      }
    });
  },

  onPermCancel() {
    this.setData({ showPermDialog: false });
  },

  onPermConfirm() {
    this.setData({ showPermDialog: false });
    wx.openSetting();
  },

  // ==================== 航迹回放 ====================

  goScoreRecords() {
    wx.navigateTo({ url: '/pages-ext/score-records/score-records' });
  },

  // ==================== 分享 ====================

  onShareAppMessage() {
    var mbti = this.data.mbti || {};
    var crew = this.data.crewProfile || {};
    var name = sanitizeCrewName(crew.displayName || crew.nickname);
    return {
      title: sanitizeMirrorText(name + '的镜像档案 · ' + (mbti.mbtiType || '--')),
      path: '/pages/mirror/index',
      imageUrl: this.data.cardTempPath || ''
    };
  }
});
