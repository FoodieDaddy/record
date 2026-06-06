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
      this.triggerEvent('reject');
    },
    onClose() {
      this.triggerEvent('close');
    }
  }
});
