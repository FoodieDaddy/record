/**
 * 脉冲终端 — 全局术语常量
 * 所有页面展示文案统一引用此文件，减少硬编码
 *
 * 注：当前未被页面 import，仅作权威参考。
 * 工程层 room / fortune / all_record / dimensions 等命名保留不动。
 */
const TERMINOLOGY = {
  appName: '脉冲方舟',
  appEnglishName: 'PULSE ARK',

  // 编队（旧称）
  space: '编队',
  spaceCore: '编队核心',
  activeSpace: '当前编队',
  createSpace: '创建编队',
  joinSpace: '加入编队',
  leaveSpace: '退出编队',
  closeSpace: '解散编队',
  accessCode: '编队码',
  spaceAccessCode: '编队码',
  beacon: '信标',
  joinBeacon: '加入信标',
  shareBeacon: '发送信标',
  saveBeacon: '保存信标',
  scanBeacon: '扫描信标',
  scanSpace: '扫描加入',
  roomCode: '编队码',

  // 角色
  controller: '编队主控',
  member: '成员',
  crew: '乘员',
  slot: '舱位',
  adjustSlot: '调整舱位',

  // 任务
  mission: '航程',
  activeMission: '当前航程',
  missionActive: '航程进行中',
  missionSealed: '航程已封存',
  sealMission: '封存航程',
  missionDossier: '航程档案',
  missionLog: '航程日志',

  // 数值
  pulse: '脉冲',
  recordPulse: '记录脉冲',
  pulseLog: '脉冲日志',
  value: '数值',
  valueChange: '数值变化',
  valueFlow: '数值流向',
  valueSummary: '数值汇总',
  flowShift: '流向调整',
  flowConfirm: '确认流转',
  sequence: '实时序列',
  netValue: '净数值',

  // 档案
  dossier: '档案',
  dossierArchive: '档案库',
  archive: '归档',
  missionArchive: '航程封存',

  // 镜像
  mirrorCore: '镜像核心',
  personaProtocol: '人格协议',
  personaCalibration: '人格校准',
  protocolRevision: '协议修订',
  recalibrate: '重新校准',
  taskMirror: '航程镜像',

  // 指令（导航核心）
  oracleCore: '导航核心',
  strategyCard: '指令投影',
  fieldStatus: '状态读数',
  actionHint: '推进节奏',
  riskNotice: '安全边界',
  actionAdvantage: '推进节奏',
  regenerate: '重新计算',

  // 档案（身份）
  identityCore: '档案核心',
  identityDossier: '识别档案',
  systemControl: '系统控制',
  voiceProfile: '声音协议',
  voiceModule: '音色模块',
  terminalConfig: '装备协议',
  disconnectTerminal: '断开终端',
  fxProtocol: '动效协议',
  hapticProtocol: '触感协议',
  aboutTerminal: '关于终端',

  // 状态语言
  statusStandby: '等待接入',
  statusOnline: '编队已开启',
  statusMissionActive: '航程进行中',
  statusSealPending: '航程待封存',
  statusSealed: '航程已封存',
  statusClosed: '编队已关闭',

  // 航迹档案（旧称）
  blackBox: '航迹档案',

  // 系统编号前缀
  spacePrefix: 'SP',
  missionPrefix: 'MS',
  dossierPrefix: 'DS',

  // 结构推演（替代非策略化表达）
  structureDeduction: '结构推演',
  fieldAnalysis: '场域分析',

  // 通用
  online: '在线',
  offline: '离线',
  systemStatus: '系统状态',
  confirm: '确认',
  cancel: '取消',
  loading: '加载中',
  noData: '暂无数据',
  scoreModel: '数值模型',
  zeroSum: '零和封存',
  freeSum: '自由封存'
}

module.exports = TERMINOLOGY
