/**
 * 五维战力雷达图 — Persona Terminal 风格
 * 锁定态：蓝色线框 + 扫描动画 + DATA COLLECTING
 * 解锁态：发光数据线 + 脉冲顶点
 */

const LINE_COLOR = '#00AFFF';
const FILL_COLOR = 'rgba(0, 175, 255, 0.10)';
const FILL_GLOW = 'rgba(0, 175, 255, 0.25)';
const GRID_COLOR = 'rgba(0, 175, 255, 0.08)';
const GRID_COLOR_STRONG = 'rgba(0, 175, 255, 0.14)';
const LABEL_COLOR = 'rgba(255, 255, 255, 0.60)';
const VALUE_COLOR = 'rgba(0, 175, 255, 0.95)';
const BG_COLOR = 'rgba(0, 175, 255, 0.02)';

// 锁定态：蓝色线框
const LOCKED_LINE = 'rgba(0, 175, 255, 0.30)';
const LOCKED_FILL = 'rgba(0, 175, 255, 0.04)';
const LOCKED_LABEL = 'rgba(0, 175, 255, 0.40)';
const LOCKED_VALUE = 'rgba(0, 175, 255, 0.35)';
const SCAN_COLOR = 'rgba(0, 175, 255, 0.15)';

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
    'dimensions, locked'() {
      if (!this._width) {
        this._initCanvas();
      } else {
        if (this.data.locked) {
          this._startScanAnimation();
        } else {
          this._stopScanAnimation();
          this._draw(1);
        }
      }
    }
  },

  lifetimes: {
    ready() {
      this._initCanvas();
    },
    detached() {
      this._stopScanAnimation();
      this._stopPulseAnimation();
      if (this._animFrameId && this._canvas) {
        this._canvas.cancelAnimationFrame(this._animFrameId);
      }
      if (this._tooltipTimer) {
        clearTimeout(this._tooltipTimer);
        this._tooltipTimer = null;
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
            const dpr = wx.getWindowInfo().pixelRatio;

            canvas.width = res[0].width * dpr;
            canvas.height = res[0].height * dpr;
            ctx.scale(dpr, dpr);

            this._canvas = canvas;
            this._ctx = ctx;
            this._width = res[0].width;
            this._height = res[0].height;

            if (this.data.locked) {
              this._scanAngle = 0;
              this._startScanAnimation();
            } else if (this.data.reduceMotion) {
              this._draw(1);
            } else {
              this._animateIn();
            }
          } catch (err) {
            console.warn('radar-chart canvas init failed:', err);
          }
        });
    },

    _startScanAnimation() {
      if (this.data.reduceMotion) {
        this._drawLocked(0);
        return;
      }
      this._stopScanAnimation();
      this._scanAngle = 0;
      const tick = () => {
        this._scanAngle = (this._scanAngle + 0.015) % (Math.PI * 2);
        this._drawLocked(this._scanAngle);
        this._scanTimer = setTimeout(tick, 40);
      };
      tick();
    },

    _stopScanAnimation() {
      if (this._scanTimer) {
        clearTimeout(this._scanTimer);
        this._scanTimer = null;
      }
    },

    _animateIn() {
      const duration = 800;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        this._draw(eased);

        if (progress < 1) {
          this._animFrameId = this._canvas.requestAnimationFrame(animate);
        } else {
          this._startPulseAnimation();
        }
      };

      this._animFrameId = this._canvas.requestAnimationFrame(animate);
    },

    _startPulseAnimation() {
      if (this.data.reduceMotion || this.data.locked) return;
      this._pulsePhase = 0;
      const tick = () => {
        this._pulsePhase = (this._pulsePhase + 0.04) % (Math.PI * 2);
        this._draw(1, this._pulsePhase);
        this._pulseTimer = setTimeout(tick, 50);
      };
      tick();
    },

    _stopPulseAnimation() {
      if (this._pulseTimer) {
        clearTimeout(this._pulseTimer);
        this._pulseTimer = null;
      }
    },

    _drawLocked(scanAngle) {
      const ctx = this._ctx;
      const w = this._width;
      const h = this._height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2 - 50;

      ctx.clearRect(0, 0, w, h);

      // 背景
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 20, 0, Math.PI * 2);
      ctx.fillStyle = BG_COLOR;
      ctx.fill();

      // 网格
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

      // 扫描扇形
      const sweepAngle = Math.PI * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, scanAngle, scanAngle + sweepAngle);
      ctx.closePath();
      const scanGrad = ctx.createConicalGradient
        ? null
        : null;
      ctx.fillStyle = SCAN_COLOR;
      ctx.fill();

      // 蓝色线框轮廓（半径 60%）
      ctx.beginPath();
      for (let i = 0; i < SIDES; i++) {
        const angle = START_ANGLE + (Math.PI * 2 / SIDES) * i;
        const val = 0.55;
        const x = cx + Math.cos(angle) * radius * val;
        const y = cy + Math.sin(angle) * radius * val;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = LOCKED_FILL;
      ctx.fill();
      ctx.strokeStyle = LOCKED_LINE;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 锁定顶点
      for (let i = 0; i < SIDES; i++) {
        const angle = START_ANGLE + (Math.PI * 2 / SIDES) * i;
        const val = 0.55;
        const x = cx + Math.cos(angle) * radius * val;
        const y = cy + Math.sin(angle) * radius * val;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = LOCKED_LINE;
        ctx.fill();
      }

      // 标签
      const dims = this.data.dimensions;
      if (dims && dims.length > 0) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < SIDES; i++) {
          const angle = START_ANGLE + (Math.PI * 2 / SIDES) * i;
          const labelR = radius + 32;
          const lx = cx + Math.cos(angle) * labelR;
          const ly = cy + Math.sin(angle) * labelR;
          ctx.font = '12px -apple-system, sans-serif';
          ctx.fillStyle = LOCKED_LABEL;
          ctx.fillText(dims[i].label, lx, ly);
        }
      }

      // 中心文字
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 11px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(0, 175, 255, 0.50)';
      ctx.letterSpacing = '2px';
      ctx.fillText('数据采集中', cx, cy - 8);
      ctx.font = '10px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(0, 175, 255, 0.30)';
      ctx.fillText('采样中', cx, cy + 10);
    },

    _draw(progress, pulsePhase) {
      const ctx = this._ctx;
      const dims = this.data.dimensions;
      if (!dims || dims.length === 0) return;

      const w = this._width;
      const h = this._height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2 - 50;

      ctx.clearRect(0, 0, w, h);

      // 背景
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 20, 0, Math.PI * 2);
      ctx.fillStyle = BG_COLOR;
      ctx.fill();

      // 网格
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
        ctx.strokeStyle = level === 1.0 ? GRID_COLOR_STRONG : GRID_COLOR;
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

      // 数据区域 — 发光描边
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

      // 发光层
      ctx.save();
      ctx.shadowColor = 'rgba(0, 175, 255, 0.30)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = FILL_COLOR;
      ctx.fill();
      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // 内层高亮
      ctx.strokeStyle = FILL_GLOW;
      ctx.lineWidth = 1;
      ctx.stroke();

      // 数据顶点 — 脉冲
      const pulseScale = pulsePhase !== undefined ? 1 + 0.3 * Math.sin(pulsePhase) : 1;
      for (let i = 0; i < SIDES; i++) {
        const angle = START_ANGLE + (Math.PI * 2 / SIDES) * i;
        const val = (dims[i].value / 100) * progress;
        const x = cx + Math.cos(angle) * radius * val;
        const y = cy + Math.sin(angle) * radius * val;

        // 外圈发光
        ctx.beginPath();
        ctx.arc(x, y, 6 * pulseScale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 175, 255, 0.15)';
        ctx.fill();

        // 内圈实心
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = LINE_COLOR;
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

        ctx.font = '12px -apple-system, sans-serif';
        ctx.fillStyle = LABEL_COLOR;
        ctx.fillText(dims[i].label, lx, ly - 8);

        ctx.font = 'bold 14px -apple-system, sans-serif';
        ctx.fillStyle = VALUE_COLOR;
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

      for (const v of this._vertices) {
        const dx = x - v.x;
        const dy = y - v.y;
        if (dx * dx + dy * dy < 900) {
          const dim = this.data.dimensions[v.index];
          this.setData({
            tooltipVisible: true,
            tooltipX: v.x,
            tooltipY: v.y - 50,
            tooltipLabel: dim.label,
            tooltipDesc: dim.desc,
            tooltipValue: dim.value
          });

          if (this._tooltipTimer) clearTimeout(this._tooltipTimer);
          this._tooltipTimer = setTimeout(() => {
            this.setData({ tooltipVisible: false });
          }, 3000);
          return;
        }
      }

      this.setData({ tooltipVisible: false });
    },

    closeTooltip() {
      this.setData({ tooltipVisible: false });
    },

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
