Component({
  properties: {
    danger: { type: Boolean, value: false },
    reduceMotion: { type: Boolean, value: false }
  },
  methods: {
    onTap() {
      this.triggerEvent('close');
    }
  }
});
