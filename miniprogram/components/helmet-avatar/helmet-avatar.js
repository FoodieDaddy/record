const { normalizeAvatarUrl } = require('../../utils/avatar');
const { resolveAvatarSrc } = require('../../utils/avatar-storage');

Component({
  properties: {
    src: {
      type: String,
      value: ''
    },
    nickname: {
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
    imgSrc: '',
    fallbackChar: '',
    fallbackColor: ''
  },

  observers: {
    'src, nickname': function(src, nickname) {
      const { normalizeAvatarUrl, getFirstChar, getColor } = require('../../utils/avatar');
      const normalized = normalizeAvatarUrl(src);
      
      if (!normalized) {
        this.setData({ 
          imgSrc: '',
          fallbackChar: getFirstChar(nickname),
          fallbackColor: getColor(nickname)
        });
        return;
      }
      // cloud:// 需要异步解析为 https 临时 URL
      if (normalized.startsWith('cloud://')) {
        // 先显示默认头像，异步解析后更新
        this.setData({ 
          imgSrc: '',
          fallbackChar: getFirstChar(nickname),
          fallbackColor: getColor(nickname)
        });
        resolveAvatarSrc(normalized).then(resolved => {
          if (resolved) {
            this.setData({ imgSrc: resolved });
          }
        });
      } else {
        this.setData({ imgSrc: normalized });
      }
    }
  },

  methods: {
    onImgError() {
      this.setData({ imgSrc: '' });
    }
  }
})
