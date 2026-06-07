Component({
  options: {
    addGlobalClass: true,
    multipleSlots: true
  },

  properties: {
    // 卡片类型：primary | cyan | purple | green | orange
    type: {
      type: String,
      value: 'primary'
    },
    // 图标名称（svg-icon class 后缀）
    icon: {
      type: String,
      value: ''
    },
    // 主标题
    title: {
      type: String,
      value: ''
    },
    // 英文副标题
    en: {
      type: String,
      value: ''
    },
    // 主数值文本
    primaryText: {
      type: String,
      value: ''
    },
    // 主数值提示
    primaryHint: {
      type: String,
      value: ''
    },
    // 主数值样式类
    primaryClass: {
      type: String,
      value: ''
    },
    // 描述文本
    description: {
      type: String,
      value: ''
    },
    // 标签列表 [{text, type}]
    tags: {
      type: Array,
      value: []
    },
    // 数据指标 [{value, label, valueClass}]
    metrics: {
      type: Array,
      value: []
    },
    // 操作按钮文本
    actionText: {
      type: String,
      value: ''
    }
  },

  computed: {
    typeClass() {
      const typeMap = {
        primary: 'insight-card__icon-wrap--primary',
        cyan: 'insight-card__icon-wrap--cyan',
        purple: 'insight-card__icon-wrap--purple',
        green: 'insight-card__icon-wrap--green',
        orange: 'insight-card__icon-wrap--orange'
      };
      return typeMap[this.data.type] || typeMap.primary;
    }
  },

  methods: {
    onActionTap() {
      this.triggerEvent('action');
    }
  }
});
