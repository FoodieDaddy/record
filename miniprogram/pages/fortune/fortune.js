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
  [/盈利/g, '积分'],
  [/亏损/g, '回落'],
  [/胜率/g, '节奏稳定度'],
  [/预测/g, '判读'],
  [new RegExp('必' + '胜', 'g'), '稳定执行'],
  [new RegExp('稳' + '赚', 'g'), '稳态执行'],
  [/校准者/g, '舰载指令'],
  [/THE CALIBRATOR/gi, 'DIRECTIVE'],
  [/LOW-NOISE/gi, '低噪'],
  [/MEDIUM-NOISE/gi, '中噪'],
  [/HIGH-NOISE/gi, '高噪'],
  [/LLM/g, '主引擎'],
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
  const VALID_COLORS = ['#0A84FF', '#32D74B', '#FF9F0A']
  if (strategy.themeColor && VALID_COLORS.includes(strategy.themeColor.toUpperCase())) {
    return strategy.themeColor
  }
  if (strategy.glowColor && VALID_COLORS.includes(strategy.glowColor.toUpperCase())) {
    return strategy.glowColor
  }
  const tagColorMap = {
    WINNING_STREAK: '#32D74B',
    LOSING_STREAK: '#FF9F0A',
    HIGH_RISK: '#FF9F0A',
    STABLE: '#0A84FF',
  }
  if (strategy.userTag && tagColorMap[strategy.userTag]) {
    return tagColorMap[strategy.userTag]
  }
  return '#0A84FF'
}

function deriveStrategyMeta(strategy) {
  if (!strategy) return { strategyTheme: '节奏校准', strategySummary: '当前指令已生成。建议先观察场上节奏，再根据反馈调整行动。' }
  const theme = strategy.tag || (strategy.tags && strategy.tags[0]) || '节奏校准'
  const summary = strategy.verdict || '建议保持节奏，观察场上变化后再行动。'
  return { strategyTheme: theme, strategySummary: summary }
}

/** 提炼舰载指令主句 */
function deriveDirectiveText(strategy) {
  if (!strategy) return '保持低速推进，优先修正节奏。'
  if (strategy.subtitle) return strategy.subtitle
  if (strategy.verdict && strategy.verdict.length <= 30) return strategy.verdict
  if (strategy.verdict) return strategy.verdict.slice(0, 28) + '…'
  return '保持低速推进，优先修正节奏。'
}

/** userTag 对应颜色（偏高用橙色） */
function normalizeUserTagColor(userTag) {
  if (userTag === 'HIGH_RISK') return '#FF9F0A'
  return '#0A84FF'
}

/** userTag 映射中文标签 */
function mapUserTagToLabel(userTag) {
  const map = {
    WINNING_STREAK: '连胜态',
    LOSING_STREAK: '连败态',
    HIGH_RISK: '偏高',
    STABLE: '稳健态',
  }
  return map[userTag] || '待同步'
}

/** source 映射中文 */
function mapSourceToLabel(source) {
  if (source === 'llm') return '主引擎'
  if (source === 'fallback') return '本地'
  return '待同步'
}

/** solarTerm 映射中文 */
function mapSolarTermToLabel(solarTerm) {
  if (!solarTerm) return '待同步'
  const map = {
    'LOW-NOISE': '低噪',
    'HIGH-NOISE': '高噪',
    'MID-NOISE': '中噪',
  }
  return map[solarTerm] || solarTerm
}

/* ===== 生成中日志流 ===== */
const CALC_LOG_LINES = [
  { text: '舰员协议已同步' },
  { text: '黑匣子样本已接入' },
  { text: '安全边界生成中' },
]

/* ===== heartbeat 文案 ===== */
const HEARTBEAT_LINES = [
  '指令投影展开中',
  '推进节奏校准中',
  '链路保持中',
  '安全边界校准中',
]

