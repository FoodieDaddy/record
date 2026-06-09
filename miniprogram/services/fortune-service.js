/**
 * 指令服务 — 封装今日指令 API
 */
const { get } = require('../utils/request');

/** 获取今日指令 */
function getTodayFortune(params) {
  return get('/fortune/today', params, { timeout: 30000 });
}

module.exports = {
  getTodayFortune,
};
