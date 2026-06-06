const { get } = require('../../utils/request')
const { vibrateShort } = require('../../utils/haptic')
const app = getApp()

const STRATEGY_TEXT_REPLACEMENTS = [
  [/ALL-IN/gi, '冒进'],
  [/孤注一掷/g, '冒进'],
  [/抽取/g, '生成'],
  [/运势/g, '状态'],
  [/翻本/g, '修正'],
  [/翻盘/g, '回稳'],
  [/追损/g, '连续修正'],
  [/止损线/g, '暂停线'],
  [/收益/g, '积分反馈'],
  [/必胜/g, '稳定执行'],
  [/稳赚/g, '稳态执行'],
]

function sanitizeStrategyText(text) {
  let value = String(text || '')
  STRATEGY_TEXT_REPLACEMENTS.forEach(([pattern, replacement]) => {
    value = value.replace(pattern, replacement)
  })
  return value
}

function sanitizeStrategy(strategy) {
  if (!strategy) return strategy
  return {
    ...strategy,
    title: sanitizeStrategyText(strategy.title),
    subtitle: sanitizeStrategyText(strategy.subtitle),
    verdict: sanitizeStrategyText(strategy.verdict),
    tag: sanitizeStrategyText(strategy.tag),
    buffs: (strategy.buffs || []).map(sanitizeStrategyText),
    debuffs: (strategy.debuffs || []).map(sanitizeStrategyText),
    tags: (strategy.tags || []).map(sanitizeStrategyText),
  }
}

