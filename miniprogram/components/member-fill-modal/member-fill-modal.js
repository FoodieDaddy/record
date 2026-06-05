Component({
  properties: {
    submitted: { type: Boolean, value: false },
    myScore: { type: Number, value: 0 }
  },
  data: {
    inputValue: ''
  },
  methods: {
    onInput(e) {
      this.setData({ inputValue: e.detail.value });
    },
    onSubmit() {
      const score = parseInt(this.data.inputValue);
      if (isNaN(score)) {
        wx.showToast({ title: '请输入积分', icon: 'none' });
        return;
      }
      this.triggerEvent('submit', { score });
    },
    onClose() {
      if (!this.data.submitted) {
        this.triggerEvent('close');
      }
    }
  }
});
