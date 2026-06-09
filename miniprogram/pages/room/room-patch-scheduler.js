/**
 * Room setData 批处理调度器
 * 将高频连续 setData 合并为一次写入，降低渲染压力。
 *
 * 用法：
 *   const { createPatchScheduler } = require('./room-patch-scheduler');
 *   Page({ ...createPatchScheduler(), ... })
 */
function createPatchScheduler() {
  return {
    /**
     * 合并 patch 到待写入队列，延迟 flush。
     * @param {Object} patch - 要写入的 data 字段
     * @param {Object} [options]
     * @param {boolean} [options.immediate] - 立即 flush
     * @param {number} [options.delay] - 延迟毫秒数（默认 50ms）
     */
    scheduleRoomPatch(patch, options = {}) {
      this._pendingRoomPatch = {
        ...(this._pendingRoomPatch || {}),
        ...patch,
      };

      if (options.immediate) {
        this.flushRoomPatch();
        return;
      }

      if (this._roomPatchTimer) return;

      this._roomPatchTimer = setTimeout(() => {
        this.flushRoomPatch();
      }, options.delay || 50);
    },

    /**
     * 立即将所有待写入 patch 通过 setData 写入视图。
     */
    flushRoomPatch() {
      if (this._roomPatchTimer) {
        clearTimeout(this._roomPatchTimer);
        this._roomPatchTimer = null;
      }

      const patch = this._pendingRoomPatch;
      this._pendingRoomPatch = null;

      if (!patch || Object.keys(patch).length === 0 || this._destroyed) return;
      this.setData(patch);
    },
  };
}

module.exports = { createPatchScheduler };
