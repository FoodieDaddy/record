Component({
  properties: {
    round: { type: Object, value: null },
    isOwner: { type: Boolean, value: false }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap');
    },
    onCancel() {
      wx.showModal({
        title: '取消本局录入？',
        content: '取消后需要重新发起。',
        success: (res) => {
          if (res.confirm) {
            this.triggerEvent('cancel');
          }
        }
      });
    }
  }
});
