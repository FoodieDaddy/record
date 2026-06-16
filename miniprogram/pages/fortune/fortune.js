const { vibrateShort } = require('../../utils/haptic')
const fortuneService = require('../../services/fortune-service')
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
  [new RegExp('预' + '知', 'g'), '校准'],
  [new RegExp('必' + '胜', 'g'), '稳定执行'],
  [new RegExp('稳' + '赚', 'g'), '稳态执行'],
  [/校准者/g, '今日指令'],
  [/LOW-NOISE/gi, '低噪'],
  [/MEDIUM-NOISE/gi, '中噪'],
  [/HIGH-NOISE/gi, '高噪'],
  [/LLM/g, '主引擎'],
  [/HIGH_RISK/g, '偏高'],
  [/今日策略/g, '今日指令'],
  [/生成策略/g, '生成今日指令'],
  [/策略卡/g, '指令卡'],
  [/策略/g, '指令'],
  [/黑匣子样本/g, '航迹样本'],
  [/黑匣子/g, '航迹档案'],
  [/重新点火/g, '重新计算'],
  [/点火航行核心/g, '开始导航计算'],
  [new RegExp('神' + '谕', 'g'), '指令'],
  [new RegExp('占' + '卜', 'g'), '推演'],
  [new RegExp('算' + '命', 'g'), '推演'],
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
  if (strategy.verdict && strategy.verdict.length <= 30) return strategy.verdict
  if (strategy.verdict) return strategy.verdict.slice(0, 28) + '...'
  if (strategy.title) return strategy.title
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

/** 补充 CloudBase AI 来源缺失的 archetype 字段（title/tags） */
const ARCHETYPE_MAP = {
  WINNING_STREAK: { title: '控场者', tags: ['顺行', '连续', '控场'] },
  LOSING_STREAK: { title: '校准者', tags: ['回稳', '校准', '观察'] },
  HIGH_RISK: { title: '高波动体', tags: ['波动', '高风险', '节奏'] },
  STABLE: { title: '巡航者', tags: ['稳健', '巡航', '节奏'] },
}

function _fillArchetypeIfMissing(strategy) {
  if (strategy.title && strategy.tags) return
  const archetype = ARCHETYPE_MAP[strategy.userTag] || ARCHETYPE_MAP.STABLE
  if (!strategy.title) strategy.title = archetype.title
  if (!strategy.tags || strategy.tags.length === 0) strategy.tags = archetype.tags
}

/** source 映射中文 */
function mapSourceToLabel(source) {
  if (source === 'llm') return '主引擎'
  if (source === 'cloudbase-ai') return '主引擎'
  if (source === 'fallback') return '本地'
  return '待同步'
}

/** solarTerm 映射中文 */
function mapSolarTermToLabel(solarTerm) {
  if (!solarTerm) return '待同步'
  const map = {
    'LOW-NOISE': '低噪',
    'MID-NOISE': '中噪',
    'HIGH-NOISE': '高噪',
    'CALIBRATE': '校准',
    'CRUISE': '巡航',
    'DEBRIEF': '复盘',
  }
  return map[solarTerm] || solarTerm
}

/* ===== 生成中日志流 ===== */
const CALC_LOG_LINES = [
  { text: '航迹协议已同步' },
  { text: '航迹样本已接入' },
  { text: '安全边界生成中' },
]

/* ===== heartbeat 文案 ===== */
const HEARTBEAT_LINES = [
  '指令投影展开中',
  '推进节奏校准中',
  '导航核心校准中',
  '安全边界校准中',
]

