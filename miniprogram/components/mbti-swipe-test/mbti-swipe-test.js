const QUESTIONS = [
  { id: 'q01', dimension: 'E_I', text: '在复杂局面中，我更倾向于主动发起对话，而不是等待别人先开口。' },
  { id: 'q02', dimension: 'E_I', text: '长时间独处后，我会感到能量下降，需要和人交流来恢复。' },
  { id: 'q03', dimension: 'E_I', text: '在团队讨论中，我通常是发言最多的那个人。' },
  { id: 'q04', dimension: 'E_I', text: '我更喜欢在热闹的环境中工作，而不是安静的独处空间。' },
  { id: 'q05', dimension: 'E_I', text: '面对陌生社交场合，我会感到兴奋而非疲惫。' },

  { id: 'q06', dimension: 'S_N', text: '我更关注眼前的具体事实，而不是未来的可能性。' },
  { id: 'q07', dimension: 'S_N', text: '解决问题时，我更依赖已有经验，而不是尝试全新方法。' },
  { id: 'q08', dimension: 'S_N', text: '我更喜欢处理实际的、可触摸的事物，而不是抽象的概念。' },
  { id: 'q09', dimension: 'S_N', text: '描述一件事时，我会按时间顺序讲细节，而不是跳跃式地讲重点。' },
  { id: 'q10', dimension: 'S_N', text: '我相信经验和数据比直觉更可靠。' },

  { id: 'q11', dimension: 'T_F', text: '做决策时，我更看重逻辑分析，而不是对他人的影响。' },
  { id: 'q12', dimension: 'T_F', text: '在争论中，我更在意谁的论点更合理，而不是谁的感受被伤害了。' },
  { id: 'q13', dimension: 'T_F', text: '我更倾向于直接指出问题，而不是顾及面子委婉表达。' },
  { id: 'q14', dimension: 'T_F', text: '评价一个方案时，效率比公平更重要。' },
  { id: 'q15', dimension: 'T_F', text: '我更容易被有理有据的论证说服，而不是情感化的表达。' },

  { id: 'q16', dimension: 'J_P', text: '我喜欢提前做好计划，而不是随机应变。' },
  { id: 'q17', dimension: 'J_P', text: '截止日期临近时，我通常已经完成了大部分工作。' },
  { id: 'q18', dimension: 'J_P', text: '我更喜欢有明确规则和结构的环境。' },
  { id: 'q19', dimension: 'J_P', text: '面对多个选项时，我会尽快做出决定，而不是保持开放。' },
  { id: 'q20', dimension: 'J_P', text: '我的工作区域通常保持整洁有序。' }
];

Component({
  properties: {
    reduceMotion: { type: Boolean, value: false }
  },

  data: {
    currentIndex: 0,
    progress: '01 / 20',
    progressPercent: 0,
    currentQuestion: null,
    totalQuestions: 20,
    answers: [],
    animating: false,
    slideDirection: '' // 'left', 'right', ''
  },

  lifetimes: {
    attached() {
      this.setData({ currentQuestion: QUESTIONS[0] });
    }
  },

  methods: {
    onSwipeRight() {
      this.submitAnswer(1, 'right');
    },

    onSwipeLeft() {
      this.submitAnswer(-1, 'left');
    },

    onNotSure() {
      this.submitAnswer(0, '');
    },

    submitAnswer(score, direction) {
      if (this.data.animating) return;

      const question = QUESTIONS[this.data.currentIndex];
      const answer = {
        questionId: question.id,
        dimension: question.dimension,
        score: score
      };

      const answers = [...this.data.answers, answer];
      const nextIndex = this.data.currentIndex + 1;

      var percent = Math.round((nextIndex / QUESTIONS.length) * 100);

      if (this.data.reduceMotion) {
        // 无动画直接切换
        if (nextIndex >= QUESTIONS.length) {
          this.complete(answers);
        } else {
          this.setData({
            currentIndex: nextIndex,
            progress: String(nextIndex + 1).padStart(2, '0') + ' / 20',
            progressPercent: percent,
            currentQuestion: QUESTIONS[nextIndex],
            answers
          });
        }
      } else {
        // 带动画切换
        this.setData({ animating: true, slideDirection: direction });

        setTimeout(() => {
          if (nextIndex >= QUESTIONS.length) {
            this.complete(answers);
          } else {
            this.setData({
              currentIndex: nextIndex,
              progress: String(nextIndex + 1).padStart(2, '0') + ' / 20',
              progressPercent: percent,
              currentQuestion: QUESTIONS[nextIndex],
              answers,
              animating: false,
              slideDirection: ''
            });
          }
        }, 300);
      }
    },

    complete(answers) {
      this.triggerEvent('complete', {
        testVersion: 'v1',
        answers
      });
    },

    onClose() {
      wx.showModal({
        title: '确认退出',
        content: '退出后本次校准不会保存',
        confirmText: '退出',
        confirmColor: '#FF453A',
        success: (res) => {
          if (res.confirm) {
            this.triggerEvent('close');
          }
        }
      });
    }
  }
});
