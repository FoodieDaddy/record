/**
 * 指数退避重试
 * @param {Function} fn - 异步函数，返回 truthy 值时停止重试
 * @param {number} retries - 最大重试次数
 * @param {number} baseDelay - 基础延迟（毫秒）
 * @returns {Promise<*>} fn 的返回值，或 null（全部失败）
 */
function retryWithBackoff(fn, retries = 3, baseDelay = 1000) {
  return new Promise((resolve) => {
    let attempt = 0;

    function tryFn() {
      fn().then((result) => {
        if (result) {
          resolve(result);
        } else if (attempt < retries) {
          const delay = baseDelay * Math.pow(2, attempt);
          attempt++;
          setTimeout(tryFn, delay);
        } else {
          resolve(null);
        }
      }).catch(() => {
        if (attempt < retries) {
          const delay = baseDelay * Math.pow(2, attempt);
          attempt++;
          setTimeout(tryFn, delay);
        } else {
          resolve(null);
        }
      });
    }

    tryFn();
  });
}

module.exports = { retryWithBackoff };
