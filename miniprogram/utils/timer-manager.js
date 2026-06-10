/**
 * 统一的定时器管理器
 * 用于管理页面或组件中的所有定时器，确保在页面卸载时正确清理
 */
class TimerManager {
  constructor() {
    this.timers = new Set();
    this.intervals = new Set();
  }

  /**
   * 添加一个定时器
   * @param {Function} callback 回调函数
   * @param {number} delay 延迟时间（毫秒）
   * @returns {number} 定时器ID
   */
  setTimeout(callback, delay) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      callback();
    }, delay);
    this.timers.add(id);
    return id;
  }

  /**
   * 添加一个间隔定时器
   * @param {Function} callback 回调函数
   * @param {number} interval 间隔时间（毫秒）
   * @returns {number} 定时器ID
   */
  setInterval(callback, interval) {
    const id = setInterval(callback, interval);
    this.intervals.add(id);
    return id;
  }

  /**
   * 清除一个定时器
   * @param {number} id 定时器ID
   */
  clearTimeout(id) {
    clearTimeout(id);
    this.timers.delete(id);
  }

  /**
   * 清除一个间隔定时器
   * @param {number} id 定时器ID
   */
  clearInterval(id) {
    clearInterval(id);
    this.intervals.delete(id);
  }

  /**
   * 清除所有定时器
   */
  clearAll() {
    this.timers.forEach(id => clearTimeout(id));
    this.intervals.forEach(id => clearInterval(id));
    this.timers.clear();
    this.intervals.clear();
  }
}

module.exports = TimerManager;
