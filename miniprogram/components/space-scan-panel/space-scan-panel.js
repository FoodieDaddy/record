Component({
  properties: {
    insight: { type: Object, value: null }
  },
  computed: {},
  data: {
    densityLevel: 'low',
    densityLabel: '低',
    densityPercent: 25
  },
  observers: {
    'insight.networkDensity': function (val) {
      if (!val) return;
      const map = {
        HIGH: { level: 'high', label: '高', percent: 100 },
        MEDIUM: { level: 'mid', label: '中', percent: 60 },
        LOW: { level: 'low', label: '低', percent: 25 }
      };
      const cfg = map[val] || map.LOW;
      this.setData({
        densityLevel: cfg.level,
        densityLabel: cfg.label,
        densityPercent: cfg.percent
      });
    }
  }
});
