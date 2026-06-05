/**
 * 五维战力雷达图
 * Canvas 2D 绘制，暗黑极简风格
 * 支持入场动画（线条从圆心展开）和点击浮窗交互
 */

const LINE_COLOR = '#00D4FF';
const FILL_COLOR = 'rgba(0, 212, 255, 0.10)';
const GRID_COLOR = 'rgba(255, 255, 255, 0.06)';
const LABEL_COLOR = 'rgba(255, 255, 255, 0.72)';
const VALUE_COLOR = 'rgba(0, 212, 255, 0.90)';
const BG_COLOR = 'rgba(255, 255, 255, 0.035)';

// 锁定态灰色
const LOCKED_LINE = 'rgba(255, 255, 255, 0.12)';
const LOCKED_FILL = 'rgba(255, 255, 255, 0.03)';
const LOCKED_LABEL = 'rgba(255, 255, 255, 0.25)';
const LOCKED_VALUE = 'rgba(255, 255, 255, 0.20)';

const SIDES = 5;
const START_ANGLE = -Math.PI / 2;

Component({
  properties: {
    dimensions: {
      type: Array,
      value: []
    },
    size: {
      type: Number,
      value: 560
    },
    reduceMotion: {
      type: Boolean,
      value: false
    },
    locked: {
      type: Boolean,
      value: false
    }
  },

  observers: {
    'dimensions'() {
      if (!this._width) {
        this._initCanvas();
      } else {
        this._draw(1);
      }
    }
  },

  lifetimes: {
    ready() {
      this._initCanvas();
    },
    detached() {
      if (this._animFrameId && this._canvas) {
        this._canvas.cancelAnimationFrame(this._animFrameId);
      }
    }
  },

  data: {
    tooltipVisible: false,
    tooltipX: 0,
    tooltipY: 0,
    tooltipLabel: '',
    tooltipDesc: '',
    tooltipValue: 0
  },

  methods: {
    _initCanvas() {
      if (this._initing) return;
      this._initing = true;

      const query = this.createSelectorQuery();
      query.select('#radarCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          this._initing = false;
          if (!res || !res[0] || !res[0].node) return;

          try {
            const canvas = res[0].node;
            const ctx = canvas.getContext('2d');
            const dpr = wx.getSystemInfoSync().pixelRatio;

            canvas.width = res[0].width * dpr;
            canvas.height = res[0].height * dpr;
            ctx.scale(dpr, dpr);

            this._canvas = canvas;
            this._ctx = ctx;
            this._width = res[0].width;
            this._height = res[0].height;

            if (this.data.reduceMotion) {
              this._draw(1);
            } else {
              this._animateIn();
            }
          } catch (err) {
            console.warn('radar-chart canvas init failed:', err);
          }
        });
    },

    _animateIn() {
      const duration = 800;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);

        this._draw(eased);

        if (progress < 1) {
          this._animFrameId = this._canvas.requestAnimationFrame(animate);
        }
      };

      this._animFrameId = this._canvas.requestAnimationFrame(animate);
    },

    _draw(progress) {
      const ctx = this._ctx;
      const dims = this.data.dimensions;
      if (!dims || dims.length === 0) return;

      const locked = this.data.locked;
      const lineColor = locked ? LOCKED_LINE : LINE_COLOR;
      const fillColor = locked ? LOCKED_FILL : FILL_COLOR;
      const labelColor = locked ? LOCKED_LABEL : LABEL_COLOR;
      const valueColor = locked ? LOCKED_VALUE : VALUE_COLOR;

      const w = this._width;
      const h = this._height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2 - 50;

      ctx.clearRect(0, 0, w, h);

      // 背景圆
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 20, 0, Math.PI * 2);
      ctx.fillStyle = BG_COLOR;
      ctx.fill();

      // 网格层（3 层）
      const gridLevels = [0.33, 0.66, 1.0];
      for (const level of gridLevels) {
        ctx.beginPath();
        for (let i = 0; i < SIDES; i++) {
          const angle = START_ANGLE + (Math.PI * 2 / SIDES) * i;
          const x = cx + Math.cos(angle) * radius * level;
          const y = cy + Math.sin(angle) * radius * level;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 轴线
      for (let i = 0; i < SIDES; i++) {
        const angle = START_ANGLE + (Math.PI * 2 / SIDES) * i;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 数据区域
      ctx.beginPath();
      for (let i = 0; i < SIDES; i++) {
        const angle = START_ANGLE + (Math.PI * 2 / SIDES) * i;
        const val = (dims[i].value / 100) * progress;
        const x = cx + Math.cos(angle) * radius * val;
        const y = cy + Math.sin(angle) * radius * val;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 数据顶点
      for (let i = 0; i < SIDES; i++) {
        const angle = START_ANGLE + (Math.PI * 2 / SIDES) * i;
        const val = (dims[i].value / 100) * progress;
        const x = cx + Math.cos(angle) * radius * val;
        const y = cy + Math.sin(angle) * radius * val;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = lineColor;
        ctx.fill();
      }

      // 维度标签
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < SIDES; i++) {
        const angle = START_ANGLE + (Math.PI * 2 / SIDES) * i;
        const labelR = radius + 32;
        const lx = cx + Math.cos(angle) * labelR;
        const ly = cy + Math.sin(angle) * labelR;

        // 标签名
        ctx.font = '12px -apple-system, sans-serif';
        ctx.fillStyle = labelColor;
        ctx.fillText(dims[i].label, lx, ly - 8);

        // 数值
        ctx.font = 'bold 14px -apple-system, sans-serif';
        ctx.fillStyle = valueColor;
        ctx.fillText(String(Math.round(dims[i].value * progress)), lx, ly + 10);
      }

      // 记录顶点坐标用于点击检测
      this._vertices = [];
      for (let i = 0; i < SIDES; i++) {
        const angle = START_ANGLE + (Math.PI * 2 / SIDES) * i;
        const labelR = radius + 32;
        this._vertices.push({
          x: cx + Math.cos(angle) * labelR,
          y: cy + Math.sin(angle) * labelR,
          index: i
        });
      }
    },

    onCanvasTap(e) {
      if (!this._vertices || !this.data.dimensions.length) return;

      const x = e.detail.x;
      const y = e.detail.y;

      // 检测点击是否在某个维度标签附近
      for (const v of this._vertices) {
        const dx = x - v.x;
        const dy = y - v.y;
        if (dx * dx + dy * dy < 900) { // 30px 半径
          const dim = this.data.dimensions[v.index];
          this.setData({
            tooltipVisible: true,
            tooltipX: v.x,
            tooltipY: v.y - 50,
            tooltipLabel: dim.label,
            tooltipDesc: dim.desc,
            tooltipValue: dim.value
          });

          // 3秒后自动隐藏
          if (this._tooltipTimer) clearTimeout(this._tooltipTimer);
          this._tooltipTimer = setTimeout(() => {
            this.setData({ tooltipVisible: false });
          }, 3000);
          return;
        }
      }

      // 点击空白区域关闭浮窗
      this.setData({ tooltipVisible: false });
    },

    closeTooltip() {
      this.setData({ tooltipVisible: false });
    },

    /** 生成分享海报图片 */
    sharePoster() {
      if (!this._canvas) return;

      wx.showLoading({ title: '生成中' });
      wx.canvasToTempFilePath({
        canvas: this._canvas,
        x: 0, y: 0,
        width: this._width,
        height: this._height,
        destWidth: this._width * 2,
        destHeight: this._height * 2,
        success: (res) => {
          wx.hideLoading();
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
            fail: () => wx.showToast({ title: '保存失败', icon: 'none' })
          });
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '生成失败', icon: 'none' });
        }
      });
    }
  }
});
