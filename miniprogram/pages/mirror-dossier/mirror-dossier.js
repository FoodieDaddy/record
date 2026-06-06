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
    generatedAt: '',
    showCardPanel: false,
    showCardPreview: false,
    generatingCard: false,
    cardTempPath: ''
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
    lines.push('=== 人格档案 ===');
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

    lines.push('=== 档案结束 ===');

    wx.setClipboardData({
      data: lines.join('\n'),
      success: function () {
        wx.showToast({ title: '已复制到剪贴板', icon: 'none' });
      }
    });
  },

  // ---- 面板/预览 ----
  openCardPanel() {
    this.setData({ showCardPanel: true });
  },

  closeCardPanel() {
    if (this.data.generatingCard) return;
    this.setData({ showCardPanel: false });
  },

  closeCardPreview() {
    this.setData({ showCardPreview: false, cardTempPath: '' });
  },

  noop() {},

  // ---- 生成档案卡 ----
  async generateCard() {
    if (this.data.generatingCard) return;
    this.setData({ generatingCard: true });

    try {
      var path = await this._drawPersonaCard();
      this.setData({
        cardTempPath: path,
        generatingCard: false,
        showCardPanel: false,
        showCardPreview: true
      });
    } catch (e) {
      this.setData({ generatingCard: false });
      wx.showToast({ title: '生成失败，请稍后重试', icon: 'none' });
    }
  },

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
          var H = 1000;

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

  // ---- Canvas 绘制 ----
  _drawBg(ctx, W, H) {
    // 黑底
    ctx.fillStyle = '#0A0A0A';
    ctx.fillRect(0, 0, W, H);

    // 径向光
    var grad = ctx.createRadialGradient(160, 0, 0, 160, 0, 420);
    grad.addColorStop(0, 'rgba(10,132,255,0.18)');
    grad.addColorStop(1, 'rgba(10,132,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 外框
    ctx.strokeStyle = 'rgba(10,132,255,0.28)';
    ctx.lineWidth = 2;
    this._roundRect(ctx, 44, 44, W - 88, H - 88, 28);
    ctx.stroke();

    // 扫描线
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
    var reading = d.reading || {};
    var signals = d.personaSignals || [];
    var padL = 72;
    var contentW = W - padL * 2;

    // --- Header ---
    ctx.fillStyle = 'rgba(10,132,255,0.65)';
    ctx.font = '20px sans-serif';
    this._fillLetterSpaced(ctx, 'SMART RECORD · PERSONA', padL, 92);

    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('人格档案', padL, 148);  // 人格档案

    // MBTI 类型 + 标题
    ctx.fillStyle = '#0A84FF';
    ctx.font = 'bold 60px sans-serif';
    ctx.fillText(mbti.mbtiType || '--', padL, 240);

    if (mbti.mbtiTitle) {
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(mbti.mbtiTitle, padL + 200, 238);
    }

    // 置信度
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.font = '24px sans-serif';
    ctx.fillText('置信度 ' + (mbti.confidence || 0) + '%', padL, 296);  // 置信度

    // 分隔线
    this._drawDivider(ctx, padL, 330, contentW);

    // --- 系统判读 ---
    ctx.fillStyle = 'rgba(10,132,255,0.65)';
    ctx.font = '22px sans-serif';
    ctx.fillText('系统判读', padL, 378);  // 系统判读

    var readingText = this._buildReadingText(reading);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '24px sans-serif';
    this._drawWrappedText(ctx, readingText, padL, 422, contentW, 38, 6);

    // --- 人格信号 ---
    ctx.fillStyle = 'rgba(10,132,255,0.65)';
    ctx.font = '22px sans-serif';
    ctx.fillText('人格信号', padL, 690);  // 人格信号

    if (signals.length > 0) {
      var chipX = padL;
      var chipY = 732;
      for (var i = 0; i < signals.length; i++) {
        var label = signals[i];
        var chipW = Math.min(200, 48 + label.length * 26);
        if (chipX + chipW > W - padL) {
          chipX = padL;
          chipY += 56;
        }
        this._drawChip(ctx, chipX, chipY, chipW, 40, label);
        chipX += chipW + 16;
      }
    }

    // --- Footer ---
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.font = '20px sans-serif';
    ctx.fillText('生成时间 ' + d.generatedAt, padL, H - 110);  // 生成时间

    ctx.fillStyle = 'rgba(10,132,255,0.40)';
    ctx.font = '18px sans-serif';
    this._fillLetterSpaced(ctx, 'Smart Record · Record Terminal', padL, H - 76);
  },

  _buildReadingText(reading) {
    if (!reading || !reading.available) {
      return '暂无系统判读。完成更多对局后将生成更稳定的档案。';  // 暂无系统判读。完成更多对局后将生成更稳定的档案。
    }
    var parts = [];
    if (reading.observation) parts.push(reading.observation);
    if (reading.deviation) parts.push(reading.deviation);
    if (reading.risk) parts.push(reading.risk);
    if (reading.growthAdvice) parts.push(reading.growthAdvice);
    if (parts.length === 0 && reading.text) parts.push(reading.text);
    return parts.length > 0
      ? parts.join('。')  // 。
      : '暂无系统判读。完成更多对局后将生成更稳定的档案。';
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
      wx.showToast({ title: '请先生成档案卡', icon: 'none' });  // 请先生成档案卡
      return;
    }

    wx.saveImageToPhotosAlbum({
      filePath: path,
      success: function () {
        wx.showToast({ title: '已保存到相册', icon: 'none' });  // 已保存到相册
      },
      fail: function (err) {
        if (err.errMsg && err.errMsg.indexOf('auth deny') !== -1) {
          wx.showModal({
            title: '需要相册权限',  // 需要相册权限
            content: '请授权保存图片到相册。',  // 请授权保存图片到相册。
            confirmText: '去设置',  // 去设置
            success: function (modalRes) {
              if (modalRes.confirm) {
                wx.openSetting();
              }
            }
          });
          return;
        }
        wx.showToast({ title: '保存失败', icon: 'none' });  // 保存失败
      }
    });
  },

  // ---- 分享 ----
  onShareAppMessage() {
    var mbti = this.data.mbti || {};
    return {
      title: '我的人格档案：' + (mbti.mbtiType || '--') + ' ' + (mbti.mbtiTitle || ''),  // 我的人格档案：
      path: '/pages/mirror/index',
      imageUrl: this.data.cardTempPath || ''
    };
  }
});
