/**
 * 环境配置入口
 *
 * 优先级（从高到低）：
 * 1. Storage 运行时覆盖（SMART_RECORD_BASE_URL / SMART_RECORD_WS_URL）
 * 2. env.js 中 mode 对应的配置
 * 3. 默认本地配置
 *
 * 切换环境：
 *   修改 config/env.js 中的 mode 字段为 'local' | 'anyservice' | 'prod'
 */
const ENV = require('./config/env');

/** 运行时 Storage 覆盖（真机调试 / 灰度环境注入） */
function readRuntimeOverride() {
  try {
    const baseUrl = wx.getStorageSync('SMART_RECORD_BASE_URL');
    const wsUrl = wx.getStorageSync('SMART_RECORD_WS_URL');
    if (baseUrl && wsUrl) {
      return { baseUrl, wsUrl };
    }
  } catch (e) {
    // storage 不可用时回退
  }
  return null;
}

function getEnvVersion() {
  try {
    if (typeof wx.getAccountInfoSync !== 'function') return '';
    const account = wx.getAccountInfoSync();
    return account && account.miniProgram && account.miniProgram.envVersion || '';
  } catch (e) {
    return '';
  }
}

function resolveConfig() {
  // 暂时屏蔽 Storage 运行时覆盖，强制读取 env.js 以使真机 IP 生效
  // const override = readRuntimeOverride();
  // if (override) return override;

  const mode = ENV.mode || 'local';

  if (mode === 'anyservice') {
    // HTTP API 走 wx.cloud.callContainer，但音频下载等仍需真实服务器地址
    const server = ENV.anyservice.serverUrl || '';
    return {
      baseUrl: server ? `${server}/api` : '',
      wsUrl: ENV.anyservice.wsUrl || ''
    };
  }

  if (mode === 'prod') {
    return {
      baseUrl: `${ENV.prod.apiBaseUrl}/api`,
      wsUrl: `${ENV.prod.wsUrl}/api`
    };
  }

  // local 模式（默认）
  return {
    baseUrl: `${ENV.local.apiBaseUrl}/api`,
    wsUrl: `${ENV.local.wsUrl}/api`
  };
}

const config = resolveConfig();

/** 当前环境模式 */
config.mode = ENV.mode || 'local';

/** 超时配置 */
config.timeout = ENV.timeout || { normal: 10000, directive: 30000 };

/** AnyService 配置（mode === 'anyservice' 时使用） */
config.anyservice = ENV.anyservice || {};

/** 存储配置 */
config.storage = ENV.storage || {};
config.storageProvider = ENV.storage ? ENV.storage.provider : 'cloudbase';

/** AI 代理配置 */
config.ai = ENV.ai || {};

/**
 * 获取 WebSocket URL（供 score-ws.js 使用）
 * @param {string} roomId
 * @returns {string}
 */
config.getWsUrl = function (roomId) {
  const mode = config.mode;
  let base;

  if (mode === 'anyservice') {
    base = config.anyservice.wsUrl || config.wsUrl;
  } else if (mode === 'prod') {
    base = config.wsUrl;
  } else {
    base = config.wsUrl;
  }

  return `${base}/ws/score?roomId=${roomId}`;
};

module.exports = config;
