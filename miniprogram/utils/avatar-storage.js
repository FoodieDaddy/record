/**
 * 识别徽标存储抽象层
 *
 * 对外只暴露两个方法：
 *   uploadAvatar(tempFilePath)  — 上传识别徽标，返回可持久化的 URL（fileID 或 https URL）
 *   resolveAvatarSrc(avatarUrl) — 将 avatarUrl 解析为可渲染的 src（cloud:// → https 临时 URL）
 *
 * provider 由 config.storageProvider 控制：
 *   cloudbase — 开发测试阶段，使用 wx.cloud 云存储
 *   cos       — 后期预留，使用后端 presign 直传 COS
 *   aliyun    — 旧模式，使用后端 presign 直传阿里云 OSS
 */

const config = require('../config');
const { get } = require('./request');
const { normalizeAvatarUrl } = require('./avatar');

// ── cloud:// → https 临时 URL 内存缓存 ──

const _tempUrlCache = new Map();
const CACHE_TTL = 8 * 60 * 1000; // 8 分钟（临时链接默认 10 分钟有效期）

/**
 * 获取当前存储 provider
 */
function getProvider() {
  return config.storageProvider || 'cloudbase';
}

// ── 上传 ──

/**
 * 上传识别徽标
 * @param {string} tempFilePath 临时文件路径（wx.chooseMedia 返回）
 * @returns {Promise<string>} 可持久化的 URL（cloud:// fileID 或 https URL）
 */
async function uploadAvatar(tempFilePath) {
  if (!tempFilePath) throw new Error('缺少临时文件路径');

  const provider = getProvider();

  if (provider === 'cloudbase') {
    return _uploadViaCloudBase(tempFilePath);
  }

  // cos / aliyun 走后端 presign 直传
  return _uploadViaPresign(tempFilePath);
}

/**
 * CloudBase 直传
 */
async function _uploadViaCloudBase(tempFilePath) {
  const app = getApp();
  const userId = app.globalData.userId || 'anon';
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  // 路径格式：users/{userId}/avatar/{timestamp}_{random}.jpg
  const cloudPath = `users/${userId}/avatar/${ts}_${rand}.jpg`;

  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath,
      success(res) {
        if (res.fileID) {
          resolve(res.fileID);
        } else {
          reject(new Error('上传失败'));
        }
      },
      fail(err) {
        reject(new Error('上传失败'));
      }
    });
  });
}

/**
 * 后端 presign 直传（aliyun / cos 模式）
 */
async function _uploadViaPresign(tempFilePath) {
  const fileData = await new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath: tempFilePath,
      success: res => resolve(res.data),
      fail: reject
    });
  });

  const contentLength = fileData.byteLength || fileData.length || 0;
  const contentType = 'image/jpeg';

  const presignData = await get(
    `/storage/presign?contentType=${encodeURIComponent(contentType)}&contentLength=${encodeURIComponent(contentLength)}`
  );

  if (!presignData || !presignData.uploadUrl) {
    throw new Error('获取上传凭证失败');
  }

  await new Promise((resolve, reject) => {
    wx.request({
      url: presignData.uploadUrl,
      method: 'PUT',
      data: fileData,
      header: {
        'Content-Type': contentType,
        'Content-Length': String(contentLength)
      },
      success(res) {
        if (res.statusCode === 200) resolve();
        else reject(new Error('上传失败'));
      },
      fail: reject
    });
  });

  return presignData.accessUrl || presignData.objectKey;
}

// ── 解析 ──

/**
 * 将 avatarUrl 解析为可渲染的图片 src
 * - cloud:// → 通过 wx.cloud.getTempFileURL 换成临时 https URL（内存缓存）
 * - https:// / http:// / wxfile:// / data:image/ → 直接返回
 * - 其他 → 返回空串
 *
 * @param {string} avatarUrl
 * @returns {Promise<string>} 可用于 <image src=""> 的 URL
 */
async function resolveAvatarSrc(avatarUrl) {
  const normalized = normalizeAvatarUrl(avatarUrl);
  if (!normalized) return '';

  // 非 cloud:// 直接返回
  if (!normalized.startsWith('cloud://')) return normalized;

  // 检查内存缓存
  const cached = _tempUrlCache.get(normalized);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.url;
  }

  // 调用 wx.cloud.getTempFileURL
  try {
    const res = await new Promise((resolve, reject) => {
      wx.cloud.getTempFileURL({
        fileList: [normalized],
        success: resolve,
        fail: reject
      });
    });

    if (res.fileList && res.fileList.length > 0 && res.fileList[0].tempFileURL) {
      const httpsUrl = res.fileList[0].tempFileURL;
      _tempUrlCache.set(normalized, { url: httpsUrl, ts: Date.now() });
      return httpsUrl;
    }
  } catch (e) {
    // 解析失败，回退
  }

  // 解析失败，返回空串（触发首字头像回退）
  return '';
}

/**
 * 批量解析 avatarUrl（用于编队成员列表等场景，减少 getTempFileURL 调用次数）
 * @param {string[]} avatarUrls
 * @returns {Promise<Object<string, string>>} avatarUrl → resolvedSrc 映射
 */
async function resolveAvatarSrcBatch(avatarUrls) {
  const result = {};
  if (!avatarUrls || avatarUrls.length === 0) return result;

  // 分离 cloud:// 和非 cloud://
  const cloudUrls = [];
  for (const url of avatarUrls) {
    const normalized = normalizeAvatarUrl(url);
    if (!normalized) {
      result[url] = '';
      continue;
    }
    if (!normalized.startsWith('cloud://')) {
      result[url] = normalized;
      continue;
    }
    // 检查缓存
    const cached = _tempUrlCache.get(normalized);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      result[url] = cached.url;
      continue;
    }
    cloudUrls.push(normalized);
  }

  // 批量解析 cloud:// URL（最多 50 个）
  if (cloudUrls.length > 0) {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.cloud.getTempFileURL({
          fileList: cloudUrls.slice(0, 50),
          success: resolve,
          fail: reject
        });
      });
      if (res.fileList) {
        for (const item of res.fileList) {
          if (item.tempFileURL) {
            _tempUrlCache.set(item.fileID, { url: item.tempFileURL, ts: Date.now() });
            // 在原始 avatarUrls 中找到匹配项
            result[item.fileID] = item.tempFileURL;
          }
        }
      }
    } catch (e) {
      // 批量解析失败，逐个回退
    }
  }

  // 对未解析成功的 cloud:// URL 返回空串
  for (const url of avatarUrls) {
    if (result[url] === undefined) {
      const normalized = normalizeAvatarUrl(url);
      result[url] = normalized && !normalized.startsWith('cloud://') ? normalized : '';
    }
  }

  return result;
}

module.exports = {
  uploadAvatar,
  resolveAvatarSrc,
  resolveAvatarSrcBatch,
  getProvider
};
