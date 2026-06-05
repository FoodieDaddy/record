const api = require('../../../utils/mirror-api');

const TOOL_CONFIG = {
  tarot: { name: '塔罗抽牌', subtitle: 'TAROT', hasQuestion: true, spreads: [{ value: 'single', label: '单张牌' }, { value: 'three', label: '三张牌' }] },
  meihua: { name: '梅花易数', subtitle: 'MEIHUA', hasQuestion: true, methods: [{ value: 'time', label: '当前时间' }, { value: 'numbers', label: '两数起卦' }] },
  xiaoliuren: { name: '小六壬', subtitle: 'XIAOLIUREN', hasQuestion: true, methods: [{ value: 'time', label: '当前时间' }, { value: 'number', label: '数字起课' }] },
  liuyao: { name: '六爻', subtitle: 'LIUYAO', hasQuestion: true, methods: [{ value: 'auto', label: '自动起卦' }, { value: 'numbers', label: '数字起卦' }] },
  qimen: { name: '奇门遁甲', subtitle: 'QIMEN', hasQuestion: true },
  almanac: { name: '今日黄历', subtitle: 'ALMANAC', hasQuestion: false },
  taiyi: { name: '太乙九星', subtitle: 'TAIYI', hasQuestion: false },
  bazi: { name: '八字排盘', subtitle: 'BAZI', hasQuestion: false, needsBirth: true },
  ziwei: { name: '紫微斗数', subtitle: 'ZIWEI', hasQuestion: false, needsBirth: true },
  bazi_dayun: { name: '八字大运', subtitle: 'BAZI DAYUN', hasQuestion: false, needsBirth: true },
  bazi_pillars_resolve: { name: '八字反查', subtitle: 'BAZI RESOLVE', hasQuestion: false, needsBirth: true },
  ziwei_horoscope: { name: '紫微运限', subtitle: 'ZIWEI HOROSCOPE', hasQuestion: false, needsBirth: true },
  ziwei_flying_star: { name: '紫微飞星', subtitle: 'ZIWEI FLYING', hasQuestion: false, needsBirth: true },
  daliuren: { name: '大六壬', subtitle: 'DALIUREN', hasQuestion: false, needsBirth: true }
};

Page({
  data: {
    tool: '',
    config: null,
    question: '',
    method: '',
    spread: 'single',
    numbers: [0, 0],
    birthDate: '',
    birthTime: '',
    gender: '',
    calendarType: 'solar',
    saveBirthProfile: false,
    submitting: false,
    locked: false,
    lockReason: ''
  },

  onLoad(options) {
    const tool = options.tool || '';
    const config = TOOL_CONFIG[tool];
    if (!config) {
      wx.showToast({ title: '未知工具', icon: 'none' });
      wx.navigateBack();
      return;
    }
    wx.setNavigationBarTitle({ title: config.name });

    const defaultMethod = config.methods ? config.methods[0].value : '';
    this.setData({ tool, config, method: defaultMethod });
  },

  onQuestionInput(e) {
    this.setData({ question: e.detail.value });
  },

  onMethodChange(e) {
    this.setData({ method: e.currentTarget.dataset.value });
  },

  onSpreadChange(e) {
    this.setData({ spread: e.currentTarget.dataset.value });
  },

  onNumberInput(e) {
    const idx = e.currentTarget.dataset.idx;
    const numbers = this.data.numbers;
    numbers[idx] = parseInt(e.detail.value) || 0;
    this.setData({ numbers });
  },

  onBirthDateChange(e) {
    this.setData({ birthDate: e.detail.value });
  },

  onBirthTimeChange(e) {
    this.setData({ birthTime: e.detail.value });
  },

  onGenderChange(e) {
    this.setData({ gender: e.currentTarget.dataset.value });
  },

  onCalendarChange(e) {
    this.setData({ calendarType: e.currentTarget.dataset.value });
  },

  onSaveBirthChange(e) {
    this.setData({ saveBirthProfile: e.detail.value });
  },

  async onSubmit() {
    const { tool, config, question, method, spread, numbers, birthDate, birthTime, gender, calendarType, saveBirthProfile } = this.data;

    // 前端校验
    if (config.hasQuestion && !question.trim()) {
      wx.showToast({ title: '请输入问题', icon: 'none' });
      return;
    }

    if (config.needsBirth && !birthDate) {
      wx.showToast({ title: '请选择出生日期', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      const params = {};
      if (method) params.method = method;
      if (spread && tool === 'tarot') params.spread = spread;
      if (tool === 'meihua' && method === 'numbers') params.numbers = numbers;
      if (config.needsBirth) {
        params.birthDate = birthDate;
        params.birthTime = birthTime;
        params.gender = gender;
        params.calendarType = calendarType;
        params.saveBirthProfile = saveBirthProfile;
      }

      const result = await api.runMirrorTool({ tool, question, params });
      wx.navigateTo({ url: '/pages/mirror/report/index?id=' + result.reportId });
    } catch (err) {
      wx.showToast({ title: err.message || '运行失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
