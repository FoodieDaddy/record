// 镜像展示兜底净化：后端历史缓存可能包含旧画像词，展示前统一替换。
// 规则按长词到短词排列，避免短词先替换造成二次残留。
var MIRROR_TEXT_REPLACEMENTS = [
  ['规则型' + '压' + '制者', '规则型控场者'],
  ['进攻' + '压' + '制', '节奏控场'],
  ['规则' + '压' + '制', '规则控场'],
  ['压' + '制者', '控场者'],
  ['压' + '制', '控场'],
  ['爆' + '发型', '波动响应型'],
  ['冒' + '险型', '边界试探型']
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

module.exports = {
  sanitizeMirrorText: sanitizeMirrorText,
  sanitizeMirrorObject: sanitizeMirrorObject
};
