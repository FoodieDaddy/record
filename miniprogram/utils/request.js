/**
 * HTTP 请求封装 — 自动携带 JWT，统一错误处理
 */
const app = getApp();

function request(options) {
  return new Promise((resolve, reject) => {
    const header = {
      'Content-Type': 'application/json',
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
    }
    if (options.timeout) {
      reqOptions.timeout = options.timeout
    }

    wx.request({
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
      }
    });
  });
}

function get(url, data, opts) {
  return request({ url, method: 'GET', data, ...opts });
}

function post(url, data, opts) {
  return request({ url, method: 'POST', data, ...opts });
}

function put(url, data) {
  return request({ url, method: 'PUT', data });
}

function del(url, data) {
  return request({ url, method: 'DELETE', data });
}

module.exports = { request, get, post, put, del };
