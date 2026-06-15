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

var MBTI_DESCS = {
  INTJ: '旗舰指挥级适性。适合负责超光速航行中的多航路规划与突发状况的冷静推演，失误率趋近于零。',
  INTP: '科研测绘级适性。擅长在复杂引力波中提取航线信号，对未知黑洞边缘的视界流体力学有极高的解算天赋。',
  ENTJ: '编队旗舰主官。适性极佳，擅长率领整支星际编队执行遭遇战，以强硬的目标驱动达成作战任务。',
  ENTP: '战术扰动级适性。擅长在星际迷雾中进行多线程战术试探，捕捉敌方电磁防御网的微小空隙。',
  INFJ: '隐形侦测级适性。能在雷达噪声中提早感知微弱暗物质辐射，常先于系统报警发现潜在的重力陷阱。',
  INFP: '深空通讯级适性。即使在强电磁干扰的星云内部，亦能凭借卓越的直觉和坚守的信号基准建立稳定链接。',
  ENFJ: '协同控制级适性。能完美调度多艘子舰的引擎同步，优化整体编队的电能分配与情绪共鸣。',
  ENFP: '游击突击级适性。在陨石带与混乱力场中表现非凡，能高频切换航路以捕捉瞬息万变的跃迁窗口。',
  ISTJ: '引力锚定级适性。完美遵循飞船运行守则，在长达数百个星际日的恒星系际航行中提供绝对稳定的推进输出。',
  ISFJ: '护盾调度级适性. 拥有无可匹敌的耐心与专注，擅长在极高热的恒星辐射区分配偏振护盾能量。',
  ESTJ: '重力场管控级适性。擅长以刚性的战术指令和严格的参数边界管理推进器的过载上限。',
  ESFJ: '星港枢纽级适性。能高速响应来自各分系统的协作请求，是多人编队中不可或缺的润滑剂。',
  ISTP: '星舰工程级适性。擅长极限状态下的引擎冷启动与机械解构，在无应答的深空孤境中亦能独立决策。',
  ISFP: '星图漫游级适性。拥有独特的空间方向感，常能在毫无地标的混沌星区中，感知到最安全的暗物质通道。',
  ESTP: '强袭拦截级适性。对超高频的电磁警告有惊人的应变速度，适合作为强袭截击机的首席飞行员。',
  ESFP: '近防炮控级适性。即时反应速度极快，在遭遇大量太空垃圾或微陨石雨袭击时，能以极高精准度进行手动拦截。'
};

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
    mbtiDesc: '',
    originalType: '',
    dirty: false,
    showExitConfirm: false,
    showAnimation: false
  },

  lifetimes: {
    attached: function () {
      var pages = getCurrentPages();
      var parent = pages[pages.length - 1];
      var originalType = (parent && parent.data.mbti && parent.data.mbti.mbtiType) || 'INTJ';

      var dims = buildDims(originalType);
      var mbtiType = getType(dims);
      var traits = MBTI_TRAITS[mbtiType] || [];
      var mbtiDesc = MBTI_DESCS[mbtiType] || '未激活系统适性分析';

      this.setData({
        dims: dims,
        mbtiType: mbtiType,
        mbtiTitle: resolveTitle(mbtiType),
        mbtiTraits: traits,
        mbtiDesc: mbtiDesc,
        originalType: originalType
      });

      var self = this;
      if (this.properties.reduceMotion) {
        this.setData({ showAnimation: true });
      } else {
        // 延时以触发 CSS 过渡滑入
        setTimeout(function () {
          self.setData({ showAnimation: true });
        }, 30);
      }
    },
    detached: function () {
      // 组件销毁时无需清理内部定时器
    }
  },

  methods: {
    onDimToggle: function (e) {
      var dimindex = e.currentTarget.dataset.dimindex;
      var dims = this.data.dims;
      var dim = dims[dimindex];

      // 翻转所选维度的状态值
      var nextValue = dim.selected === dim.options[0].code ? dim.options[1].code : dim.options[0].code;
      dim.selected = nextValue;

      var mbtiType = getType(dims);
      var traits = MBTI_TRAITS[mbtiType] || [];
      var mbtiDesc = MBTI_DESCS[mbtiType] || '未激活系统适性分析';
      var dirty = mbtiType !== this.data.originalType;

      this.setData({
        dims: dims,
        mbtiType: mbtiType,
        mbtiTitle: resolveTitle(mbtiType),
        mbtiTraits: traits,
        mbtiDesc: mbtiDesc,
        dirty: dirty
      });

      vibrateShort('medium');
    },

    onConfirm: function () {
      // 不再内部假装成功，直接通知父页面
      if (this.data.syncState === 'syncing' || this.data.syncState === 'success') return;
      this.triggerEvent('confirm', { mbtiCode: MBTI_CODE_MAP[this.data.mbtiType] });
    },

    _triggerCloseWithAnimation: function () {
      var self = this;
      if (this.properties.reduceMotion) {
        this.triggerEvent('close');
      } else {
        this.setData({ showAnimation: false });
        setTimeout(function () {
          self.triggerEvent('close');
        }, 350); // 对应 WXSS 中 transition 的时间 0.35s
      }
    },

    onClose: function () {
      if (this.data.syncState === 'syncing') return;
      if (this.data.dirty) {
        this.setData({ showExitConfirm: true });
      } else {
        this._triggerCloseWithAnimation();
      }
    },

    cancelExit: function () {
      this.setData({ showExitConfirm: false });
    },

    confirmExit: function () {
      this.setData({ showExitConfirm: false });
      this._triggerCloseWithAnimation();
    },

    onOverlayTap: function () {
      this.onClose();
    },

    noop: function () {
      // 仅用于阻止冒泡
    }
  }
});
