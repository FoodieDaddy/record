Component({
  properties: {
    todayField: {
      type: Object,
      value: { tag: '', summary: '', themeColor: '#0A84FF', date: '' }
    }
  },

  methods: {
    openAlmanac() {
      this.triggerEvent('open-tool', { code: 'almanac', locked: false });
    },
    openTaiyi() {
      this.triggerEvent('open-tool', { code: 'taiyi', locked: false });
    }
  }
});
