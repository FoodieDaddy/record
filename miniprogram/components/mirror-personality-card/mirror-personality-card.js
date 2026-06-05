Component({
  properties: {
    profile: {
      type: Object,
      value: {
        calibrated: false,
        mbtiType: '',
        mbtiTitle: '',
        confidence: 0,
        mbtiSource: '',
        calibratedAt: ''
      }
    }
  },

  methods: {
    onStartTest() {
      this.triggerEvent('start-test');
    },
    onDirectInput() {
      this.triggerEvent('direct-input');
    }
  }
});