Page({
  data: {
    pageMode: 'launch',     // launch | generating | result | relaunchReady
    flightStage: 'idle',    // idle | arming | pressed | plasma | lifting | syncing | projecting | done
    animationEnabled: true,
    reduceMotion: false,
    showRegenerateModal: false,
    forcePending: false,
    currentDate: '',
    countdownText: '',
    nextRefreshAt: '',

    // generating
    logs: [],

    // result
    strategy: null,
    strategyTheme: '',
    strategySummary: '',
    directiveText: '',
    themeColor: '#0A84FF',
    projectingResult: false,

    // HUD 芯片
    sourceLabel: '待同步',
    solarTermLabel: '待同步',
    userTagLabel: '待同步',
    userTagColor: '#0A84FF',

    // heartbeat
    heartbeatText: '',

    // error
    error: null,

    // poster
    phase: '',
    posterPath: '',
    posterError: '',
  },

  _countdownTimer: null,
  _forceRefresh: false,
  _calcTimers: [],
  _flightTimers: [],
  _heartbeatTimer: null,
  _heartbeatDelayTimer: null,
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
    this._clearFlightTimers()
    this._stopHeartbeat()
  },

  onUnload() {
    this._stopCountdown()
    this._clearCalcTimers()
    this._clearFlightTimers()
    this._stopHeartbeat()
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
          flightStage: 'done',
          strategy,
          strategyTheme: meta.strategyTheme,
          strategySummary: meta.strategySummary,
          directiveText: deriveDirectiveText(strategy),
          themeColor,
          nextRefreshAt: strategy.nextRefreshAt || '',
          sourceLabel: mapSourceToLabel(strategy.source),
          solarTermLabel: mapSolarTermToLabel(strategy.solarTerm),
          userTagLabel: mapUserTagToLabel(strategy.userTag),
          userTagColor: normalizeUserTagColor(strategy.userTag),
        })
        return
      }
    } catch (e) {}
    this.setData({ pageMode: 'launch', flightStage: 'idle' })
  },

  /* ==================== 点火航行核心 ==================== */

  onTapLaunchCore() {
    if (this.data.flightStage !== 'idle') return
    vibrateShort('light')

    if (!this.data.animationEnabled) {
      this.setData({ flightStage: 'syncing', pageMode: 'generating' })
      this._fireApiRequest()
      this._runLogAnimation()
      this._startHeartbeat()
      return
    }

    this._runIgnitionSequence()
  },

  /**
   * 点火序列：统一镜头，不切换 pageMode
   * 时间线压缩到 ~1120ms 完成主点火
   *
   * 0ms:    arming  — 保险栅打开，状态灯亮起
   * 120ms:  pressed — 按钮下沉，能量槽开始流动
   * 360ms:  plasma  — 蓝白离子火出现，核心中心点放大
   * 600ms:  lifting — 核心上浮，光束拉长
   * 980ms:  syncing — 日志舱接入，核心进入生成位置
   */
  _runIgnitionSequence() {
    this._clearFlightTimers()

    // 发送 API 请求（UI 不等）
    this._fireApiRequest()

    // 0ms: arming — 保险栅打开
    this.setData({ flightStage: 'arming' })

    // 120ms: pressed — 按钮下沉、能量槽亮起
    const t1 = setTimeout(() => {
      this.setData({ flightStage: 'pressed' })
    }, 120)
    this._flightTimers.push(t1)

    // 360ms: plasma — 离子火出现、核心同步变亮
    const t2 = setTimeout(() => {
      this.setData({ flightStage: 'plasma' })
    }, 360)
    this._flightTimers.push(t2)

    // 600ms: lifting — 光束拉长、核心上浮
    const t3 = setTimeout(() => {
      this.setData({ flightStage: 'lifting' })
    }, 600)
    this._flightTimers.push(t3)

    // 980ms: syncing — 日志舱接入、核心进入生成位置
    const t4 = setTimeout(() => {
      this.setData({ flightStage: 'syncing', pageMode: 'generating' })
      this._runLogAnimation()
      this._startHeartbeat()
    }, 980)
    this._flightTimers.push(t4)
  },

  /** 提前发送 API 请求，不等 UI */
  _fireApiRequest() {
    if (this._requesting) return
    this._requesting = true

    this._clearCalcTimers()
    this._calcAnimDone = false
    this._calcApiDone = false
    this._calcResult = null

    const params = this.data.forcePending ? { force: true } : undefined
    this.setData({ forcePending: false, error: null })

    // 前端超时守卫：10 秒后强制结束
    this._apiTimeoutTimer = setTimeout(() => {
      if (!this._calcApiDone) {
        this._calcApiDone = true
        this._calcResult = { error: '链路超时，请重试' }
        this._tryFinishCalc()
      }
    }, 10000)

    get('/fortune/today', params).then(data => {
      if (this._apiTimeoutTimer) { clearTimeout(this._apiTimeoutTimer); this._apiTimeoutTimer = null }
      this._calcApiDone = true
      this._calcResult = { strategy: data }
      this._tryFinishCalc()
    }).catch(err => {
      if (this._apiTimeoutTimer) { clearTimeout(this._apiTimeoutTimer); this._apiTimeoutTimer = null }
      this._calcApiDone = true
      this._calcResult = { error: err.message || '连接中断，请重试' }
      this._tryFinishCalc()
    })
  },

  _clearFlightTimers() {
    this._flightTimers.forEach(t => clearTimeout(t))
    this._flightTimers = []
  },

  /* ==================== generating 状态 ==================== */

  /**
   * 日志动画：3 条日志，每条间隔 380ms
   * 起始延迟 500ms（等 syncing 动画稳定）
   */
  _runLogAnimation() {
    if (!this.data.animationEnabled) {
      this._calcAnimDone = true
      this._tryFinishCalc()
      return
    }

    const lines = CALC_LOG_LINES

    lines.forEach((line, i) => {
      const showTimer = setTimeout(() => {
        if (this.data.pageMode !== 'generating') return

        const logs = [...this.data.logs]
        logs.push({ text: line.text, visible: true, typing: true })
        this.setData({ logs })
      }, 500 + i * 380)
      this._calcTimers.push(showTimer)

      const typeTimer = setTimeout(() => {
        if (this.data.pageMode !== 'generating') return
        const logs = [...this.data.logs]
        if (logs[i]) {
          logs[i] = { ...logs[i], typing: false }
          this.setData({ logs })
        }
      }, 500 + i * 380 + 300)
      this._calcTimers.push(typeTimer)
    })

    const doneTimer = setTimeout(() => {
      if (this.data.pageMode !== 'generating') return
      this._calcAnimDone = true
      this._tryFinishCalc()
    }, 500 + lines.length * 380 + 200)
    this._calcTimers.push(doneTimer)
  },

  /** 双标记就绪检查 */
  _tryFinishCalc() {
    if (!this._calcAnimDone || !this._calcApiDone) return

    // projecting: 投影展开过渡
    this.setData({ flightStage: 'projecting' })

    const finishTimer = setTimeout(() => {
      this._finishCalc(this._calcResult)
    }, 600)
    this._calcTimers.push(finishTimer)
  },

  _clearCalcTimers() {
    this._calcTimers.forEach(t => clearTimeout(t))
    this._calcTimers = []
    if (this._apiTimeoutTimer) { clearTimeout(this._apiTimeoutTimer); this._apiTimeoutTimer = null }
  },

  /* ===== heartbeat 轮换文案（延迟 6 秒） ===== */
  _startHeartbeat() {
    this._stopHeartbeat()
    let idx = 0

    // 延迟 6 秒后才开始显示 heartbeat
    this._heartbeatDelayTimer = setTimeout(() => {
      if (this.data.pageMode !== 'generating') return
      this.setData({ heartbeatText: HEARTBEAT_LINES[0] })
      idx = 1

      this._heartbeatTimer = setInterval(() => {
        if (this.data.pageMode !== 'generating') {
          this._stopHeartbeat()
          return
        }
        this.setData({ heartbeatText: HEARTBEAT_LINES[idx % HEARTBEAT_LINES.length] })
        idx++
      }, 3000)
    }, 6000)
  },

  _stopHeartbeat() {
    if (this._heartbeatDelayTimer) {
      clearTimeout(this._heartbeatDelayTimer)
      this._heartbeatDelayTimer = null
    }
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer)
      this._heartbeatTimer = null
    }
    this.setData({ heartbeatText: '' })
  },

  /** 退场：进入 result 或回 launch */
  _finishCalc(result) {
    this._requesting = false
    this._clearCalcTimers()
    this._stopHeartbeat()

    if (result.error) {
      this.setData({
        pageMode: 'launch',
        flightStage: 'idle',
        error: null,
        logs: [],
      })
      wx.showToast({ title: '航行核心启动失败', icon: 'none' })
      return
    }

    const strategy = sanitizeStrategy(result.strategy)
    // 结果有效性校验：verdict/buffs/debuffs 至少一组有内容
    const hasVerdict = strategy.verdict && strategy.verdict.trim().length > 0
    const hasBuffs = strategy.buffs && strategy.buffs.length > 0
    const hasDebuffs = strategy.debuffs && strategy.debuffs.length > 0
    if (!hasVerdict && !hasBuffs && !hasDebuffs) {
      this.setData({
        pageMode: 'launch',
        flightStage: 'idle',
        error: null,
        logs: [],
      })
      wx.showToast({ title: '指令数据不足，请重试', icon: 'none' })
      return
    }
    const themeColor = normalizeThemeColor(strategy)

    try {
      const today = this.data.currentDate.replace(/\./g, '-')
      wx.setStorageSync('strategy_result', { date: today, data: strategy })
    } catch (e) {}

    const meta = deriveStrategyMeta(strategy)

    // flightStage: done — 结果投影完全展开
    this.setData({
      pageMode: 'result',
      flightStage: 'done',
      projectingResult: true,
      strategy,
      strategyTheme: meta.strategyTheme,
      strategySummary: meta.strategySummary,
      directiveText: deriveDirectiveText(strategy),
      themeColor,
      nextRefreshAt: strategy.nextRefreshAt || '',
      sourceLabel: mapSourceToLabel(strategy.source),
      solarTermLabel: mapSolarTermToLabel(strategy.solarTerm),
      userTagLabel: mapUserTagToLabel(strategy.userTag),
      userTagColor: normalizeUserTagColor(strategy.userTag),
      logs: [],
    })

    // 600ms 后关闭 projecting 标记
    setTimeout(() => {
      this.setData({ projectingResult: false })
    }, 600)
  },

  /* ==================== result → 重新点火弹窗 ==================== */

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
      pageMode: 'launch',
      flightStage: 'idle',
      forcePending: true,
      projectingResult: false,
      strategy: null,
      strategyTheme: '',
      strategySummary: '',
      directiveText: '',
      themeColor: '#0A84FF',
      sourceLabel: '待同步',
      solarTermLabel: '待同步',
      userTagLabel: '待同步',
      userTagColor: '#0A84FF',
    })
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
      const W = 750
      const H = 1200

      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.scale(dpr, dpr)

      const s = this.data.strategy
      if (!s) {
        this.setData({ phase: 'result', posterError: '指令数据缺失' })
        return
      }

      // ═══ 背景 ═══
      this._drawPosterBg(ctx, W, H)

      // ═══ 内容 ═══
      this._drawPosterContent(ctx, W, H, s)

      // ═══ 导出图片 ═══
      wx.canvasToTempFilePath({
        canvas,
        x: 0, y: 0,
        width: W,
        height: H,
        destWidth: W * dpr,
        destHeight: H * dpr,
        success: (fileRes) => {
          this._posterImagePath = fileRes.tempFilePath
          this.setData({ phase: 'poster_preview', posterPath: fileRes.tempFilePath })
        },
        fail: () => {
          this.setData({ phase: 'result', posterError: '指令卡导出失败' })
          wx.showToast({ title: '导出失败', icon: 'none' })
        },
      })
    })
  },

  /** 海报背景（与镜像页同款） */
  _drawPosterBg(ctx, W, H) {
    ctx.fillStyle = '#0A0A0A'
    ctx.fillRect(0, 0, W, H)

    // 顶部微光
    const grad = ctx.createRadialGradient(160, 0, 0, 160, 0, 420)
    grad.addColorStop(0, 'rgba(10,132,255,0.18)')
    grad.addColorStop(1, 'rgba(10,132,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // 外框圆角矩形
    ctx.strokeStyle = 'rgba(10,132,255,0.28)'
    ctx.lineWidth = 2
    this._roundRect(ctx, 44, 44, W - 88, H - 88, 28)
    ctx.stroke()

    // 扫描线
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 1
    for (let y = 76; y < H - 76; y += 16) {
      ctx.beginPath()
      ctx.moveTo(60, y)
      ctx.lineTo(W - 60, y)
      ctx.stroke()
    }
  },

  /**
   * 海报内容：舰载指令主视觉 + 双栏布局
   *
   * 布局比例：
   *   顶部 10%:  PULSE TERMINAL / 今日指令投影 / FLIGHT DIRECTIVE
   *   主指令 28%: 舰载指令大字
   *   状态读数 22%: verdict
   *   底部数据 30%: 左推进节奏 / 右安全边界
   *   底部 5%: 签名
   */
  _drawPosterContent(ctx, W, H, s) {
    const padL = 72
    const padR = W - padL
    const contentW = padR - padL

    const directiveText = sanitizeStrategyText(this.data.directiveText || '保持低速推进，优先修正节奏。')
    const statusText = sanitizeStrategyText(s.verdict || '当前状态读数待同步。保持节奏观察。')
    const buffs = (s.buffs || []).map(sanitizeStrategyText).slice(0, 3)
    const debuffs = (s.debuffs || []).map(sanitizeStrategyText).slice(0, 2)
    const buffsFilled = buffs.length >= 3 ? buffs : [...buffs, ...['保持低速推进', '减少连续修正', '优先观察节奏'].slice(buffs.length, 3)]
    const debuffsFilled = debuffs.length >= 2 ? debuffs : [...debuffs, ...['避免高频切换', '保持状态回稳'].slice(debuffs.length, 2)]

    // ═══ 顶部区 (y: 72 → 200) ═══
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font = '18px sans-serif'
    this._fillLetterSpaced(ctx, 'PULSE TERMINAL', padL, 90)

    ctx.fillStyle = '#00C8FF'
    ctx.font = 'bold 42px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('今日指令投影', W / 2, 150)

    ctx.fillStyle = 'rgba(255,255,255,0.26)'
    ctx.font = '18px sans-serif'
    ctx.fillText('FLIGHT DIRECTIVE', W / 2, 180)

    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.font = '18px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(this.data.currentDate, padL, 210)
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(0,200,255,0.28)'
    this._fillLetterSpaced(ctx, 'NAV CORE', padR, 210)
    ctx.textAlign = 'left'

    // 分隔线
    let y = 235
    this._drawDivider(ctx, padL, y, contentW)

    // ═══ 舰载指令主视觉 (y: 260 → 510, ~28%) ═══
    y += 30
    ctx.fillStyle = '#00C8FF'
    ctx.font = 'bold 28px sans-serif'
    ctx.fillText('舰载指令', padL, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.font = '16px Courier New'
    ctx.fillText('DIRECTIVE', padR, y)
    ctx.textAlign = 'left'

    y += 44
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = 'bold 56px sans-serif'
    const dLines = this._wrapText(ctx, directiveText, contentW)
    const maxD = Math.min(dLines.length, 3)
    for (let i = 0; i < maxD; i++) {
      ctx.fillText(dLines[i], padL, y)
      y += 72
    }

    // 分隔线
    y += 12
    this._drawDivider(ctx, padL, y, contentW)

    // ═══ 状态读数 (y: → 750, ~22%) ═══
    y += 30
    ctx.fillStyle = '#00C8FF'
    ctx.font = 'bold 28px sans-serif'
    ctx.fillText('状态读数', padL, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.font = '16px Courier New'
    ctx.fillText('STATUS', padR, y)
    ctx.textAlign = 'left'

    y += 38
    ctx.fillStyle = 'rgba(255,255,255,0.70)'
    ctx.font = '34px sans-serif'
    const sLines = this._wrapText(ctx, statusText, contentW)
    const maxS = Math.min(sLines.length, 3)
    for (let i = 0; i < maxS; i++) {
      ctx.fillText(sLines[i], padL, y)
      y += 48
    }

    // 分隔线
    y += 12
    this._drawDivider(ctx, padL, y, contentW)

    // ═══ 推进节奏 + 安全边界 双栏 (y: → 1080, ~30%) ═══
    y += 30
    const halfW = (contentW - 32) / 2  // 32px 中间间距

    // --- 左栏：推进节奏 ---
    ctx.fillStyle = '#00C8FF'
    ctx.font = 'bold 26px sans-serif'
    ctx.fillText('推进节奏', padL, y)
    ctx.fillStyle = 'rgba(48,209,88,0.28)'
    ctx.font = '14px Courier New'
    ctx.fillText('THRUST', padL, y + 22)

    let leftY = y + 52
    buffsFilled.forEach((b, i) => {
      ctx.fillStyle = 'rgba(48,209,88,0.55)'
      ctx.font = 'bold 18px Courier New'
      const num = String(i + 1).padStart(2, '0')
      ctx.fillText(num, padL, leftY)
      ctx.fillStyle = 'rgba(255,255,255,0.70)'
      ctx.font = '30px sans-serif'
      const lines = this._wrapText(ctx, b, halfW - 44)
      lines.forEach(line => {
        ctx.fillText(line, padL + 44, leftY)
        leftY += 44
      })
      leftY += 6
    })

    // --- 右栏：安全边界 ---
    const rightX = padL + halfW + 32
    ctx.fillStyle = '#FF9F0A'
    ctx.font = 'bold 26px sans-serif'
    ctx.fillText('安全边界', rightX, y)
    ctx.fillStyle = 'rgba(255,159,10,0.28)'
    ctx.font = '14px Courier New'
    ctx.fillText('SAFETY', rightX, y + 22)

    let rightY = y + 52
    debuffsFilled.forEach((d, i) => {
      ctx.fillStyle = 'rgba(255,159,10,0.55)'
      ctx.font = 'bold 18px Courier New'
      const num = String(i + 1).padStart(2, '0')
      ctx.fillText(num, rightX, rightY)
      ctx.fillStyle = 'rgba(255,255,255,0.62)'
      ctx.font = '30px sans-serif'
      const lines = this._wrapText(ctx, d, halfW - 44)
      lines.forEach(line => {
        ctx.fillText(line, rightX + 44, rightY)
        rightY += 44
      })
      rightY += 6
    })

    // ═══ 底部标识区 ═══
    ctx.strokeStyle = 'rgba(10,132,255,0.15)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padL, H - 120)
    ctx.lineTo(padR, H - 120)
    ctx.stroke()

    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    ctx.font = '18px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(this.data.currentDate, padL, H - 80)

    ctx.fillStyle = 'rgba(10,132,255,0.35)'
    ctx.font = '16px sans-serif'
    this._fillLetterSpaced(ctx, 'SMART RECORD · NAV CORE', padL, H - 50)
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

  /** 圆角矩形路径 */
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  },

  /** 分隔线 */
  _drawDivider(ctx, x, y, w) {
    ctx.strokeStyle = 'rgba(10,132,255,0.20)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + w, y)
    ctx.stroke()
  },

  /** 字间距绘制（左对齐） */
  _fillLetterSpaced(ctx, text, x, y) {
    const chars = text.split('')
    let cx = x
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], cx, y)
      cx += ctx.measureText(chars[i]).width + 4
    }
  },

  /** 字间距绘制（右对齐） */
  _fillLetterSpacedRight(ctx, text, x, y) {
    const chars = text.split('')
    let totalW = 0
    for (let i = 0; i < chars.length; i++) {
      totalW += ctx.measureText(chars[i]).width + 4
    }
    let cx = x - totalW
    for (let j = 0; j < chars.length; j++) {
      ctx.fillText(chars[j], cx, y)
      cx += ctx.measureText(chars[j]).width + 4
    }
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

  onPosterRetry() {
    this.setData({ posterError: '' })
    this._renderPosterCanvas()
  },

  onPosterCancel() {
    this.setData({ phase: 'result', posterPath: '', posterError: '' })
  },

  /* ==================== 通用工具 ==================== */

  noop() {},

  preventTouchMove() {},

  onShareAppMessage() {
    const s = this.data.strategy
    if (!s) return {}
    const result = {
      title: `今日指令投影：${s.tag || ''}`,
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
      this.setData({ countdownText: '可校准' })
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
