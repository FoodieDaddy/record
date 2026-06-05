Component({
  properties: {
    mbti: {
      type: Object,
      value: {
        calibrated: false,
        mbtiType: '',
        mbtiTitle: '',
        confidence: 0,
        mbtiSource: '',
        calibratedAt: ''
      }
    },
    reduceMotion: {
      type: Boolean,
      value: false
    }
  },

  data: {
    typedText: '',
    typing: false
  },

  observers: {
    'mbti.tacticTag': function (tag) {
      this._startTypewriter(tag || '');
    }
  },

  lifetimes: {
    detached() {
      this._clearTypewriter();
    }
  },

  methods: {
    _clearTypewriter() {
      if (this._typeTimer) {
        clearTimeout(this._typeTimer);
        this._typeTimer = null;
      }
    },

    _startTypewriter(fullText) {
      this._clearTypewriter();
      if (!fullText) {
        this.setData({ typedText: '', typing: false });
        return;
      }

      // reduce-motion：直接显示全文
      if (this.data.reduceMotion) {
        this.setData({ typedText: fullText, typing: false });
        return;
      }

      this.setData({ typedText: '', typing: true });
      var idx = 0;
      var self = this;

      function tick() {
        idx++;
        self.setData({ typedText: fullText.substring(0, idx) });
        if (idx < fullText.length) {
          // 每字符 60-120ms 随机间隔，模拟真实打字节奏
          var delay = 60 + Math.floor(Math.random() * 60);
          self._typeTimer = setTimeout(tick, delay);
        } else {
          // 打完后光标闪烁 1.5s 再消失
          self._typeTimer = setTimeout(function () {
            self.setData({ typing: false });
          }, 1500);
        }
      }

      // 首字延迟 300ms，等待卡片入场
      this._typeTimer = setTimeout(tick, 300);
    },

    onStartTest() {
      this.triggerEvent('start-test');
    },
    onDirectInput() {
      this.triggerEvent('direct-input');
    }
  }
});
