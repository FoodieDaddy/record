/**
 * MBTI 类型常量映射
 * 编号 ↔ 类型字符串 ↔ 中文称号
 */

var MBTI_MAP = {
  1:  { type: 'INTJ', title: '冷静型控场者' },
  2:  { type: 'INTP', title: '模型型分析者' },
  3:  { type: 'ENTJ', title: '主导型指挥者' },
  4:  { type: 'ENTP', title: '扰动型试探者' },
  5:  { type: 'INFJ', title: '远读型观察者' },
  6:  { type: 'INFP', title: '直觉型守序者' },
  7:  { type: 'ENFJ', title: '节奏型组织者' },
  8:  { type: 'ENFP', title: '机会型游走者' },
  9:  { type: 'ISTJ', title: '纪律型执行者' },
  10: { type: 'ISFJ', title: '防守型稳定者' },
  11: { type: 'ESTJ', title: '规则型控场者' },
  12: { type: 'ESFJ', title: '协同型支援者' },
  13: { type: 'ISTP', title: '冷启动分析者' },
  14: { type: 'ISFP', title: '低频型感知者' },
  15: { type: 'ESTP', title: '高频型响应者' },
  16: { type: 'ESFP', title: '现场型响应者' }
};

var MBTI_CODE_MAP = {};
Object.keys(MBTI_MAP).forEach(function (code) {
  MBTI_CODE_MAP[MBTI_MAP[code].type] = parseInt(code);
});

/** MBTI 认知特征标签 */
var MBTI_TRAITS = {
  INTJ: ['战略思维', '长期主义', '独立决策', '风险克制'],
  INTP: ['模式识别', '逻辑推演', '灵活变通', '深度分析'],
  ENTJ: ['节奏主导', '稳压决策', '目标驱动', '结构化执行'],
  ENTP: ['机会捕捉', '多线程思维', '扰动试探', '快速切换'],
  INFJ: ['远距阅读', '模式感知', '隐性节奏', '直觉判断'],
  INFP: ['价值驱动', '低频高质', '模式识别', '原则坚守'],
  ENFJ: ['节奏组织', '协同驱动', '情绪感知', '团队节奏'],
  ENFP: ['机会游走', '高频切换', '情绪带动', '灵活应变'],
  ISTJ: ['纪律执行', '稳定节奏', '规则遵循', '低失误率'],
  ISFJ: ['边界稳固', '稳定输出', '风险规避', '持久耐力'],
  ESTJ: ['规则控场', '节奏控制', '稳压执行', '结构化打法'],
  ESFJ: ['协同支援', '团队配合', '节奏感知', '稳定贡献'],
  ISTP: ['冷启动分析', '精准出手', '独立决策', '效率优先'],
  ISFP: ['低频感知', '直觉捕捉', '柔韧应变', '安静观察'],
  ESTP: ['高频响应', '即时反应', '快速决策', '窗口执行'],
  ESFP: ['现场响应', '即时反应', '高频决策', '情绪感知']
};

module.exports = {
  MBTI_MAP: MBTI_MAP,
  MBTI_CODE_MAP: MBTI_CODE_MAP,
  MBTI_TRAITS: MBTI_TRAITS
};
