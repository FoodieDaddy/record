const { getColor, getFirstChar } = require('../../utils/avatar');

Component({
  properties: {
    visible: { type: Boolean, value: false },
    targetName: { type: String, value: '' },
    targetUserId: { type: String, value: '' }
  },

  data: {
    amount: '',
    remark: '',
    quickAmounts: [10, 50, 100, 500],
    targetColor: '#4f8cff',
    targetChar: '?',
    canConfirm: false
  },

  observers: {
    'targetName': function(name) {
      this.setData({
        targetColor: getColor(name),
        targetChar: getFirstChar(name)
      });
    },
    'amount': function(val) {
      const num = parseFloat(val);
      this.setData({ canConfirm: !isNaN(num) && num > 0 });
    }
  },

  methods: {
    onAmountInput(e) {
      this.setData({ amount: e.detail.value });
    },

    onRemarkInput(e) {
      this.setData({ remark: e.detail.value });
    },

    onQuickAmount(e) {
      const add = e.currentTarget.dataset.value;
      const current = parseFloat(this.data.amount) || 0;
      this.setData({ amount: String(current + add) });
    },

    onConfirm() {
      const amount = Math.round(parseFloat(this.data.amount) * 100); // 转为分
      if (amount <= 0) return;

      this.triggerEvent('confirm', {
        toUserId: this.data.targetUserId,
        amount: amount,
        remark: this.data.remark
      });

      // 重置
      this.setData({ amount: '', remark: '' });
    },

    onClose() {
      this.setData({ amount: '', remark: '' });
      this.triggerEvent('close');
    }
  }
});
