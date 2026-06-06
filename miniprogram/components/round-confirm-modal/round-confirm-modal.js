Component({
  properties: {
    round: { type: Object, value: null },
    myUserId: { type: String, value: '' }
  },
  methods: {
    onAgree() {
      this.triggerEvent('confirm', { agree: true });
    },
    onReject() {
      wx.showModal({
        title: '确认驳回本轮数值？',
        content: '驳回后，本轮录入不会生效，主控需要重新录入。',
        confirmText: '确认驳回',
        confirmColor: '#ff453a',
        cancelText: '再看看',
        success: (res) => {
          if (res.confirm) {
            this.triggerEvent('confirm', { agree: false });
          }
        }
      });
    },
    onClose() {
      this.triggerEvent('close');
    }
  }
});
