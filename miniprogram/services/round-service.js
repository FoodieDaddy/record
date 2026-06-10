/**
 * 本局录入服务 — 封装轮次相关 API
 */
const { get, post, createRequestId } = require('../utils/request');

/** 发起本局录入 */
function startRound(roomId) {
  return post('/round/start', { roomId });
}

/** 提交轮次分数 */
function submitRoundScores(roomId, scores) {
  return post('/round/submit', { roomId, scores, clientRequestId: createRequestId() });
}

/** 确认轮次 */
function confirmRound(roomId, agree) {
  return post('/round/confirm', { roomId, agree, clientRequestId: createRequestId() });
}

/** 取消轮次 */
function cancelRound(roomId) {
  return post(`/round/cancel?roomId=${roomId}`);
}

/** 获取待处理轮次 */
function getPendingRound(roomId) {
  return get(`/round/pending?roomId=${roomId}`);
}

module.exports = {
  startRound,
  submitRoundScores,
  confirmRound,
  cancelRound,
  getPendingRound,
};
