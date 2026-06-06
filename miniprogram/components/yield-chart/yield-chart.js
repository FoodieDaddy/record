/**
 * 积分曲线组件 — Canvas 2D
 * 累计净积分折线 · 正负渐变填充 · 发光节点 · 终端网格
 */

Component({
  properties: {
    points: { type: Array, value: [] },
    reduceMotion: { type: Boolean, value: false }
  },

  data: {
    canvasHeight: 320
  },

  observers: {
    'points'() {
      this._dataReady = true;
      if (this._initialized) {
        this._draw();
      } else if (this._lifecycleReady) {
        this._scheduleInit();
      }
    }
  },

  lifetimes: {
    ready() {
      this._lifecycleReady = true;
      this._retryCount = 0;
      this._tryInit();
    },
    detached() {
      if (this._drawTimer) clearTimeout(this._drawTimer);
      if (this._retryTimer) clearTimeout(this._retryTimer);
      this._ctx = null;
      this._canvas = null;
      this._lifecycleReady = false;
      this._dataReady = false;
      this._initialized = false;
    }
  },

  methods: {
    _tryInit() {
      if (!this._lifecycleReady || !this._dataReady) return;
      this._retryCount = 0;
      this._scheduleInit();
    },

    _scheduleInit() {
      if (this._retryTimer) clearTimeout(this._retryTimer);
      if (this._initialized) return;
      this._retryTimer = setTimeout(() => this._initCanvas(), 200);
    },

    _initCanvas() {
      if (this._initialized) return;
      if (this._retryCount >= 20) return;
      this._retryCount++;

      wx.createSelectorQuery().in(this)
        .select('#yieldCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            this._scheduleInit();
            return;
          }

          const canvas = res[0].node;
          const cssW = res[0].width;
          const cssH = res[0].height;

          if (cssW === 0 || cssH === 0) {
            this._scheduleInit();
            return;
          }

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            this._scheduleInit();
            return;
          }

          const dpr = wx.getWindowInfo().pixelRatio;
          canvas.width = cssW * dpr;
          canvas.height = cssH * dpr;
          ctx.scale(dpr, dpr);

          this._canvas = canvas;
          this._ctx = ctx;
          this._width = cssW;
          this._height = cssH;
          this._initialized = true;
          this._draw();
        });
    },

    _draw() {
      const ctx = this._ctx;
      if (!ctx) return;
      const { points } = this.data;
      const w = this._width;
      const h = this._height;

      ctx.fillStyle = '#0A0F18';
      ctx.fillRect(0, 0, w, h);

      if (!points || points.length < 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('数据不足', w / 2, h / 2);
        return;
      }

      const pad = { top: 24, right: 20, bottom: 36, left: 44 };
      const chartW = w - pad.left - pad.right;
      const chartH = h - pad.top - pad.bottom;
      const n = points.length;

      const cumulative = [];
      let sum = 0;
      points.forEach(p => { sum += p.netScore; cumulative.push(sum); });

      let yMin = Math.min(0, ...cumulative);
      let yMax = Math.max(0, ...cumulative);
      const absMax = Math.max(Math.abs(yMin), Math.abs(yMax));
      const finalMax = (absMax === 0 ? 100 : absMax) * 1.15;
      yMin = -finalMax;
      yMax = finalMax;

      const xScale = (i) => pad.left + (n > 1 ? (i / (n - 1)) * chartW : chartW / 2);
      const yScale = (v) => pad.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;
      const zeroY = yScale(0);

      this._drawYGrid(ctx, pad, w, chartH, yMin, yMax, yScale);

      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '10px sans-serif';
      ctx.textBaseline = 'top';
      const labelCount = Math.min(5, n);
      const step = n > 1 ? (n - 1) / (labelCount - 1) : 0;
      for (let i = 0; i < labelCount; i++) {
        const idx = Math.round(i * step);
        if (idx >= n) continue;
        const x = xScale(idx);
        const label = points[idx].date ? points[idx].date.slice(5) : '';
        ctx.textAlign = i === 0 ? 'left' : i === labelCount - 1 ? 'right' : 'center';
        ctx.fillText(label, x, h - pad.bottom + 10);
      }
      ctx.restore();

      const xyPoints = cumulative.map((v, i) => ({ x: xScale(i), y: yScale(v) }));

      this._fillSegments(ctx, xyPoints, zeroY, h - pad.bottom, pad);

      ctx.save();
      ctx.shadowColor = '#00AFFF';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#00AFFF';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(xyPoints[0].x, xyPoints[0].y);
      for (let i = 1; i < xyPoints.length; i++) ctx.lineTo(xyPoints[i].x, xyPoints[i].y);
      ctx.stroke();
      ctx.restore();

      xyPoints.forEach((pt) => {
        ctx.save();
        ctx.shadowColor = '#00AFFF';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#00AFFF';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      const last = xyPoints[xyPoints.length - 1];
      ctx.save();
      ctx.shadowColor = '#00AFFF';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#00AFFF';
      ctx.beginPath();
      ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    _fillSegments(ctx, xyPoints, zeroY, bottomY, pad) {
      const n = xyPoints.length;
      if (n < 2) return;

      for (let i = 0; i < n - 1; i++) {
        const p0 = xyPoints[i];
        const p1 = xyPoints[i + 1];
        const midY = (p0.y + p1.y) / 2;
        const isPositive = midY <= zeroY;

        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p1.x, zeroY);
        ctx.lineTo(p0.x, zeroY);
        ctx.closePath();

        if (isPositive) {
          const grad = ctx.createLinearGradient(0, pad.top, 0, zeroY);
          grad.addColorStop(0, 'rgba(0, 175, 255, 0.35)');
          grad.addColorStop(1, 'rgba(0, 175, 255, 0.0)');
          ctx.fillStyle = grad;
        } else {
          const grad = ctx.createLinearGradient(0, zeroY, 0, bottomY);
          grad.addColorStop(0, 'rgba(255, 77, 79, 0.0)');
          grad.addColorStop(1, 'rgba(255, 77, 79, 0.35)');
          ctx.fillStyle = grad;
        }
        ctx.fill();
        ctx.restore();
      }
    },

    _drawYGrid(ctx, pad, w, chartH, yMin, yMax, yScale) {
      const tickCount = 4;
      const range = yMax - yMin;
      const rawStep = range / tickCount;
      const step = this._niceStep(rawStep);
      const firstTick = Math.ceil(yMin / step) * step;

      ctx.save();
      for (let v = firstTick; v <= yMax; v += step) {
        const y = yScale(v);
        if (y < pad.top - 2 || y > pad.top + chartH + 2) continue;

        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(w - pad.right, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(this._formatAxisValue(v), pad.left - 6, y);
      }

      const zeroY = yScale(0);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(pad.left, zeroY);
      ctx.lineTo(w - pad.right, zeroY);
      ctx.stroke();
      ctx.restore();
    },

    _niceStep(rawStep) {
      if (rawStep <= 0) return 1;
      const exp = Math.floor(Math.log10(rawStep));
      const frac = rawStep / Math.pow(10, exp);
      let nice;
      if (frac <= 1.5) nice = 1;
      else if (frac <= 3) nice = 2;
      else if (frac <= 7) nice = 5;
      else nice = 10;
      return nice * Math.pow(10, exp);
    },

    _formatAxisValue(v) {
      if (v === 0) return '0';
      const abs = Math.abs(v);
      const sign = v > 0 ? '+' : '-';
      if (abs >= 100000000) return sign + (Math.round(abs / 10000000) / 10) + '亿';
      if (abs >= 10000) return sign + (Math.round(abs / 1000) / 10) + '万';
      return String(v);
    }
  }
});
