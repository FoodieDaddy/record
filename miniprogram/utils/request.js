/**
 * HTTP 请求封装 — JWT 注入、去重、追踪 ID、统一错误处理
 */
const app = getApp();

/** 进行中的请求（用于去重） */
const inflight = new Map();

function createRequestId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildRequestKey(options) {
  const method = (options.method || 'GET').toUpperCase();
  const data = options.data ? JSON.stringify(options.data) : '';
  return `${method}:${options.url}:${data}`;
}

function request(options) {
  const key = buildRequestKey(options);

  // GET 请求去重（同一 key 的请求进行中时复用）
  if (options.dedupe !== false && (options.method || 'GET') === 'GET' && inflight.has(key)) {
    return inflight.get(key).promise;
  }

  const requestId = createRequestId();
  const start = Date.now();
  let task;

  const header = {
    'Content-Type': 'application/json',
    'X-Request-Id': requestId,
    ...options.header
  };
  if (app.globalData.token) {
    header['Authorization'] = `Bearer ${app.globalData.token}`;
  }

  const reqOptions = {
    url: `${app.globalData.baseUrl}${options.url}`,
    method: options.method || 'GET',
    data: options.data,
    header,
  };
  if (options.timeout) {
    reqOptions.timeout = options.timeout;
  }

  const promise = new Promise((resolve, reject) => {
    task = wx.request({
      ...reqOptions,
      success(res) {
        const errCode = res.data && res.data.code;
        // 4001: token 无效/过期/用户不存在 | 4003: 账号已注销/已封禁
        if (res.statusCode === 401 || errCode === 4001 || errCode === 4003) {
          const msg = errCode === 4003 ? (res.data.message || '账号异常') : '接入已过期';
          app.logout();
          wx.redirectTo({ url: '/pages/login/login' });
          if (errCode === 4003) {
            wx.showToast({ title: msg, icon: 'none', duration: 3000 });
          }
          reject(new Error(msg));
          return;
        }
        if (errCode === 200) {
          resolve(res.data.data);
        } else {
          const msg = (res.data && res.data.message) || '请求失败';
          const err = new Error(msg);
          err.code = errCode;
          if (!options.silent) {
            wx.showToast({ title: msg, icon: 'none' });
          }
          reject(err);
        }
      },
      fail(err) {
        if (!options.silent) {
          wx.showToast({ title: '网络异常', icon: 'none' });
        }
        reject(err);
      },
      complete(res) {
        inflight.delete(key);
        const duration = Date.now() - start;
        if (duration > 3000) {
          console.warn(`[request] ${reqOptions.method} ${options.url} ${duration}ms`);
        }
      }
    });
  });

  inflight.set(key, { promise, task });
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

module.exports = { request, get, post, put, del };
