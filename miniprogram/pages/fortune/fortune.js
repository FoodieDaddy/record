const { get } = require('../../utils/request')
const app = getApp()

/** 绘制圆角矩形路径 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

/** HEX 颜色转 rgba 字符串 */
function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// 终端日志池 — 拆分为过程日志 / 拖延日志 / 成功收尾日志
// 过程日志：API 返回前逐步输出
const PROCESS_LOGS = [
  // 阶段 1：系统引导
  { msg: 'BOOT SEQUENCE INITIATED...', type: 'info' },
  { msg: '[SYS] 加载命运内核模块 (KERNEL v3.7.2)...', type: 'info' },
  { msg: 'MEMORY ALLOCATION: 0x8F3A2B00 // 运势缓存区已锁定', type: 'info' },
  { msg: '[INIT] 挂载玄学设备 /dev/fortune [OK]', type: 'success' },
  // 阶段 2：环境校准
  { msg: '[ENV] 正在同步天干地支坐标系 (SOLAR_TERMS_DB)...', type: 'info' },
  { msg: '[ENV] 校准农历模块 LUNAR_MODULE v2.1...', type: 'info' },
  { msg: '[WARN] 检测到缓存层数据陈旧，执行 BYPASS...', type: 'warn' },
  { msg: '[ENV] 解密历史运势数据流 HIST_STREAM... [OK]', type: 'success' },
  // 阶段 3：场域扫描
  { msg: '[SCAN] 扫描玩家积分磁场偏移量...', type: 'info' },
  { msg: '[SCAN] 近期积分波动幅度: ±327.68 // MAGNETIC_DEVIATION', type: 'info' },
  { msg: '[FIELD] 分析运势向量场 FORTUNE_VECTOR...', type: 'info' },
  { msg: '[QUANTUM] 计算量子态坍缩概率...', type: 'info' },
  { msg: '[FIELD] 场域分析完成 VECTOR_NORM=0.97 [OK]', type: 'success' },
  // 阶段 4：AI 推演引擎
  { msg: '[AIGC] 启动 Agent 推理任务 TASK_ID=0xA7F3...', type: 'info' },
  { msg: '[AIGC] 神经网络推理引擎 INFERENCE_ENGINE 就绪', type: 'info' },
  { msg: '[AIGC] 算力倾注：深度推演多重宇宙分支...', type: 'info' },
  { msg: '[AIGC] 正在评估风险/收益矩阵 RISK_MATRIX...', type: 'info' },
  { msg: '[AIGC] 解析玩家近期对局行为模式 BEHAVIOR_PATTERN...', type: 'info' },
  { msg: '[AIGC] 交叉验证星座 × 生肖 × 节气耦合因子...', type: 'info' },
]
// 拖延日志：动态生成器，模拟分布式微服务集群仿真
function hex8() { return Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, '0') }
function randAlphaNum(len) { return Math.random().toString(36).substring(2, 2 + len).toUpperCase() }

