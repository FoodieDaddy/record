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
const _resolvingMap = new Map(); // 记录正在进行的解析请求，防止重复发起
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
  const cloudPath = `images/${Date.now()}.png`;

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

  // 1. 检查内存缓存
  const cached = _tempUrlCache.get(normalized);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.url;
  }

  // 2. 检查是否有正在进行的相同请求（并发去重）
  if (_resolvingMap.has(normalized)) {
    return _resolvingMap.get(normalized);
  }

  // 3. 发起请求并记录到 resolvingMap
  const resolvePromise = new Promise(async (resolve) => {
    try {
      const res = await new Promise((resInner, rejInner) => {
        wx.cloud.getTempFileURL({
          fileList: [normalized],
          success: resInner,
          fail: rejInner
        });
      });

      if (res.fileList && res.fileList.length > 0) {
        const item = res.fileList[0];
        if (item.status === 0 && item.tempFileURL) {
          const httpsUrl = item.tempFileURL;
          _tempUrlCache.set(normalized, { url: httpsUrl, ts: Date.now() });
          resolve(httpsUrl);
        } else {
          console.warn('[avatar-storage] 单个云头像解析失败:', normalized, '原因:', item.errMsg, '状态码:', item.status);
          resolve('');
        }
      } else {
        console.warn('[avatar-storage] 单个云头像解析返回为空列表:', normalized);
        resolve('');
      }
    } catch (e) {
      console.error('[avatar-storage] 解析单个云头像异常:', e);
      resolve('');
    } finally {
      // 完成后清理记录
      _resolvingMap.delete(normalized);
    }
  });

  _resolvingMap.set(normalized, resolvePromise);
  return resolvePromise;
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
          if (item.status === 0 && item.tempFileURL) {
            _tempUrlCache.set(item.fileID, { url: item.tempFileURL, ts: Date.now() });
            // 在原始 avatarUrls 中找到匹配项
            result[item.fileID] = item.tempFileURL;
          } else {
            console.warn('[avatar-storage] 批量解析失败项:', item.fileID, '原因:', item.errMsg, '状态码:', item.status);
            // 明确将其标记为空字符串，代表解析失败，不要让它成为 undefined
            result[item.fileID] = '';
          }
        }
      }
    } catch (e) {
      console.error('[avatar-storage] 批量解析异常:', e);
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
  getProvider,
  /** 清除指定 cloud:// URL 的临时 URL 缓存，用于过期后重试 */
  clearTempUrlCache,
  _tempUrlCache,
  _resolvingMap
};

/**
 * 清除临时 URL 缓存（全部或指定 cloud:// URL）
 * @param {string} [cloudUrl] 可选，指定则只清除该条
 */
function clearTempUrlCache(cloudUrl) {
  if (cloudUrl) {
    _tempUrlCache.delete(cloudUrl);
  } else {
    _tempUrlCache.clear();
  }
}
