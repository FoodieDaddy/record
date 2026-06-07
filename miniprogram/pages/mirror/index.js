const api = require('../../utils/mirror-api');
const { MBTI_MAP, MBTI_TRAITS } = require('../../utils/mbti-const');
const { sanitizeMirrorText, sanitizeMirrorObject } = require('../../utils/mirror-sanitize');
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

Page({
  data: {
    loading: true,
    loadedOnce: false,
    reduceMotion: false,
    viewMode: 'main', // 'main' | 'calibration'

    // 入场动画
    headerOpacity: 0,
    heroOpacity: 0,
    sectionsOpacity: 0,

    // 舱位状态
    baySubtitle: '接入人格协议以启动镜像',

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
      title: '黑匣子样本不足',
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

    // 协议一致率（原人格可信度）
    personaConfidence: 0,

    // 协议偏移（原人格偏差）
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

    // 弹窗控制
    showMbtiPicker: false,
    showExitConfirm: false,

    // 校准进度
    calibrationProgress: '01 / 20',

    // 生成镜像卡
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
    this._entryTimers = [];
    this._generatedAt = this._formatDate();
    this.loadProfile();
  },

  onUnload() {
    this._clearScanTimers();
    this._clearEntryTimers();
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

  _clearEntryTimers() {
    for (var i = 0; i < this._entryTimers.length; i++) {
      clearTimeout(this._entryTimers[i]);
    }
    this._entryTimers = [];
  },

  _playEntryAnimation() {
    if (this.data.reduceMotion) {
      this.setData({ headerOpacity: 1, heroOpacity: 1, sectionsOpacity: 1 });
      return;
    }
    var self = this;
    this._clearEntryTimers();
    var t1 = setTimeout(function () { self.setData({ headerOpacity: 1 }); }, 120);
    var t2 = setTimeout(function () { self.setData({ heroOpacity: 1 }); }, 240);
    var t3 = setTimeout(function () { self.setData({ sectionsOpacity: 1 }); }, 600);
    this._entryTimers = [t1, t2, t3];
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

      // 协议一致率
      var personaConfidence = res.personaConfidence || 0;

      // 结构化判读（兼容旧格式）
      var reading = sanitizeMirrorObject(res.reading || this.data.reading);
      if (reading.available && !reading.observation && reading.text) {
        reading = Object.assign({}, reading, { observation: reading.text });
      }

      // 人格信号：关键词标签
      var signals = this._calcSignalTags(battle, traits);

      // 演化轨迹
      var evolution = res.evolution || [];

      var baySubtitle = '镜像舱在线';
      if (!mbti.calibrated) {
        baySubtitle = '接入人格协议以启动镜像';
      } else if (battle.sampleSize < 3) {
        baySubtitle = '黑匣子样本读取中';
      }

      this.setData({
        mbti: mbti,
        traits: traits,
        syncActive: mbti.calibrated,
        battlePersona: battle,
        personaMatch: sanitizeMirrorObject(res.personaMatch || this.data.personaMatch),
        reading: reading,
        personaConfidence: personaConfidence,
        personaSignals: signals,
        evolution: evolution,
        generatedAt: this._generatedAt,
        baySubtitle: baySubtitle,
        loading: false,
        loadedOnce: true,
        needRefresh: false
      });

      this._playEntryAnimation();
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
      var dims = sampleSize >= 3 ? (res.dimensions || []) : [];
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
      this.setData({
        radarDimensions: normalized.length > 0 ? normalized : this.data.radarDimensions,
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

    // 径向光
    var grad = ctx.createRadialGradient(W / 2, 200, 0, W / 2, 200, 480);
    grad.addColorStop(0, 'rgba(0,200,255,0.10)');
    grad.addColorStop(0.6, 'rgba(10,132,255,0.06)');
    grad.addColorStop(1, 'rgba(10,132,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 星场
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

    // 边框
    ctx.strokeStyle = 'rgba(10,132,255,0.28)';
    ctx.lineWidth = 2;
    this._roundRect(ctx, 44, 44, W - 88, H - 88, 28);
    ctx.stroke();

    // HUD 角标
    var cornerLen = 24;
    ctx.strokeStyle = 'rgba(0,200,255,0.18)';
    ctx.lineWidth = 1;
    // 左上
    ctx.beginPath(); ctx.moveTo(44, 44 + cornerLen); ctx.lineTo(44, 44); ctx.lineTo(44 + cornerLen, 44); ctx.stroke();
    // 右上
    ctx.beginPath(); ctx.moveTo(W - 44 - cornerLen, 44); ctx.lineTo(W - 44, 44); ctx.lineTo(W - 44, 44 + cornerLen); ctx.stroke();
    // 左下
    ctx.beginPath(); ctx.moveTo(44, H - 44 - cornerLen); ctx.lineTo(44, H - 44); ctx.lineTo(44 + cornerLen, H - 44); ctx.stroke();
    // 右下
    ctx.beginPath(); ctx.moveTo(W - 44 - cornerLen, H - 44); ctx.lineTo(W - 44, H - 44); ctx.lineTo(W - 44, H - 44 - cornerLen); ctx.stroke();

    // 极弱扫描线
    ctx.strokeStyle = 'rgba(0,200,255,0.02)';
    ctx.lineWidth = 1;
    for (var y = 76; y < H - 76; y += 4) {
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

    // ---- 顶部：弱装饰区 ----
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '16px sans-serif';
    this._fillLetterSpaced(ctx, 'SMART RECORD', padL, 72);
    this._fillLetterSpacedRight(ctx, 'MIRROR PROJECTION', W - padL, 72);

    // ---- 中央核心：MBTI 类型 ----
    var coreY = 280;
    ctx.fillStyle = '#00C8FF';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mbti.mbtiType || '----', W / 2, coreY);

    // 类型名
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '32px sans-serif';
    ctx.fillText(sanitizeMirrorText(mbti.mbtiTitle || ''), W / 2, coreY + 52);
    ctx.textAlign = 'left';

    // 五维扫描雷达
    var scanCenterX = W / 2;
    var scanCenterY = coreY + 150;
    var scanRadius = 100;
    var dims = d.radarDimensions || [];
    if (dims.length > 0 && battle.generated) {
      var sides = 5;
      var startAngle = -Math.PI / 2;

      // 五角星网格
      var gridLevels = [0.33, 0.66, 1.0];
      for (var gi = 0; gi < gridLevels.length; gi++) {
        var gl = gridLevels[gi];
        ctx.beginPath();
        for (var si = 0; si < sides; si++) {
          var ga = startAngle + (Math.PI * 2 / sides) * si;
          var gx = scanCenterX + Math.cos(ga) * scanRadius * gl;
          var gy = scanCenterY + Math.sin(ga) * scanRadius * gl;
          if (si === 0) ctx.moveTo(gx, gy); else ctx.lineTo(gx, gy);
        }
        ctx.closePath();
        ctx.strokeStyle = gi === 2 ? 'rgba(0,200,255,0.18)' : 'rgba(0,200,255,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 轴线
      for (var ai = 0; ai < sides; ai++) {
        var aa = startAngle + (Math.PI * 2 / sides) * ai;
        ctx.beginPath();
        ctx.moveTo(scanCenterX, scanCenterY);
        ctx.lineTo(scanCenterX + Math.cos(aa) * scanRadius, scanCenterY + Math.sin(aa) * scanRadius);
        ctx.strokeStyle = 'rgba(0,200,255,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 数据面
      ctx.beginPath();
      for (var di = 0; di < sides; di++) {
        var da = startAngle + (Math.PI * 2 / sides) * di;
        var dv = (dims[di] ? dims[di].value : 0) / 100;
        var dx = scanCenterX + Math.cos(da) * scanRadius * dv;
        var dy = scanCenterY + Math.sin(da) * scanRadius * dv;
        if (di === 0) ctx.moveTo(dx, dy); else ctx.lineTo(dx, dy);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,200,255,0.10)';
      ctx.fill();
      ctx.strokeStyle = '#00C8FF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 数据节点
      for (var ni = 0; ni < sides; ni++) {
        var na = startAngle + (Math.PI * 2 / sides) * ni;
        var nv = (dims[ni] ? dims[ni].value : 0) / 100;
        var nx = scanCenterX + Math.cos(na) * scanRadius * nv;
        var ny = scanCenterY + Math.sin(na) * scanRadius * nv;
        ctx.beginPath();
        ctx.arc(nx, ny, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#00C8FF';
        ctx.fill();
      }

      // 中心点
      ctx.beginPath();
      ctx.arc(scanCenterX, scanCenterY, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,200,255,0.60)';
      ctx.fill();
    }

    // ---- 信息区 ----
    var infoY = scanCenterY + scanRadius + 48;
    var infoBoxW = (contentW - 20) / 2;
    var infoBoxH = 72;

    // 左：协议一致率
    this._roundRect(ctx, padL, infoY, infoBoxW, infoBoxH, 12);
    ctx.strokeStyle = 'rgba(10,132,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.56)';
    ctx.font = '18px sans-serif';
    ctx.fillText('协议一致率', padL + 16, infoY + 28);
    ctx.fillStyle = '#00C8FF';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText((mbti.confidence || 0) + '%', padL + 16, infoY + 58);

    // 右：黑匣子样本
    var infoRX = padL + infoBoxW + 20;
    this._roundRect(ctx, infoRX, infoY, infoBoxW, infoBoxH, 12);
    ctx.strokeStyle = 'rgba(10,132,255,0.18)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.56)';
    ctx.font = '18px sans-serif';
    ctx.fillText('黑匣子样本', infoRX + 16, infoY + 28);
    ctx.fillStyle = '#00C8FF';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(battle.sampleSize + ' / 3', infoRX + 16, infoY + 58);

    // ---- 判读区 ----
    var readY = infoY + infoBoxH + 40;
    var readingText = this._buildReadingText(reading);
    ctx.fillStyle = 'rgba(255,255,255,0.56)';
    ctx.font = '26px sans-serif';
    this._drawWrappedText(ctx, readingText, padL, readY, contentW, 38, 3);

    // ---- 底部标识区 ----
    // 细线
    ctx.strokeStyle = 'rgba(10,132,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, H - 120);
    ctx.lineTo(W - padL, H - 120);
    ctx.stroke();

    // 时间戳
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '18px sans-serif';
    ctx.fillText(d.generatedAt || '', padL, H - 80);

    // 底部品牌
    ctx.fillStyle = 'rgba(10,132,255,0.35)';
    ctx.font = '16px sans-serif';
    this._fillLetterSpaced(ctx, 'SMART RECORD · MIRROR PROJECTION', padL, H - 50);
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
  startFullCalibration() {
    this.setData({ viewMode: 'calibration' });
  },

  closeMbtiTest() {
    this.setData({ showExitConfirm: true });
  },

  onExitConfirm() {
    this.setData({ showExitConfirm: false, viewMode: 'main' });
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
      this.setData({ viewMode: 'main' });
      this._showToast('协议已同步', 'dot-sync');
      this.loadProfile(true);
    } catch (err) {
      this._showToast('提交失败，请重试', 'dot-error');
    }
  },

  async handleMbtiDirectInput(e) {
    try {
      await api.submitMbtiDirect({ mbtiCode: e.detail.mbtiCode });
      this.setData({ showMbtiPicker: false, viewMode: 'main' });
      this._showToast('协议已同步', 'dot-sync');
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
