const api = require('../../utils/mirror-api');
const { MBTI_MAP, MBTI_TRAITS } = require('../../utils/mbti-const');
const { sanitizeMirrorText, sanitizeMirrorObject } = require('../../utils/mirror-sanitize');
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
  return sanitizeMirrorObject(Object.assign({}, mbti, { mbtiType: info.type, mbtiTitle: info.title }));
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
      title: '黑匣子样本不足',
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
    showExitConfirm: false,

    // 人格复制
    showCardPreview: false,
    generatingCard: false,
    scanStep: 0,
    cardTempPath: '',
    showPermDialog: false,
    generatedAt: ''
  },

  onLoad() {
    var reduceMotion =
      !app.globalData.animationEnabled ||
      app.globalData.reduceMotion === true;
    this.setData({ reduceMotion: reduceMotion });
    this._toastRef = null;
    this._scanTimers = [];
    this._generatedAt = this._formatDate();
    this.loadProfile();
  },

  onUnload() {
    this._clearScanTimers();
  },

  onReady() {
    this._toastRef = this.selectComponent('#srToast');
  },

  _showToast(text, type, duration) {
    if (this._toastRef) {
      this._toastRef.show(text, type, duration);
    }
  },

  _clearScanTimers() {
    for (var i = 0; i < this._scanTimers.length; i++) {
      clearTimeout(this._scanTimers[i]);
    }
    this._scanTimers = [];
  },

  _formatDate() {
    var now = new Date();
    return now.getFullYear() + '.'
      + String(now.getMonth() + 1).padStart(2, '0') + '.'
      + String(now.getDate()).padStart(2, '0');
  },

  noop() {},

  onShow() {
    if (this.data.loadedOnce) {
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
      traits = traits.map(sanitizeMirrorText);

      // 历史缓存可能残留旧画像词，进入页面状态前统一净化。
      var battle = sanitizeMirrorObject(res.battlePersona || this.data.battlePersona);

      // 人格可信度
      var personaConfidence = res.personaConfidence || 0;
      var confidenceChecklist = [
        { label: 'MBTI校准', done: mbti.calibrated },
        { label: '3场封存', done: battle.sampleSize >= 3 },
        { label: '任务画像', done: battle.generated },
        { label: '基础数据', done: mbti.calibrated || battle.sampleSize > 0 }
      ];

      // 结构化判读（兼容旧格式）
      var reading = sanitizeMirrorObject(res.reading || this.data.reading);
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
        personaMatch: sanitizeMirrorObject(res.personaMatch || this.data.personaMatch),
        reading: reading,
        personaConfidence: personaConfidence,
        confidenceChecklist: confidenceChecklist,
        personaSignals: signals,
        evolution: evolution,
        generatedAt: this._generatedAt,
        loading: false,
        loadedOnce: true,
        needRefresh: false
      });

      this.loadStats();
    } catch (e) {
      this.setData({ loading: false, loadedOnce: true });
      this._showToast('镜像投影加载失败', 'dot-error');
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
      var item = sanitizeMirrorText(all[i]);
      if (!seen[item]) {
        seen[item] = true;
        unique.push(item);
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
      traits = traits.map(sanitizeMirrorText);

      var battle = sanitizeMirrorObject(res.battlePersona || this.data.battlePersona);
      var signals = this._calcSignalTags(battle, traits);

      this.setData({
        mbti: mbti,
        traits: traits,
        syncActive: mbti.calibrated,
        battlePersona: battle,
        personaMatch: sanitizeMirrorObject(res.personaMatch || this.data.personaMatch),
        reading: sanitizeMirrorObject(res.reading || this.data.reading),
        personaConfidence: res.personaConfidence || 0,
        personaSignals: signals
      });
      this.loadStats();
      this._showToast('[SYNC] 协议参数已写入镜像', 'dot-sync');
    } catch (e) {
      this._showToast('协议同步失败，请重试', 'dot-error');
    } finally {
      wx.hideLoading();
    }
  },

  // ---- 人格复制 ----
  generateDossier() {
    if (this.data.generatingCard) return;
    this._clearScanTimers();
    this.setData({ generatingCard: true, scanStep: 0 });

    var self = this;
    var reduceMotion = this.data.reduceMotion;

    if (reduceMotion) {
      this.setData({ scanStep: 3 });
      this._doDrawCard();
      return;
    }

    var t1 = setTimeout(function () { self.setData({ scanStep: 1 }); }, 400);
    var t2 = setTimeout(function () { self.setData({ scanStep: 2 }); }, 900);
    var t3 = setTimeout(function () {
      self.setData({ scanStep: 3 });
      self._doDrawCard();
    }, 1500);
    this._scanTimers = [t1, t2, t3];
  },

  async _doDrawCard() {
    try {
      var path = await this._drawPersonaCard();
      this.setData({
        cardTempPath: path,
        generatingCard: false,
        scanStep: 0,
        showCardPreview: true
      });
    } catch (e) {
      this.setData({ generatingCard: false, scanStep: 0 });
      this._showToast('投影生成失败，请稍后重试', 'dot-error');
    }
  },

  closeCardPreview() {
    this.setData({ showCardPreview: false, cardTempPath: '' });
  },

  // ---- Canvas 绘制 ----
  _drawPersonaCard() {
    var self = this;
    return new Promise(function (resolve, reject) {
      var query = wx.createSelectorQuery().in(self);
      query.select('#personaCardCanvas')
        .fields({ node: true, size: true })
        .exec(function (res) {
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

          self._drawBg(ctx, W, H);
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

    var grad = ctx.createRadialGradient(160, 0, 0, 160, 0, 420);
    grad.addColorStop(0, 'rgba(10,132,255,0.18)');
    grad.addColorStop(1, 'rgba(10,132,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(10,132,255,0.28)';
    ctx.lineWidth = 2;
    this._roundRect(ctx, 44, 44, W - 88, H - 88, 28);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (var y = 76; y < H - 76; y += 16) {
      ctx.beginPath();
      ctx.moveTo(60, y);
      ctx.lineTo(W - 60, y);
      ctx.stroke();
    }
  },

  _drawContent(ctx, W, H) {
    var d = this.data;
    var mbti = d.mbti || {};
    var battle = d.battlePersona || {};
    var reading = d.reading || {};
    var signals = d.personaSignals || [];
    var padL = 72;
    var contentW = W - padL * 2;

    // Header
    ctx.fillStyle = 'rgba(10,132,255,0.50)';
    ctx.font = '18px sans-serif';
    this._fillLetterSpaced(ctx, 'PERSONA ARCHIVE', padL, 80);

    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('人格档案卡', padL, 130);

    this._drawDivider(ctx, padL, 158, contentW);

    // MBTI 类型
    ctx.fillStyle = '#0A84FF';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText(mbti.mbtiType || '--', padL, 232);

    if (mbti.mbtiTitle) {
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(sanitizeMirrorText(mbti.mbtiTitle), padL + 190, 230);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.font = '22px sans-serif';
    ctx.fillText('置信度 ' + (mbti.confidence || 0) + '%', padL, 278);

    var source = mbti.mbtiSource === 'test' ? '20题校准' : '直接输入';
    ctx.fillText('来源 ' + source, padL + 220, 278);

    this._drawDivider(ctx, padL, 306, contentW);

    // 五维数据
    ctx.fillStyle = 'rgba(10,132,255,0.50)';
    ctx.font = '20px sans-serif';
    this._fillLetterSpaced(ctx, 'RADAR DATA', padL, 346);

    var dims = d.radarDimensions || [];
    if (dims.length > 0 && battle.generated) {
      var dimY = 382;
      for (var di = 0; di < dims.length; di++) {
        var dim = dims[di];
        ctx.fillStyle = 'rgba(255,255,255,0.48)';
        ctx.font = '20px sans-serif';
        ctx.fillText(dim.label, padL, dimY);
        ctx.fillStyle = '#00AFFF';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(String(dim.value), padL + 140, dimY);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        this._roundRect(ctx, padL + 200, dimY - 12, contentW - 200, 10, 5);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,175,255,0.45)';
        var barW = Math.max(4, (dim.value / 100) * (contentW - 200));
        this._roundRect(ctx, padL + 200, dimY - 12, barW, 10, 5);
        ctx.fill();
        dimY += 40;
      }
    }

    var dividerY = battle.generated && dims.length > 0 ? 590 : 370;
    this._drawDivider(ctx, padL, dividerY, contentW);

    // 系统判读
    var readingY = dividerY + 36;
    ctx.fillStyle = 'rgba(10,132,255,0.50)';
    ctx.font = '20px sans-serif';
    this._fillLetterSpaced(ctx, 'SYSTEM READING', padL, readingY);

    var readingText = this._buildReadingText(reading);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '22px sans-serif';
    this._drawWrappedText(ctx, readingText, padL, readingY + 36, contentW, 34, 5);

    // 人格信号
    var signalY = readingY + 220;
    ctx.fillStyle = 'rgba(10,132,255,0.50)';
    ctx.font = '20px sans-serif';
    this._fillLetterSpaced(ctx, 'PERSONA SIGNAL', padL, signalY);

    if (signals.length > 0) {
      var chipX = padL;
      var chipY = signalY + 36;
      for (var si = 0; si < signals.length; si++) {
        var label = sanitizeMirrorText(signals[si]);
        var chipW = Math.min(200, 48 + label.length * 24);
        if (chipX + chipW > W - padL) {
          chipX = padL;
          chipY += 52;
        }
        this._drawChip(ctx, chipX, chipY, chipW, 38, label);
        chipX += chipW + 14;
      }
    }

    // Footer
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '18px sans-serif';
    ctx.fillText('生成时间 ' + d.generatedAt, padL, H - 100);

    ctx.fillStyle = 'rgba(10,132,255,0.35)';
    ctx.font = '16px sans-serif';
    this._fillLetterSpaced(ctx, 'PULSE TERMINAL · SMART RECORD', padL, H - 70);
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

  _drawChip(ctx, x, y, w, h, text) {
    ctx.fillStyle = 'rgba(10,132,255,0.08)';
    ctx.strokeStyle = 'rgba(10,132,255,0.30)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0A84FF';
    ctx.font = '20px sans-serif';
    ctx.fillText(text, x + 16, y + 27);
  },

  // ---- 保存到相册 ----
  saveCard() {
    var path = this.data.cardTempPath;
    if (!path) {
      this._showToast('请先生成镜像档案', 'dot-warn');
      return;
    }

    var self = this;
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success: function () {
        self._showToast('镜像档案已保存', 'dot-sync');
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

  // ---- 分享 ----
  onShareAppMessage() {
    var mbti = this.data.mbti || {};
    return {
      title: '我的镜像档案：' + (mbti.mbtiType || '--') + ' ' + sanitizeMirrorText(mbti.mbtiTitle || ''),
      path: '/pages/mirror/index',
      imageUrl: this.data.cardTempPath || ''
    };
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
      this._showToast('[SYNC] 协议参数已写入镜像', 'dot-sync');
      this.loadProfile(true);
    } catch (err) {
      this._showToast('提交失败，请重试', 'dot-error');
    }
  },

  async handleMbtiDirectInput(e) {
    try {
      await api.submitMbtiDirect({ mbtiCode: e.detail.mbtiCode });
      this.setData({ showMbtiPicker: false });
      this._showToast('[SYNC] 协议参数已写入镜像', 'dot-sync');
      this.loadProfile(true);
    } catch (err) {
      var picker = this.selectComponent('#mbtiPicker');
      if (picker && picker.showError) {
        picker.showError('同步失败，请重试');
      } else {
        this._showToast('协议同步失败，请重试', 'dot-error');
      }
    }
  }
});
