/**
 * 镜像模块 API 封装
 */
const { request, get, post } = require('./request');

module.exports = {
  getMirrorProfile: () => get('/mirror/profile'),
  refreshMirrorProfile: () => post('/mirror/profile/refresh'),
  submitMbtiTest: (data) => post('/mirror/mbti/test', data).then(res => {
    try {
      const behaviorLogger = require('./behavior-logger');
      behaviorLogger.track('PERSONAL_CALIBRATION', { type: 'TEST' });
    } catch(e) {}
    return res;
  }),
  submitMbtiDirect: (data) => post('/mirror/mbti/direct', data).then(res => {
    try {
      const behaviorLogger = require('./behavior-logger');
      behaviorLogger.track('PERSONAL_CALIBRATION', { type: 'DIRECT', mbti: data.mbti });
    } catch(e) {}
    return res;
  }),
  getMirrorStats: () => get('/mirror/stats'),
  getCurrentUser: () => request({ url: '/user/me', method: 'GET', silent: true }),
};