Page({
  data: {
    pageMode: 'launch',     // launch | generating | result | relaunchReady
    flightStage: 'idle',    // idle | arming | pressed | plasma | lifting | syncing | projecting | done
    uiPhase: 'idle',
    animationEnabled: true,
    reduceMotion: false,
    showRegenerateModal: false,
    forcePending: false,
    currentDate: '',
    countdownText: '',
    nextRefreshAt: '',

    // 跨 Tab 骨架屏
    pageReady: false,
    firstEnter: true,

    // generating
    logs: [],
    showSyncLogs: false,
    compactSyncLogs: false,

    // 统一等待主文案（唯一用户可见等待出口）
    generationStatusText: '',
    generationStatusLevel: 'normal', // normal | long | deep | fallback | timeout
    waitStep: 0, // 0 | 1 | 2 | 3

    // 旧字段保留兼容，不再直接渲染
    waitLevel: 'normal',
    engineWaitText: '',

    // result
    strategy: null,
    nextRefreshAtEpochMs: 0,
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
    posterModalVisible: false,

    // share capability
    canUseWxShare: false,

    // projection visibility
    projectionVisible: false,
    coreCompact: false,

    // Page layout
    pageHeight: 0,

    // Custom Nav
    customNavTop: 44,
    customNavBarHeight: 44,
    customNavHeight: 88,
    cockpitState: 'idle',
    cockpitView: {
      statusDot: 'idle',
      statusLabel: '导航舱待机中',
      roomNo: '--',
      memberCountText: '0/16'
    }
  },

  /* ===== 实例字段（非 data） ===== */
  _countdownTimer: null,
  _forceRefresh: false,
  _calcTimers: [],
  _flightTimers: [],
  _projectionTimers: [],
  _longWaitTimers: [],
  _heartbeatTimer: null,
  _heartbeatDelayTimer: null,
  _apiTimeoutTimer: null,
  _calcAnimDone: false,
  _calcApiDone: false,
  _calcResult: null,
  _posterImagePath: '',
  _requesting: false,
  _runId: 0,
  _calcFinishing: false,
  _calcSettled: false,
  _apiStartedAt: 0,

  /* ==================== 生命周期 ==================== */

  onLoad() {
    this.initCustomNav()
    this._hideSystemLoadingSafe()
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    this.setData({
      animationEnabled: app.globalData.animationEnabled !== false,
      reduceMotion: app.globalData.animationEnabled === false,
      currentDate: `${y}.${m}.${d}`,
      pageReady: true,
    })
    this._calcPageHeight()
    this._initShareCapability()
    this._checkCache()
    this._updateCockpitStatusByPhase()
    this._setupEntranceAnimation()
  },

  onShow() {
    this._hideSystemLoadingSafe()
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.setData({ routeAnimating: true });
    setTimeout(() => {
      this.setData({ routeAnimating: false });
    }, 450);
    app.globalData.activeTabKey = 'nav'
    wx.setNavigationBarTitle({ title: '导航舱' })
    this._startCountdown()
    this.syncRoomStatus()
    // pageReady 立即为 true，避免空暗场；骨架屏仅用于极端冷启动
    if (!this.data.pageReady) {
      this.setData({ pageReady: true })
    }
    // 确保 TabBar 可见（防止异常路径漏恢复）
    // 只使用自定义 tabbar 的方法
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden: false, selected: 1 });
    }
    // 每次展示重新计算高度，防止横竖屏切换等场景
    this._calcPageHeight()
    this._updateCockpitStatusByPhase()
  },

  initCustomNav() {
    let statusBarHeight = 44;
    let navBarHeight = 44;
    try {
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      statusBarHeight = windowInfo.statusBarHeight || statusBarHeight;
      const menuRect = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
      if (menuRect && menuRect.height && menuRect.top > statusBarHeight) {
        navBarHeight = (menuRect.top - statusBarHeight) * 2 + menuRect.height;
      }
    } catch (e) {}
    this.setData({
      customNavTop: statusBarHeight,
      customNavBarHeight: navBarHeight,
      customNavHeight: statusBarHeight + navBarHeight
    });
  },

  syncRoomStatus() {
    const roomId = wx.getStorageSync('currentRoomId');
    if (!roomId) {
      this.setData({
        cockpitState: 'idle'
      });
    } else {
      this.setData({
        cockpitState: 'active'
      });
    }
    this._updateCockpitStatusByPhase();
  },

  _calcPageHeight() {
    let pageHeight = this.data.pageHeight || 0
    try {
      const win = wx.getWindowInfo();
      pageHeight = win.windowHeight;
    } catch (e) {
      try {
        const info = wx.getSystemInfoSync();
        pageHeight = info.windowHeight;
      } catch (e2) { /* 最终降级，保持旧值 */ }
    }
    if (pageHeight && pageHeight !== this.data.pageHeight) {
      this.setData({ pageHeight })
    }
  },

  onHide() {
    this._resetLoadingState()
    this.setData({ routeAnimating: 'prepare' });
    this._stopCountdown()
    this._abortCurrentFlight({ resetToLaunch: false })
    // 海报弹层可能已隐藏 tabbar，离开页面时恢复
    if (this.data.posterModalVisible) {
      this.setData({ posterModalVisible: false, phase: '', posterPath: '', posterError: '' })
      // 只使用自定义 tabbar 的方法
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setData({ hidden: false, selected: 1 });
      }
    }
    this._updateCockpitStatusByPhase()
  },

  onUnload() {
    this._resetLoadingState()
    this._stopCountdown()
    this._abortCurrentFlight({ resetToLaunch: false })
    // 只使用自定义 tabbar 的方法
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden: false, selected: 1 });
    }
    this._updateCockpitStatusByPhase()
  },

  /* ==================== 分享能力检测 ==================== */

  _initShareCapability() {
    const enableWechatShare = !!app.globalData.enableWechatShare
    const apiSupported = typeof wx.showShareImageMenu === 'function'
    this.setData({ canUseWxShare: enableWechatShare && apiSupported })
  },

  /* ==================== 统一动效判断 ==================== */

  _isMotionEnabled() {
    return app.globalData.animationEnabled !== false && this.data.reduceMotion !== true
  },

  /** 首次入场动画完成后，标记所有元素已入场，避免重新点火时重跑入场动画 */
  _setupEntranceAnimation() {
    if (this._hasEntered) return
    this._hasEntered = true
    setTimeout(() => {
      this.setData({ _ignitionEntered: true, firstEnter: false })
    }, 1500)
  },

  /* ==================== 缓存检查 ==================== */

  _checkCache() {
    try {
      const today = this.data.currentDate.replace(/\./g, '-')
      const cached = wx.getStorageSync('strategy_result')
      if (cached && cached.date === today && cached.data) {
        const strategy = sanitizeStrategy(cached.data)
        wx.setStorageSync('strategy_result', { date: today, data: strategy })
        const viewState = this._buildStrategyViewState(strategy)
        this.setData({
          pageMode: 'result',
          flightStage: 'done',
          uiPhase: 'result',
          projectionVisible: true,
          coreCompact: true,
          firstEnter: false,
          _ignitionEntered: true,
          ...viewState,
        })
        return
      }
    } catch (e) {}
    this.setData({ pageMode: 'launch', flightStage: 'idle' })
  },

  _hideSystemLoadingSafe() {
    try {
      wx.hideLoading()
    } catch (e) {}
  },

  _resetLoadingState() {
    this._hideSystemLoadingSafe()
    this._requesting = false
    this.setData({
      requesting: false,
      loading: false,
      generationStatusText: '',
      generationStatusLevel: 'normal',
      waitStep: 0,
      showSyncLogs: false,
      compactSyncLogs: false,
      logs: [],
      heartbeatText: '',
      engineWaitText: '',
      waitLevel: 'normal'
    })
  },

  _updateCockpitStatusByPhase() {
    const { pageMode, uiPhase, flightStage } = this.data
    const roomNo = wx.getStorageSync('currentRoomNo') || '--'
    const memberCount = wx.getStorageSync('currentMemberCount') || 0
    const memberCountText = `${memberCount}/16`

    let statusDot = 'idle'
    let statusLabel = '导航舱待机中'

    if (pageMode === 'generating' || uiPhase === 'loading' || flightStage === 'syncing') {
      statusDot = 'starting'
      statusLabel = '导航计算中'
    } else if (pageMode === 'result' || uiPhase === 'result' || flightStage === 'done') {
      statusDot = 'online'
      statusLabel = '指令已生成'
    } else {
      const roomId = wx.getStorageSync('currentRoomId')
      if (roomId) {
        statusDot = 'online'
        statusLabel = '导航舱已接入'
      } else {
        statusDot = 'idle'
        statusLabel = '导航舱待机中'
      }
    }

    this.setData({
      cockpitView: {
        statusDot,
        statusLabel,
        roomNo,
        memberCountText
      }
    })
  },

  /* ==================== 点火航行核心 ==================== */

  onTapLaunchCore() {
    if (this.data.flightStage !== 'idle') return
    vibrateShort('light')

    if (!this._isMotionEnabled()) {
      this._runId++
      this._calcSettled = false
      this._calcFinishing = false
      this.setData({
        flightStage: 'syncing',
        pageMode: 'generating',
        uiPhase: 'loading'
      })
      this._updateCockpitStatusByPhase()
      this._fireApiRequest()
      this._runLogAnimation()
      return
    }

    this._runIgnitionSequence()
  },

  _runIgnitionSequence() {
    this._abortCurrentFlight({ resetToLaunch: false })
    this._runId++
    this._calcSettled = false
    this._calcFinishing = false

    const runId = this._runId

    this._fireApiRequest()

    this.setData({
      uiPhase: 'launching',
      flightStage: 'pressed',
      generationStatusText: '导航核心校准中',
      generationStatusLevel: 'normal',
      waitStep: 1
    })
    this._updateCockpitStatusByPhase()

    const t1 = setTimeout(() => {
      if (runId !== this._runId) return
      this.setData({
        pageMode: 'generating',
        uiPhase: 'loading',
        flightStage: 'syncing',
        showSyncLogs: true,
        logs: [{ text: '航迹协议已同步', visible: true, typing: false }]
      })
      this._updateCockpitStatusByPhase()
      this._runLogAnimation({ skipFirst: true })
    }, 360)

    this._flightTimers.push(t1)
  },

  /** 提前发送 API 请求，不等 UI */
  _fireApiRequest() {
    if (this._requesting) return
    this._requesting = true
    const runId = this._runId

    this._resetCalcFlags()
    this._apiStartedAt = Date.now()

    const params = this.data.forcePending ? { force: true } : undefined
    const isTransitioning = this.data.uiPhase === 'launching' || this.data.uiPhase === 'loading'
    this.setData({
      forcePending: false,
      error: null,
      waitLevel: 'normal',
      engineWaitText: '',
      generationStatusText: isTransitioning ? this.data.generationStatusText : '',
      generationStatusLevel: isTransitioning ? this.data.generationStatusLevel : 'normal',
      waitStep: isTransitioning ? this.data.waitStep : 0,
      showSyncLogs: false,
      compactSyncLogs: false,
    })

    // 启动长等待守卫
    this._startLongWaitGuard(runId)

    // 前端超时守卫：30 秒后强制结束（晚于后端 25s LLM 上限）
    this._apiTimeoutTimer = setTimeout(() => {
      if (runId !== this._runId || this._calcApiDone) return
      this._calcApiDone = true
      this._calcResult = { error: '导航计算响应超时，请稍后再试' }
      this._tryFinishCalc(runId)
    }, 30000)

    // timeout 30s，配合后端 25s LLM 上限
    fortuneService.getTodayFortune(params).then(data => {
      if (this._apiTimeoutTimer) { clearTimeout(this._apiTimeoutTimer); this._apiTimeoutTimer = null }
      if (runId !== this._runId || this._calcApiDone) return
      this._calcApiDone = true
      this._calcResult = { strategy: data }
      this._tryFinishCalc(runId)
    }).catch(err => {
      if (this._apiTimeoutTimer) { clearTimeout(this._apiTimeoutTimer); this._apiTimeoutTimer = null }
      if (runId !== this._runId || this._calcApiDone) return
      this._calcApiDone = true
      this._calcResult = { error: err.message || '导航链路中断，请重试' }
      this._tryFinishCalc(runId)
    }).finally(() => {
      this._hideSystemLoadingSafe()
    })
  },

  /* ==================== generating 状态 ==================== */

  _runLogAnimation(options = {}) {
    const runId = this._runId
    const skipFirst = options.skipFirst === true

    if (!this._isMotionEnabled()) {
      this.setData({
        logs: CALC_LOG_LINES.map(item => ({ text: item.text, visible: true, typing: false })),
        showSyncLogs: true,
        compactSyncLogs: true,
      })
      this._calcAnimDone = true
      this._tryFinishCalc(runId)
      return
    }

    if (!skipFirst) {
      this.setData({
        logs: [],
        showSyncLogs: true,
        compactSyncLogs: false,
      })
    }

    const lines = skipFirst ? CALC_LOG_LINES.slice(1) : CALC_LOG_LINES

    lines.forEach((line, index) => {
      const logIndex = skipFirst ? index + 1 : index
      const delay = skipFirst 
        ? (index === 0 ? 240 : 520)
        : (index === 0 ? 120 : index === 1 ? 360 : 640)

      const showTimer = setTimeout(() => {
        if (runId !== this._runId || this.data.pageMode !== 'generating') return
        const logs = [...this.data.logs]
        logs.push({ text: line.text, visible: true, typing: true })
        this.setData({ logs })
      }, delay)
      this._calcTimers.push(showTimer)

      const typeTimer = setTimeout(() => {
        if (runId !== this._runId || this.data.pageMode !== 'generating') return
        const logs = [...this.data.logs]
        if (logs[logIndex]) {
          logs[logIndex] = { ...logs[logIndex], typing: false }
          this.setData({ logs })
        }
      }, delay + 200)
      this._calcTimers.push(typeTimer)
    })

    const compactTimer = setTimeout(() => {
      if (runId !== this._runId) return
      this._calcAnimDone = true
      this.setData({ compactSyncLogs: true })
      this._tryFinishCalc(runId)
    }, 1200)
    this._calcTimers.push(compactTimer)
  },

  /** 就绪检查：API 完成 + 最短展示时间满足即进入投影 */
  _tryFinishCalc(runId) {
    if (runId !== this._runId) return
    if (!this._calcApiDone) return
    if (this._calcFinishing || this._calcSettled) return

    const elapsed = Date.now() - this._apiStartedAt
    const minReady = elapsed >= 1200
    const animReady = this._calcAnimDone || elapsed >= 2400

    // API 在 1200ms 内返回，设置短 timer 再尝试
    if (!minReady) {
      const retryTimer = setTimeout(() => {
        this._tryFinishCalc(runId)
      }, Math.max(0, 1200 - elapsed))
      this._calcTimers.push(retryTimer)
      return
    }

    if (!animReady) return
    this._calcFinishing = true

    // 进入投影前只清理等待文案
    this._clearGeneratingTextState()

    const result = this._calcResult

    // 错误态处理
    if (result.error) {
      this._failCalc(result.error)
      return
    }

    // 数据准备：先 sanitize + 校验 + 构建 viewState
    const strategy = sanitizeStrategy(result.strategy)
    const hasVerdict = strategy.verdict && strategy.verdict.trim().length > 0
    const hasBuffs = strategy.buffs && strategy.buffs.length > 0
    const hasDebuffs = strategy.debuffs && strategy.debuffs.length > 0
    if (!hasVerdict && !hasBuffs && !hasDebuffs) {
      this._failCalc('指令数据不足')
      return
    }

    const viewState = this._buildStrategyViewState(strategy)

    // 缓存 sanitize 后的数据
    try {
      const today = this.data.currentDate.replace(/\./g, '-')
      wx.setStorageSync('strategy_result', { date: today, data: strategy })
    } catch (e) {}

    this._calcSettled = true
    this._enterResultReveal(runId, viewState)
  },

  /** 构建完整结果 viewState */
  _buildStrategyViewState(strategy) {
    // CloudBase AI 来源缺少 archetype 字段时，根据 userTag 补充
    _fillArchetypeIfMissing(strategy)
    const themeColor = normalizeThemeColor(strategy)
    const meta = deriveStrategyMeta(strategy)
    return {
      strategy,
      strategyTheme: meta.strategyTheme,
      strategySummary: meta.strategySummary,
      directiveText: deriveDirectiveText(strategy),
      themeColor,
      nextRefreshAt: strategy.nextRefreshAt || '',
      nextRefreshAtEpochMs: strategy.nextRefreshAtEpochMs || 0,
      sourceLabel: mapSourceToLabel(strategy.source),
      solarTermLabel: mapSolarTermToLabel(strategy.solarTerm),
      userTagLabel: mapUserTagToLabel(strategy.userTag),
      userTagColor: normalizeUserTagColor(strategy.userTag),
    }
  },

  /** 错误态回退：回到完整待机态 */
  _failCalc(message) {
    this._resetLoadingState()
    this._calcSettled = true
    this._clearCalcTimers()
    this.setData({
      pageMode: 'launch',
      flightStage: 'idle',
      uiPhase: 'idle',
      error: null,
      projectionVisible: false,
      coreCompact: false,
      firstEnter: false,
      _ignitionEntered: true,
    })
    this._updateCockpitStatusByPhase()
    wx.showToast({ title: sanitizeStrategyText(message) || '导航计算响应超时，请稍后再试', icon: 'none' })
  },

  _enterResultReveal(runId, viewState) {
    if (runId !== this._runId) return

    this._resetLoadingState()
    this._clearCalcTimers()
    this._clearLongWaitTimers()
    this._stopHeartbeat()

    if (!this._isMotionEnabled()) {
      this.setData({
        pageMode: 'result',
        flightStage: 'done',
        uiPhase: 'result',
        projectionVisible: true,
        coreCompact: true,
        ...viewState
      })
      this._updateCockpitStatusByPhase()
      return
    }

    this.setData({
      pageMode: 'result',
      flightStage: 'projecting',
      uiPhase: 'revealing',
      projectionVisible: false,
      coreCompact: true,
      compactSyncLogs: true,
      ...viewState
    })
    this._updateCockpitStatusByPhase()

    const showTimer = setTimeout(() => {
      if (runId !== this._runId) return
      this.setData({
        projectionVisible: true
      })
    }, 60)

    const doneTimer = setTimeout(() => {
      if (runId !== this._runId) return
      this._resetLoadingState()
      this.setData({
        pageMode: 'result',
        flightStage: 'done',
        uiPhase: 'result',
        projectingResult: false
      })
      this._updateCockpitStatusByPhase()
    }, 420)

    this._projectionTimers.push(showTimer, doneTimer)
  },

  /* ==================== 统一清理 ==================== */

  /** 中断当前点火流程 */
  _abortCurrentFlight(options = {}) {
    this._resetLoadingState()
    this._clearFlightTimers()
    this._clearCalcTimers()
    this._clearProjectionTimers()
    this._resetCalcFlags()

    if (options.resetToLaunch) {
      this.setData({
        pageMode: 'launch',
        flightStage: 'idle',
        uiPhase: 'idle',
        projectingResult: false,
        projectionVisible: false,
        coreCompact: false,
        firstEnter: false,
        _ignitionEntered: true,
        posterModalVisible: false,
        phase: '',
        posterPath: '',
        posterError: '',
      })
      this._updateCockpitStatusByPhase()
      // 只使用自定义 tabbar 的方法
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setData({ hidden: false, selected: 1 });
      }
    }
  },

  _clearFlightTimers() {
    this._flightTimers.forEach(t => clearTimeout(t))
    this._flightTimers = []
  },

  _clearCalcTimers() {
    this._calcTimers.forEach(t => clearTimeout(t))
    this._calcTimers = []
    if (this._apiTimeoutTimer) { clearTimeout(this._apiTimeoutTimer); this._apiTimeoutTimer = null }
    this._clearLongWaitTimers()
  },

  _clearProjectionTimers() {
    this._projectionTimers.forEach(t => clearTimeout(t))
    this._projectionTimers = []
  },

  _resetCalcFlags() {
    this._calcAnimDone = false
    this._calcApiDone = false
    this._calcResult = null
    this._calcFinishing = false
    this._calcSettled = false
  },

  /* ===== heartbeat 已废弃：等待文案统一由 generationStatusText 接管 ===== */
  _startHeartbeat() {
    // 不再启动循环 heartbeat，避免与长等待文案叠加
    return
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
    if (this.data.heartbeatText) {
      this.setData({ heartbeatText: '' })
    }
  },

  /* ===== 长等待守卫（配合后端 25s LLM 上限） ===== */
  _startLongWaitGuard(runId) {
    this._clearLongWaitTimers()

    // 4 秒：长等待态 — 同时收缩接入日志
    const t1 = setTimeout(() => {
      if (!this._isRunActive(runId) || this._calcApiDone) return
      this._setGenerationStatus('导航核心校准中', 'long', 1)
      this.setData({ compactSyncLogs: true })
    }, 4000)
    this._longWaitTimers.push(t1)

    // 12 秒：深度等待态
    const t2 = setTimeout(() => {
      if (!this._isRunActive(runId) || this._calcApiDone) return
      this._setGenerationStatus('指令投影校准中', 'deep', 2)
    }, 12000)
    this._longWaitTimers.push(t2)

    // 20 秒：备用链路准备态
    const t3 = setTimeout(() => {
      if (!this._isRunActive(runId) || this._calcApiDone) return
      this._setGenerationStatus('备用导航准备中', 'fallback', 3)
    }, 20000)
    this._longWaitTimers.push(t3)

    // 30 秒：前端兜底（晚于后端 25s）
    const t4 = setTimeout(() => {
      if (!this._isRunActive(runId) || this._calcApiDone) return
      this._failCalc('导航计算响应超时，请稍后再试')
    }, 30000)
    this._longWaitTimers.push(t4)
  },

  /** 统一设置等待主文案（替换关系，不是追加） */
  _setGenerationStatus(text, level, step) {
    if (!this._isRunActive(this._runId) && this.data.pageMode === 'generating') return
    this.setData({
      generationStatusText: sanitizeStrategyText(text || ''),
      generationStatusLevel: level || 'normal',
      waitStep: typeof step === 'number' ? step : this.data.waitStep,
      // 清掉旧字段，防止 WXML 残留
      heartbeatText: '',
      engineWaitText: '',
    })
  },

  _clearGeneratingTextState() {
    this._stopHeartbeat()
    this.setData({
      generationStatusText: '',
      generationStatusLevel: 'normal',
      heartbeatText: '',
      engineWaitText: '',
      waitStep: 0
    })
  },

  /** 清理所有生成中视觉状态 */
  _clearGeneratingVisualState() {
    this._stopHeartbeat()
    this.setData({
      generationStatusText: '',
      generationStatusLevel: 'normal',
      heartbeatText: '',
      engineWaitText: '',
      waitStep: 0,
      logs: [],
      showSyncLogs: false,
      compactSyncLogs: false,
    })
  },

  _clearLongWaitTimers() {
    this._longWaitTimers.forEach(t => clearTimeout(t))
    this._longWaitTimers = []
  },

  _isRunActive(runId) {
    return runId === this._runId && this.data.pageMode === 'generating'
  },

  /* ==================== result → 重新点火弹窗 ==================== */

  onTapRegenerate() {
    vibrateShort('light')
    this._resetLoadingState()
    this.setData({ showRegenerateModal: true })
  },

  onCancelRegenerate() {
    this._resetLoadingState()
    this.setData({ showRegenerateModal: false })
  },

  onConfirmRegenerate() {
    vibrateShort('light')
    this._resetLoadingState()
    this._clearFlightTimers()
    this._clearCalcTimers()
    this._clearProjectionTimers()
    this._clearLongWaitTimers()
    this._stopHeartbeat()

    try { wx.removeStorageSync('strategy_result') } catch (e) {}
    this._abortCurrentFlight({ resetToLaunch: false })

    // 原子化复位：一次性回到完整待机态
    // firstEnter / _ignitionEntered 保留 true，跳过入场动画
    this.setData({
      pageMode: 'launch',
      flightStage: 'idle',
      uiPhase: 'idle',
      showRegenerateModal: false,
      firstEnter: false,
      _ignitionEntered: true,

      strategy: null,
      directiveText: '',
      strategyTheme: '',
      strategySummary: '',
      sourceLabel: '待同步',
      solarTermLabel: '待同步',
      userTagLabel: '待同步',
      userTagColor: '#0A84FF',
      themeColor: '#0A84FF',
      nextRefreshAtEpochMs: 0,

      projectionVisible: false,
      coreCompact: false,
      projectingResult: false,

      posterPath: '',
      posterError: '',
      phase: '',
      posterModalVisible: false,

      error: null,
      forcePending: true,
    })
    this._resetLoadingState()
    this._updateCockpitStatusByPhase()
    // 只使用自定义 tabbar 的方法
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden: false, selected: 1 });
    }
  },

  /* ==================== 分享 / 海报 ==================== */

  onTapGeneratePoster() {
    vibrateShort('light')
    this._hideSystemLoadingSafe()
    this.setData({ phase: 'poster_generating', posterError: '', posterModalVisible: true })
    // 只使用自定义 tabbar 的方法
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden: true });
    }
    setTimeout(() => {
      this._renderPosterCanvas()
    }, 300)
  },

  _renderPosterCanvas() {
    const query = wx.createSelectorQuery().in(this)
    query.select('#posterCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        this.setData({ phase: 'poster_error', posterError: '画布初始化失败' })
        // 只使用自定义 tabbar 的方法
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
          this.getTabBar().setData({ hidden: false, selected: 1 });
        }
        return
      }

      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getWindowInfo().pixelRatio || 2
      const W = 750
      const H = 1300

      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.scale(dpr, dpr)

      const s = this.data.strategy
      if (!s) {
        this.setData({ phase: 'poster_error', posterError: '指令数据缺失' })
        // 只使用自定义 tabbar 的方法
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
          this.getTabBar().setData({ hidden: false, selected: 1 });
        }
        return
      }

      try {
        this._drawPosterBg(ctx, W, H)
        this._drawPosterContent(ctx, W, H, s)
      } catch (e) {
        this.setData({ phase: 'poster_error', posterError: '指令卡绘制失败' })
        // 只使用自定义 tabbar 的方法
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
          this.getTabBar().setData({ hidden: false, selected: 1 });
        }
        return
      }

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
          this.setData({ phase: 'poster_error', posterError: '指令卡导出失败' })
          // 只使用自定义 tabbar 的方法
          if (typeof this.getTabBar === 'function' && this.getTabBar()) {
            this.getTabBar().setData({ hidden: false, selected: 1 });
          }
        },
      })
    })
  },

  /** 海报背景：终端作战风格 */
  _drawPosterBg(ctx, W, H) {
    // 深黑底
    ctx.fillStyle = '#06080C'
    ctx.fillRect(0, 0, W, H)

    // 主辉光：左上蓝
    const g1 = ctx.createRadialGradient(120, 60, 0, 120, 60, 480)
    g1.addColorStop(0, 'rgba(10,132,255,0.16)')
    g1.addColorStop(1, 'rgba(10,132,255,0)')
    ctx.fillStyle = g1
    ctx.fillRect(0, 0, W, H)

    // 次辉光：右下蓝
    const g2 = ctx.createRadialGradient(W - 80, H - 200, 0, W - 80, H - 200, 360)
    g2.addColorStop(0, 'rgba(0,200,255,0.06)')
    g2.addColorStop(1, 'rgba(0,200,255,0)')
    ctx.fillStyle = g2
    ctx.fillRect(0, 0, W, H)

    // 扫描线
    ctx.strokeStyle = 'rgba(255,255,255,0.018)'
    ctx.lineWidth = 1
    for (let sy = 0; sy < H; sy += 6) {
      ctx.beginPath()
      ctx.moveTo(0, sy)
      ctx.lineTo(W, sy)
      ctx.stroke()
    }

    // 角标（终端感 L 形标记）
    this._drawCorner(ctx, 36, 36, 1, 1)
    this._drawCorner(ctx, W - 36, 36, -1, 1)
    this._drawCorner(ctx, 36, H - 36, 1, -1)
    this._drawCorner(ctx, W - 36, H - 36, -1, -1)

    // 外框线
    ctx.strokeStyle = 'rgba(0,200,255,0.10)'
    ctx.lineWidth = 1
    ctx.strokeRect(48, 48, W - 96, H - 96)
  },

  /** 绘制角标 */
  _drawCorner(ctx, x, y, dx, dy) {
    const len = 28
    ctx.strokeStyle = 'rgba(0,200,255,0.45)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, y + len * dy)
    ctx.lineTo(x, y)
    ctx.lineTo(x + len * dx, y)
    ctx.stroke()
  },

  /**
   * 海报内容：与结果页投影布局完全对齐
   *
   * 布局结构（750 x 1300）：
   *   [标题区]      y: 72~126     dp-header
   *   [舰载指令]    y: 160~380    strategy-section--directive + strategy-reading + tags
   *   [状态读数]    y: 410~550    strategy-insight
   *   [HUD 芯片]    y: 580~640    strategy-hud-chips
   *   [状态胶囊]    y: 660~710    strategy-tag-pill
   *   [推进节奏]    y: 740~970    strategy-section + strategy-list-card
   *   [安全边界]    y: 1000~1180  strategy-section + strategy-list-card--risk
   *   [底部标识]    y: 1220~1270
   */
  _drawPosterContent(ctx, W, H, s) {
    const padL = 72
    const padR = W - padL
    const contentW = padR - padL

    const directiveText = sanitizeStrategyText(this.data.directiveText || '保持低速推进，优先修正节奏。')
    const statusText = sanitizeStrategyText(s.verdict || '当前状态读数待同步。保持节奏观察。')
    const tags = (s.tags || []).map(sanitizeStrategyText).slice(0, 3)
    const buffs = (s.buffs || []).map(sanitizeStrategyText).slice(0, 3)
    const debuffs = (s.debuffs || []).map(sanitizeStrategyText).slice(0, 2)
    const themeColor = this.data.themeColor || '#0A84FF'

    /* ========== 标题区（dp-header） ========== */
    ctx.fillStyle = 'rgba(226,242,255,0.90)'
    ctx.font = 'bold 36px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('今日指令投影', W / 2, 100)

    ctx.fillStyle = 'rgba(126,156,180,0.16)'
    ctx.font = '14px Courier New'
    ctx.textAlign = 'left'
    ctx.fillText(this.data.currentDate, padL, 122)

    /* ========== 舰载指令（strategy-section--directive） ========== */
    let y = 160
    this._drawSectionHead(ctx, padL, y, contentW, '今日指令', '#00C8FF')
    y += 40

    // strategy-reading 卡片
    this._drawCardBg(ctx, padL, y, contentW, 170)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = 'bold 30px sans-serif'
    const dLines = this._wrapText(ctx, directiveText, contentW - 48)
    const maxD = Math.min(dLines.length, 3)
    let dy = y + 44
    for (let i = 0; i < maxD; i++) {
      ctx.fillText(dLines[i], padL + 24, dy)
      dy += 42
    }

    // strategy-reading-tags
    if (tags.length > 0) {
      let tagX = padL + 24
      const tagY = dy + 8
      tags.forEach((tag) => {
        const tw = ctx.measureText(tag).width + 24
        ctx.fillStyle = 'rgba(0,175,255,0.05)'
        ctx.fillRect(tagX, tagY, tw, 30)
        ctx.strokeStyle = 'rgba(0,175,255,0.12)'
        ctx.lineWidth = 1
        ctx.strokeRect(tagX, tagY, tw, 30)
        ctx.fillStyle = 'rgba(0,175,255,0.6)'
        ctx.font = '16px Courier New'
        ctx.fillText(tag, tagX + 12, tagY + 21)
        tagX += tw + 12
      })
    }

    /* ========== 状态读数（strategy-insight） ========== */
    y += 186
    this._drawSectionHead(ctx, padL, y, contentW, '状态读数', '#00C8FF')
    y += 40

    const sLines = this._wrapText(ctx, statusText, contentW - 48)
    const maxS = Math.min(sLines.length, 3)
    const statusCardH = maxS * 40 + 40
    this._drawCardBg(ctx, padL, y, contentW, statusCardH)

    ctx.fillStyle = 'rgba(255,255,255,0.90)'
    ctx.font = '28px sans-serif'
    let sy = y + 38
    for (let i = 0; i < maxS; i++) {
      ctx.fillText(sLines[i], padL + 24, sy)
      sy += 40
    }

    /* ========== HUD 芯片（strategy-hud-chips） ========== */
    y += statusCardH + 24
    this._drawHudChips(ctx, padL, y, contentW)

    /* ========== 状态胶囊（strategy-tag-pill） ========== */
    if (s.tag) {
      y += 72
      const tagText = sanitizeStrategyText(s.tag)
      ctx.font = 'bold 24px sans-serif'
      const pillW = ctx.measureText(tagText).width + 48
      const pillX = padL + (contentW - pillW) / 2
      this._drawTagPill(ctx, pillX, y, pillW, 44, tagText, themeColor)
    }

    /* ========== 推进节奏（strategy-section + strategy-list-card） ========== */
    y += (s.tag ? 72 : 24)
    this._drawSectionHead(ctx, padL, y, contentW, '推进节奏', '#00C8FF', '+')
    y += 40

    buffs.forEach((b, i) => {
      y = this._drawListItem(ctx, padL, y, contentW, i + 1, b, '#30D158', false)
    })

    /* ========== 安全边界（strategy-section + strategy-list-card--risk） ========== */
    y += 20
    this._drawSectionHead(ctx, padL, y, contentW, '安全边界', '#FF9F0A', '!')
    y += 40

    debuffs.forEach((d, i) => {
      y = this._drawListItem(ctx, padL, y, contentW, i + 1, d, '#FF9F0A', true)
    })

    /* ========== 底部标识 ========== */
    ctx.strokeStyle = 'rgba(0,200,255,0.08)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 8])
    ctx.beginPath()
    ctx.moveTo(padL, H - 80)
    ctx.lineTo(padR, H - 80)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.font = '13px Courier New'
    ctx.textAlign = 'left'
    ctx.fillText(this.data.currentDate, padL, H - 48)

    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(0,175,255,0.18)'
    this._fillLetterSpaced(ctx, 'SPACE SCOREKEEPER', padR, H - 48)
    ctx.textAlign = 'left'
  },

  /** 绘制区块标题（与页面 strategy-section-head 对齐） */
  _drawSectionHead(ctx, x, y, w, title, color, icon) {
    // icon（可选）
    let titleX = x
    if (icon) {
      ctx.fillStyle = color
      ctx.font = 'bold 18px sans-serif'
      ctx.fillText(icon, x, y + 2)
      titleX = x + 24
    }

    ctx.fillStyle = color
    ctx.font = 'bold 22px sans-serif'
    ctx.fillText(title, titleX, y + 2)
  },

  /** 绘制卡片背景（与页面 strategy-reading / strategy-insight 对齐） */
  _drawCardBg(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.025)'
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, w, h)
  },

  /** 绘制 HUD 芯片行（与页面 strategy-hud-chips 对齐） */
  _drawHudChips(ctx, x, y, w) {
    const chipH = 48
    // 背景
    ctx.fillStyle = 'rgba(0,175,255,0.02)'
    ctx.fillRect(x, y, w, chipH)
    ctx.strokeStyle = 'rgba(0,175,255,0.06)'
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, w, chipH)

    const colW = w / 3
    const chips = [
      { label: '指令源', value: this.data.sourceLabel || '待同步' },
      { label: '观测窗', value: this.data.solarTermLabel || '待同步' },
      { label: '状态噪声', value: this.data.userTagLabel || '待同步', color: this.data.userTagColor },
    ]

    chips.forEach((chip, i) => {
      const cx = x + colW * i + colW / 2
      ctx.font = '14px Courier New'
      ctx.fillStyle = 'rgba(126,156,180,0.32)'
      ctx.textAlign = 'center'
      ctx.fillText(chip.label, cx, y + 18)

      ctx.font = 'bold 18px Courier New'
      ctx.fillStyle = chip.color || 'rgba(0,175,255,0.72)'
      ctx.fillText(chip.value, cx, y + 38)

      // 分隔线
      if (i < 2) {
        ctx.strokeStyle = 'rgba(0,175,255,0.10)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x + colW * (i + 1), y + 10)
        ctx.lineTo(x + colW * (i + 1), y + chipH - 10)
        ctx.stroke()
      }
    })
    ctx.textAlign = 'left'
  },

  /** 绘制状态胶囊（与页面 strategy-tag-pill 对齐） */
  _drawTagPill(ctx, x, y, w, h, text, color) {
    ctx.fillStyle = color + '12'
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = color + '40'
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, w, h)
    ctx.fillStyle = color
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(text, x + w / 2, y + 30)
    ctx.textAlign = 'left'
  },

  /**
   * 绘制列表项（与页面 strategy-list-item 对齐）
   * 返回下一项 y 坐标
   */
  _drawListItem(ctx, x, y, w, num, text, color, isRisk) {
    const cardPadH = 20
    const cardPadV = 14
    const indexW = 52
    const textMaxW = w - indexW - cardPadH * 2 - 8
    const lines = this._wrapText(ctx, text, textMaxW)
    const maxLines = Math.min(lines.length, 2)
    const lineH = 38
    const itemH = Math.max(56, maxLines * lineH + cardPadV * 2)

    // 列表卡片背景
    ctx.fillStyle = isRisk ? 'rgba(255,159,10,0.018)' : 'rgba(255,255,255,0.025)'
    ctx.fillRect(x, y, w, itemH)
    ctx.strokeStyle = isRisk ? 'rgba(255,159,10,0.08)' : 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, w, itemH)

    // 分隔线（非第一项）
    if (num > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x + 1, y)
      ctx.lineTo(x + w - 1, y)
      ctx.stroke()
    }

    // 编号背景
    const numBgX = x + cardPadH
    const numBgY = y + (itemH - 40) / 2
    const numBgColor = isRisk ? 'rgba(255,159,10,0.08)' : 'rgba(48,209,88,0.08)'
    const numBorderColor = isRisk ? 'rgba(255,159,10,0.18)' : 'rgba(48,209,88,0.18)'
    ctx.fillStyle = numBgColor
    ctx.fillRect(numBgX, numBgY, indexW, 40)
    ctx.strokeStyle = numBorderColor
    ctx.lineWidth = 1
    ctx.strokeRect(numBgX, numBgY, indexW, 40)

    // 编号文字
    const numStr = String(num).padStart(2, '0')
    ctx.fillStyle = color
    ctx.font = 'bold 18px Courier New'
    ctx.textAlign = 'center'
    ctx.fillText(numStr, numBgX + indexW / 2, numBgY + 27)
    ctx.textAlign = 'left'

    // 内容文字
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    ctx.font = '26px sans-serif'
    let ty = y + cardPadV + 30
    for (let i = 0; i < maxLines; i++) {
      ctx.fillText(lines[i], x + cardPadH + indexW + 12, ty)
      ty += lineH
    }

    return y + itemH + 8
  },

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

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  },

  _drawDivider(ctx, x, y, w) {
    ctx.strokeStyle = 'rgba(10,132,255,0.20)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + w, y)
    ctx.stroke()
  },

  _fillLetterSpaced(ctx, text, x, y) {
    const chars = text.split('')
    let cx = x
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], cx, y)
      cx += ctx.measureText(chars[i]).width + 4
    }
  },

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
    vibrateShort('light')
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

  onSharePosterImage() {
    vibrateShort('light')
    if (!this._posterImagePath) return
    if (wx.showShareImageMenu) {
      wx.showShareImageMenu({
        imageUrl: this._posterImagePath,
        fail: () => {
          wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] })
        },
      })
    } else {
      wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] })
    }
  },

  onClosePoster() {
    vibrateShort('light')
    this.setData({ phase: '', posterPath: '', posterError: '', posterModalVisible: false })
    // 只使用自定义 tabbar 的方法
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden: false, selected: 1 });
    }
  },

  onPosterRetry() {
    vibrateShort('light')
    this.setData({ posterError: '', phase: 'poster_generating' })
    setTimeout(() => {
      this._renderPosterCanvas()
    }, 300)
  },

  onPosterCancel() {
    vibrateShort('light')
    this.setData({ phase: '', posterPath: '', posterError: '', posterModalVisible: false })
    // 只使用自定义 tabbar 的方法
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden: false, selected: 1 });
    }
  },

  /* ==================== 通用工具 ==================== */

  noop() {},

  preventTouchMove() {},

  onShareAppMessage() {
    const s = this.data.strategy
    if (!s) return {}
    const title = sanitizeStrategyText(`今日指令投影：${s.tag || '节奏校准'}`)
    const result = {
      title,
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
    const nextRefreshAtEpochMs = this.data.nextRefreshAtEpochMs
    const nextRefreshAt = this.data.nextRefreshAt
    if (!nextRefreshAt && !nextRefreshAtEpochMs) {
      if (this.data.countdownText) this.setData({ countdownText: '' })
      return
    }

    let diff
    if (nextRefreshAtEpochMs > 0) {
      diff = Math.floor((nextRefreshAtEpochMs - Date.now()) / 1000)
    } else {
      const now = new Date()
      const [hh, mm, ss] = nextRefreshAt.split(':').map(Number)
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, ss)
      diff = Math.floor((target - now) / 1000)
    }

    if (diff <= 0) {
      this.setData({ countdownText: '可计算' })
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
