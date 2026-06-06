Component({
  properties: {
    options: { type: Array, value: ['选项1', '选项2'] },
    active: { type: Number, value: 0 }
  },
  methods: {
    onTap(e) {
      const idx = Number(e.currentTarget.dataset.index);
      if (idx !== this.data.active) {
        this.triggerEvent('change', { index: idx });
      }
    }
  }
});
