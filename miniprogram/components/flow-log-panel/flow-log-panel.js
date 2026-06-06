Component({
  properties: {
    groupedRecords: { type: Array, value: [] },
    filterMine: { type: Boolean, value: false },
    loadingMore: { type: Boolean, value: false },
    noMore: { type: Boolean, value: false },
    showMatrix: { type: Boolean, value: false }
  },
  methods: {
    onViewChange(e) {
      // 0 = 我的视角, 1 = 全域视角
      const filterMine = e.detail.index === 0;
      this.triggerEvent('toggleFilter', { filterMine });
    },
    openMatrix() {
      this.triggerEvent('openMatrix');
    }
  }
});
