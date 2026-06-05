/**
 * 镜像模块 API 封装
 */
const { get, post } = require('./request');

module.exports = {
  getMirrorProfile: () => get('/mirror/profile'),
  refreshMirrorProfile: () => post('/mirror/profile/refresh'),
  submitMbtiTest: (data) => post('/mirror/mbti/test', data),
  submitMbtiDirect: (data) => post('/mirror/mbti/direct', data),
  getMirrorStats: () => get('/mirror/stats'),
};
