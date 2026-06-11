/**
 * 统一内容净化模块
 * 合并 fortune（指令）和 mirror（镜像）的净化规则。
 * 按上下文选择规则集：sanitizeDirective() / sanitizeMirror() / sanitize通用()
 */

// ── 通用旧术语映射 ──
var LEGACY_TERMS = {
  scan: '五维' + '扫描',
  sampleBox: '黑' + '匣子样本',
  archiveBox: '黑' + '匣子',
  forecast: '预' + '测',
  foresight: '预' + '知',
  luck: '运' + '势',
  oracle: '神' + '谕'
};

// ── 指令（Fortune）净化规则 ──
var DIRECTIVE_REPLACEMENTS = [
  [/ALL-IN/gi, '冒进'],
  [/孤注一掷/g, '冒进'],
  [/抽取/g, '生成'],
  [new RegExp('运' + '势', 'g'), '状态'],
  [new RegExp('翻' + '本', 'g'), '修正'],
  [/翻盘/g, '回稳'],
  [new RegExp('追' + '损', 'g'), '连续修正'],
  [/止损线/g, '暂停线'],
  [/收益/g, '数值反馈'],
  [/盈利/g, '积分'],
  [/亏损/g, '回落'],
  [/胜率/g, '节奏稳定度'],
  [/预测/g, '判读'],
  [new RegExp('预' + '知', 'g'), '校准'],
  [new RegExp('必' + '胜', 'g'), '稳定执行'],
  [new RegExp('稳' + '赚', 'g'), '稳态执行'],
  [/校准者/g, '今日指令'],
  [/THE CALIBRATOR/gi, 'DIRECTIVE'],
  [/LOW-NOISE/gi, '低噪'],
  [/MEDIUM-NOISE/gi, '中噪'],
  [/HIGH-NOISE/gi, '高噪'],
  [/LLM/g, '主引擎'],
  [/HIGH_RISK/g, '偏高'],
  [/今日策略/g, '今日指令'],
  [/生成策略/g, '生成今日指令'],
  [/策略卡/g, '指令卡'],
  [/策略/g, '指令'],
  [/黑匣子样本/g, '航迹样本'],
  [/黑匣子/g, '航迹档案'],
  [/重新点火/g, '重新计算'],
  [/点火航行核心/g, '开始导航计算'],
  [new RegExp('神' + '谕', 'g'), '指令'],
  [new RegExp('占' + '卜', 'g'), '推演'],
  [new RegExp('算' + '命', 'g'), '推演']
];

// ── 镜像（Mirror）净化规则（长词到短词排列） ──
var MIRROR_REPLACEMENTS = [
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
  [LEGACY_TERMS.scan, '全息扫描'],
  ['五维投影', '全息投影'],
  ['五维图谱', '全息图谱'],
  [LEGACY_TERMS.sampleBox, '航迹样本'],
  [LEGACY_TERMS.archiveBox, '航迹档案'],
  ['人格测试', '协议校准'],
  ['行为画像', '镜像投影'],
  [LEGACY_TERMS.forecast, '推演'],
  [LEGACY_TERMS.foresight, '校准'],
  [LEGACY_TERMS.luck, '状态'],
  [LEGACY_TERMS.oracle, '指令']
];

function _applyReplacements(text, rules) {
  if (!text) return text;
  var result = String(text);
  rules.forEach(function (pair) {
    var pattern = pair[0];
    var replacement = pair[1];
    if (pattern instanceof RegExp) {
      result = result.replace(pattern, replacement);
    } else {
      result = result.split(pattern).join(replacement);
    }
  });
  return result;
}

/** 净化指令文本 */
function sanitizeDirective(text) {
  return _applyReplacements(text, DIRECTIVE_REPLACEMENTS);
}

/** 净化镜像文本 */
function sanitizeMirror(text) {
  return _applyReplacements(text, MIRROR_REPLACEMENTS);
}

/** 净化镜像对象（批量字段） */
function sanitizeMirrorObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  var sanitized = Object.assign({}, obj);
  [
    'title', 'summary', 'mbtiTitle', 'inferredMbtiTitle',
    'observation', 'deviation', 'risk', 'growthAdvice',
    'text', 'prediction', 'actualSummary'
  ].forEach(function (key) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeMirror(sanitized[key]);
    }
  });
  ['traits', 'personaSignals'].forEach(function (key) {
    if (Array.isArray(sanitized[key])) {
      sanitized[key] = sanitized[key].map(sanitizeMirror);
    }
  });
  return sanitized;
}

module.exports = {
  sanitizeDirective: sanitizeDirective,
  sanitizeMirror: sanitizeMirror,
  sanitizeMirrorObject: sanitizeMirrorObject,
  LEGACY_TERMS: LEGACY_TERMS
};
