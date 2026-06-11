/**
 * HTTP 请求封装 — JWT 注入、去重、追踪 ID、统一错误处理
 *
 * 支持三种模式（由 config/env.js 的 mode 控制）：
 *   local       wx.request + 本地/局域网后端
 *   anyservice  wx.cloud.callContainer + CloudBase AnyService
 *   prod        wx.request + 正式域名
 */
const config = require('../config');

/** 进行中的 GET 请求（用于去重） */
const inflight = new Map();

/** 去重请求最大生存期 (ms)，超时自动清除防止永久阻塞 */
const INFLIGHT_TTL = 30000;

/** 网络异常 toast 节流：5s 内只弹一次 */
let _networkToastTime = 0;
/** 业务错误 toast 节流：同一消息 3s 内不重复弹 */
const _bizToastTimes = new Map();
/** 401 登出防抖 */
let _loggingOut = false;

function createRequestId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildRequestKey(options) {
  const method = (options.method || 'GET').toUpperCase();
  const data = options.data ? JSON.stringify(options.data) : '';
  return `${method}:${options.url}:${data}`;
}

function request(options) {
  const app = getApp();
  const key = buildRequestKey(options);
  const method = options.method || 'GET';

  // GET 请求去重（同一 key 的请求进行中时复用）
  if (options.dedupe !== false && method === 'GET') {
    // 清理过期条目
    const now = Date.now();
    for (const [k, v] of inflight) {
      if (now - v.ts > INFLIGHT_TTL) inflight.delete(k);
    }
    if (inflight.has(key)) {
      return inflight.get(key).promise;
    }
  }

  const requestId = createRequestId();
  const start = Date.now();

  const header = {
    'Content-Type': 'application/json',
    'X-Request-Id': requestId,
    ...options.header
  };
  if (app.globalData.token) {
    header['Authorization'] = `Bearer ${app.globalData.token}`;
  }

  const useCloud = config.mode === 'anyservice' && wx.cloud;
  // wx.request 不传 timeout 时默认 60s；callContainer 需显式传入
  const timeout = options.timeout || (useCloud ? config.timeout.normal : undefined);

  const promise = new Promise((resolve, reject) => {
    const onSuccess = (res) => {
      const resData = res.data || {};
      const errCode = resData.code;

      // 身份/Token 相关: 4001=未接入, 4002=已过期, 4004=未识别
      // 账号相关: 4003=已封禁, 4005=已注销
      const isAuthError = errCode === 4001 || errCode === 4002 || errCode === 4004;
      const isAccountError = errCode === 4003 || errCode === 4005;
      if (res.statusCode === 401 || isAuthError || isAccountError) {
        const msg = isAccountError ? (resData.message || '账号异常') : '接入已过期';
        // 防抖：避免并发 401 重复登出
        if (!_loggingOut) {
          _loggingOut = true;
          app.logout();
          wx.redirectTo({ url: '/pages/login/login' });
          if (isAccountError) {
            wx.showToast({ title: msg, icon: 'none', duration: 3000 });
          }
          setTimeout(() => { _loggingOut = false; }, 3000);
        }
        reject(new Error(msg));
        return;
      }

      if (errCode === 200) {
        resolve(resData.data);
      } else {
        const msg = resData.message || '请求失败';
        const err = new Error(msg);
        err.code = errCode;
        if (!options.silent) {
          const now = Date.now();
          const lastTime = _bizToastTimes.get(msg) || 0;
          if (now - lastTime > 3000) {
            _bizToastTimes.set(msg, now);
            if (_bizToastTimes.size > 20) {
              _bizToastTimes.delete(_bizToastTimes.keys().next().value);
            }
            wx.showToast({ title: msg, icon: 'none' });
          }
        }
        reject(err);
      }
    };

    const onFail = (err) => {
      if (!options.silent) {
        const now = Date.now();
        if (now - _networkToastTime > 5000) {
          _networkToastTime = now;
          wx.hideToast();
          wx.showToast({ title: '网络异常', icon: 'none' });
        }
      }
      
      // 异常监控埋点（排除日志上报接口本身以防止递归）
      if (options.url !== '/behavior/report') {
        setTimeout(() => {
          try {
            const behaviorLogger = require('./behavior-logger');
            behaviorLogger.track('NETWORK_ERROR', {
              url: options.url,
              method: method,
              errMsg: err.errMsg || String(err),
              requestId: requestId
            });
          } catch (e) {
            console.error('[request] 自动记录 NETWORK_ERROR 失败', e);
          }
        }, 0);
      }
      
      reject(err);
    };

    const onComplete = () => {
      inflight.delete(key);
      const duration = Date.now() - start;
      if (duration > 3000) {
        console.warn(`[request] ${method} ${options.url} ${duration}ms`);
      }
      
      // 慢请求监控埋点（排除日志上报接口本身）
      if (duration > 2000 && options.url !== '/behavior/report') {
        setTimeout(() => {
          try {
            const behaviorLogger = require('./behavior-logger');
            behaviorLogger.track('SLOW_REQUEST', {
              url: options.url,
              method: method,
              duration: duration,
              requestId: requestId
            });
          } catch (e) {
            console.error('[request] 自动记录 SLOW_REQUEST 失败', e);
          }
        }, 0);
      }
    };

    if (useCloud) {
      // AnyService 模式：wx.cloud.callContainer
      const cloudHeader = {
        'X-WX-SERVICE': 'tcbanyservice',
        'X-AnyService-Name': config.anyservice.serviceName,
        ...header
      };

      wx.cloud.callContainer({
        path: options.url,
        method,
        data: options.data,
        header: cloudHeader,
        timeout,
        success: (res) => {
          // callContainer 响应结构：{ data: { code, message, data }, statusCode, header }
          onSuccess({
            statusCode: res.statusCode,
            data: res.data
          });
        },
        fail: onFail,
        complete: onComplete
      });
    } else {
      // 本地/正式模式：wx.request
      const reqOptions = {
        url: `${app.globalData.baseUrl}${options.url}`,
        method,
        data: options.data,
        header,
        timeout
      };

      wx.request({
        ...reqOptions,
        success: onSuccess,
        fail: onFail,
        complete: onComplete
      });
    }
  });

  // 去重仅复用 Promise，移至外部以防构造器内部同步调用引发的暂存死区 (TDZ) 报错
  inflight.set(key, { promise, ts: Date.now() });

  return promise;
}

function get(url, data, opts) {
  return request({ url, method: 'GET', data, ...opts });
}

function post(url, data, opts) {
  return request({ url, method: 'POST', data, ...opts });
}

function put(url, data, opts) {
  return request({ url, method: 'PUT', data, ...opts });
}

function del(url, data, opts) {
  return request({ url, method: 'DELETE', data, ...opts });
}

module.exports = { request, get, post, put, del, createRequestId };
