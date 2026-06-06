/**
 * 脉冲终端 — 展示适配层
 * 后端状态码/枚举 → 前端展示文案
 */

function formatRoomStatus(status) {
  const map = {
    ACTIVE: '任务进行中',
    SETTLED: '任务已封存',
    CLOSED: '空间已关闭',
    WAITING: '等待接入'
  }
  return map[status] || '未知状态'
}

function formatScoreMode(mode) {
  return mode === 1 ? '自由流转' : '本局录入'
}

function formatRoundInputMethod(method) {
  return method === 1 ? '主控填写' : '成员自填'
}

function formatTrustMode(mode) {
  return mode === 0 ? '标准协议' : '快速协议'
}

function formatZeroSum(val) {
  return val === 1 ? '零和封存' : '自由封存'
}

function formatUserTag(tag) {
  const map = {
    WINNING_STREAK: '连胜状态',
    LOSING_STREAK: '连败状态',
    HIGH_RISK: '高风险',
    STABLE: '稳健'
  }
  return map[tag] || tag
}

module.exports = {
  formatRoomStatus,
  formatScoreMode,
  formatRoundInputMethod,
  formatTrustMode,
  formatZeroSum,
  formatUserTag
}
