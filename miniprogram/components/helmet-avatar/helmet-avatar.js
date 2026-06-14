const { normalizeAvatarUrl, getFirstChar, getColor } = require('../../utils/avatar');
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
      const normalized = normalizeAvatarUrl(src);
      
      if (!normalized || normalized.startsWith('cloud://')) {
        // 如果为空，或尚未被父组件解析的 cloud:// 协议，则显示首字占位
        this.setData({ 
          imgSrc: '',
          fallbackChar: getFirstChar(nickname),
          fallbackColor: getColor(nickname)
        });
        return;
      }
      
      // 已被父组件解析的真实 URL (https/http 等)
      this.setData({ 
        imgSrc: normalized,
        fallbackChar: getFirstChar(nickname),
        fallbackColor: getColor(nickname)
      });
    }
  },

  methods: {
    onImgError() {
      // 图片加载失败（如临时 URL 过期），清除缓存并重新解析 cloud://
      const { src, nickname } = this.properties;
      const { normalizeAvatarUrl, getFirstChar, getColor } = require('../../utils/avatar');
      const normalized = normalizeAvatarUrl(src);
      
      console.warn('[helmet-avatar] 图片加载失败，触发回退:', { src, normalized });

      if (normalized && normalized.startsWith('cloud://')) {
        const avatarStorage = require('../../utils/avatar-storage');
        avatarStorage.clearTempUrlCache(normalized);
        avatarStorage.resolveAvatarSrc(normalized).then(resolved => {
          if (resolved) {
            this.setData({ imgSrc: resolved });
            return;
          }
          // 二次解析也失败
          this.setData({
            imgSrc: '',
            fallbackChar: getFirstChar(nickname),
            fallbackColor: getColor(nickname)
          });
        });
        return;
      }
      // 无法恢复时回退到首字头像
      this.setData({
        imgSrc: '',
        fallbackChar: getFirstChar(nickname),
        fallbackColor: getColor(nickname)
      });
    }
  }
})
