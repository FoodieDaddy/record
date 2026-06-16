Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '系统警告' },
    content: { type: String, value: '' },
    cancelText: { type: String, value: '取消' },
    confirmText: { type: String, value: '确认' },
    confirmType: { type: String, value: 'danger' }, // danger | primary
    reduceMotion: { type: Boolean, value: false }
  },

  data: {
    mounted: false,
    showAnimation: false
  },

  observers: {
    'visible': function(newVal) {
      if (this.properties.reduceMotion) {
        // 如果是静默模式，不搞延时动画，直接同步
        this.setData({
          mounted: newVal,
          showAnimation: newVal
        })
        return
      }

      if (newVal) {
        // 开启：先挂载，下一帧开启显示动画
        this.setData({ mounted: true })
        this._mountTimer = setTimeout(() => {
          this.setData({ showAnimation: true })
        }, 30)
      } else {
        // 关闭：先关闭显示动画，延时卸载
        this.setData({ showAnimation: false })
        this._mountTimer = setTimeout(() => {
          this.setData({ mounted: false })
        }, 220)
      }
    }
  },

  lifetimes: {
    detached() {
      if (this._mountTimer) {
        clearTimeout(this._mountTimer)
      }
    }
  },

  methods: {
    onMaskTap() {
      // 点击遮罩不关闭，需明确操作
    },

    onCancel() {
      this.triggerEvent('cancel');
    },

    onConfirm() {
      this.triggerEvent('confirm');
    },

    noop() {}
  }
});
