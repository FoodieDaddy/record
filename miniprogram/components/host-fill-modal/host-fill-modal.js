Component({
  properties: {
    members: { type: Array, value: [] },
    zeroSum: { type: Number, value: 1 }
  },
  data: {
    scoreInputs: {},
    totalScore: 0
  },
  lifetimes: {
    attached() {
      const inputs = {};
      (this.data.members || []).forEach(m => { inputs[m.userId] = ''; });
      this.setData({ scoreInputs: inputs, totalScore: 0 });
    }
  },
  methods: {
    onScoreInput(e) {
      const userId = e.currentTarget.dataset.userId;
      const val = e.detail.value;
      const scoreInputs = { ...this.data.scoreInputs, [userId]: val };
      let total = 0;
      Object.values(scoreInputs).forEach(v => {
        const n = parseInt(v) || 0;
        total += n;
      });
      this.setData({ scoreInputs, totalScore: total });
    },
    onSubmit() {
      const { members, scoreInputs, zeroSum, totalScore } = this.data;
      const scores = members.map(m => ({
        userId: m.userId,
        score: parseInt(scoreInputs[m.userId]) || 0
      }));
      const hasEmpty = members.some(m => scoreInputs[m.userId] === '' || scoreInputs[m.userId] === undefined);
      if (hasEmpty) {
        wx.showToast({ title: '请填写所有成员积分', icon: 'none' });
        return;
      }
      if (zeroSum === 1 && totalScore !== 0) {
        wx.showToast({ title: '积分变化总和必须为 0', icon: 'none' });
        return;
      }
      this.triggerEvent('submit', { scores });
    },
    onClose() {
      this.triggerEvent('close');
    }
  }
});
