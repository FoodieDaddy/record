/**
 * 环境配置 — 支持 local / anyservice / prod 三种模式
 *
 * mode 说明：
 *   local       本地开发，直连本机或局域网 Spring Boot 后端
 *   anyservice  云开发 AnyService，走 wx.cloud.callContainer
 *   prod        正式域名，走 wx.request + HTTPS
 *
 * 使用方式：
 *   - 本地开发保持 mode: 'local'，无需 CloudBase
 *   - 切换到 anyservice 前需填写 cloudEnvId 和 serviceName
 *   - prod 模式填写正式域名
 */

const ENV = {
  mode: 'local',

  local: {
    apiBaseUrl: 'http://192.168.31.167:18080',
    wsUrl: 'ws://192.168.31.167:18080'
  },

  anyservice: {
    cloudEnvId: '',        // 替换为实际 CloudBase 环境 ID
    serviceName: 'smartrecord-api',
    serverUrl: '',         // 后端服务器地址（音频下载等非 API 请求需要）
    apiPrefix: '/api',     // 后端 context-path
    wsUrl: ''              // AnyService WebSocket 需真机验证后填写
  },

  prod: {
    apiBaseUrl: 'https://your-domain.com',
    wsUrl: 'wss://your-domain.com'
  },

  timeout: {
    normal: 10000,
    directive: 30000
  },

  /** 存储配置 */
  storage: {
    /** 当前存储 provider: cloudbase / cos / aliyun */
    provider: 'cloudbase',
    /** CloudBase 环境 ID（provider=cloudbase 时必填） */
    cloudbaseEnvId: 'cloud1-d3g6oa11id960ba31'
  },

  /** AI 代理配置 */
  ai: {
    /** AI 提供者: 'cloudbase-proxy' | 'backend' */
    provider: 'cloudbase-proxy',
    /** CloudBase 环境 ID（空则降级 backend） */
    cloudEnvId: 'cloud1-d3g6oa11id960ba31',
    /** CloudBase AI 子模型名 */
    model: 'hy3-preview',
    /** 云函数超时 ms */
    timeout: 20000,
    /** prompt 版本号，变更后自动使旧 portraitCache 失效 */
    promptVersion: '1'
  }
};

module.exports = ENV;