function deriveStrategyMeta(strategy) {
  if (!strategy) return { strategyTheme: '节奏校准', strategySummary: '当前策略已生成。建议先观察场上节奏，再根据反馈调整行动。' }
  const theme = strategy.tag || (strategy.tags && strategy.tags[0]) || '节奏校准'
  const summary = strategy.verdict || '建议保持节奏，观察场上变化后再行动。'
  return { strategyTheme: theme, strategySummary: summary }
}

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
    reduceMotion: false,
    showRefreshConfirm: false,
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
    strategyTheme: '',
    strategySummary: '',

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
      reduceMotion: app.globalData.animationEnabled === false || app.globalData.reduceMotion === true,
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
        const strategy = sanitizeStrategy(cached.data)
        let lunarInfo = ''
        if (strategy.lunarDate) {
          lunarInfo = strategy.lunarDate
          if (strategy.solarTerm) lunarInfo += ' · ' + strategy.solarTerm
        }
        wx.setStorageSync('strategy_result', { date: today, data: strategy })
        const meta = deriveStrategyMeta(strategy)
        this.setData({
          phase: 'success',
          strategy,
          strategyTheme: meta.strategyTheme,
          strategySummary: meta.strategySummary,
          lunarInfo,
          nextRefreshAt: strategy.nextRefreshAt || '',
        })
        return
      }
    } catch (e) {}
    this.setData({ phase: 'idle' })
  },

  /* ==================== idle 状态 ==================== */

  onTapDraw() {
    if (this.data.phase !== 'idle') return
    vibrateShort('light')
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

    const strategy = sanitizeStrategy(result.strategy)

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

    const meta = deriveStrategyMeta(strategy)

    this.setData({
      phase: 'success',
      strategy,
      strategyTheme: meta.strategyTheme,
      strategySummary: meta.strategySummary,
      lunarInfo,
      nextRefreshAt: strategy.nextRefreshAt || '',
    })
  },

  /* ==================== success 状态 ==================== */

  onTapRefresh() {
    this.setData({ showRefreshConfirm: true })
  },

  onRefreshCancel() {
    this.setData({ showRefreshConfirm: false })
  },

  onRefreshConfirm() {
    this.setData({ showRefreshConfirm: false })
    try { wx.removeStorageSync('strategy_result') } catch (e) {}
    this._forceRefresh = true
    this._startGeneration()
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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)'
      ctx.lineWidth = 1
      for (let y = 0; y < H; y += 4) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
        ctx.stroke()
      }

      // 顶部微光
      const glowGrad = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 500)
      glowGrad.addColorStop(0, 'rgba(0, 175, 255, 0.06)')
      glowGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = glowGrad
      ctx.fillRect(0, 0, W, 500)

      // === 外框（更窄边距，最大化内容区） ===
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.2)'
      ctx.lineWidth = 2
      ctx.shadowColor = 'rgba(0, 175, 255, 0.25)'
      ctx.shadowBlur = 12
      ctx.strokeRect(20, 20, W - 40, H - 40)
      ctx.shadowBlur = 0

      // 内框
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.06)'
      ctx.lineWidth = 1
      ctx.strokeRect(28, 28, W - 56, H - 56)

      // === 顶部标头 ===
      ctx.textAlign = 'center'
      ctx.font = '26px Courier New'
      ctx.fillStyle = 'rgba(0, 175, 255, 0.45)'
      ctx.fillText('今日策略', W / 2, 80)
      ctx.font = '14px Courier New'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
      ctx.fillText('STRATEGY · HAPPY 记分器', W / 2, 106)

      // 顶部分隔线
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.1)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(60, 128)
      ctx.lineTo(W - 60, 128)
      ctx.stroke()

      // === 日期 + 农历 ===
      ctx.font = '16px Courier New'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.fillText(`[ ${this.data.currentDate} ]`, W / 2, 168)
      if (this.data.lunarInfo) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
        ctx.fillText(this.data.lunarInfo, W / 2, 196)
      }

      // === 中央：title 大字（加光晕） ===
      ctx.textAlign = 'center'
      ctx.font = 'bold 60px sans-serif'
      ctx.shadowColor = 'rgba(0, 175, 255, 0.2)'
      ctx.shadowBlur = 24
      ctx.fillStyle = '#F5F5F7'
      const titleY = 320
      ctx.fillText(s.title || '', W / 2, titleY)
      ctx.shadowBlur = 0

      // subtitle 英文
      if (s.subtitle) {
        ctx.font = '18px Courier New'
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
        ctx.fillText(s.subtitle.toUpperCase(), W / 2, titleY + 46)
      }

      // 分隔线
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(W / 2 - 100, titleY + 72)
      ctx.lineTo(W / 2 + 100, titleY + 72)
      ctx.stroke()

      // === verdict 判词（加粗 + 微光晕，自动换行） ===
      ctx.font = 'bold 34px sans-serif'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.textAlign = 'center'
      ctx.shadowColor = 'rgba(0, 175, 255, 0.1)'
      ctx.shadowBlur = 16
      const verdictText = s.verdict || ''
      const verdictLines = this._wrapText(ctx, verdictText, W - 160)
      let vy = titleY + 130
      verdictLines.forEach(line => {
        ctx.fillText(line, W / 2, vy)
        vy += 52
      })
      ctx.shadowBlur = 0

      // === tags 标签（背景块样式） ===
      if (s.tags && s.tags.length > 0) {
        const tagY = vy + 30
        ctx.font = '18px Courier New'

        // 计算总宽度以居中
        const tagPadding = 24
        const tagGap = 16
        let totalTagWidth = 0
        const tagWidths = s.tags.map(t => {
          const w = ctx.measureText(t).width + tagPadding * 2
          totalTagWidth += w
          return w
        })
        totalTagWidth += tagGap * (s.tags.length - 1)

        let tx = (W - totalTagWidth) / 2
        s.tags.forEach((t, i) => {
          const tw = tagWidths[i]
          const th = 40

          // 标签背景
          ctx.fillStyle = 'rgba(0, 175, 255, 0.06)'
          ctx.strokeStyle = 'rgba(0, 175, 255, 0.15)'
          ctx.lineWidth = 1
          const r = 6
          ctx.beginPath()
          ctx.moveTo(tx + r, tagY)
          ctx.lineTo(tx + tw - r, tagY)
          ctx.arcTo(tx + tw, tagY, tx + tw, tagY + r, r)
          ctx.lineTo(tx + tw, tagY + th - r)
          ctx.arcTo(tx + tw, tagY + th, tx + tw - r, tagY + th, r)
          ctx.lineTo(tx + r, tagY + th)
          ctx.arcTo(tx, tagY + th, tx, tagY + th - r, r)
          ctx.lineTo(tx, tagY + r)
          ctx.arcTo(tx, tagY, tx + r, tagY, r)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()

          // 标签文字
          ctx.fillStyle = 'rgba(0, 175, 255, 0.65)'
          ctx.textAlign = 'center'
          ctx.fillText(t, tx + tw / 2, tagY + 27)

          tx += tw + tagGap
        })
      }

      // === buffs / debuffs 区域 ===
      let infoY = vy + 120
      const infoX = 80
      const infoMaxW = W - 160

      if (s.buffs && s.buffs.length > 0) {
        // 区块标题
        ctx.font = '16px Courier New'
        ctx.fillStyle = 'rgba(48, 209, 88, 0.4)'
        ctx.textAlign = 'left'
        ctx.fillText('+ 行动优势', infoX, infoY)
        infoY += 36

        ctx.font = '22px sans-serif'
        ctx.fillStyle = 'rgba(255, 255, 255, 0.62)'
        s.buffs.forEach(b => {
          // 绿色指示点
          ctx.fillStyle = '#30D158'
          ctx.beginPath()
          ctx.arc(infoX + 6, infoY - 6, 4, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = 'rgba(255, 255, 255, 0.62)'
          ctx.textAlign = 'left'
          const lines = this._wrapText(ctx, b, infoMaxW - 24)
          lines.forEach(line => {
            ctx.fillText(line, infoX + 24, infoY)
            infoY += 34
          })
          infoY += 8
        })
      }

      if (s.debuffs && s.debuffs.length > 0) {
        infoY += 8
        ctx.font = '16px Courier New'
        ctx.fillStyle = 'rgba(255, 69, 58, 0.4)'
        ctx.textAlign = 'left'
        ctx.fillText('! 风险提示', infoX, infoY)
        infoY += 36

        ctx.font = '22px sans-serif'
        s.debuffs.forEach(d => {
          // 红色指示点
          ctx.fillStyle = '#FF453A'
          ctx.beginPath()
          ctx.arc(infoX + 6, infoY - 6, 4, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = 'rgba(255, 255, 255, 0.62)'
          ctx.textAlign = 'left'
          const lines = this._wrapText(ctx, d, infoMaxW - 24)
          lines.forEach(line => {
            ctx.fillText(line, infoX + 24, infoY)
            infoY += 34
          })
          infoY += 8
        })
      }

      // === 底部标识 ===
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.06)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(60, H - 70)
      ctx.lineTo(W - 60, H - 70)
      ctx.stroke()

      ctx.font = '13px Courier New'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.textAlign = 'center'
      ctx.fillText('smart 记分器 · 策略档案', W / 2, H - 38)

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
