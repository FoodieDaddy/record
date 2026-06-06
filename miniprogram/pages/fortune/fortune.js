const { get } = require('../../utils/request')
const { vibrateShort } = require('../../utils/haptic')
const app = getApp()

const STRATEGY_TEXT_REPLACEMENTS = [
  [/ALL-IN/gi, '冒进'],
  [/孤注一掷/g, '冒进'],
  [/抽取/g, '生成'],
  [new RegExp('运' + '势', 'g'), '状态'],
  [new RegExp('翻' + '本', 'g'), '修正'],
  [/翻盘/g, '回稳'],
  [new RegExp('追' + '损', 'g'), '连续修正'],
  [/止损线/g, '暂停线'],
  [/收益/g, '数值反馈'],
  [new RegExp('必' + '胜', 'g'), '稳定执行'],
  [new RegExp('稳' + '赚', 'g'), '稳态执行'],
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

/** 主题色归一化：themeColor > glowColor > userTag 推导 > 默认蓝 */
function normalizeThemeColor(strategy) {
  const VALID_COLORS = ['#0A84FF', '#32D74B', '#FF9F0A', '#FF453A']
  if (strategy.themeColor && VALID_COLORS.includes(strategy.themeColor.toUpperCase())) {
    return strategy.themeColor
  }
  if (strategy.glowColor && VALID_COLORS.includes(strategy.glowColor.toUpperCase())) {
    return strategy.glowColor
  }
  const tagColorMap = {
    WINNING_STREAK: '#32D74B',
    LOSING_STREAK: '#FF9F0A',
    HIGH_RISK: '#FF453A',
    STABLE: '#0A84FF',
  }
  if (strategy.userTag && tagColorMap[strategy.userTag]) {
    return tagColorMap[strategy.userTag]
  }
  return '#0A84FF'
}

function deriveStrategyMeta(strategy) {
  if (!strategy) return { strategyTheme: '节奏校准', strategySummary: '当前策略已生成。建议先观察场上节奏，再根据反馈调整行动。' }
  const theme = strategy.tag || (strategy.tags && strategy.tags[0]) || '节奏校准'
  const summary = strategy.verdict || '建议保持节奏，观察场上变化后再行动。'
  return { strategyTheme: theme, strategySummary: summary }
}

/** userTag 映射中文标签 */
function mapUserTagToLabel(userTag) {
  const map = {
    WINNING_STREAK: '连胜态',
    LOSING_STREAK: '连败态',
    HIGH_RISK: '高风险',
    STABLE: '稳健态',
  }
  return map[userTag] || '待同步'
}

/** source 映射中文 */
function mapSourceToLabel(source) {
  if (source === 'llm') return 'LLM'
  if (source === 'fallback') return '本地'
  return '待同步'
}

/* ===== 推演日志流（中文化） ===== */
const CALC_LOG_LINES = [
  { stage: 0, prefix: '[SYS]',  text: '人格协议同步完成' },
  { stage: 0, prefix: '[SYS]',  text: '任务镜像读取中' },
  { stage: 1, prefix: '[CORE]', text: '策略向量构建中' },
  { stage: 1, prefix: '[RISK]', text: '风险噪声校准中' },
  { stage: 2, prefix: '[CORE]', text: '策略原型匹配中' },
  { stage: 2, prefix: '[SYS]',  text: '策略卡生成中' },
]

Page({
  data: {
    pageMode: 'launch',     // launch | generating | result | relaunchReady
    animationEnabled: true,
    reduceMotion: false,
    showRegenerateModal: false,
    forcePending: false,
    currentDate: '',
    countdownText: '',
    nextRefreshAt: '',

    // generating
    logs: [],
    step: 0,
    stages: [
      { label: '人格协议同步', done: false },
      { label: '画像校准', done: false },
      { label: '策略向量生成', done: false },
      { label: '策略卡输出', done: false },
    ],
    stagesDoneCount: 0,

    // result
    strategy: null,
    strategyTheme: '',
    strategySummary: '',
    themeColor: '#0A84FF',

    // HUD 芯片
    sourceLabel: '待同步',
    solarTermLabel: '待同步',
    userTagLabel: '待同步',

    // error (generating 失败时短暂显示 toast 后回 launch)
    error: null,

    // poster (独立于 pageMode，用于海报弹层)
    phase: '',
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
  _requesting: false,

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
        wx.setStorageSync('strategy_result', { date: today, data: strategy })
        const meta = deriveStrategyMeta(strategy)
        const themeColor = normalizeThemeColor(strategy)
        this.setData({
          pageMode: 'result',
          strategy,
          strategyTheme: meta.strategyTheme,
          strategySummary: meta.strategySummary,
          themeColor,
          nextRefreshAt: strategy.nextRefreshAt || '',
          sourceLabel: mapSourceToLabel(strategy.source),
          solarTermLabel: strategy.solarTerm || '待同步',
          userTagLabel: mapUserTagToLabel(strategy.userTag),
        })
        return
      }
    } catch (e) {}
    this.setData({ pageMode: 'launch' })
  },

  /* ==================== 启动核心卡牌 ==================== */

  onTapLaunchCore() {
    if (this.data.pageMode === 'generating') return
    vibrateShort('light')
    this._startGeneration({ force: this.data.forcePending })
  },

  /* ==================== generating 状态 ==================== */

  _startGeneration({ force } = {}) {
    if (this._requesting) return
    this._requesting = true

    this._clearCalcTimers()
    this._calcAnimDone = false
    this._calcApiDone = false
    this._calcResult = null

    const stages = this.data.stages.map(s => ({ ...s, done: false }))
    this.setData({
      pageMode: 'generating',
      forcePending: false,
      logs: [],
      step: 0,
      stages,
      stagesDoneCount: 0,
      error: null,
    })

    this._runLogAnimation()

    const params = force ? { force: true } : undefined
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
  },

  /** 日志动画：setTimeout 链，每条间隔 1200ms */
  _runLogAnimation() {
    if (!this.data.animationEnabled) {
      const stages = this.data.stages.map(s => ({ ...s, done: true }))
      this.setData({ stages, stagesDoneCount: 4 })
      this._calcAnimDone = true
      this._tryFinishCalc()
      return
    }

    const lines = CALC_LOG_LINES
    let currentStage = -1

    lines.forEach((line, i) => {
      const showTimer = setTimeout(() => {
        if (this.data.pageMode !== 'generating') return

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

        const logs = [...this.data.logs]
        logs.push({ prefix: line.prefix, text: line.text, visible: true, typing: true })
        this.setData({ logs })
      }, 500 + i * 1200)
      this._calcTimers.push(showTimer)

      const typeTimer = setTimeout(() => {
        if (this.data.pageMode !== 'generating') return
        const logs = [...this.data.logs]
        if (logs[i]) {
          logs[i] = { ...logs[i], typing: false }
          this.setData({ logs })
        }
      }, 500 + i * 1200 + 800)
      this._calcTimers.push(typeTimer)
    })

    const doneTimer = setTimeout(() => {
      if (this.data.pageMode !== 'generating') return
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

    const stages = [...this.data.stages]
    stages[3].done = true
    this.setData({
      [`stages[3].done`]: true,
      stagesDoneCount: 4,
    })

    const finishTimer = setTimeout(() => {
      this._finishCalc(this._calcResult)
    }, 600)
    this._calcTimers.push(finishTimer)
  },

  _clearCalcTimers() {
    this._calcTimers.forEach(t => clearTimeout(t))
    this._calcTimers = []
  },

  /** 退场：进入 result 或回 launch */
  _finishCalc(result) {
    this._requesting = false
    this._clearCalcTimers()

    if (result.error) {
      this.setData({ pageMode: 'launch', error: null })
      wx.showToast({ title: '策略核心启动失败', icon: 'none' })
      return
    }

    const strategy = sanitizeStrategy(result.strategy)
    const themeColor = normalizeThemeColor(strategy)

    try {
      const today = this.data.currentDate.replace(/\./g, '-')
      wx.setStorageSync('strategy_result', { date: today, data: strategy })
    } catch (e) {}

    const meta = deriveStrategyMeta(strategy)

    this.setData({
      pageMode: 'result',
      strategy,
      strategyTheme: meta.strategyTheme,
      strategySummary: meta.strategySummary,
      themeColor,
      nextRefreshAt: strategy.nextRefreshAt || '',
      sourceLabel: mapSourceToLabel(strategy.source),
      solarTermLabel: strategy.solarTerm || '待同步',
      userTagLabel: mapUserTagToLabel(strategy.userTag),
    })
  },

  /* ==================== result → 重新推演弹窗 ==================== */

  onTapRegenerate() {
    vibrateShort('light')
    this.setData({ showRegenerateModal: true })
  },

  onCancelRegenerate() {
    this.setData({ showRegenerateModal: false })
  },

  onConfirmRegenerate() {
    vibrateShort('light')
    try { wx.removeStorageSync('strategy_result') } catch (e) {}
    this.setData({
      showRegenerateModal: false,
      pageMode: 'relaunchReady',
      forcePending: true,
      strategy: null,
      strategyTheme: '',
      strategySummary: '',
      themeColor: '#0A84FF',
      sourceLabel: '待同步',
      solarTermLabel: '待同步',
      userTagLabel: '待同步',
    })
    // 注意：禁止调用接口
  },

  /* ==================== 分享 / 海报 ==================== */

  onTapShare() {
    this.setData({ phase: 'poster_generating', posterError: '' })
    setTimeout(() => {
      this._renderPosterCanvas()
    }, 300)
  },

  _renderPosterCanvas() {
    const query = wx.createSelectorQuery().in(this)
    query.select('#posterCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        this.setData({ phase: 'result', posterError: '画布初始化失败' })
        wx.showToast({ title: '启动失败', icon: 'none' })
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
        this.setData({ phase: 'result', posterError: '策略数据缺失' })
        return
      }

      const accentColor = this.data.themeColor || '#0A84FF'

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

      // === 外框 ===
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
      ctx.fillText('STRATEGY · PULSE TERMINAL', W / 2, 106)

      // 顶部分隔线
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.1)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(60, 128)
      ctx.lineTo(W - 60, 128)
      ctx.stroke()

      // === 日期 + 时间窗口 ===
      ctx.font = '16px Courier New'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.fillText(`[ ${this.data.currentDate} ]`, W / 2, 168)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.fillText('STRATEGY WINDOW', W / 2, 196)

      // === 中央：tag 状态胶囊 ===
      if (s.tag) {
        const tagW = ctx.measureText(s.tag).width + 60
        ctx.save()
        ctx.globalAlpha = 0.12
        ctx.fillStyle = accentColor
        ctx.fillRect(W / 2 - tagW / 2, 220, tagW, 44)
        ctx.globalAlpha = 0.3
        ctx.strokeStyle = accentColor
        ctx.strokeRect(W / 2 - tagW / 2, 220, tagW, 44)
        ctx.restore()
        ctx.font = 'bold 22px sans-serif'
        ctx.fillStyle = '#F5F5F7'
        ctx.fillText(s.tag, W / 2, 248)
      }

      // === verdict 判词 ===
      ctx.font = 'bold 34px sans-serif'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.textAlign = 'center'
      ctx.shadowColor = 'rgba(0, 175, 255, 0.1)'
      ctx.shadowBlur = 16
      const verdictText = s.verdict || ''
      const verdictLines = this._wrapText(ctx, verdictText, W - 160)
      let vy = 320
      verdictLines.forEach(line => {
        ctx.fillText(line, W / 2, vy)
        vy += 52
      })
      ctx.shadowBlur = 0

      // 分隔线
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(W / 2 - 100, vy + 20)
      ctx.lineTo(W / 2 + 100, vy + 20)
      ctx.stroke()

      // === buffs / debuffs 区域 ===
      let infoY = vy + 70
      const infoX = 80
      const infoMaxW = W - 160

      if (s.buffs && s.buffs.length > 0) {
        ctx.font = '16px Courier New'
        ctx.fillStyle = 'rgba(48, 209, 88, 0.4)'
        ctx.textAlign = 'left'
        ctx.fillText('+ 行动优势', infoX, infoY)
        infoY += 36

        ctx.font = '22px sans-serif'
        ctx.fillStyle = 'rgba(255, 255, 255, 0.62)'
        s.buffs.forEach(b => {
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
      ctx.fillText('PULSE TERMINAL · STRATEGY ARCHIVE', W / 2, H - 38)

      // === 导出图片 ===
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
          this.setData({ phase: 'result', posterError: '海报导出失败' })
          wx.showToast({ title: '启动失败', icon: 'none' })
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
    this.setData({ phase: 'result', posterPath: '', posterError: '' })
  },

  /* ==================== 通用工具 ==================== */

  noop() {},

  preventTouchMove() {},

  onShareAppMessage() {
    const s = this.data.strategy
    if (!s) return {}
    const result = {
      title: `今日策略：${s.tag || ''}`,
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
