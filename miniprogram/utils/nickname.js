/**
 * 昵称生成器 — 复刻后端 NicknameGenerator.java
 * 按权重随机选择组合模板，所有组合严格 ≤ 6 字符
 */

// ── 2 字符前置修饰语 ──
const ADJ2 = [
  '深空','冷静','静默','星港','航电','蓝光','银翼','低噪',
  '稳态','夜航','巡航','极轨','脉冲','量测','同步','校准',
  '记录','矩阵','回路','信标','舱段','终端','观测','复盘'
];

// ── 3 字符前置修饰语 ──
const ADJ3 = [
  '低噪的','校准中','巡航中','同步中','观测中','待命中',
  '稳态的','深空的','航电的','矩阵的','冷启动','微光的',
  '蓝移的','静默的','归档中','复盘中','信标的','舱内的'
];

// ── 4 字符名词/状态/成语 ──
const NOUN4 = [
  '星轨巡游','仪表校准','声纳回响','数据回环','舰桥待命',
  '低噪观测','航电巡检','空间记录','脉冲归档','矩阵同步',
  '信标常亮','冷光复盘','轨道校时','终端在线','蓝光记录',
  '回路稳定','舱段巡查','静默采样','态势观察','协议就绪'
];

// ── 5~6 字符长前缀/长状态 ──
const NOUN5_6 = [
  '星港调度员','穿梭机长','局外观察员','跨域通信员','舰桥播报员',
  '矩阵记录员','轨道巡检员','深空校准员','低噪观察员','脉冲归档员',
  '航电同步员','空间接入员'
];

// ── 1~2 字符称呼/头衔 ──
const NAME2 = [
  '舵手','领航','舰桥','星港','通信',
  '夜航','地勤','热舱','巡检','护盾','脉冲','航电','引擎',
  '星轨','搭档','听客','记录','矩阵','信标','雷达','舱段',
  '终端','样本','节点','回路','静默','蓝光','银翼','归档',
  '校时','控台','接入','观测','复盘','协议'
];

// ── 3 字符称呼/头衔 ──
const NAME3 = [
  '扫描员','练习生','记录官','细节控','护航员','监听者',
  '守门员','星航员','主理人','主心骨','老玩家','调度员',
  '校准员','巡检员','观察员','同步员','归档员','接入员',
  '值班员','复盘员','读数员','控台手','信标员','样本员'
];

// ── 1~2 字符动作/结尾词 ──
const SUFFIX2 = [
  '启动','待命','接入','同步','校准','巡检','记录','复盘',
  '归档','上线','读数','观测','回传','采样','静默','校时'
];

// ── 3 字符动作/结尾词 ──
const SUFFIX3 = [
  '已接入','已同步','已校准','已待命','已归档','巡航中',
  '观测中','记录中','复盘中','低噪中','回传中','校时中'
];

// ── 4 字符动作/结尾词 ──
const SUFFIX4 = [
  '进入巡航','保持低噪','完成校准','完成同步','等待接入',
  '记录就绪','归档就绪','信标常亮','航电在线','矩阵在线',
  '回路稳定','样本就绪'
];

// ── 模板定义：{ weight, generate } ──
const TEMPLATES = [
  { weight: 5, generate: () => pick(ADJ2) + pick(NAME2) },
  { weight: 5, generate: () => pick(ADJ2) + pick(NAME3) },
  { weight: 5, generate: () => pick(ADJ3) + pick(NAME2) },
  { weight: 5, generate: () => pick(ADJ3) + pick(NAME3) },
  { weight: 5, generate: () => pick(NAME2) + pick(SUFFIX2) },
  { weight: 5, generate: () => pick(NAME2) + pick(SUFFIX3) },
  { weight: 5, generate: () => pick(NAME2) + pick(SUFFIX4) },
  { weight: 5, generate: () => pick(NAME3) + pick(SUFFIX2) },
  { weight: 5, generate: () => pick(NAME3) + pick(SUFFIX3) },
  { weight: 5, generate: () => pick(NAME2) },
  { weight: 5, generate: () => pick(NAME3) },
  { weight: 2, generate: () => pick(NOUN4) },
  { weight: 2, generate: () => pick(NOUN5_6) }
];

// 计算总权重
const TOTAL_WEIGHT = TEMPLATES.reduce((sum, t) => sum + t.weight, 0);

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 按权重随机选择模板并生成昵称
 */
function generate() {
  let hit = Math.floor(Math.random() * TOTAL_WEIGHT);
  for (const tpl of TEMPLATES) {
    hit -= tpl.weight;
    if (hit < 0) return tpl.generate();
  }
  return TEMPLATES[0].generate();
}

module.exports = { generate, generateNickname: generate };
