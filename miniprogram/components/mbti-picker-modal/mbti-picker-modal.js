var MBTI_CODE_MAP = require('../../utils/mbti-const').MBTI_CODE_MAP;

var TITLES = {
  INTJ: '冷静型控场者', INTP: '模型型分析者', ENTJ: '压迫型指挥者', ENTP: '扰动型试探者',
  INFJ: '远读型观察者', INFP: '直觉型守序者', ENFJ: '节奏型组织者', ENFP: '机会型游走者',
  ISTJ: '纪律型执行者', ISFJ: '防守型稳定者', ESTJ: '规则型压制者', ESFJ: '协同型支援者',
  ISTP: '冷启动猎手', ISFP: '低频型感知者', ESTP: '高压型突击者', ESFP: '现场型爆发者'
};

var PAIRS = [
  { key: 'EI', options: ['E', 'I'], dimLabel: '外向 / 内向' },
  { key: 'SN', options: ['S', 'N'], dimLabel: '感知 / 直觉' },
  { key: 'TF', options: ['T', 'F'], dimLabel: '思维 / 情感' },
  { key: 'JP', options: ['J', 'P'], dimLabel: '判断 / 感知' }
];

// 默认选中 INTJ
var DEFAULTS = ['I', 'N', 'T', 'J'];

function buildDims() {
  return PAIRS.map(function (p, i) {
    var sel = DEFAULTS[i];
    var opp = sel === p.options[0] ? p.options[1] : p.options[0];
    return {
      key: p.key,
      options: p.options,
      selected: sel,
      opposite: opp,
      dimLabel: p.dimLabel,
      flipping: false,
      flipDone: false
    };
  });
}

function getType(dims) {
  return dims.map(function (d) { return d.selected; }).join('');
}

Component({
  properties: {
    reduceMotion: { type: Boolean, value: false }
  },

  data: {
    dims: buildDims(),
    mbtiType: getType(buildDims()),
    mbtiTitle: TITLES[getType(buildDims())] || '未知型'
  },

  methods: {
    onFlip: function (e) {
      var dimindex = e.currentTarget.dataset.dimindex;
      var dims = this.data.dims;
      var dim = dims[dimindex];

      if (dim.flipping) return;

      // reduce-motion：直接切换，无动画
      if (this.data.reduceMotion) {
        var tmp = dim.selected;
        dim.selected = dim.opposite;
        dim.opposite = tmp;
        var mbtiType = getType(dims);
        this.setData({ dims: dims, mbtiType: mbtiType, mbtiTitle: TITLES[mbtiType] || '未知型' });
        try { wx.vibrateShort({ type: 'medium' }); } catch (err) {}
        return;
      }

      // 开始翻转动画
      dim.flipping = true;
      this.setData({ dims: dims });

      var self = this;
      // 翻转到 300ms（半程）时切换字母数据
      setTimeout(function () {
        var tmp = dim.selected;
        dim.selected = dim.opposite;
        dim.opposite = tmp;
        dim.flipping = false;
        dim.flipDone = true;

        var mbtiType = getType(dims);
        self.setData({ dims: dims, mbtiType: mbtiType, mbtiTitle: TITLES[mbtiType] || '未知型' });

        // 触觉反馈
        try { wx.vibrateShort({ type: 'medium' }); } catch (err) {}

        // 重置 flipDone 状态
        setTimeout(function () {
          dim.flipDone = false;
          self.setData({ dims: dims });
        }, 50);
      }, 300);
    },

    onConfirm: function () {
      this.triggerEvent('confirm', { mbtiCode: MBTI_CODE_MAP[this.data.mbtiType] });
    },

    onClose: function () {
      this.triggerEvent('close');
    }
  }
});
