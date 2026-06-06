Component({
  properties: {
    reduceMotion: { type: Boolean, value: false }
  },
  data: {
    visible: false,
    text: '',
    dotType: 'dot-sync'
  },
  methods: {
    /**
     * 显示 toast
     * @param {string} text - 提示文案
     * @param {string} type - dot-sync | dot-info | dot-warn | dot-error
     * @param {number} duration - 持续时间 ms，默认 1600
     */
    show(text, type, duration) {
      if (this._hideTimer) {
        clearTimeout(this._hideTimer);
        this._hideTimer = null;
      }
      this.setData({
        visible: true,
        text: text || '',
        dotType: type || 'dot-sync'
      });
      var self = this;
      this._hideTimer = setTimeout(function () {
        self.setData({ visible: false });
        self._hideTimer = null;
      }, duration || 1600);
    }
  },
  lifetimes: {
    detached() {
      if (this._hideTimer) {
        clearTimeout(this._hideTimer);
        this._hideTimer = null;
      }
    }
  }
});
