/**
 * 环境配置 — 切换开发/生产环境
 */
const ENV = {
  dev: {
    baseUrl: 'http://localhost:18080/api'
  },
  prod: {
    baseUrl: 'https://your-domain.com/api'
  }
};

// 切换此处切换环境
const currentEnv = 'dev';

module.exports = ENV[currentEnv];
