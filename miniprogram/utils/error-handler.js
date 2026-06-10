/**
 * 统一的错误处理工具函数
 * 提供一致的错误处理、重试逻辑和用户提示
 */

/**
 * 显示错误提示
 * @param {string} message 错误信息
 * @param {string} type 错误类型：'error' | 'warning' | 'info'
 * @param {number} duration 显示时长（毫秒）
 */
function showError(message, type = 'error', duration = 2000) {
  const icon = type === 'error' ? 'none' : 'success';
  wx.showToast({
    title: message,
    icon: icon,
    duration: duration
  });
}

/**
 * 统一的异步操作包装器
 * 自动处理加载状态、错误提示和重试逻辑
 * @param {Function} asyncFn 异步函数
 * @param {Object} options 配置选项
 * @returns {Promise} 包含执行结果的Promise
 */
function withErrorHandling(asyncFn, options = {}) {
  const {
    loadingText = '加载中...',
    errorText = '操作失败',
    successText = '',
    showLoading = false,
    showSuccess = false,
    retry = 0,
    retryDelay = 1000,
    onError = null,
    onSuccess = null
  } = options;

  return async function(...args) {
    try {
      if (showLoading && loadingText) {
        wx.showLoading({ title: loadingText, mask: true });
      }

      const result = await asyncFn(...args);
      
      if (showLoading) {
        wx.hideLoading();
      }
      
      if (showSuccess && successText) {
        wx.showToast({
          title: successText,
          icon: 'success',
          duration: 1500
        });
      }
      
      if (onSuccess && typeof onSuccess === 'function') {
        onSuccess(result);
      }
      
      return result;
    } catch (error) {
      if (showLoading) {
        wx.hideLoading();
      }
      
      const message = error.message || errorText;
      showError(message, 'error');
      
      if (onError && typeof onError === 'function') {
        onError(error);
      }
      
      // 重试逻辑
      if (retry > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return withErrorHandling(asyncFn, { ...options, retry: retry - 1 })(...args);
      }
      
      throw error;
    }
  };
}

/**
 * 网络请求重试包装器
 * 特别针对网络请求失败的情况进行重试
 * @param {Function} requestFn 请求函数
 * @param {number} maxRetries 最大重试次数
 * @returns {Promise} 包含请求结果的Promise
 */
function withRetry(requestFn, maxRetries = 3) {
  return async function(...args) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await requestFn(...args);
      } catch (error) {
        lastError = error;
        
        // 只在网络错误或超时的情况下重试
        const shouldRetry = error.message && (
          error.message.includes('timeout') ||
          error.message.includes('timeout') ||
          error.message.includes('网络') ||
          error.message.includes('network') ||
          error.message.includes('request:fail')
        );
        
        if (!shouldRetry || i === maxRetries - 1) {
          throw error;
        }
        
        // 指数退避
        const delay = Math.min(1000 * Math.pow(2, i), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  };
}

module.exports = {
  showError,
  withErrorHandling,
  withRetry
};
