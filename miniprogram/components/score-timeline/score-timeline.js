/**
 * 积分-时间折线图组件
 * Canvas 2D 绘制，Neon 发光效果，贝塞尔曲线，渐变填充
 * 支持触摸游标交互和入场动画
 */

// 正值：科技蓝；负值：警示红
const COLOR_POSITIVE = '#4f8cff';
const COLOR_NEGATIVE = '#f87171';
// 发光色（半透明版本）
const GLOW_POSITIVE = 'rgba(79, 140, 255, 0.6)';
const GLOW_NEGATIVE = 'rgba(248, 113, 113, 0.6)';

Component({
  properties: {
    /** 时间戳数组（毫秒） */
    timestamps: { type: Array, value: [] },
    /** 积分数组（与 timestamps 一一对应） */
    scores: { type: Array, value: [] },
    /** 图表高度 rpx */
    canvasHeight: { type: Number, value: 400 },
    reduceMotion: { type: Boolean, value: false }
  },

  observers: {
    'timestamps, scores'() {
      if (!this._width) {
        this._initCanvas();
      } else {
        this._scheduleRedraw();
      }
    }
  },

  lifetimes: {
    ready() {
      this._initCanvas();
    },
    detached() {
      if (this._animFrameId && this._canvas) this._canvas.cancelAnimationFrame(this._animFrameId);
      if (this._redrawTimer) clearTimeout(this._redrawTimer);
    }
  },

  data: {
    tooltipVisible: false,
    tooltipX: 0,
    tooltipY: 0,
    tooltipText: ''
  },

  methods: {
    // ======================== Canvas 初始化 ========================

    _initCanvas() {
      if (this._initing) return;
      this._initing = true;

      const query = this.createSelectorQuery();
      query.select('#timelineCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          this._initing = false;
          if (!res || !res[0]) return;

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

          this._startEntryAnimation();
        });
    },

    // ======================== 重绘调度（节流） ========================

    _scheduleRedraw() {
      if (this._redrawTimer) return;
      this._redrawTimer = setTimeout(() => {
        this._redrawTimer = null;
        this._draw(1);
      }, 16);
    },

    // ======================== 入场动画 ========================

    _startEntryAnimation() {
      if (this._animFrameId && this._canvas) this._canvas.cancelAnimationFrame(this._animFrameId);

      if (this.data.reduceMotion) {
        this._draw(1);
        return;
      }

      const { timestamps } = this.data;
      if (!timestamps || timestamps.length < 2) {
        this._draw(1);
        return;
      }

      const duration = 1200;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        // easeOutCubic 缓动
        let progress = Math.min(elapsed / duration, 1);
        progress = 1 - Math.pow(1 - progress, 3);

        this._draw(progress);

        if (progress < 1) {
          this._animFrameId = this._canvas.requestAnimationFrame(animate);
        }
      };

      this._animFrameId = this._canvas.requestAnimationFrame(animate);
    },

    // ======================== 主绘制函数 ========================

    _draw(progress) {
      const ctx = this._ctx;
      if (!ctx) return;

      const { timestamps, scores } = this.data;
      const w = this._width;
      const h = this._height;

      // 清空画布
      ctx.clearRect(0, 0, w, h);

      // 数据校验
      if (!timestamps || timestamps.length < 2 || !scores || scores.length < 2) {
        this._drawEmpty(ctx, w, h);
        return;
      }

      const n = Math.min(timestamps.length, scores.length);

      // 计算 Y 轴极值（对称化，保证 0 在中间）
      let yMin = Infinity, yMax = -Infinity;
      for (let i = 0; i < n; i++) {
        if (scores[i] < yMin) yMin = scores[i];
        if (scores[i] > yMax) yMax = scores[i];
      }
      const absMax = Math.max(Math.abs(yMin), Math.abs(yMax), 10);
      yMin = -absMax;
      yMax = absMax;

      // 布局参数
      const pad = { top: 24, right: 20, bottom: 16, left: 20 };
      const chartW = w - pad.left - pad.right;
      const chartH = h - pad.top - pad.bottom;

      // 坐标映射
      const xOf = (i) => pad.left + (i / (n - 1)) * chartW;
      const yOf = (v) => pad.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;
      const zeroY = yOf(0);

      // 计算数据点像素坐标
      const points = [];
      for (let i = 0; i < n; i++) {
        points.push({ x: xOf(i), y: yOf(scores[i]), score: scores[i] });
      }

      // 贝塞尔控制点
      const cp = this._computeControlPoints(points);

      // 入场动画裁剪：只绘制 progress 比例的宽度
      const clipRight = pad.left + chartW * progress;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, clipRight, h);
      ctx.clip();

      // 绘制渐变填充
      this._drawGradientFill(ctx, points, cp, zeroY, h, pad);

      // 绘制发光折线
      this._drawGlowLine(ctx, points, cp);

      ctx.restore();

      // 绘制游标（不受入场动画裁剪）
      if (this._touchIdx >= 0 && this._touchIdx < n && progress >= 1) {
        this._drawCursor(ctx, points, this._touchIdx, pad, h);
      }
    },

    // ======================== 空状态 ========================

    _drawEmpty(ctx, w, h) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('数据不足', w / 2, h / 2);
    },

    // ======================== 贝塞尔控制点计算 ========================

    _computeControlPoints(pts) {
      const n = pts.length;
      const result = [];
      for (let i = 0; i < n - 1; i++) {
        const p0 = pts[Math.max(i - 1, 0)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(i + 2, n - 1)];

        // Catmull-Rom 切线
        const tension = 0.3;
        const dx1 = (p2.x - p0.x) * tension;
        const dy1 = (p2.y - p0.y) * tension;
        const dx2 = (p3.x - p1.x) * tension;
        const dy2 = (p3.y - p1.y) * tension;

        result.push({
          cp1x: p1.x + dx1 / 3,
          cp1y: p1.y + dy1 / 3,
          cp2x: p2.x - dx2 / 3,
          cp2y: p2.y - dy2 / 3
        });
      }
      return result;
    },

    // ======================== 渐变填充 ========================

    _drawGradientFill(ctx, pts, cp, zeroY, h, pad) {
      // 先构建完整路径
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < cp.length; i++) {
        ctx.bezierCurveTo(
          cp[i].cp1x, cp[i].cp1y,
          cp[i].cp2x, cp[i].cp2y,
          pts[i + 1].x, pts[i + 1].y
        );
      }

      // 闭合到底部
      const lastScore = pts[pts.length - 1].score;
      const fillBottom = Math.max(pad.top + (h - pad.top - pad.bottom) * 0.85, zeroY + 20);
      ctx.lineTo(pts[pts.length - 1].x, fillBottom);
      ctx.lineTo(pts[0].x, fillBottom);
      ctx.closePath();

      // 垂直线性渐变：从 zeroY 位置分色
      const grad = ctx.createLinearGradient(0, pad.top, 0, fillBottom);

      // 根据最终得分确定主色调
      const mainColor = lastScore >= 0 ? COLOR_POSITIVE : COLOR_NEGATIVE;
      const mainAlpha = lastScore >= 0 ? 'rgba(79, 140, 255,' : 'rgba(248, 113, 113,';

      // 上半部分（正值区域）用蓝色渐变
      const zeroRatio = Math.max(0, Math.min(1, (zeroY - pad.top) / (fillBottom - pad.top)));
      grad.addColorStop(0, mainAlpha + '0.25)');
      grad.addColorStop(Math.max(0, zeroRatio - 0.01), mainAlpha + '0.12)');
      // zeroY 附近过渡
      grad.addColorStop(zeroRatio, 'rgba(255,255,255,0.03)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');

      ctx.fillStyle = grad;
      ctx.fill();
    },

    // ======================== 发光折线 ========================

    _drawGlowLine(ctx, pts, cp) {
      // 逐段绘制，根据正负切换颜色
      for (let i = 0; i < cp.length; i++) {
        const s1 = pts[i].score;
        const s2 = pts[i + 1].score;
        const bothPositive = s1 >= 0 && s2 >= 0;
        const bothNegative = s1 < 0 && s2 < 0;

        let color, glow;
        if (bothNegative) {
          color = COLOR_NEGATIVE;
          glow = GLOW_NEGATIVE;
        } else if (bothPositive) {
          color = COLOR_POSITIVE;
          glow = GLOW_POSITIVE;
        } else {
          // 跨零段：使用混合色或根据趋势决定
          color = s2 >= 0 ? COLOR_POSITIVE : COLOR_NEGATIVE;
          glow = s2 >= 0 ? GLOW_POSITIVE : GLOW_NEGATIVE;
        }

        // 外发光
        ctx.save();
        ctx.shadowColor = glow;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.bezierCurveTo(
          cp[i].cp1x, cp[i].cp1y,
          cp[i].cp2x, cp[i].cp2y,
          pts[i + 1].x, pts[i + 1].y
        );
        ctx.stroke();
        ctx.restore();

        // 再画一层纯色细线增强锐度
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.bezierCurveTo(
          cp[i].cp1x, cp[i].cp1y,
          cp[i].cp2x, cp[i].cp2y,
          pts[i + 1].x, pts[i + 1].y
        );
        ctx.stroke();
      }
    },

    // ======================== 游标绘制 ========================

    _drawCursor(ctx, pts, idx, pad, h) {
      const px = pts[idx].x;
      const py = pts[idx].y;
      const score = pts[idx].score;

      // 竖线（半透明细线）
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(px, pad.top);
      ctx.lineTo(px, h - pad.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 发光圆点
      const dotColor = score >= 0 ? COLOR_POSITIVE : COLOR_NEGATIVE;
      const dotGlow = score >= 0 ? GLOW_POSITIVE : GLOW_NEGATIVE;

      ctx.save();
      ctx.shadowColor = dotGlow;
      ctx.shadowBlur = 16;
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 内圈白色高光
      ctx.fillStyle = '#E2F2FF';
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    },

    // ======================== 触摸交互 ========================

    onTouchStart(e) {
      this._handleTouch(e);
    },

    onTouchMove(e) {
      // 节流：16ms 间隔
      const now = Date.now();
      if (this._lastTouchTime && now - this._lastTouchTime < 16) return;
      this._lastTouchTime = now;
      this._handleTouch(e);
    },

    onTouchEnd() {
      this._touchIdx = -1;
      this.setData({ tooltipVisible: false });
      this._draw(1);
      this.triggerEvent('touchend');
    },

    onLongPress(e) {
      this._handleTouch(e);
    },

    _handleTouch(e) {
      const touch = e.touches[0];
      if (!touch || !this._width) return;

      const { timestamps, scores } = this.data;
      const n = Math.min(timestamps.length, scores.length);
      if (n < 2) return;

      const pad = { left: 20, right: 20 };
      const chartW = this._width - pad.left - pad.right;
      const x = touch.x - pad.left;
      const idx = Math.round((x / chartW) * (n - 1));
      const clamped = Math.max(0, Math.min(n - 1, idx));

      this._touchIdx = clamped;
      this._draw(1);

      // 更新 tooltip
      const score = scores[clamped];
      const px = pad.left + (clamped / (n - 1)) * chartW;

      this.setData({
        tooltipVisible: true,
        tooltipX: px,
        tooltipY: this._getTooltipY(scores, clamped),
        tooltipText: (score > 0 ? '+' : '') + score
      });

      this.triggerEvent('touchpoint', {
        index: clamped,
        timestamp: timestamps[clamped],
        score: score
      });
    },

    _getTooltipY(scores, idx) {
      // 将分数映射到 canvas 坐标，tooltip 在点上方
      const n = scores.length;
      let yMin = Infinity, yMax = -Infinity;
      for (let i = 0; i < n; i++) {
        if (scores[i] < yMin) yMin = scores[i];
        if (scores[i] > yMax) yMax = scores[i];
      }
      const absMax = Math.max(Math.abs(yMin), Math.abs(yMax), 10);
      yMin = -absMax;
      yMax = absMax;

      const pad = { top: 24, bottom: 16 };
      const chartH = this._height - pad.top - pad.bottom;
      const yOf = (v) => pad.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;
      const pointY = yOf(scores[idx]);

      // tooltip 在点上方 30px，但不超出顶部
      return Math.max(8, pointY - 30);
    }
  }
});
