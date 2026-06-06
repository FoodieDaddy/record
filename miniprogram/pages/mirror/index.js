const api = require('../../utils/mirror-api');
const { MBTI_MAP, MBTI_TRAITS } = require('../../utils/mbti-const');
const app = getApp();

var ZERO_DIMS = [
  { key: 'aggression', label: '进攻性', value: 0, desc: '' },
  { key: 'stability', label: '稳定性', value: 0, desc: '' },
  { key: 'participation', label: '参局率', value: 0, desc: '' },
  { key: 'comeback', label: '回稳力', value: 0, desc: '' },
  { key: 'dominance', label: '控场力', value: 0, desc: '' }
];

const RADAR_DIMENSION_TEXT = {
  comeback: {
    label: '回稳力',
    desc: '基于低位波动后的修正能力。'
  }
};

function normalizeRadarDimensions(dimensions) {
  return (dimensions || ZERO_DIMS).map(item => {
    var override = RADAR_DIMENSION_TEXT[item.key];
    return override ? Object.assign({}, item, override) : item;
  });
}

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
  return Object.assign({}, mbti, { mbtiType: info.type, mbtiTitle: info.title });
}

Page({
  data: {
    loading: true,
    loadedOnce: false,
    reduceMotion: false,

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

    // 战绩镜像
    battlePersona: {
      generated: false,
      sampleSize: 0,
      tag: 'INSUFFICIENT_DATA',
      title: '样本不足',
      summary: ''
    },
    radarDimensions: ZERO_DIMS,
    radarLocked: true,

    // 人格可信度
    personaConfidence: 0,
    confidenceChecklist: [],

    // 人格偏差
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

    // 系统判读（结构化）
    reading: {
      available: false,
      text: '',
      observation: '',
      deviation: '',
      risk: '',
      growthAdvice: ''
    },

    // 人格信号（关键词标签）
    personaSignals: [],

    // 人格演化
    evolution: [],

    // 弹窗控制
    showSwipeTest: false,
    showMbtiPicker: false,
    showExitConfirm: false
  },

  onLoad() {
    var reduceMotion =
      !app.globalData.animationEnabled ||
      app.globalData.reduceMotion === true;
    this.setData({ reduceMotion: reduceMotion });
    this.loadProfile();
  },

  onShow() {
    if (this.data.loadedOnce && this.data.needRefresh) {
      this.loadProfile(true);
    }
  },

  async loadProfile(force) {
    if (this.data.loading && !force && this.data.loadedOnce) return;
    this.setData({ loading: true });

    try {
      var res = await api.getMirrorProfile();

      var mbti = resolveMbti(res.mbti) || this.data.mbti;
      if (mbti.calibratedAt && mbti.calibratedAt.length > 10) {
        mbti = Object.assign({}, mbti, {
          updatedAtShort: mbti.calibratedAt.substring(11)
        });
      }

      var traits = (res.traits && res.traits.length > 0)
        ? res.traits
        : (mbti.mbtiType ? (MBTI_TRAITS[mbti.mbtiType] || []) : []);

      // 战绩数据
      var battle = res.battlePersona || this.data.battlePersona;

      // 人格可信度
      var personaConfidence = res.personaConfidence || 0;
      var confidenceChecklist = [
        { label: 'MBTI校准', done: mbti.calibrated },
        { label: '3场封存', done: battle.sampleSize >= 3 },
        { label: '任务画像', done: battle.generated },
        { label: '基础数据', done: mbti.calibrated || battle.sampleSize > 0 }
      ];

      // 结构化判读（兼容旧格式）
      var reading = res.reading || this.data.reading;
      if (reading.available && !reading.observation && reading.text) {
        reading = Object.assign({}, reading, { observation: reading.text });
      }

      // 人格信号：关键词标签
      var signals = this._calcSignalTags(battle, traits);

      // 演化轨迹
      var evolution = res.evolution || [];

      this.setData({
        mbti: mbti,
        traits: traits,
        syncActive: mbti.calibrated,
        battlePersona: battle,
        personaMatch: res.personaMatch || this.data.personaMatch,
        reading: reading,
        personaConfidence: personaConfidence,
        confidenceChecklist: confidenceChecklist,
        personaSignals: signals,
        evolution: evolution,
        loading: false,
        loadedOnce: true,
        needRefresh: false
      });

      this.loadStats();
    } catch (e) {
      this.setData({ loading: false, loadedOnce: true });
      wx.showToast({ title: '镜像加载失败', icon: 'none' });
    }
  },

  async loadStats() {
    try {
      var res = await api.getMirrorStats();
      var sampleSize = this.data.battlePersona.sampleSize || 0;
      this.setData({
        radarDimensions: sampleSize >= 3 ? normalizeRadarDimensions(res.dimensions) : ZERO_DIMS,
        radarLocked: sampleSize < 3
      });
    } catch (e) {
      // 雷达图加载失败不影响主流程
    }
  },

  // 计算信号关键词标签
  _calcSignalTags(battle, traits) {
    if (!battle || !battle.generated) {
      return traits && traits.length > 0 ? traits.slice(0, 4) : [];
    }
    var tag = battle.tag || 'STABLE_CONTROL';
    var signalTags = PERSONA_SIGNAL_MAP[tag] || [];
    // 合并：信号关键词 + 认知特征标签，去重取前5
    var all = signalTags.concat(traits || []);
    var unique = [];
    var seen = {};
    for (var i = 0; i < all.length; i++) {
      if (!seen[all[i]]) {
        seen[all[i]] = true;
        unique.push(all[i]);
      }
    }
    return unique.slice(0, 5);
  },

  // 同步人格
  async refreshProfile() {
    wx.showLoading({ title: '同步中' });
    try {
      var res = await api.refreshMirrorProfile();

      var mbti = resolveMbti(res.mbti) || this.data.mbti;
      if (mbti.calibratedAt && mbti.calibratedAt.length > 10) {
        mbti = Object.assign({}, mbti, {
          updatedAtShort: mbti.calibratedAt.substring(11)
        });
      }

      var traits = (res.traits && res.traits.length > 0)
        ? res.traits
        : (mbti.mbtiType ? (MBTI_TRAITS[mbti.mbtiType] || []) : []);

      var battle = res.battlePersona || this.data.battlePersona;
      var signals = this._calcSignalTags(battle, traits);

      this.setData({
        mbti: mbti,
        traits: traits,
        syncActive: mbti.calibrated,
        battlePersona: battle,
        personaMatch: res.personaMatch || this.data.personaMatch,
        reading: res.reading || this.data.reading,
        personaConfidence: res.personaConfidence || 0,
        personaSignals: signals
      });
      this.loadStats();
      wx.showToast({ title: '已同步', icon: 'none' });
    } catch (e) {
      wx.showToast({ title: '同步失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 生成人格档案
  generateDossier() {
    wx.navigateTo({ url: '/pages/mirror-dossier/mirror-dossier' });
  },

  // MBTI 测试
  startMbtiTest() {
    this.setData({ showSwipeTest: true });
  },

  closeMbtiTest() {
    this.setData({ showExitConfirm: true });
  },

  onExitConfirm() {
    this.setData({ showSwipeTest: false, showExitConfirm: false });
  },

  onExitCancel() {
    this.setData({ showExitConfirm: false });
  },

  openMbtiPicker() {
    this.setData({ showMbtiPicker: true });
  },

  closeMbtiPicker() {
    this.setData({ showMbtiPicker: false });
  },

  async handleMbtiComplete(e) {
    var detail = e.detail;
    try {
      await api.submitMbtiTest({ testVersion: detail.testVersion, answers: detail.answers });
      this.setData({ showSwipeTest: false });
      wx.showToast({ title: '校准完成', icon: 'success' });
      this.loadProfile(true);
    } catch (err) {
      wx.showToast({ title: '提交失败', icon: 'none' });
    }
  },

  async handleMbtiDirectInput(e) {
    try {
      await api.submitMbtiDirect({ mbtiCode: e.detail.mbtiCode });
      this.setData({ showMbtiPicker: false });
      wx.showToast({ title: '设置成功', icon: 'success' });
      this.loadProfile(true);
    } catch (err) {
      // 通知 picker 显示错误状态
      var picker = this.selectComponent('#mbtiPicker');
      if (picker && picker.showError) {
        picker.showError('同步失败，请重试');
      } else {
        wx.showToast({ title: '提交失败', icon: 'none' });
      }
    }
  }
});
