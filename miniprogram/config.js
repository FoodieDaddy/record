/**
 * 环境配置 — 切换开发/生产环境
 */
const ENV = {
  local: {
    baseUrl: 'http://localhost:18080/api'
  },
  dev: {
    baseUrl: 'http://8.148.245.54:18080/api'
  },
  prod: {
    baseUrl: 'https://your-domain.com/api'
  }
};

// 切换此处切换环境: local=本地, dev=阿里云服务器, prod=生产
const currentEnv = 'local';

module.exports = ENV[currentEnv];
