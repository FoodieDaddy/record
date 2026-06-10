/**
 * 全息扫描图 — 星图式轨道圈风格
 * 锁定态：轨道圈 + 扫描动画 + 轨道节点
 * 解锁态：弧线连接 + 节点旅行 + 脉冲投影
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
    },
    heroMode: {
      type: Boolean,
      value: false
    },
    heroLabel: {
      type: String,
      value: ''
    }
  },

  observers: {
    'dimensions, locked'() {
      this._redraw();
    }
  },

  lifetimes: {
    ready() {
      this._initCanvas();
    },
    detached() {
      this._stopAnimation();
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
    _redraw() {
      if (!this._width) {
        this._initCanvas();
      } else {
        this._stopAnimation();
        if (this.data.locked) {
          this._startAnimation('locked');
        } else if (this.data.reduceMotion) {
          this._drawFull(1, 0, 0);
        } else {
          this._startAnimation('unlocked');
        }
      }
    },

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
              this._startAnimation('locked');
            } else if (this.data.reduceMotion) {
              this._drawFull(1, 0, 0);
            } else {
              this._startAnimation('unlocked');
            }
          } catch (err) {
            console.warn('radar-chart canvas init failed:', err);
          }
        });
    },

    // ---- 统一动画控制 ----
    _startAnimation(mode) {
      this._animMode = mode;
      this._animStartTime = Date.now();
      this._starField = this._generateStarField();

      if (mode === 'locked') {
        this._scanAngle = 0;
      }

      if (this.data.reduceMotion) {
        if (mode === 'locked') {
          this._drawLockedStatic();
        } else {
          this._drawFull(1, 0, 0);
        }
        return;
      }

      const self = this;
      function tick() {
        if (self._animMode !== mode) return;

        if (mode === 'locked') {
          self._scanAngle = (self._scanAngle + 0.012) % (Math.PI * 2);
          const t = (Date.now() - self._animStartTime) / 1000;
          self._drawLockedAnimated(self._scanAngle, t);
        } else {
          const elapsed = Date.now() - self._animStartTime;
          const duration = 1200;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const sweep = Math.min(elapsed / 1500, 1);
          const pulseT = elapsed / 1000;

          self._drawFull(eased, sweep, pulseT);

          if (progress >= 1 && !self._pulsing) {
            self._pulsing = true;
            self._startPulseLoop();
            return;
          }
        }

        if (self._canvas) {
          self._animFrameId = self._canvas.requestAnimationFrame(tick);
        }
      }

      this._animFrameId = this._canvas.requestAnimationFrame(tick);
    },

    _startPulseLoop() {
      if (this._pulsing) return;
      const self = this;
      function tick() {
        if (self._animMode !== 'unlocked' || self.data.locked) return;
        const t = (Date.now() - self._animStartTime) / 1000;
        self._drawFull(1, 1, t);
        if (self._canvas) {
          self._animFrameId = self._canvas.requestAnimationFrame(tick);
        }
      }
      this._animFrameId = this._canvas.requestAnimationFrame(tick);
    },

    _stopAnimation() {
      this._animMode = null;
      this._pulsing = false;
      if (this._animFrameId && this._canvas) {
        this._canvas.cancelAnimationFrame(this._animFrameId);
        this._animFrameId = null;
      }
    },

    _generateStarField() {
      var stars = [];
      var seed = (this._width || 300) * 7 + (this._height || 300) * 13;
      for (var i = 0; i < 18; i++) {
        seed = (seed * 16807 + 7) % 2147483647;
        var rx = (seed % 1000) / 1000;
        seed = (seed * 16807 + 7) % 2147483647;
        var ry = (seed % 1000) / 1000;
        seed = (seed * 16807 + 7) % 2147483647;
        var rb = 0.3 + (seed % 1000) / 1000 * 0.7;
        stars.push({ x: rx, y: ry, b: rb });
      }
      return stars;
    },

    // ---- 绘制：锁定态（静态，reduce-motion） ----
    _drawLockedStatic() {
      var ctx = this._ctx;
      var w = this._width;
      var h = this._height;
      var cx = w / 2;
      var cy = h / 2;
      var radius = Math.min(w, h) / 2 - 50;

      ctx.clearRect(0, 0, w, h);

      this._drawStarField(ctx, w, h);
      this._drawStarPoints(ctx, cx, cy, radius, 12);

      // 背景
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 20, 0, Math.PI * 2);
      ctx.fillStyle = BG_COLOR;
      ctx.fill();

      // 同心轨道圈
      this._drawOrbitalRings(ctx, cx, cy, radius, 'rgba(0,200,255,0.12)', 'rgba(0,200,255,0.05)');

      // 轨道节点
      for (var j = 0; j < SIDES; j++) {
        var a = START_ANGLE + (Math.PI * 2 / SIDES) * j;
        var vx = cx + Math.cos(a) * radius * 0.55;
        var vy = cy + Math.sin(a) * radius * 0.55;
        ctx.beginPath();
        ctx.arc(vx, vy, 3, 0, Math.PI * 2);
        ctx.fillStyle = LOCKED_LINE;
        ctx.fill();
      }

      // 维度标签
      this._drawLabels(ctx, cx, cy, radius, 1, LOCKED_LABEL, LOCKED_VALUE, true);

      // 中心投影点
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 200, 255, 0.40)';
      ctx.fill();
    },

    // ---- 绘制：锁定态（动画） ----
    _drawLockedAnimated(scanAngle, time) {
      var ctx = this._ctx;
      var w = this._width;
      var h = this._height;
      var cx = w / 2;
      var cy = h / 2;
      var radius = Math.min(w, h) / 2 - 50;

      ctx.clearRect(0, 0, w, h);

      this._drawStarField(ctx, w, h);
      this._drawStarPoints(ctx, cx, cy, radius, 12);

      // 背景
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 20, 0, Math.PI * 2);
      ctx.fillStyle = BG_COLOR;
      ctx.fill();

      // 呼吸外环
      var breathe = 1 + 0.02 * Math.sin(time * 0.8);
      ctx.beginPath();
      ctx.arc(cx, cy, (radius + 16) * breathe, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.10)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 同心轨道圈
      this._drawOrbitalRings(ctx, cx, cy, radius, 'rgba(0,200,255,0.12)', 'rgba(0,200,255,0.05)');

      // 扫描扇形
      var sweepAngle = Math.PI * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, scanAngle, scanAngle + sweepAngle);
      ctx.closePath();
      ctx.fillStyle = SCAN_COLOR;
      ctx.fill();

      // 轨道节点
      for (var j = 0; j < SIDES; j++) {
        var a = START_ANGLE + (Math.PI * 2 / SIDES) * j;
        var vx = cx + Math.cos(a) * radius * 0.55;
        var vy = cy + Math.sin(a) * radius * 0.55;
        ctx.beginPath();
        ctx.arc(vx, vy, 3, 0, Math.PI * 2);
        ctx.fillStyle = LOCKED_LINE;
        ctx.fill();
      }

      // 维度标签
      this._drawLabels(ctx, cx, cy, radius, 1, LOCKED_LABEL, LOCKED_VALUE, true);

      // 中心投影点
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 200, 255, 0.40)';
      ctx.fill();
    },

    // ---- 绘制：完整态（轨道圈 + 弧线连接 + 节点旅行 + 脉冲） ----
    _drawFull(progress, sweep, time) {
      var ctx = this._ctx;
      var dims = this.data.dimensions;
      if (!dims || dims.length === 0) return;

      var w = this._width;
      var h = this._height;
      var cx = w / 2;
      var cy = h / 2;
      var radius = Math.min(w, h) / 2 - 50;

      ctx.clearRect(0, 0, w, h);

      // 星场背景
      this._drawStarField(ctx, w, h);

      // 背景圆
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 20, 0, Math.PI * 2);
      ctx.fillStyle = BG_COLOR;
      ctx.fill();

      // 呼吸外环
      var breathe = 1 + 0.015 * Math.sin(time * 0.8);
      ctx.beginPath();
      ctx.arc(cx, cy, (radius + 16) * breathe, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.10)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 同心轨道圈
      this._drawOrbitalRings(ctx, cx, cy, radius, GRID_COLOR_STRONG, GRID_COLOR);

      // 数据进度
      var faceProgress = Math.max(0, Math.min((progress - 0.2) / 0.8, 1));
      var faceEased = 1 - Math.pow(1 - faceProgress, 2);

      // 数据顶点（从中心旅行到目标位置）
      var nodeProgress = Math.max(0, Math.min((progress - 0.3) / 0.7, 1));
      var nodeEased = 1 - Math.pow(1 - nodeProgress, 3);
      var pulseScale = 1 + 0.25 * Math.sin(time * 2.5);

      for (var n = 0; n < SIDES; n++) {
        var na = START_ANGLE + (Math.PI * 2 / SIDES) * n;
        var targetVal = (dims[n].value / 100) * progress * faceEased;
        var currentVal = targetVal * nodeEased;
        var nx = cx + Math.cos(na) * radius * currentVal;
        var ny = cy + Math.sin(na) * radius * currentVal;

        ctx.beginPath();
        ctx.arc(nx, ny, 6 * pulseScale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 200, 255, 0.15)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(nx, ny, 3, 0, Math.PI * 2);
        ctx.fillStyle = LINE_COLOR;
        ctx.fill();
      }

      // HUD 标签
      this._drawLabels(ctx, cx, cy, radius, progress, LABEL_COLOR, VALUE_COLOR);

      // 扫描完成流光
      if (sweep > 0 && sweep < 1) {
        var sweepAngle2 = sweep * Math.PI * 2;
        var sx = cx + Math.cos(sweepAngle2) * radius;
        var sy = cy + Math.sin(sweepAngle2) * radius;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(sx, sy);
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 200, 255, 0.50)';
        ctx.fill();
      }

      // 中心脉冲点
      var cpScale = 1 + 0.15 * Math.sin(time * 2);
      ctx.beginPath();
      ctx.arc(cx, cy, 5 * cpScale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 200, 255, 0.60)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 10 * cpScale, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.20)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 记录顶点坐标
      this._vertices = [];
      for (var v = 0; v < SIDES; v++) {
        var va = START_ANGLE + (Math.PI * 2 / SIDES) * v;
        var vlr = radius + 32;
        this._vertices.push({
          x: cx + Math.cos(va) * vlr,
          y: cy + Math.sin(va) * vlr,
          index: v
        });
      }
    },

    // ---- 共享绘制子方法 ----
    _drawStarField(ctx, w, h) {
      var stars = this._starField;
      if (!stars) return;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, 0.5 + s.b * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200, 220, 255, ' + (0.04 + s.b * 0.08) + ')';
        ctx.fill();
      }
    },

    _drawOrbitalRings(ctx, cx, cy, radius, outerColor, innerColor) {
      var levels = [0.33, 0.66, 1.0];
      for (var i = 0; i < levels.length; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * levels[i], 0, Math.PI * 2);
        ctx.strokeStyle = i === 2 ? outerColor : innerColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    },

    _drawStarPoints(ctx, cx, cy, radius, count) {
      var seed = (cx * 7 + cy * 13) | 0;
      if (seed === 0) seed = 12345;
      for (var i = 0; i < count; i++) {
        seed = (seed * 16807 + 7) % 2147483647;
        var rx = (seed % 1000) / 1000;
        seed = (seed * 16807 + 7) % 2147483647;
        var ry = (seed % 1000) / 1000;
        seed = (seed * 16807 + 7) % 2147483647;
        var rb = 0.3 + (seed % 1000) / 1000 * 0.7;
        var dx = cx + (rx - 0.5) * radius * 2.2;
        var dy = cy + (ry - 0.5) * radius * 2.2;
        ctx.beginPath();
        ctx.arc(dx, dy, 0.5 + rb * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200, 220, 255, ' + (0.04 + rb * 0.06) + ')';
        ctx.fill();
      }
    },

    _drawLabels(ctx, cx, cy, radius, progress, labelColor, valueColor, locked) {
      var dims = this.data.dimensions;
      if (!dims || dims.length === 0) return;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (var i = 0; i < SIDES; i++) {
        var angle = START_ANGLE + (Math.PI * 2 / SIDES) * i;
        var labelR = radius + 32;
        var lx = cx + Math.cos(angle) * labelR;
        var ly = cy + Math.sin(angle) * labelR;
        ctx.font = '12px -apple-system, sans-serif';
        ctx.fillStyle = labelColor;
        ctx.fillText(dims[i].label, lx, ly - 8);
        ctx.font = 'bold 14px -apple-system, sans-serif';
        ctx.fillStyle = valueColor;
        var valueText = locked ? '--' : String(Math.round(dims[i].value * progress));
        ctx.fillText(valueText, lx, ly + 10);
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
