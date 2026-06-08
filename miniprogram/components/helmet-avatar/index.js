Component({
  properties: {
    src: {
      type: String,
      value: ''
    },
    size: {
      type: String,
      value: 'md'
    },
    active: {
      type: Boolean,
      value: false
    },
    dimmed: {
      type: Boolean,
      value: false
    },
    controller: {
      type: Boolean,
      value: false
    },
    showStatus: {
      type: Boolean,
      value: true
    },
    reduceMotion: {
      type: Boolean,
      value: false
    }
  },

  data: {
    defaultAvatar: '/images/default-avatar.png',
    imgSrc: ''
  },

  observers: {
    'src': function(val) {
      this.setData({ imgSrc: val || '' });
    }
  },

  methods: {
    onImgError() {
      this.setData({ imgSrc: '' });
    }
  }
})
