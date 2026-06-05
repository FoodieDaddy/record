/**
 * 镜像模块 API 封装
 */
const { get, post } = require('./request');

module.exports = {
  getMirrorDashboard: () => get('/mirror/dashboard'),
  submitMbtiTest: (data) => post('/mirror/mbti/test', data),
  submitMbtiDirect: (data) => post('/mirror/mbti/direct', data),
  runMirrorTool: (data) => post('/mirror/tool/run', data),
  getMirrorReport: (id) => get('/mirror/report/' + id),
  getMirrorArchive: (params) => get('/mirror/archive', params),
  saveBirthProfile: (data) => post('/mirror/birth-profile', data),
  getBirthProfile: () => get('/mirror/birth-profile'),
};
