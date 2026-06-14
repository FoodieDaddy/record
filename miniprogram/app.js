const config = require('./config');
const scoreWS = require('./utils/score-ws');
const { normalizeAvatarUrl } = require('./utils/avatar');
const behaviorLogger = require('./utils/behavior-logger');

// 全局拦截 wx.showToast，代理到 #srToast 组件，实现全项目统一左上角提示
const originalShowToast = wx.showToast;
Object.defineProperty(wx, 'showToast', {
  configurable: true,
  enumerable: true,
  writable: true,
  value: function(options) {
    const pages = getCurrentPages();
    if (pages && pages.length > 0) {
      const currentPage = pages[pages.length - 1];
      const srToast = currentPage.selectComponent('#srToast');
      if (srToast) {
        let type = 'dot-sync';
        if (options.icon === 'none') type = 'dot-info';
        if (options.icon === 'error') type = 'dot-error';
        // 兼容 custom icon
        if (options.image) type = 'dot-info';
        srToast.show(options.title, type, options.duration || 2000);
        return;
      }
    }
    originalShowToast.call(wx, options);
  }
});


App({
  globalData: {
    baseUrl: config.baseUrl,
    token: null,
    userId: null,
    userInfo: null,
    audioEnabled: true,
    animationEnabled: true,
    vibrateEnabled: true,
    enableWechatShare: false,
    activeTabKey: 'cockpit',
    storageProvider: config.storageProvider || 'cloudbase',
    preloads: {}
  },

  onLaunch() {
    // 初始化行为日志收集 SDK
    try {
      behaviorLogger.init();
    } catch (e) {
      console.error('[app] behaviorLogger 初始化失败:', e);
    }

    // CloudBase 初始化：anyservice 模式 / cloudbase 存储 / AI 云函数代理 需要初始化
    const needCloudBase = config.mode === 'anyservice'
      || this.globalData.storageProvider === 'cloudbase'
      || (config.ai && config.ai.provider === 'cloudbase-proxy');
    if (needCloudBase && wx.cloud) {
      const cloudEnvId = (config.ai && config.ai.cloudEnvId)
                         || (config.anyservice && config.anyservice.cloudEnvId)
                         || (config.storage && config.storage.cloudbaseEnvId) || '';
      if (cloudEnvId) {
        try {
          wx.cloud.init({
            env: cloudEnvId,
            traceUser: true
          });
        } catch (e) {
          console.warn('[app] CloudBase 初始化失败，本地开发可忽略:', e);
        }
      }
    }

    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
      this.globalData.userId = String(wx.getStorageSync('userId') || '');
      // 从本地缓存恢复用户信息，避免冷启动时的空窗期
      const cached = wx.getStorageSync('userInfo');
      if (cached) {
        const cleanAvatar = normalizeAvatarUrl(cached.avatarUrl || cached.avatar || cached.headUrl || '');
        this.globalData.userInfo = {
          ...cached,
          avatarUrl: cleanAvatar
        };
        wx.setStorageSync('userInfo', this.globalData.userInfo);
      }
    }
    this.globalData.animationEnabled = wx.getStorageSync('animationEnabled') !== false;
    this.globalData.audioEnabled = wx.getStorageSync('audioEnabled') !== false;
    this.globalData.vibrateEnabled = wx.getStorageSync('vibrateEnabled') !== false;

    // 尝试重试同步挂起的默认头像，如果登录且没有头像，触发生成
    try {
      const avatarGen = require('./utils/avatar-generator-helper');
      avatarGen.syncPendingAvatarToBackend();
      if (token) {
        avatarGen.triggerAvatarGenerationIfNeeded();
      }
    } catch (e) {}
  },

  /**
   * 全局运行时错误拦截埋点
   */
  onError(msg) {
    console.error('[app] 捕获全局 JS 报错:', msg);
    try {
      behaviorLogger.track('JS_ERROR', { error: msg });
    } catch (e) {
      console.error('[app] 自动上报 JS_ERROR 失败', e);
    }
  },

  /**
   * 全局未捕获 Promise Rejection 拦截埋点
   */
  onUnhandledRejection(err) {
    console.warn('[app] 捕获未处理 Promise Rejection:', err);
    try {
      behaviorLogger.track('JS_ERROR', {
        reason: err.reason ? String(err.reason) : 'Unhandled Promise Rejection'
      });
    } catch (e) {
      console.error('[app] 自动上报 onUnhandledRejection 失败', e);
    }
  },

  onShow() {
    // 每次小程序切到前台时，尝试将挂起的默认头像同步给后端（断网恢复对账）
    try {
      const avatarGen = require('./utils/avatar-generator-helper');
      avatarGen.syncPendingAvatarToBackend();
    } catch (e) {}
  },

  setLoginInfo(data) {
    this.globalData.token = data.token;
    this.globalData.userId = String(data.userId);
    const info = { nickname: data.nickname, avatarUrl: normalizeAvatarUrl(data.avatarUrl) };
    this.globalData.userInfo = info;
    wx.setStorageSync('token', data.token);
    wx.setStorageSync('userId', data.userId);
    wx.setStorageSync('userInfo', info);

    // 登录/注册成功后，触发默认头像异步生图任务
    try {
      const avatarGen = require('./utils/avatar-generator-helper');
      avatarGen.triggerAvatarGenerationIfNeeded();
    } catch (e) {}
  },

  /** 局部更新 userInfo（乐观更新时调用） */
  updateUserInfo(partial) {
    const prev = this.globalData.userInfo || {};
    const merged = { ...prev, ...partial };
    if (Object.prototype.hasOwnProperty.call(partial || {}, 'avatarUrl')) {
      merged.avatarUrl = normalizeAvatarUrl(partial.avatarUrl);
    }
    this.globalData.userInfo = merged;
    wx.setStorageSync('userInfo', merged);
  },

  /** 连接房间 WebSocket（进入房间时调用） */
  connectWS(roomId, force = false) {
    scoreWS.connect(roomId, force);
  },

  /** 断开 WebSocket（退出登录/退出房间时调用） */
  disconnectWS() {
    scoreWS.disconnect();
  },

  logout() {
    scoreWS.disconnect();
    scoreWS.clearListeners();
    this.globalData.token = null;
    this.globalData.userId = null;
    this.globalData.userInfo = null;
    wx.clearStorageSync();
  }
});
