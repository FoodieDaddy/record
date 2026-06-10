/**
 * 节流/防抖工具函数
 * 用于优化高频事件处理，提高性能
 */

/**
 * 节流函数：在指定时间内只执行一次
 * @param {Function} fn 要节流的函数
 * @param {number} delay 节流间隔（毫秒）
 * @returns {Function} 节流后的函数
 */
function throttle(fn, delay = 100) {
  let lastCall = 0;
  let timer = null;
  
  return function(...args) {
    const now = Date.now();
    const remaining = delay - (now - lastCall);
    
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastCall = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastCall = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

/**
 * 防抖函数：在指定时间后执行，如果在指定时间内再次调用则重新计时
 * @param {Function} fn 要防抖的函数
 * @param {number} delay 防抖延迟（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(fn, delay = 300) {
  let timer = null;
  
  return function(...args) {
    if (timer) {
      clearTimeout(timer);
    }
    
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

/**
 * 立即执行的防抖函数：立即执行，然后在指定时间内不再执行
 * @param {Function} fn 要防抖的函数
 * @param {number} delay 防抖延迟（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounceImmediate(fn, delay = 300) {
  let timer = null;
  let immediate = true;
  
  return function(...args) {
    const context = this;
    
    if (immediate) {
      fn.apply(context, args);
      immediate = false;
    }
    
    if (timer) {
      clearTimeout(timer);
    }
    
    timer = setTimeout(() => {
      immediate = true;
      timer = null;
    }, delay);
  };
}

module.exports = {
  throttle,
  debounce,
  debounceImmediate
};