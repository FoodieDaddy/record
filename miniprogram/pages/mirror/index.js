const api = require('../../utils/mirror-api');
const { MBTI_MAP, MBTI_TRAITS } = require('../../utils/mbti-const');
const app = getApp();

var ZERO_DIMS = [
  { key: 'aggression', label: '进攻性', value: 0, desc: '' },
  { key: 'stability', label: '稳定性', value: 0, desc: '' },
  { key: 'participation', label: '参局率', value: 0, desc: '' },
  { key: 'comeback', label: '翻盘力', value: 0, desc: '' },
  { key: 'dominance', label: '控场力', value: 0, desc: '' }
];

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

    // 人格档案
    mbti: {
      calibrated: false,
      mbtiType: '',
      mbtiTitle: '',
      confidence: 0,
      mbtiSource: '',
      calibratedAt: ''
    },
    traits: [],

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

    // 人格一致性
    personaMatch: {
      available: false,
      matchPercentage: 0,
      prediction: '',
      actualSummary: '',
      summary: ''
    },

    // 菜单
    showMenu: false,

    // MBTI 弹窗
    showSwipeTest: false,
    showMbtiPicker: false
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

      // 认知特征：后端优先，前端兜底
      var traits = (res.traits && res.traits.length > 0)
        ? res.traits
        : (mbti.mbtiType ? (MBTI_TRAITS[mbti.mbtiType] || []) : []);

      this.setData({
        mbti: mbti,
        traits: traits,
        battlePersona: res.battlePersona || this.data.battlePersona,
        personaMatch: res.personaMatch || this.data.personaMatch,
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
        radarDimensions: sampleSize >= 3 ? (res.dimensions || ZERO_DIMS) : ZERO_DIMS,
        radarLocked: sampleSize < 3
      });
    } catch (e) {
      // 雷达图加载失败不影响主流程
    }
  },

  // 分享画像
  shareRadarPoster() {
    var radar = this.selectComponent('#radarChart');
    if (radar) radar.sharePoster();
  },

  // 菜单
  toggleMenu() {
    this.setData({ showMenu: !this.data.showMenu });
  },

  closeMenu() {
    this.setData({ showMenu: false });
  },

  // 同步人格
  async refreshProfile() {
    this.setData({ showMenu: false });
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

      this.setData({
        mbti: mbti,
        traits: traits,
        battlePersona: res.battlePersona || this.data.battlePersona,
        personaMatch: res.personaMatch || this.data.personaMatch
      });
      this.loadStats();
      wx.showToast({ title: '已同步', icon: 'none' });
    } catch (e) {
      wx.showToast({ title: '同步失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 重新计算画像
  async recalcPersona() {
    this.setData({ showMenu: false });
    wx.showLoading({ title: '计算中' });
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

      this.setData({
        mbti: mbti,
        traits: traits,
        battlePersona: res.battlePersona || this.data.battlePersona,
        personaMatch: res.personaMatch || this.data.personaMatch
      });
      this.loadStats();
      wx.showToast({ title: '已更新', icon: 'none' });
    } catch (e) {
      wx.showToast({ title: '计算失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // MBTI 测试
  startMbtiTest() {
    this.setData({ showSwipeTest: true });
  },

  closeMbtiTest() {
    this.setData({ showSwipeTest: false });
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
      wx.showToast({ title: '提交失败', icon: 'none' });
    }
  }
});
