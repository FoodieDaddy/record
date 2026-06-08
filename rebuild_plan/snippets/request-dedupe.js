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
  if (options.dedupe !== false && inflight.has(key)) {
    return inflight.get(key).promise;
  }

  const requestId = createRequestId();
  const start = Date.now();
  let task;

  const promise = new Promise((resolve, reject) => {
    task = wx.request({
      url: normalizeUrl(options.url),
      method: options.method || 'GET',
      data: options.data || {},
      timeout: options.timeout || 10000,
      header: {
        ...(options.header || {}),
        'X-Request-Id': requestId
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else reject({ type: 'HTTP_ERROR', statusCode: res.statusCode, data: res.data });
      },
      fail(err) {
        reject({ type: 'NETWORK_ERROR', raw: err });
      },
      complete() {
        inflight.delete(key);
        console.log('[request]', {
          requestId,
          url: options.url,
          method: options.method || 'GET',
          duration: Date.now() - start
        });
      }
    });
  });

  inflight.set(key, { promise, task });
  return promise;
}
