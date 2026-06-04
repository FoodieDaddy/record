/**
 * 科技感折线图组件 — Canvas 2D
 * 线性 lineTo · 发光特效 · 渐变填充 · Y 轴网格 · Canvas Tooltip · 数据抽稀
 */
const { getColor } = require('../../utils/avatar');

// 抽稀阈值
const MAX_POINTS = 60;

Component({
  properties: {
    timestamps: { type: Array, value: [] },
    series: { type: Array, value: [] },
    visibleUsers: { type: Array, value: [] },
    highlightUser: { type: String, value: '' }
  },

  data: {
    canvasHeight: 420
  },

  observers: {
    'timestamps, series, visibleUsers, highlightUser'() {
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
      this._cleanup();
    }
  },

  pageLifetimes: {
    show() {
      if (this._initialized && !this._ctx) {
        this._initialized = false;
        this._retryCount = 0;
        this._tryInit();
      }
    }
  },

  methods: {
    _cleanup() {
      if (this._drawTimer) clearTimeout(this._drawTimer);
      if (this._touchThrottle) clearTimeout(this._touchThrottle);
      if (this._retryTimer) clearTimeout(this._retryTimer);
      this._ctx = null;
      this._canvas = null;
      this._width = 0;
      this._height = 0;
      this._lifecycleReady = false;
      this._dataReady = false;
      this._initialized = false;
    },

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
        .select('#scoreChart')
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

    // ========== 数据抽稀 ==========

    _decimateIndices(scores, maxPoints) {
      const n = scores.length;
      if (n <= maxPoints) return scores.map((_, i) => i);

      const keep = new Set([0, n - 1]);
      for (let i = 1; i < n - 1; i++) {
        const prev = scores[i - 1], cur = scores[i], next = scores[i + 1];
        if ((cur >= prev && cur >= next) || (cur <= prev && cur <= next)) {
          keep.add(i);
        }
      }

      const sorted = Array.from(keep).sort((a, b) => a - b);
      if (sorted.length > maxPoints) {
        const step = (n - 1) / (maxPoints - 1);
        const result = [];
        for (let i = 0; i < maxPoints; i++) {
          result.push(Math.round(i * step));
        }
        return [...new Set(result)];
      }

      const remaining = maxPoints - sorted.length;
      const step = (n - 1) / (remaining + 1);
      for (let i = 1; i <= remaining; i++) {
        sorted.push(Math.round(i * step));
      }
      return [...new Set(sorted)].sort((a, b) => a - b);
    },

    // ========== 主绘制 ==========

    _draw() {
      const ctx = this._ctx;
      if (!ctx) return;
      const { timestamps, series, visibleUsers } = this.data;
      const w = this._width;
      const h = this._height;

      ctx.clearRect(0, 0, w, h);

      if (!timestamps || timestamps.length < 1 || !series || series.length === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('数据不足', w / 2, h / 2);
        return;
      }

      const visibleSet = new Set(visibleUsers.map(String));
      const visibleSeries = visibleUsers.length > 0
        ? series.filter(s => visibleSet.has(String(s.userId)))
        : series;

      if (visibleSeries.length === 0) return;

      const pad = { top: 24, right: 20, bottom: 36, left: 44 };
      const chartW = w - pad.left - pad.right;
      const chartH = h - pad.top - pad.bottom;

      // Y 轴范围（对称化 + 15% 冗余边界）
      let yMin = Infinity, yMax = -Infinity;
      visibleSeries.forEach(s => {
        if (s.scores) {
          s.scores.forEach(v => {
            if (v < yMin) yMin = v;
            if (v > yMax) yMax = v;
          });
        }
      });
      const absMax = Math.max(Math.abs(yMin), Math.abs(yMax));
      const finalMax = (absMax === 0 ? 100 : absMax) * 1.15;
      yMin = -finalMax;
      yMax = finalMax;

      // 数据抽稀
      const firstScores = visibleSeries[0].scores || [];
      const indices = this._decimateIndices(firstScores, MAX_POINTS);
      const n = indices.length;
      this._decimatedIndices = indices;

      const xScale = (i) => pad.left + (n > 1 ? (i / (n - 1)) * chartW : chartW / 2);
      const yScale = (v) => pad.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

      // Y 轴网格 + 刻度
      this._drawYGrid(ctx, pad, w, chartH, yMin, yMax, yScale);

      // X 轴时间标签
      this._drawXTicks(ctx, timestamps, indices, pad, h, chartW, n, xScale);

      // 绘制曲线
      const hlUser = this.data.highlightUser;
      visibleSeries.forEach((s) => {
        if (!s.scores || s.scores.length === 0) return;

        const color = getColor(s.nickname);
        const isHL = hlUser && String(s.userId) === String(hlUser);
        const alpha = hlUser ? (isHL ? 1.0 : 0.35) : 1.0;
        const lineWidth = isHL ? 4 : 2;
        const glowBlur = isHL ? 18 : 8;

        const scores = indices.map(i => s.scores[i] || 0);
        const points = scores.map((v, i) => ({ x: xScale(i), y: yScale(v) }));
        const pointCount = points.length;

        if (pointCount === 1) {
          this._drawSinglePoint(ctx, points[0], color);
          return;
        }

        // 渐变填充
        const grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
        grad.addColorStop(0, this._colorWithAlpha(color, 0.20 * alpha));
        grad.addColorStop(1, this._colorWithAlpha(color, 0.0));
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < pointCount; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.lineTo(points[pointCount - 1].x, h - pad.bottom);
        ctx.lineTo(points[0].x, h - pad.bottom);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // 发光曲线
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowColor = color;
        ctx.shadowBlur = glowBlur;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < pointCount; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
        ctx.restore();

        // 终点圆
        ctx.save();
        ctx.globalAlpha = alpha;
        const last = points[pointCount - 1];
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(last.x, last.y, isHL ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 触控指示线 + Canvas Tooltip
      if (this._touchIdx >= 0 && this._touchIdx < n) {
        const tx = xScale(this._touchIdx);

        // 虚线竖线
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(tx, pad.top);
        ctx.lineTo(tx, h - pad.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        // 各 series 的触控圆点
        visibleSeries.forEach((s) => {
          if (!s.scores) return;
          const color = getColor(s.nickname);
          const val = s.scores[indices[this._touchIdx]] || 0;
          const cy = yScale(val);
          if (isNaN(cy)) return;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(tx, cy, 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#141414';
          ctx.beginPath();
          ctx.arc(tx, cy, 3, 0, Math.PI * 2);
          ctx.fill();
        });

        // Canvas Tooltip
        this._drawTooltip(ctx, visibleSeries, indices, timestamps, w, h, pad, tx);
      }
    },

    // ========== Canvas Tooltip ==========

    _drawTooltip(ctx, visibleSeries, indices, timestamps, canvasW, canvasH, pad, tx) {
      const rawIdx = indices[this._touchIdx];
      const ts = timestamps[rawIdx];

      // 取第一个可见 series 的数据（当前用户）
      const s = visibleSeries[0];
      if (!s || !s.scores) return;

      const currentScore = s.scores[rawIdx] || 0;
      const nickname = s.nickname || '';

      // 计算 delta
      let delta = 0;
      if (s.deltas && s.deltas[rawIdx] !== undefined && s.deltas[rawIdx] !== 0) {
        delta = s.deltas[rawIdx];
      } else if (rawIdx > 0) {
        delta = (s.scores[rawIdx] || 0) - (s.scores[rawIdx - 1] || 0);
      }

      // 解析交易对手
      let targetName = '';
      if (s.targets && s.targets[rawIdx]) {
        const targetId = s.targets[rawIdx];
        const found = this.data.series.find(ss => String(ss.userId) === String(targetId));
        if (found) targetName = found.nickname;
      }

      // ===== 组装两行文本 =====
      const timeStr = this._fmtTime(ts);
      const text1 = `${timeStr} | 结余: ${currentScore}`;

      let text2 = '';
      let text2Color = '#FFFFFF';
      if (delta > 0) {
        text2 = `← ${targetName || '未知'}  +${delta}`;
        text2Color = '#32D74B';
      } else if (delta < 0) {
        text2 = `→ ${targetName || '未知'}  ${delta}`;
        text2Color = '#FF453A';
      } else {
        text2 = '无积分变动';
        text2Color = 'rgba(255,255,255,0.5)';
      }

      // ===== 计算框体尺寸 =====
      ctx.font = 'bold 11px sans-serif';
      const w1 = ctx.measureText(text1).width;
      const w2 = ctx.measureText(text2).width;
      const boxW = Math.max(w1, w2) + 24;
      const lineH = 20;
      const boxH = lineH * 2 + 16;

      // 碰撞检测：超出右边界则翻转到左侧
      let boxX = tx + 12;
      if (boxX + boxW > canvasW - 8) {
        boxX = tx - boxW - 12;
      }
      const boxY = pad.top + 8;

      // ===== 绘制毛玻璃背景 =====
      ctx.save();
      ctx.fillStyle = 'rgba(20, 20, 20, 0.88)';
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      this._roundRect(ctx, boxX, boxY, boxW, boxH, 8);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // ===== 绘制文本 =====
      ctx.save();
      ctx.textBaseline = 'top';
      ctx.font = 'bold 11px sans-serif';

      // 第一行：时间 | 结余
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(text1, boxX + 12, boxY + 8);

      // 第二行：箭头 + 对手 + 变动额
      ctx.fillStyle = text2Color;
      ctx.fillText(text2, boxX + 12, boxY + 8 + lineH);

      ctx.restore();
    },

    /** 绘制圆角矩形 */
    _roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    },

    // ========== Y 轴网格 ==========

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
      ctx.restore();
    },

    // ========== X 轴标签 ==========

    _drawXTicks(ctx, timestamps, indices, pad, h, chartW, n, xScale) {
      if (n < 1) return;
      const labelCount = Math.min(5, n);
      const step = n > 1 ? (n - 1) / (labelCount - 1) : 0;

      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '10px sans-serif';
      ctx.textBaseline = 'top';

      for (let i = 0; i < labelCount; i++) {
        const idx = Math.round(i * step);
        if (idx >= n) continue;
        const x = xScale(idx);
        const rawIdx = indices[idx];
        const label = this._fmtTime(timestamps[rawIdx]);

        if (i === 0) ctx.textAlign = 'left';
        else if (i === labelCount - 1) ctx.textAlign = 'right';
        else ctx.textAlign = 'center';
        ctx.fillText(label, x, h - pad.bottom + 10);
      }
      ctx.restore();
    },

    _drawSinglePoint(ctx, point, color) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = this._colorWithAlpha(color, 0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
      ctx.stroke();
    },

    // ========== 触控交互 ==========

    onTouchStart(e) { this._handleTouch(e); },

    onTouchMove(e) {
      if (this._touchThrottle) return;
      this._touchThrottle = setTimeout(() => { this._touchThrottle = null; }, 16);
      this._handleTouch(e);
    },

    onTouchEnd() {
      this._touchIdx = -1;
      this._draw();
    },

    _handleTouch(e) {
      const touch = e.touches[0];
      if (!touch || !this._width) return;
      const { timestamps, series } = this.data;
      if (!timestamps || timestamps.length < 1) return;

      const firstScores = (series[0] && series[0].scores) || [];
      const indices = this._decimateIndices(firstScores, MAX_POINTS);
      const n = indices.length;

      const pad = { left: 44, right: 20 };
      const chartW = this._width - pad.left - pad.right;
      const x = touch.x - pad.left;
      const idx = n > 1 ? Math.round((x / chartW) * (n - 1)) : 0;
      const clamped = Math.max(0, Math.min(n - 1, idx));
      this._touchIdx = clamped;
      this._draw();
    },

    // ========== 工具函数 ==========

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
    },

    _colorWithAlpha(hex, alpha) {
      if (!hex || hex.length < 7) return `rgba(255,255,255,${alpha})`;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    },

    _fmtTime(ts) {
      if (!ts) return '';
      const ms = String(ts).length === 10 ? parseInt(ts) * 1000 : parseInt(ts);
      const d = new Date(ms);
      if (isNaN(d.getTime())) return '';
      const p = n => String(n).padStart(2, '0');
      return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }
  }
});
