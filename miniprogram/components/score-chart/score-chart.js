/**
 * 科技感折线图组件 — Canvas 2D
 * 贝塞尔平滑曲线 · 发光特效 · 渐变填充 · 触控交互
 */
const { getColor } = require('../../utils/avatar');

Component({
  properties: {
    timestamps: { type: Array, value: [] },
    series: { type: Array, value: [] },
    visibleUsers: { type: Array, value: [] }
  },

  data: {
    canvasHeight: 420,
    tooltipVisible: false,
    tooltipX: 0,
    tooltipTime: '',
    tooltipItems: []
  },

  observers: {
    'timestamps, series, visibleUsers'() {
      this._dataReady = true;
      this._tryInit();
    }
  },

  lifetimes: {
    ready() {
      this._lifecycleReady = true;
      this._tryInit();
    },
    detached() {
      if (this._drawTimer) clearTimeout(this._drawTimer);
      if (this._touchThrottle) clearTimeout(this._touchThrottle);
      if (this._retryTimer) clearTimeout(this._retryTimer);
      this._ctx = null;
      this._canvas = null;
      this._width = 0;
      this._height = 0;
      this._lifecycleReady = false;
      this._dataReady = false;
    }
  },

  methods: {
    /**
     * 安全初始化入口：必须同时满足
     * 1. 组件 lifecycle ready（DOM 已挂载）
     * 2. 数据 observer 已触发（wx:if 条件为 true，canvas 节点存在）
     * 3. setData 回调后 + setTimeout 确保节点完成渲染
     */
    _tryInit() {
      if (!this._lifecycleReady || !this._dataReady) return;
      if (this._initing) return;
      // setData 回调 + setTimeout：确保 wx:if 条件渲染的 canvas 节点已挂载到 DOM
      setTimeout(() => {
        this._initCanvas();
      }, 60);
    },

    _initCanvas() {
      if (this._initing) return;
      this._initing = true;

      // 必须用 this.createSelectorQuery()（组件作用域）
      const query = this.createSelectorQuery();
      query.select('#scoreChart')
        .fields({ node: true, size: true })
        .exec((res) => {
          // res[0] 为 null：节点还没挂载，延迟重试
          if (!res || !res[0] || !res[0].node) {
            console.warn('[score-chart] canvas 节点未就绪，100ms 后重试');
            this._initing = false;
            this._retryTimer = setTimeout(() => this._initCanvas(), 100);
            return;
          }

          const canvas = res[0].node;
          const cssW = res[0].width;
          const cssH = res[0].height;

          // 尺寸为 0：scroll-view 布局未完成，延迟重试
          if (cssW === 0 || cssH === 0) {
            console.warn('[score-chart] canvas 尺寸为 0，100ms 后重试');
            this._initing = false;
            this._retryTimer = setTimeout(() => this._initCanvas(), 100);
            return;
          }

          const ctx = canvas.getContext('2d');
          const dpr = wx.getWindowInfo().pixelRatio;

          // 强制重置物理分辨率（DPR 缩放，防止高清屏模糊）
          canvas.width = cssW * dpr;
          canvas.height = cssH * dpr;
          ctx.scale(dpr, dpr);

          this._canvas = canvas;
          this._ctx = ctx;
          this._width = cssW;
          this._height = cssH;
          this._initing = false;

          console.log('[score-chart] 初始化成功', cssW, cssH, 'dpr:', dpr);
          this._draw();
        });
    },

    _drawDebounced() {
      if (this._drawTimer) clearTimeout(this._drawTimer);
      this._drawTimer = setTimeout(() => this._draw(), 50);
    },

    // ========== Catmull-Rom → Bezier 控制点 ==========

    _catmullRomControlPoints(pts) {
      const n = pts.length;
      if (n < 2) return [];
      const result = [];
      for (let i = 0; i < n - 1; i++) {
        const p0 = pts[Math.max(i - 1, 0)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(i + 2, n - 1)];
        const tension = 0.3;
        result.push({
          cp1x: p1.x + (p2.x - p0.x) * tension,
          cp1y: p1.y + (p2.y - p0.y) * tension,
          cp2x: p2.x - (p3.x - p1.x) * tension,
          cp2y: p2.y - (p3.y - p1.y) * tension,
          x: p2.x,
          y: p2.y
        });
      }
      return result;
    },

    // ========== 主绘制 ==========

    _draw() {
      const ctx = this._ctx;
      if (!ctx) return;
      const { timestamps, series, visibleUsers } = this.data;
      const w = this._width;
      const h = this._height;

      ctx.clearRect(0, 0, w, h);

      if (!timestamps || timestamps.length < 2 || !series || series.length === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('数据不足', w / 2, h / 2);
        return;
      }

      // 过滤可见 series
      const visibleSet = new Set(visibleUsers.map(String));
      const visibleSeries = visibleUsers.length > 0
        ? series.filter(s => visibleSet.has(String(s.userId)))
        : series;

      if (visibleSeries.length === 0) return;

      // Y 轴范围（对称化）
      let yMin = Infinity, yMax = -Infinity;
      visibleSeries.forEach(s => {
        s.scores.forEach(v => {
          if (v < yMin) yMin = v;
          if (v > yMax) yMax = v;
        });
      });
      const absMax = Math.max(Math.abs(yMin), Math.abs(yMax), 10);
      yMin = -absMax;
      yMax = absMax;

      // 布局
      const pad = { top: 24, right: 20, bottom: 36, left: 20 };
      const chartW = w - pad.left - pad.right;
      const chartH = h - pad.top - pad.bottom;
      const n = timestamps.length;

      const xScale = (i) => pad.left + (i / (n - 1)) * chartW;
      const yScale = (v) => pad.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;
      const zeroY = yScale(0);

      // 极淡零线
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, zeroY);
      ctx.lineTo(w - pad.right, zeroY);
      ctx.stroke();

      // 绘制每条曲线
      visibleSeries.forEach((s) => {
        const color = getColor(s.nickname);
        const points = s.scores.map((v, i) => ({ x: xScale(i), y: yScale(v) }));
        const cps = this._catmullRomControlPoints(points);

        // 渐变填充
        const grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
        grad.addColorStop(0, this._colorWithAlpha(color, 0.20));
        grad.addColorStop(1, this._colorWithAlpha(color, 0.0));

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        cps.forEach(cp => {
          ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, cp.x, cp.y);
        });
        ctx.lineTo(points[n - 1].x, h - pad.bottom);
        ctx.lineTo(points[0].x, h - pad.bottom);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // 发光曲线
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        cps.forEach(cp => {
          ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, cp.x, cp.y);
        });
        ctx.stroke();
        ctx.restore();

        // 终点圆
        const last = points[n - 1];
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // X 轴极简标签（首尾时间）
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(this._fmtTime(timestamps[0]), pad.left, h - 8);
      ctx.textAlign = 'right';
      ctx.fillText(this._fmtTime(timestamps[n - 1]), w - pad.right, h - 8);

      // 触控指示线
      if (this._touchIdx >= 0 && this._touchIdx < n) {
        const tx = xScale(this._touchIdx);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(tx, pad.top);
        ctx.lineTo(tx, h - pad.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        visibleSeries.forEach((s) => {
          const color = getColor(s.nickname);
          const cy = yScale(s.scores[this._touchIdx]);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(tx, cy, 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(20,20,20,0.9)';
          ctx.beginPath();
          ctx.arc(tx, cy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    },

    // ========== 触控交互 ==========

    onTouchStart(e) { this._handleTouch(e); },

    onTouchMove(e) {
      if (this._touchThrottle) return;
      this._touchThrottle = setTimeout(() => {
        this._touchThrottle = null;
      }, 16);
      this._handleTouch(e);
    },

    onTouchEnd() {
      this._touchIdx = -1;
      this._draw();
      this.setData({ tooltipVisible: false });
    },

    _handleTouch(e) {
      const touch = e.touches[0];
      if (!touch || !this._width) return;
      const { timestamps, series, visibleUsers } = this.data;
      const n = timestamps.length;
      if (n < 2) return;

      const pad = { left: 20, right: 20 };
      const chartW = this._width - pad.left - pad.right;
      const x = touch.x - pad.left;
      const idx = Math.round((x / chartW) * (n - 1));
      const clamped = Math.max(0, Math.min(n - 1, idx));
      this._touchIdx = clamped;
      this._draw();

      const visibleSet = new Set(visibleUsers.map(String));
      const vis = visibleUsers.length > 0
        ? series.filter(s => visibleSet.has(String(s.userId)))
        : series;

      const items = vis.map(s => ({
        nickname: s.nickname,
        score: s.scores[clamped],
        color: getColor(s.nickname)
      }));

      this.setData({
        tooltipVisible: true,
        tooltipX: Math.round(touch.x),
        tooltipTime: this._fmtTime(timestamps[clamped]),
        tooltipItems: items
      });
    },

    // ========== 工具 ==========

    _colorWithAlpha(hex, alpha) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    },

    _fmtTime(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      const pad = n => String(n).padStart(2, '0');
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }
});
