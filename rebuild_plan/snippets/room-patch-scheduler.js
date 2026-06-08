scheduleRoomPatch(patch, options = {}) {
  this._pendingRoomPatch = {
    ...(this._pendingRoomPatch || {}),
    ...patch
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

flushRoomPatch() {
  if (this._roomPatchTimer) {
    clearTimeout(this._roomPatchTimer);
    this._roomPatchTimer = null;
  }

  const patch = this._pendingRoomPatch;
  this._pendingRoomPatch = null;

  if (!patch || Object.keys(patch).length === 0 || this._destroyed) return;
  this.setData(patch);
}
