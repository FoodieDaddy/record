const api = require('../../utils/mirror-api');
const { MBTI_MAP, MBTI_TRAITS } = require('../../utils/mbti-const');
const app = getApp();

var PERSONA_SIGNAL_MAP = {
  STABLE_CONTROL: ['节奏控制', '低失误', '稳健决策', '长期主义'],
  AGGRESSIVE_PUSH: ['主动进攻', '窗口捕捉', '高频决策', '积分最大化'],
  VOLATILE_BURST: ['爆发型', '高波动', '极限操作', '情绪驱动'],
  DEFENSIVE_COUNTER: ['防守反击', '耐心等待', '低频高效', '信息积累'],
  SLOW_OBSERVER: ['后发制人', '信息导向', '节奏观察', '稳定输出'],
  EMOTIONAL_SWING: ['情绪敏感', '状态波动', '连败影响', '需调节奏']
};

function resolveMbti(mbti) {
  if (!mbti || !mbti.mbtiCode || !MBTI_MAP[mbti.mbtiCode]) return mbti;
  var info = MBTI_MAP[mbti.mbtiCode];
  return Object.assign({}, mbti, { mbtiType: info.type, mbtiTitle: info.title });
}

Page({
  data: {
    loading: true,
    reduceMotion: false,
    mbti: {},
    battlePersona: {},
    personaMatch: {},
    reading: {},
    personaConfidence: 0,
    personaSignals: [],
    traits: [],
    generatedAt: ''
  },

  onLoad() {
    var reduceMotion =
      !app.globalData.animationEnabled ||
      app.globalData.reduceMotion === true;
    this.setData({ reduceMotion: reduceMotion });
    this.loadDossier();
  },

  async loadDossier() {
    try {
      var res = await api.getMirrorProfile();

      var mbti = resolveMbti(res.mbti) || {};
      var battle = res.battlePersona || {};
      var match = res.personaMatch || {};
      var reading = res.reading || {};
      var traits = (res.traits && res.traits.length > 0)
        ? res.traits
        : (mbti.mbtiType ? (MBTI_TRAITS[mbti.mbtiType] || []) : []);

      var tag = battle.tag || 'STABLE_CONTROL';
      var signals = battle.generated
        ? (PERSONA_SIGNAL_MAP[tag] || []).concat(traits).slice(0, 5)
        : traits.slice(0, 4);

      var now = new Date();
      var generatedAt = now.getFullYear() + '.'
        + String(now.getMonth() + 1).padStart(2, '0') + '.'
        + String(now.getDate()).padStart(2, '0');

      this.setData({
        mbti: mbti,
        battlePersona: battle,
        personaMatch: match,
        reading: reading,
        personaConfidence: res.personaConfidence || 0,
        personaSignals: signals,
        traits: traits,
        generatedAt: generatedAt,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '档案加载失败', icon: 'none' });
    }
  },

  copyDossier() {
    var d = this.data;
    var lines = [];
    lines.push('=== PERSONA DOSSIER ===');
    lines.push('生成日期: ' + d.generatedAt);
    lines.push('');

    if (d.mbti.mbtiType) {
      lines.push('--- 人格协议 ---');
      lines.push('类型: ' + d.mbti.mbtiType + ' ' + (d.mbti.mbtiTitle || ''));
      lines.push('置信度: ' + (d.mbti.confidence || 0) + '%');
      lines.push('');
    }

    lines.push('可信度: ' + d.personaConfidence + '%');
    lines.push('');

    if (d.battlePersona.generated) {
      lines.push('--- 战绩画像 ---');
      lines.push('类型: ' + d.battlePersona.title);
      lines.push('样本: ' + d.battlePersona.sampleSize + ' 场');
      lines.push('');
    }

    if (d.personaMatch.available) {
      lines.push('--- 人格偏差 ---');
      lines.push('校准人格: ' + d.mbti.mbtiType);
      lines.push('行为人格: ' + d.personaMatch.inferredMbtiType);
      lines.push('偏差率: ' + d.personaMatch.deviationPercent + '%');
      lines.push('');
    }

    if (d.reading.available) {
      lines.push('--- 系统判读 ---');
      if (d.reading.observation) lines.push('观测: ' + d.reading.observation);
      if (d.reading.deviation) lines.push('偏差: ' + d.reading.deviation);
      if (d.reading.risk) lines.push('风险: ' + d.reading.risk);
      if (d.reading.growthAdvice) lines.push('建议: ' + d.reading.growthAdvice);
      lines.push('');
    }

    if (d.personaSignals.length > 0) {
      lines.push('--- 人格信号 ---');
      lines.push(d.personaSignals.join(' · '));
      lines.push('');
    }

    lines.push('=== END DOSSIER ===');

    wx.setClipboardData({
      data: lines.join('\n'),
      success: function () {
        wx.showToast({ title: '已复制到剪贴板', icon: 'none' });
      }
    });
  }
});
