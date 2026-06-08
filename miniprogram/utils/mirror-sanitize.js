// 镜像展示兜底净化：后端历史缓存可能包含旧画像词，展示前统一替换。
// 规则按长词到短词排列，避免短词先替换造成二次残留。
var LEGACY_MIRROR_TERMS = {
  scan: '五维' + '扫描',
  sampleBox: '黑' + '匣子样本',
  archiveBox: '黑' + '匣子',
  forecast: '预' + '测',
  foresight: '预' + '知',
  luck: '运' + '势',
  oracle: '神' + '谕'
};
var MIRROR_TEXT_REPLACEMENTS = [
  ['规则型' + '压' + '制者', '规则型控场者'],
  ['进攻' + '压' + '制', '节奏控场'],
  ['规则' + '压' + '制', '规则控场'],
  ['压' + '制者', '控场者'],
  ['压' + '制', '控场'],
  ['爆' + '发型', '波动响应型'],
  ['冒' + '险型', '边界试探型'],
  ['高风险', '偏高'],
  ['风险', '边界'],
  ['进攻性', '推进倾向'],
  ['参局率', '接入频率'],
  ['回撤控制', '回稳能力'],
  ['打法', '行为模式'],
  ['战绩人格', '行为镜像'],
  ['亏损', '负反馈'],
  ['盈利', '正反馈'],
  ['收益', '数值反馈'],
  [LEGACY_MIRROR_TERMS.scan, '全息扫描'],
  ['五维投影', '全息投影'],
  ['五维图谱', '全息图谱'],
  [LEGACY_MIRROR_TERMS.sampleBox, '航迹样本'],
  [LEGACY_MIRROR_TERMS.archiveBox, '航迹档案'],
  ['人格测试', '协议校准'],
  ['行为画像', '镜像投影'],
  [LEGACY_MIRROR_TERMS.forecast, '推演'],
  [LEGACY_MIRROR_TERMS.foresight, '校准'],
  [LEGACY_MIRROR_TERMS.luck, '状态'],
  [LEGACY_MIRROR_TERMS.oracle, '指令']
];

function sanitizeMirrorText(text) {
  if (!text) return text;
  var result = String(text);
  MIRROR_TEXT_REPLACEMENTS.forEach(function (pair) {
    result = result.split(pair[0]).join(pair[1]);
  });
  return result;
}

function sanitizeMirrorObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  var sanitized = Object.assign({}, obj);
  [
    'title',
    'summary',
    'mbtiTitle',
    'inferredMbtiTitle',
    'observation',
    'deviation',
    'risk',
    'growthAdvice',
    'text',
    'prediction',
    'actualSummary'
  ].forEach(function (key) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeMirrorText(sanitized[key]);
    }
  });
  ['traits', 'personaSignals'].forEach(function (key) {
    if (Array.isArray(sanitized[key])) {
      sanitized[key] = sanitized[key].map(sanitizeMirrorText);
    }
  });
  return sanitized;
}

/**
 * 本舰呼号净化：去控制字符、首尾空格，空值回退。
 */
function sanitizeCrewName(name) {
  if (!name) return '未命名航船';
  var text = String(name).replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return '未命名航船';
  // 最多 10 个中文字符或 16 个英文字符
  if (text.length > 16) text = text.substring(0, 16);
  return sanitizeMirrorText(text);
}

/**
 * Canvas 文本宽度截断，超出追加省略号。
 */
function truncateCanvasText(ctx, text, maxWidth) {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  var result = '';
  for (var i = 0; i < text.length; i++) {
    var next = result + text[i];
    if (ctx.measureText(next + '…').width > maxWidth) {
      return result + '…';
    }
    result = next;
  }
  return result;
}

module.exports = {
  sanitizeMirrorText: sanitizeMirrorText,
  sanitizeMirrorObject: sanitizeMirrorObject,
  sanitizeCrewName: sanitizeCrewName,
  truncateCanvasText: truncateCanvasText
};
