/**
 * 头像生成与同步辅助器
 * 处理新用户注册时异步生图、直传云开发存储、同步到后端的闭环流程，并包含网络波动重试机制。
 */
const { uploadAvatar } = require('./avatar-storage');
const { saveProfile } = require('../services/profile-service');

/**
 * 触发异步头像生成（如果用户头像为空）
 */
function triggerAvatarGenerationIfNeeded() {
  const app = getApp();
  const token = app.globalData.token || wx.getStorageSync('token');
  if (!token) return;

  const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
  const avatarUrl = userInfo ? (userInfo.avatarUrl || userInfo.avatar) : '';

  // 如果已有永久头像（以 cloud:// 或 http(s):// 开头），跳过生成
  if (avatarUrl && (avatarUrl.startsWith('cloud://') || avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'))) {
    console.log('[AvatarGen] 用户已有有效头像，跳过生成:', avatarUrl);
    return;
  }

  // 检查生图锁，避免重复调用
  if (wx.getStorageSync('generating_avatar_lock')) {
    console.log('[AvatarGen] 生图任务正在运行中，跳过重复触发');
    return;
  }

  console.log('[AvatarGen] 用户头像为空，开始异步调用云开发生图接口...');
  wx.setStorageSync('generating_avatar_lock', true);

  wx.cloud.callFunction({
    name: 'generateImage-1M0y65',
    data: {
      prompt: '一个可爱的人物大头像，科幻飞船驾驶舱风格，扁平化，高质感，圆形徽章感'
    },
    success: res => {
      const result = res.result || {};
      if (result.success && result.imageUrl) {
        console.log('[AvatarGen] 头像生成成功，图片地址:', result.imageUrl);
        // 下载并直传
        _downloadAndUploadAvatar(result.imageUrl);
      } else {
        console.error('[AvatarGen] 头像生成失败:', result.code, result.message);
        wx.removeStorageSync('generating_avatar_lock');
      }
    },
    fail: err => {
      console.error('[AvatarGen] 异步调用生图云函数失败:', err);
      wx.removeStorageSync('generating_avatar_lock');
    }
  });
}

/**
 * 下载生图链接并直传云存储
 */
async function _downloadAndUploadAvatar(imageUrl) {
  try {
    // 1. 下载临时图片文件到本地
    const tempFile = await new Promise((resolve, reject) => {
      wx.downloadFile({
        url: imageUrl,
        success: res => {
          if (res.statusCode === 200) resolve(res.tempFilePath);
          else reject(new Error(`下载图片失败 HTTP ${res.statusCode}`));
        },
        fail: reject
      });
    });

    console.log('[AvatarGen] 下载临时文件成功:', tempFile);

    // 2. 直传至微信云开发存储/OSS（根据当前存储引擎配置）
    const permanentUrl = await uploadAvatar(tempFile);
    console.log('[AvatarGen] 头像直传云端成功:', permanentUrl);

    // 3. 写入本地待更新缓存，准备上传后端（防网络波动核心）
    wx.setStorageSync('pending_avatar_update', permanentUrl);
    wx.removeStorageSync('generating_avatar_lock');

    // 4. 同步至后端并清理
    await syncPendingAvatarToBackend();
  } catch (e) {
    console.error('[AvatarGen] 下载或直传默认头像失败:', e);
    wx.removeStorageSync('generating_avatar_lock');
  }
}

/**
 * 同步缓存中挂起的头像文件至后端数据库（支持断网重试）
 */
async function syncPendingAvatarToBackend() {
  const pendingUrl = wx.getStorageSync('pending_avatar_update');
  if (!pendingUrl) return;

  const app = getApp();
  console.log('[AvatarGen] 检查到有挂起的头像需要同步到后端:', pendingUrl);

  try {
    // 调用更新个人资料 API
    await saveProfile({ avatarUrl: pendingUrl });
    console.log('[AvatarGen] 默认头像同步后端成功，清理挂起任务');

    // 成功后清理本地重试缓存
    wx.removeStorageSync('pending_avatar_update');

    // 更新全局的 userInfo 并发出通知
    if (app) {
      app.updateUserInfo({ avatarUrl: pendingUrl });
      // 触发当前页面刷新（如果页面有更新方法）
      const pages = getCurrentPages();
      if (pages.length > 0) {
        const currentPage = pages[pages.length - 1];
        if (currentPage && typeof currentPage.updateAvatar === 'function') {
          currentPage.setData({ 'userInfo.avatarUrl': pendingUrl });
          currentPage.updateAvatar();
        }
      }
    }
  } catch (err) {
    console.warn('[AvatarGen] 同步头像至后端失败（可能由于网络波动），保留重试标记:', err.message || err);
  }
}

module.exports = {
  triggerAvatarGenerationIfNeeded,
  syncPendingAvatarToBackend
};
