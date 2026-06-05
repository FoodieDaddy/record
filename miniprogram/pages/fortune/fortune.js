const { get } = require('../../utils/request')
const app = getApp()

/* ===== 推演日志流 ===== */
const CALC_LOG_LINES = [
  { stage: 0, prefix: '[SCAN]',      text: '读取人格协议...' },
  { stage: 0, prefix: '[SCAN]',      text: '读取战绩镜像...' },
  { stage: 1, prefix: '[ANALYSIS]',  text: '构建策略向量...' },
  { stage: 1, prefix: '[VECTOR]',    text: '风险模型同步...' },
  { stage: 2, prefix: '[MATCH]',     text: '匹配策略原型...' },
  { stage: 2, prefix: '[OK]',        text: '策略已锁定' },
]

Page({
  data: {
    phase: 'idle',         // idle | generating | success | poster_generating | poster_preview | error
    animationEnabled: true,
    currentDate: '',
    lunarInfo: '',
    countdownText: '',
    nextRefreshAt: '',

    // generating
    logs: [],
    step: 0,
    stages: [
      { label: '人格协议同步', done: false },
      { label: '战绩镜像分析', done: false },
      { label: '策略向量构建', done: false },
      { label: '生成最终建议', done: false },
    ],
    stagesDoneCount: 0,
    timeoutLevel: 'normal',  // normal | warning | critical

    // success
    strategy: null,

    // error
    error: null,

    // poster
    posterPath: '',
    posterError: '',
  },

  _countdownTimer: null,
  _forceRefresh: false,
  _calcTimers: [],
  _calcAnimDone: false,
  _calcApiDone: false,
  _calcResult: null,
  _posterImagePath: '',

  /* ==================== 生命周期 ==================== */

  onLoad() {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    this.setData({
      animationEnabled: app.globalData.animationEnabled !== false,
      currentDate: `${y}.${m}.${d}`,
    })
    this._checkCache()
  },

  onShow() {
    this._startCountdown()
  },

  onHide() {
    this._stopCountdown()
    this._clearCalcTimers()
  },

  onUnload() {
    this._stopCountdown()
    this._clearCalcTimers()
  },

  /* ==================== 缓存检查 ==================== */

  _checkCache() {
    try {
      const today = this.data.currentDate.replace(/\./g, '-')
      const cached = wx.getStorageSync('strategy_result')
      if (cached && cached.date === today && cached.data) {
        let lunarInfo = ''
        if (cached.data.lunarDate) {
          lunarInfo = cached.data.lunarDate
          if (cached.data.solarTerm) lunarInfo += ' · ' + cached.data.solarTerm
        }
        this.setData({
          phase: 'success',
          strategy: cached.data,
          lunarInfo,
          nextRefreshAt: cached.data.nextRefreshAt || '',
        })
        return
      }
    } catch (e) {}
    this.setData({ phase: 'idle' })
  },

  /* ==================== idle 状态 ==================== */

  onTapDraw() {
    if (this.data.phase !== 'idle') return
    try { wx.vibrateShort({ type: 'light' }) } catch (err) {}
    this._startGeneration()
  },

  /* ==================== generating 状态 ==================== */

  _startGeneration() {
    this._clearCalcTimers()
    this._calcAnimDone = false
    this._calcApiDone = false
    this._calcResult = null

    // 重置阶段清单
    const stages = this.data.stages.map(s => ({ ...s, done: false }))
    this.setData({
      phase: 'generating',
      logs: [],
      step: 0,
      stages,
      stagesDoneCount: 0,
      timeoutLevel: 'normal',
      error: null,
    })

    // 并行启动：日志动画 + API 调用
    this._runLogAnimation()

    const params = this._forceRefresh ? { force: true } : undefined
    this._forceRefresh = false

    get('/fortune/today', params).then(data => {
      this._calcApiDone = true
      this._calcResult = { strategy: data }
      this._tryFinishCalc()
    }).catch(err => {
      this._calcApiDone = true
      this._calcResult = { error: err.message || '连接中断，请重试' }
      this._tryFinishCalc()
    })

    // 超时处理
    this._setupTimeoutGuards()
  },

  /** 超时守卫：5s 警告，10s 临界 */
  _setupTimeoutGuards() {
    const t5 = setTimeout(() => {
      if (this.data.phase !== 'generating') return
      this.setData({ timeoutLevel: 'warning' })
    }, 5000)
    this._calcTimers.push(t5)

    const t10 = setTimeout(() => {
      if (this.data.phase !== 'generating') return
      this.setData({ timeoutLevel: 'critical' })
    }, 10000)
    this._calcTimers.push(t10)
  },

  /** 日志动画：setTimeout 链，每条间隔 1200ms */
  _runLogAnimation() {
    const lines = CALC_LOG_LINES
    let currentStage = -1

    lines.forEach((line, i) => {
      // 每条日志出现
      const showTimer = setTimeout(() => {
        if (this.data.phase !== 'generating') return

        // 阶段切换：标记前一阶段 done
        if (line.stage !== currentStage) {
          if (currentStage >= 0) {
            const stages = [...this.data.stages]
            stages[currentStage].done = true
            const doneCount = stages.filter(s => s.done).length
            this.setData({
              [`stages[${currentStage}].done`]: true,
              stagesDoneCount: doneCount,
            })
          }
          currentStage = line.stage
          this.setData({ step: line.stage })
        }

        // 添加日志行（typing 状态）
        const logs = [...this.data.logs]
        logs.push({ prefix: line.prefix, text: line.text, visible: true, typing: true })
        this.setData({ logs })
      }, 500 + i * 1200)
      this._calcTimers.push(showTimer)

      // 关闭 typing 光标
      const typeTimer = setTimeout(() => {
        if (this.data.phase !== 'generating') return
        const logs = [...this.data.logs]
        if (logs[i]) {
          logs[i] = { ...logs[i], typing: false }
          this.setData({ logs })
        }
      }, 500 + i * 1200 + 800)
      this._calcTimers.push(typeTimer)
    })

    // 动画完成
    const doneTimer = setTimeout(() => {
      if (this.data.phase !== 'generating') return
      // 标记最后一个阶段 done
      const lastStage = lines[lines.length - 1].stage
      const stages = [...this.data.stages]
      stages[lastStage].done = true
      const doneCount = stages.filter(s => s.done).length
      this.setData({
        [`stages[${lastStage}].done`]: true,
        stagesDoneCount: doneCount,
      })
      this._calcAnimDone = true
      this._tryFinishCalc()
    }, 500 + lines.length * 1200 + 200)
    this._calcTimers.push(doneTimer)
  },

  /** 双标记就绪检查 */
  _tryFinishCalc() {
    if (!this._calcAnimDone || !this._calcApiDone) return

    // 标记 stage[3] done
    const stages = [...this.data.stages]
    stages[3].done = true
    this.setData({
      [`stages[3].done`]: true,
      stagesDoneCount: 4,
    })

    // 短暂延迟让最后阶段清单动画可见
    const finishTimer = setTimeout(() => {
      this._finishCalc(this._calcResult)
    }, 600)
    this._calcTimers.push(finishTimer)
  },

  /** 清理推演定时器 */
  _clearCalcTimers() {
    this._calcTimers.forEach(t => clearTimeout(t))
    this._calcTimers = []
  },

  /** 超时后继续等待 */
  onTapWait() {
    // 仅重置超时等级，继续等待 API 返回
    this.setData({ timeoutLevel: 'normal' })
  },

  /** 超时后重新推演 */
  onTapRetry() {
    this._clearCalcTimers()
    this._forceRefresh = true
    this._startGeneration()
  },

  /** 退场：进入 success 或 error */
  _finishCalc(result) {
    if (result.error) {
      this.setData({ phase: 'error', error: result.error })
      return
    }

    const strategy = result.strategy

    // 缓存到本地
    try {
      const today = this.data.currentDate.replace(/\./g, '-')
      wx.setStorageSync('strategy_result', { date: today, data: strategy })
    } catch (e) {}

    // 拼接农历信息
    let lunarInfo = ''
    if (strategy.lunarDate) {
      lunarInfo = strategy.lunarDate
      if (strategy.solarTerm) lunarInfo += ' · ' + strategy.solarTerm
    }

    this.setData({
      phase: 'success',
      strategy,
      lunarInfo,
      nextRefreshAt: strategy.nextRefreshAt || '',
    })
  },

  /* ==================== success 状态 ==================== */

  onTapRefresh() {
    wx.showModal({
      title: '重新推演',
      content: '确定要重新生成今日策略？',
      confirmText: '确认',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return
        try { wx.removeStorageSync('strategy_result') } catch (e) {}
        this._forceRefresh = true
        this._startGeneration()
      },
    })
  },

  onTapShare() {
    this.setData({ phase: 'poster_generating', posterError: '' })
    setTimeout(() => {
      this._renderPosterCanvas()
    }, 300)
  },

  /* ==================== poster_generating 状态 ==================== */

  _renderPosterCanvas() {
    const query = wx.createSelectorQuery().in(this)
    query.select('#posterCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        this.setData({ phase: 'success', posterError: '画布初始化失败' })
        wx.showToast({ title: '生成失败', icon: 'none' })
        return
      }

      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getWindowInfo().pixelRatio || 2
      const W = 1080
      const H = 1440

      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.scale(dpr, dpr)

      const s = this.data.strategy
      if (!s) {
        this.setData({ phase: 'success', posterError: '策略数据缺失' })
        return
      }

      // === 背景 #05070A ===
      ctx.fillStyle = '#05070A'
      ctx.fillRect(0, 0, W, H)

      // 扫描线纹理
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)'
      ctx.lineWidth = 1
      for (let y = 0; y < H; y += 4) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
        ctx.stroke()
      }

      // === 霓虹外框 ===
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.25)'
      ctx.lineWidth = 3
      ctx.shadowColor = 'rgba(0, 175, 255, 0.3)'
      ctx.shadowBlur = 16
      ctx.strokeRect(24, 24, W - 48, H - 48)
      ctx.shadowBlur = 0

      // 内框高光
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.08)'
      ctx.lineWidth = 1
      ctx.strokeRect(34, 34, W - 68, H - 68)

      // === 顶部标头 ===
      ctx.textAlign = 'center'
      ctx.font = '28px Courier New'
      ctx.fillStyle = 'rgba(0, 175, 255, 0.5)'
      ctx.fillText('SMART RECORD', W / 2, 96)
      ctx.font = '16px Courier New'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.fillText('STRATEGY DOSSIER', W / 2, 126)

      // 顶部分隔线
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.12)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(80, 152)
      ctx.lineTo(W - 80, 152)
      ctx.stroke()

      // === 日期 + 农历 ===
      ctx.font = '18px Courier New'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.fillText(`[ ${this.data.currentDate} ]`, W / 2, 196)
      if (this.data.lunarInfo) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
        ctx.fillText(this.data.lunarInfo, W / 2, 228)
      }

      // === 中央：title 大字 ===
      ctx.font = 'bold 56px sans-serif'
      ctx.fillStyle = '#F5F5F7'
      ctx.textAlign = 'center'
      const titleY = 360
      ctx.fillText(s.title || '', W / 2, titleY)

      // subtitle 英文
      if (s.subtitle) {
        ctx.font = '20px Courier New'
        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)'
        ctx.fillText(s.subtitle, W / 2, titleY + 50)
      }

      // 分隔线
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(W / 2 - 120, titleY + 80)
      ctx.lineTo(W / 2 + 120, titleY + 80)
      ctx.stroke()

      // === verdict 判词（自动换行） ===
      ctx.font = '32px sans-serif'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.textAlign = 'center'
      const verdictText = s.verdict || ''
      const verdictLines = this._wrapText(ctx, verdictText, W - 200)
      let vy = titleY + 140
      verdictLines.forEach(line => {
        ctx.fillText(line, W / 2, vy)
        vy += 48
      })

      // === tags 标签 ===
      if (s.tags && s.tags.length > 0) {
        const tagY = vy + 40
        const tagStr = s.tags.map(t => `#${t}`).join('   ')
        ctx.font = '20px Courier New'
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
        ctx.fillText(tagStr, W / 2, tagY)
      }

      // === buffs / debuffs 区域（如果有） ===
      let infoY = vy + 120
      if (s.buffs && s.buffs.length > 0) {
        ctx.font = '18px Courier New'
        ctx.fillStyle = 'rgba(48, 209, 88, 0.7)'
        ctx.textAlign = 'left'
        s.buffs.forEach(b => {
          ctx.fillText(`+ ${b}`, 100, infoY)
          infoY += 36
        })
      }
      if (s.debuffs && s.debuffs.length > 0) {
        ctx.fillStyle = 'rgba(255, 69, 58, 0.7)'
        ctx.textAlign = 'left'
        s.debuffs.forEach(d => {
          ctx.fillText(`- ${d}`, 100, infoY)
          infoY += 36
        })
      }

      // === 底部分隔线 ===
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.08)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(80, H - 160)
      ctx.lineTo(W - 80, H - 160)
      ctx.stroke()

      // === 底部扫码区域 ===
      // 装饰框
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.15)'
      ctx.lineWidth = 1
      const qrSize = 120
      const qrX = W / 2 - qrSize / 2
      const qrY = H - 140
      ctx.strokeRect(qrX, qrY, qrSize, qrSize)

      // 装饰十字
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.1)'
      ctx.beginPath()
      ctx.moveTo(W / 2 - 20, qrY + qrSize / 2)
      ctx.lineTo(W / 2 + 20, qrY + qrSize / 2)
      ctx.moveTo(W / 2, qrY + qrSize / 2 - 20)
      ctx.lineTo(W / 2, qrY + qrSize / 2 + 20)
      ctx.stroke()

      ctx.font = '14px Courier New'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.textAlign = 'center'
      ctx.fillText('扫码进入 Smart Record', W / 2, H - 40)

      // === 导出图片（2x 分辨率） ===
      wx.canvasToTempFilePath({
        canvas,
        x: 0, y: 0,
        width: canvas.width,
        height: canvas.height,
        destWidth: W * 2,
        destHeight: H * 2,
        success: (res) => {
          this._posterImagePath = res.tempFilePath
          this.setData({
            phase: 'poster_preview',
            posterPath: res.tempFilePath,
          })
        },
        fail: () => {
          this.setData({ phase: 'success', posterError: '海报导出失败' })
          wx.showToast({ title: '生成失败', icon: 'none' })
        },
      })
    })
  },

  /** Canvas 文字自动换行 */
  _wrapText(ctx, text, maxWidth) {
    const lines = []
    let current = ''
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      const test = current + ch
      if (ctx.measureText(test).width > maxWidth && current.length > 0) {
        lines.push(current)
        current = ch
      } else {
        current = test
      }
    }
    if (current) lines.push(current)
    return lines
  },

  /* ==================== poster_preview 状态 ==================== */

  onSavePoster() {
    if (!this._posterImagePath) return
    wx.saveImageToPhotosAlbum({
      filePath: this._posterImagePath,
      success: () => {
        wx.showToast({ title: '已保存', icon: 'success' })
      },
      fail: (err) => {
        if (err.errMsg.indexOf('auth deny') !== -1 || err.errMsg.indexOf('authorize') !== -1) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许保存到相册',
            confirmText: '去设置',
            success: (res) => { if (res.confirm) wx.openSetting() },
          })
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      },
    })
  },

  onSharePoster() {
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] })
  },

  onClosePoster() {
    this.setData({ phase: 'success', posterPath: '', posterError: '' })
  },

  /* ==================== error 状态 ==================== */

  onTapRetryError() {
    this._forceRefresh = true
    this._startGeneration()
  },

  /* ==================== 通用工具 ==================== */

  noop() {},

  preventTouchMove() {},

  onShareAppMessage() {
    const s = this.data.strategy
    if (!s) return {}
    const result = {
      title: `今日策略：${s.title || ''}`,
      path: '/pages/fortune/fortune',
    }
    if (this._posterImagePath) {
      result.imageUrl = this._posterImagePath
    }
    return result
  },

  /* ==================== 倒计时 ==================== */

  _startCountdown() {
    this._stopCountdown()
    this._updateCountdown()
    this._countdownTimer = setInterval(() => {
      this._updateCountdown()
    }, 1000)
  },

  _stopCountdown() {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer)
      this._countdownTimer = null
    }
  },

  _updateCountdown() {
    const nextRefreshAt = this.data.nextRefreshAt
    if (!nextRefreshAt) {
      this.setData({ countdownText: '' })
      return
    }

    const now = new Date()
    const [hh, mm, ss] = nextRefreshAt.split(':').map(Number)
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, ss)
    let diff = Math.floor((target - now) / 1000)

    if (diff <= 0) {
      this.setData({ countdownText: '可刷新' })
      this._stopCountdown()
      return
    }

    const h = String(Math.floor(diff / 3600)).padStart(2, '0')
    diff %= 3600
    const m = String(Math.floor(diff / 60)).padStart(2, '0')
    const s = String(diff % 60).padStart(2, '0')
    this.setData({ countdownText: `${h}:${m}:${s}` })
  },
})
