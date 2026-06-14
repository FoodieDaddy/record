/**
 * 记分服务 — 封装记分相关 API
 */
const { get, post, createRequestId } = require('../utils/request');

/** 获取房间排行榜 */
function getRoomRanking(roomId) {
  return get(`/score/room/${roomId}/ranking`);
}

/** 获取房间折线图数据 */
function getRoomChart(roomId) {
  return get(`/score/room/${roomId}/chart`);
}

/** 获取房间关系网络 */
function getRoomNetwork(roomId) {
  return get(`/score/room/${roomId}/network`);
}

/** 获取房间洞察 */
function getRoomInsight(roomId) {
  return get(`/score/room/${roomId}/insight`);
}

/** 获取房间最近记分记录 */
function getRoomRecentScores(roomId, count) {
  return get(`/score/room/${roomId}/recent`, { count });
}

/** 获取房间总览 */
function getRoomOverview(roomId) {
  return get(`/score/room/${roomId}/overview`);
}

/** 获取房间流水 */
function getRoomTransfers(roomId, page, size) {
  return get(`/score/transfer/room/${roomId}`, { page, size });
}

/** 获取转出金额推荐 */
function getTransferAmountSuggestions(roomId) {
  return get(`/score/room/${roomId}/transfer-amount-suggestions`);
}

/** 提交记分 */
function submitScore(payload) {
  return post('/score', payload).then(res => {
    try {
      const behaviorLogger = require('../utils/behavior-logger');
      behaviorLogger.track('PULSE_RECORD', {
        action: 'SUBMIT',
        roomId: payload.roomId,
        scoresCount: payload.scores ? Object.keys(payload.scores).length : 0
      });
    } catch(e) {}
    return res;
  });
}

/** 发起转分 */
function transferScore(payload) {
  const clientRequestId = payload.clientRequestId || createRequestId();
  return post('/score/transfer', { ...payload, clientRequestId }).then(res => {
    try {
      const behaviorLogger = require('../utils/behavior-logger');
      behaviorLogger.track('PULSE_RECORD', {
        action: 'TRANSFER',
        roomId: payload.roomId,
        amount: payload.amount
      });
    } catch(e) {}
    return res;
  });
}

/** 结束对局 */
function settleRoom(roomId) {
  return post(`/score/room/${roomId}/settle`, { clientRequestId: createRequestId() }, { silent: true }).then(res => {
    try {
      const behaviorLogger = require('../utils/behavior-logger');
      behaviorLogger.track('FLEET_ARCHIVE', {
        roomId: roomId
      });
    } catch(e) {}
    return res;
  });
}

/** 获取收益日志 */
function getYieldLog() {
  return get('/score/yield-log');
}

module.exports = {
  getRoomRanking,
  getRoomChart,
  getRoomNetwork,
  getRoomInsight,
  getRoomRecentScores,
  getRoomOverview,
  getRoomTransfers,
  getTransferAmountSuggestions,
  submitScore,
  transferScore,
  settleRoom,
  getYieldLog,
};
