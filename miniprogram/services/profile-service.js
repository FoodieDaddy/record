/**
 * 身份服务 — 封装用户/身份相关 API
 */
const { get, put } = require('../utils/request');

/** 获取当前用户信息 */
function getCurrentUser() {
  return get('/user/me');
}

/** 获取身份等级 */
function getIdentityLevel() {
  return get('/user/identity-level');
}

/** 保存用户设置（语音、动效、触感） */
function saveUserSettings(settings) {
  return put('/user/detail', settings);
}

/** 保存个人资料（呼号、头像） */
function saveProfile(data) {
  return put('/user/me', data);
}

/** 获取预签名上传 URL */
function getPresignUrl(contentType, contentLength) {
  return get(
    `/storage/presign?contentType=${encodeURIComponent(contentType)}&contentLength=${encodeURIComponent(contentLength)}`
  );
}

module.exports = {
  getCurrentUser,
  getIdentityLevel,
  saveUserSettings,
  saveProfile,
  getPresignUrl,
};