function generateStallLog() {
  const templates = [
    () => ({ msg: `[WARN] 推理引擎高负荷运转 CPU_LOAD: ${(85 + Math.random() * 14).toFixed(1)}%`, type: 'warn' }),
    () => ({ msg: `[QUANTUM] 解析多重宇宙分支 0x${hex8()}... 波函数尚未坍缩`, type: 'info' }),
    () => ({ msg: `[GATEWAY] 动态路由寻址中... 命中可用神经节点 NACOS_ID: ${randAlphaNum(6)}`, type: 'info' }),
    () => ({ msg: `[ROCKETMQ] 持续消费环境事件流 TOPIC_FORTUNE | OFFSET: ${Math.floor(Math.random() * 900000 + 100000)}`, type: 'info' }),
    () => ({ msg: `[REDIS] 离线演算穿透，触发内存淘汰机制 LRU_KEY: 0x${hex8()}`, type: 'warn' }),
    () => ({ msg: `[AIGC] 持续推演时间线... 累计词元吞吐 TOKENS: ${Math.floor(Math.random() * 4096 + 1024)}`, type: 'info' }),
    () => ({ msg: `[VISION] 提取多模态环境特征矩阵 | YOLO_CONFIDENCE: ${(0.85 + Math.random() * 0.14).toFixed(3)}`, type: 'info' }),
    () => ({ msg: `[FEIGN] 维持跨节点 RPC 量子通信链路 | LATENCY: ${Math.floor(Math.random() * 45 + 5)}ms`, type: 'info' }),
    () => ({ msg: `>>> DATA_STREAM: ${randAlphaNum(10)}...`, type: 'info' }),
    () => ({ msg: `[TRACE] 分布式链路追踪 SPAN_ID: ${randAlphaNum(8)}-${randAlphaNum(4)}`, type: 'info' }),
    () => ({ msg: `[WARN] 算力调度器触发熔断降级 FALLBACK_CHAIN: ${randAlphaNum(6)}`, type: 'warn' }),
    () => ({ msg: `[KAFKA] 消费者组重平衡 REBALANCE_IN_PROGRESS | PARTITION: ${Math.floor(Math.random() * 8)}`, type: 'warn' }),
    () => ({ msg: `[PROMETHEUS] 采集推理节点指标 INFERENCE_P99: ${Math.floor(Math.random() * 300 + 200)}ms`, type: 'info' }),
    () => ({ msg: `[CONSUL] 健康检查通过 NODE_PASS: ${Math.floor(Math.random() * 12 + 3)}/15`, type: 'success' }),
  ]
  return templates[Math.floor(Math.random() * templates.length)]()
}
// 成功收尾日志：API 返回后快速连续输出
const SUCCESS_LOGS = [
  { msg: '[SYNTH] 合成运势输出 FORTUNE_OUTPUT... [OK]', type: 'success' },
  { msg: '[RENDER] 渲染全息命运卡片 HOLO_CARD...', type: 'info' },
  { msg: '[BUFF] 生成增益/减益效果列表...', type: 'info' },
  { msg: 'ALL SYSTEMS NOMINAL // 运势模块就绪', type: 'success' },
  { msg: '[AGENT] 运势量子态坍缩演算完成 [200 OK]', type: 'success' },
]

