const TITLES = {
  INTJ: '冷静型控场者', INTP: '模型型分析者', ENTJ: '压迫型指挥者', ENTP: '扰动型试探者',
  INFJ: '远读型观察者', INFP: '直觉型守序者', ENFJ: '节奏型组织者', ENFP: '机会型游走者',
  ISTJ: '纪律型执行者', ISFJ: '防守型稳定者', ESTJ: '规则型压制者', ESFJ: '协同型支援者',
  ISTP: '冷启动猎手', ISFP: '低频型感知者', ESTP: '高压型突击者', ESFP: '现场型爆发者'
};

Component({
  properties: {
    reduceMotion: { type: Boolean, value: false }
  },

  data: {
    dims: [
      { key: 'EI', options: ['E', 'I'], selected: 'I' },
      { key: 'SN', options: ['S', 'N'], selected: 'N' },
      { key: 'TF', options: ['T', 'F'], selected: 'T' },
      { key: 'JP', options: ['J', 'P'], selected: 'J' }
    ],
    mbtiType: 'INTJ',
    mbtiTitle: '冷静型控场者'
  },

  methods: {
    onSelect(e) {
      const { dimindex, value } = e.currentTarget.dataset;
      const dims = this.data.dims;
      dims[dimindex].selected = value;
      const mbtiType = dims.map(d => d.selected).join('');
      const mbtiTitle = TITLES[mbtiType] || '未知型';
      this.setData({ dims, mbtiType, mbtiTitle });
    },

    onConfirm() {
      this.triggerEvent('confirm', { mbtiType: this.data.mbtiType });
    },

    onClose() {
      this.triggerEvent('close');
    }
  }
});
