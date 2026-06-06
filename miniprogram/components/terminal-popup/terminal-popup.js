Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '系统警告' },
    subtitle: { type: String, value: '系统警告' },
    content: { type: String, value: '' },
    cancelText: { type: String, value: '取消' },
    confirmText: { type: String, value: '确认' },
    confirmType: { type: String, value: 'danger' }, // danger | primary
    reduceMotion: { type: Boolean, value: false }
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
