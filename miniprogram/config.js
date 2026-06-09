/**
 * 环境配置
 *
 * 默认只保留本机开发和发布占位地址；真机调试或灰度环境可通过
 * wx.setStorageSync('SMART_RECORD_BASE_URL', 'https://example.com/api')
 * wx.setStorageSync('SMART_RECORD_WS_URL', 'wss://example.com/api')
 * 注入运行时地址，避免在仓库中提交服务器 IP。
 */
const DEFAULT_CONFIG = {
  baseUrl: 'http://localhost:18080/api',
  wsUrl: 'ws://localhost:18080/api'
};

const RELEASE_CONFIG = {
  baseUrl: 'https://your-domain.com/api',
  wsUrl: 'wss://your-domain.com/api'
};

function readRuntimeOverride() {
  try {
    const baseUrl = wx.getStorageSync('SMART_RECORD_BASE_URL');
    const wsUrl = wx.getStorageSync('SMART_RECORD_WS_URL');
    if (baseUrl && wsUrl) {
      return { baseUrl, wsUrl };
    }
  } catch (e) {
    // storage 不可用时回退到默认配置
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
  const override = readRuntimeOverride();
  if (override) return override;
  return getEnvVersion() === 'release' ? RELEASE_CONFIG : DEFAULT_CONFIG;
}

module.exports = resolveConfig();
