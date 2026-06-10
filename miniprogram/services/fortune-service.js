/**
 * 指令服务 — 封装今日指令 API
 *
 * 支持 CloudBase 云函数代理（cloudbase-proxy）和后端直连（backend）两种路径：
 * - cloudbase-proxy：有 portraitCache 时走云函数快路径，无缓存时走后端权威路径并写入缓存
 * - backend：直连 Spring Boot 后端（local 模式默认）
 *
 * 降级链：CloudBase 云函数 → 失败 → 后端 /fortune/today
 */
const config = require('../config');
const { get } = require('../utils/request');

const PORTRAIT_CACHE_KEY = 'portrait_cache';

/** 获取今日指令 — 根据配置选择路径 */
function getTodayFortune(params) {
  if (_shouldUseCloudProxy()) {
    return _getFortuneViaCloudProxy(params);
  }
  return _getFortuneViaBackend(params);
}

/** 判断是否走云函数快路径 */
function _shouldUseCloudProxy() {
  const ai = config.ai;
  return !!(ai && ai.provider === 'cloudbase-proxy' && ai.cloudEnvId);
}

/** 后端路径：Spring Boot */
function _getFortuneViaBackend(params) {
  return get('/fortune/today', params, { timeout: 30000 });
}

/**
 * 云函数快路径：
 * 1. 有有效 portraitCache → 调云函数 aiProxy → CloudBase AI
 * 2. 无 portraitCache → 走后端权威路径，提取 portraitCache 写入本地缓存
 * 3. 云函数失败 → 降级后端
 */
async function _getFortuneViaCloudProxy(params) {
  const portrait = _loadPortraitCache();

  // 无有效 portraitCache → 走后端权威路径，顺便获取画像缓存
  if (!portrait || !_isPortraitValid(portrait)) {
    const data = await _getFortuneViaBackend(params);
    if (data && data.portraitCache) {
      _savePortraitCache(data.portraitCache);
    }
    return data;
  }

  // 有 portraitCache → 调云函数快路径
  try {
    const res = await wx.cloud.callFunction({
      name: 'aiProxy',
      data: {
        action: 'fortune',
        payload: {
          force: params && params.force,
          userTag: portrait.userTag,
          netScore: portrait.netScore,
          recentScores: portrait.recentScores,
          sampleCount: portrait.sampleCount,
        }
      }
    });

    const result = res.result || {};
    if (result.code === 200 && result.data) {
      return result.data;
    }

    // 云函数返回异常 → 降级后端
    throw new Error(result.message || '云函数返回异常');
  } catch (err) {
    console.warn('[fortune] CloudBase 代理失败，降级后端:', err.message || err.errMsg);
    return _getFortuneViaBackend(params);
  }
}

// ==================== portraitCache 读写 ====================

/** 加载本地画像缓存 */
function _loadPortraitCache() {
  try {
    return wx.getStorageSync(PORTRAIT_CACHE_KEY) || null;
  } catch (_) {
    return null;
  }
}

/** 保存画像缓存到本地 */
function _savePortraitCache(cache) {
  try {
    wx.setStorageSync(PORTRAIT_CACHE_KEY, cache);
  } catch (_) {
    // storage 写入失败不影响主流程
  }
}

/** 校验画像缓存是否有效 */
function _isPortraitValid(cache) {
  if (!cache || !cache.userTag) return false;

  // promptVersion 不一致 → 失效
  const currentVersion = config.ai && config.ai.promptVersion;
  if (currentVersion && cache.promptVersion !== currentVersion) return false;

  // expiresAt 已过期 → 失效
  if (cache.expiresAt && Date.now() > cache.expiresAt) return false;

  // userId 不一致 → 失效
  const app = getApp();
  if (app && app.globalData && app.globalData.userId) {
    if (cache.userId && cache.userId !== String(app.globalData.userId)) return false;
  }

  return true;
}

module.exports = {
  getTodayFortune,
};