Page({
  data: {
    loading: true,
    loadingFadeOut: false,
    logs: [],
    scrollToId: '',
    fortune: null,
    error: null,
    rotateX: 0,
    rotateY: 0,
    animationEnabled: true,
    countdownStr: '00:00:00',
    currentDate: '',
    showPosterModal: false,
    posterImagePath: ''
  },

  _logTimer: null,
  _logIndex: 0,
  _accelerometerListening: false,
  _countdownTimer: null,

  onLoad() {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    this.setData({
      animationEnabled: app.globalData.animationEnabled !== false,
      currentDate: `${y}.${m}.${d}`
    })
    this.fetchFortune()
  },

  onShow() {
    if (this.data.animationEnabled) {
      this.startAccelerometer()
    }
    this.startCountdown()
  },

  onHide() {
    this.stopAccelerometer()
    this.stopCountdown()
  },

  onUnload() {
    this.clearLogTimer()
    this.stopAccelerometer()
    this.stopCountdown()
  },

  /** 获取运势，force=true 时跳过缓存强制重新生成 */
  fetchFortune(force) {
    this.setData({ loading: true, loadingFadeOut: false, logs: [], error: null })
    this._apiReturned = false
    this.startLogStream()

    const params = force ? { force: true } : undefined

    get('/fortune/today', params).then(data => {
      this._apiReturned = true
      this.clearLogTimer()
      // 快速连续输出成功收尾日志，然后退场
      this._pushSuccessLogs(() => {
        this._finishLoading({ fortune: data })
      })
    }).catch(err => {
      this._apiReturned = true
      this.clearLogTimer()
      // 失败也要输出收尾日志再退场
      this._pushSuccessLogs(() => {
        this._finishLoading({ error: err.message || '连接中断，请重试' })
      })
    })
  },

  /** 退场：淡出日志遮罩，展示真实内容 */
  _finishLoading(updates) {
    if (this.data.animationEnabled) {
      this.setData({ loadingFadeOut: true })
      setTimeout(() => {
        this.setData({ loading: false, loadingFadeOut: false, logs: [], scrollToId: '', ...updates })
      }, 300)
    } else {
      this.setData({ loading: false, logs: [], scrollToId: '', ...updates })
    }
  },

  /** 刷新运势：强制跳过缓存，重新调用 LLM 生成 */
  refreshFortune() {
    if (this.data.loading) return
    this.fetchFortune(true)
  },

  // ===== 终端日志瀑布流（智能引擎） =====

  startLogStream() {
    this._logIndex = 0
    this.clearLogTimer()
    this._pushNextProcessLog()
  },

  /** 输出下一条过程日志；打完后进入动态拖延模式 */
  _pushNextProcessLog() {
    if (this._apiReturned) return // API 已返回，停止过程日志

    let entry
    if (this._logIndex < PROCESS_LOGS.length) {
      // 过程日志未打完，按序取
      entry = PROCESS_LOGS[this._logIndex++]
    } else {
      // 过程日志打完，动态生成拖延日志
      entry = generateStallLog()
    }

    this._appendLog(entry)

    // 非线性心跳：过程日志 400~900ms；拖延模式 200~1500ms 极端抖动
    const isStall = this._logIndex >= PROCESS_LOGS.length
    const delay = isStall
      ? 200 + Math.floor(Math.random() * 1300)
      : 400 + Math.floor(Math.random() * 500)
    this._logTimer = setTimeout(() => this._pushNextProcessLog(), delay)
  },

  /** API 返回后快速连续输出成功收尾日志 */
  _pushSuccessLogs(onDone) {
    let i = 0
    const push = () => {
      if (i >= SUCCESS_LOGS.length) {
        // 全部收尾日志输出完毕，延迟 500ms 让用户看清，然后退场
        setTimeout(onDone, 500)
        return
      }
      this._appendLog(SUCCESS_LOGS[i++])
      this._logTimer = setTimeout(push, 80 + Math.floor(Math.random() * 70))
    }
    push()
  },

  /** 追加一条日志到 data.logs 并滚动到底部 */
  _appendLog(entry) {
    const now = new Date()
    const ts = [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0')
    ].join(':') + '.' + String(now.getMilliseconds()).padStart(3, '0')

    const logs = this.data.logs.concat({ time: ts, msg: entry.msg, type: entry.type })
    const scrollToId = 'log-' + (logs.length - 1)
    this.setData({ logs, scrollToId })
  },

  clearLogTimer() {
    if (this._logTimer) {
      clearTimeout(this._logTimer)
      this._logTimer = null
    }
  },

  // ===== 重力感应：3D 卡片跟随 =====

  startAccelerometer() {
    if (this._accelerometerListening) return
    this._accelerometerListening = true
    wx.startAccelerometer({ interval: 'game' })
    wx.onAccelerometerChange((res) => {
      const rotateX = Math.max(-15, Math.min(15, res.y * -30))
      const rotateY = Math.max(-15, Math.min(15, res.x * 30))
      this.setData({ rotateX, rotateY })
    })
  },

  stopAccelerometer() {
    if (!this._accelerometerListening) return
    this._accelerometerListening = false
    wx.stopAccelerometer()
    wx.offAccelerometerChange()
  },

  // ===== 磁场重置倒计时 =====

  startCountdown() {
    this.stopCountdown()
    this._updateCountdown()
    this._countdownTimer = setInterval(() => {
      this._updateCountdown()
    }, 1000)
  },

  stopCountdown() {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer)
      this._countdownTimer = null
    }
  },

  _updateCountdown() {
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    let diff = Math.max(0, Math.floor((end - now) / 1000))
    const h = String(Math.floor(diff / 3600)).padStart(2, '0')
    diff %= 3600
    const m = String(Math.floor(diff / 60)).padStart(2, '0')
    const s = String(diff % 60).padStart(2, '0')
    this.setData({ countdownStr: `${h}:${m}:${s}` })
  },

  // ===== 导出情报：Canvas 2D 海报 =====

  onExportSnapshot() {
    if (!this.data.fortune) return
    const userInfo = app.globalData.userInfo || {}
    if (!userInfo.avatarUrl || !userInfo.nickname) {
      wx.showToast({ title: '请先设置头像和昵称', icon: 'none' })
      return
    }
    wx.showLoading({ title: '正在生成情报快照...' })

    const query = wx.createSelectorQuery()
    query.select('#posterCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        wx.hideLoading()
        wx.showToast({ title: '生成失败', icon: 'none' })
        return
      }

      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getWindowInfo().pixelRatio || 2
      const W = 750
      const H = 1334
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.scale(dpr, dpr)

      const fortune = this.data.fortune

      // 预加载小程序码（logo 占位，后续替换为真实小程序码）
      const qrImg = canvas.createImage()
      let qrReady = false
      qrImg.onload = () => { qrReady = true }
      qrImg.src = '/images/logo.png'

      const drawPoster = (avatarImg) => {
        const cx = W / 2
        const padX = 80
        const contentW = W - padX * 2

        // === 1. 背景 ===
        ctx.fillStyle = '#0A0A0A'
        ctx.fillRect(0, 0, W, H)

        // === 2. 全息底光（判词区域背后） ===
        const glowColor = fortune.glowColor || '#0A84FF'
        const aura = ctx.createRadialGradient(cx, 340, 0, cx, 340, 320)
        aura.addColorStop(0, hexToRgba(glowColor, 0.15))
        aura.addColorStop(0.6, hexToRgba(glowColor, 0.05))
        aura.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = aura
        ctx.fillRect(0, 0, W, H)

        // === 3. 用户头像 ===
        const avatarR = 48
        const avatarY = 110
        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, avatarY, avatarR, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(avatarImg, cx - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2)
        ctx.restore()
        // 赛博边框
        ctx.beginPath()
        ctx.arc(cx, avatarY, avatarR + 1.5, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'
        ctx.lineWidth = 2
        ctx.stroke()

        // === 4. 昵称 ===
        let dy = avatarY + avatarR + 28
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.font = '500 18px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(userInfo.nickname, cx, dy)

        // === 5. 时空坐标 ===
        dy += 32
        ctx.fillStyle = 'rgba(255,255,255,0.28)'
        ctx.font = '16px Courier New, monospace'
        const headerText = fortune.lunarDate
          ? `[ 场域监测 | ${this.data.currentDate} · ${fortune.lunarDate} ]`
          : `[ 场域监测 | ${this.data.currentDate} ]`
        ctx.fillText(headerText, cx, dy)

        // === 6. 主判词 ===
        dy += 48
        ctx.fillStyle = '#F5F5F7'
        ctx.font = '600 38px sans-serif'
        dy = this._fillWrappedText(ctx, fortune.verdict, cx, dy, contentW, 54)

        // === 7. 状态标签 + 数据源（紧凑，距判词 ~40px） ===
        dy += 40
        const tagColor = fortune.glowColor || '#0A84FF'
        ctx.fillStyle = tagColor
        ctx.font = 'bold 20px Courier New, monospace'
        ctx.textAlign = 'center'
        const tagText = fortune.tag || fortune.userTag || '—'
        const tagMetrics = ctx.measureText(tagText)
        const tagW = tagMetrics.width + 32
        const tagH = 36
        // 标签背景框（hex → rgba 转换保证 Canvas 兼容）
        const tc = hexToRgba(tagColor, 0.1)
        ctx.fillStyle = tc
        ctx.strokeStyle = hexToRgba(tagColor, 0.25)
        ctx.lineWidth = 1
        roundRect(ctx, cx - tagW / 2, dy - tagH + 6, tagW, tagH, 6)
        ctx.fill()
        ctx.stroke()
        // 标签文字
        ctx.fillStyle = tagColor
        ctx.fillText(tagText, cx, dy)

        dy += 28
        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        ctx.font = '13px Courier New, monospace'
        const sourceText = fortune.source === 'llm' ? '[ 量子推演 ]' : '[ 离线演算 ]'
        const envText = fortune.solarTerm ? `    [ ${fortune.solarTerm} ]` : ''
        ctx.fillText(sourceText + envText, cx, dy)

        // === 8. 数据面板（Buff / Debuff） ===
        dy += 50

        // Buff
        ctx.fillStyle = '#34C759'
        ctx.font = 'bold 18px Courier New, monospace'
        ctx.textAlign = 'left'
        ctx.fillText('[ 系统增益 ]', padX, dy)
        dy += 36

        ctx.font = '20px sans-serif'
        ;(fortune.buffs || []).forEach(item => {
          ctx.fillStyle = '#34C759'
          ctx.fillText('[+]', padX, dy)
          ctx.fillStyle = 'rgba(255,255,255,0.65)'
          ctx.fillText(item, padX + 52, dy)
          dy += 36
        })

        // Debuff
        dy += 20
        ctx.fillStyle = '#FF453A'
        ctx.font = 'bold 18px Courier New, monospace'
        ctx.fillText('[ 风险预警 ]', padX, dy)
        dy += 36

        ctx.font = '20px sans-serif'
        ;(fortune.debuffs || []).forEach(item => {
          ctx.fillStyle = '#FF453A'
          ctx.fillText('[-]', padX, dy)
          ctx.fillStyle = 'rgba(255,255,255,0.65)'
          ctx.fillText(item, padX + 52, dy)
          dy += 36
        })

        // === 9. 底部社交裂变区 ===
        const qrSize = 100
        const qrX = padX
        const qrY = H - 40 - qrSize

        // 水印文字（右侧）
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.font = '14px Courier New, monospace'
        ctx.textAlign = 'left'
        ctx.fillText('HAPPY SMART RECORD', qrX + qrSize + 20, qrY + 20)

        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.font = '10px Courier New, monospace'
        ctx.fillText('[ SCAN TO INITIALIZE ]', qrX + qrSize + 20, qrY + 48)

        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        ctx.font = '10px sans-serif'
        ctx.fillText('长按识别 · 进入赛博对局', qrX + qrSize + 20, qrY + 72)

        // 小程序码
        if (qrReady) {
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)
        }
        // 二维码边框
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'
        ctx.lineWidth = 1
        ctx.strokeRect(qrX, qrY, qrSize, qrSize)

        // 导出
        exportCanvas(canvas, W, H)
      }

      // 异步加载头像
      const img = canvas.createImage()
      img.onload = () => drawPoster(img)
      img.onerror = () => {
        wx.hideLoading()
        wx.showToast({ title: '头像加载失败，导出中止', icon: 'none' })
      }
      img.src = userInfo.avatarUrl

      const exportCanvas = (canvas, W, H) => {
        wx.canvasToTempFilePath({
          canvas,
          x: 0, y: 0,
          width: W,
          height: H,
          destWidth: W * 2,
          destHeight: H * 2,
          success: (res) => {
            wx.hideLoading()
            this.setData({
              posterImagePath: res.tempFilePath,
              showPosterModal: true
            })
          },
          fail: () => {
            wx.hideLoading()
            wx.showToast({ title: '生成失败', icon: 'none' })
          }
        })
      }
    })
  },

  /** Canvas 文本自动换行，返回最终 Y 坐标 */
  _fillWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    if (!text) return y
    let line = ''
    let currentY = y
    for (let i = 0; i < text.length; i++) {
      const testLine = line + text[i]
      const metrics = ctx.measureText(testLine)
      if (metrics.width > maxWidth && line) {
        ctx.fillText(line, x, currentY)
        line = text[i]
        currentY += lineHeight
      } else {
        line = testLine
      }
    }
    ctx.fillText(line, x, currentY)
    return currentY
  },

  // ===== 建房接驳 =====

  onInitializeMatrix() {
    try { wx.vibrateShort({ type: 'light' }) } catch (e) {}
    wx.switchTab({ url: '/pages/room/room' })
  },

  // ===== 海报预览模态框 =====

  preventTouchMove() {},

  closePosterModal() {
    this.setData({ showPosterModal: false, posterImagePath: '' })
  },

  saveToAlbum() {
    if (!this.data.posterImagePath) return
    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterImagePath,
      success: () => {
        wx.showToast({ title: 'DATA SAVED', icon: 'none' })
        this.closePosterModal()
      },
      fail: () => {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    })
  }
})
