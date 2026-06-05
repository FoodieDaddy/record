Component({
  properties: {
    tool: {
      type: Object,
      value: {
        code: '',
        name: '',
        desc: '',
        category: '',
        locked: false,
        lockReason: '',
        todayUsed: false
      }
    }
  }
});
