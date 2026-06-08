var MBTI_CODE_MAP = require('../../utils/mbti-const').MBTI_CODE_MAP;
var MBTI_MAP = require('../../utils/mbti-const').MBTI_MAP;
var MBTI_TRAITS = require('../../utils/mbti-const').MBTI_TRAITS;
var vibrateShort = require('../../utils/haptic').vibrateShort;

var PAIRS = [
  { key: 'EI', options: [{ code: 'E', label: '外向' }, { code: 'I', label: '内向' }], dimLabel: '外向 / 内向 · 能量接入方式' },
  { key: 'SN', options: [{ code: 'S', label: '感知' }, { code: 'N', label: '直觉' }], dimLabel: '感知 / 直觉 · 信息读取方式' },
  { key: 'TF', options: [{ code: 'T', label: '思维' }, { code: 'F', label: '情感' }], dimLabel: '思维 / 情感 · 判断决策方式' },
  { key: 'JP', options: [{ code: 'J', label: '判断' }, { code: 'P', label: '感知' }], dimLabel: '判断 / 感知 · 节奏控制方式' }
];

var DEFAULTS = ['I', 'N', 'T', 'J'];

function buildDims(originalType) {
  return PAIRS.map(function (p, i) {
    return {
      key: p.key,
      options: p.options,
      selected: originalType ? originalType[i] : DEFAULTS[i],
      dimLabel: p.dimLabel
    };
  });
}

function getType(dims) {
  return dims.map(function (d) { return d.selected; }).join('');
}

function resolveTitle(mbtiType) {
  for (var k in MBTI_MAP) {
    if (MBTI_MAP[k].type === mbtiType) return MBTI_MAP[k].title;
  }
  return '未知型';
}

Component({
  properties: {
    reduceMotion: { type: Boolean, value: false },
    // 由父页面驱动：'idle' | 'syncing' | 'success' | 'error'
    syncState: { type: String, value: 'idle' },
    errorText: { type: String, value: '' }
  },

  data: {
    dims: [],
    mbtiType: '',
    mbtiTitle: '',
    mbtiTraits: [],
    originalType: '',
    dirty: false,
    showExitConfirm: false
  },

  lifetimes: {
    attached: function () {
      var pages = getCurrentPages();
      var parent = pages[pages.length - 1];
      var originalType = (parent && parent.data.mbti && parent.data.mbti.mbtiType) || 'INTJ';

      var dims = buildDims(originalType);
      var mbtiType = getType(dims);
      var traits = MBTI_TRAITS[mbtiType] || [];

      this.setData({
        dims: dims,
        mbtiType: mbtiType,
        mbtiTitle: resolveTitle(mbtiType),
        mbtiTraits: traits,
        originalType: originalType
      });
    },
    detached: function () {
      // 组件销毁时无需清理内部定时器（已移除假动画）
    }
  },

  methods: {
    onDimSelect: function (e) {
      var dimindex = e.currentTarget.dataset.dimindex;
      var value = e.currentTarget.dataset.value;
      var dims = this.data.dims;
      var dim = dims[dimindex];

      if (dim.selected === value) return;

      dim.selected = value;

      var mbtiType = getType(dims);
      var traits = MBTI_TRAITS[mbtiType] || [];
      var dirty = mbtiType !== this.data.originalType;

      this.setData({
        dims: dims,
        mbtiType: mbtiType,
        mbtiTitle: resolveTitle(mbtiType),
        mbtiTraits: traits,
        dirty: dirty
      });

      vibrateShort('medium');
    },

    onConfirm: function () {
      // 不再内部假装成功，直接通知父页面
      if (this.data.syncState === 'syncing' || this.data.syncState === 'success') return;
      this.triggerEvent('confirm', { mbtiCode: MBTI_CODE_MAP[this.data.mbtiType] });
    },

    onClose: function () {
      if (this.data.syncState === 'syncing') return;
      if (this.data.dirty) {
        this.setData({ showExitConfirm: true });
      } else {
        this.triggerEvent('close');
      }
    },

    cancelExit: function () {
      this.setData({ showExitConfirm: false });
    },

    confirmExit: function () {
      this.setData({ showExitConfirm: false });
      this.triggerEvent('close');
    }
  }
});
