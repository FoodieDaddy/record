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

/** 将 #RRGGBB + alpha hex 转为 rgba() 字符串，兼容微信 Canvas 2D */
function hexWithAlpha(hex, alphaHex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const a = parseInt(alphaHex, 16) / 255
  return `rgba(${r},${g},${b},${a.toFixed(2)})`
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

/** 基于 seed 字符串创建确定性伪随机数生成器 (mulberry32) */
function createSeededRandom(seed) {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  }
  return function () {
    h |= 0; h = h + 0x6D2B79F5 | 0
    let t = Math.imul(h ^ h >>> 15, 1 | h)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

/** 生成新 seed */
function createStarMapSeed() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

Page({
  data: {
    // ===== 状态机 =====
    baseState: 'idle',       // idle | starting | calibrating | completing | completed | regenerating
    overlayState: 'none',    // none | share | confirmRegenerate
    starMapSeed: '',
    starMap: { stars: [], routes: [], highlights: [], scanCenter: { x: 50, y: 50 } },
    oldStarMap: null,        // crossfade 期间保留的旧星图

    statusLineText: '导航待机',
    animationEnabled: true,
    reduceMotion: false,
    forcePending: false,
    currentDate: '',
    countdownText: '',
    nextRefreshAt: '',

    // 跨 Tab 骨架屏
    pageReady: false,
    firstEnter: true,

    // result
    strategy: null,
    nextRefreshAtEpochMs: 0,
    strategyTheme: '',
    strategySummary: '',
    directiveText: '',
    themeColor: '#0A84FF',
    targetDistance: '2.4',
    projectingResult: false,

    // HUD 芯片
    sourceLabel: '待同步',
    solarTermLabel: '待同步',
    userTagLabel: '待同步',
    userTagColor: '#0A84FF',

    // error
    error: null,

    // poster
    phase: '',
    posterPath: '',
    posterError: '',

    // share capability
    canUseWxShare: false,

    // HUD panel stability percent (derived from strategy data)
    stabilityPercent: 72,

    // 中央多行星系统（由 _generateStarMap 的 coreSystem 子结构驱动，不再硬编码）

    // 校准阶段文案
    calibrationText: '',

    // projection visibility
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
    this._flightTimers = []
    this._calcTimers = []
    this._projectionTimers = []
    this._longWaitTimers = []
    this.initCustomNav()
    this._hideSystemLoadingSafe()
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const seed = createStarMapSeed()
    this.setData({
      animationEnabled: app.globalData.animationEnabled !== false,
      reduceMotion: app.globalData.animationEnabled === false,
      currentDate: `${y}.${m}.${d}`,
      pageReady: true,
      starMapSeed: seed,
      starMap: this._generateStarMap(seed),
    })
    this._calcPageHeight()
    this._initShareCapability()
    this._checkCache()
    this._updateCockpitStatusByState()
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
    if (!this.data.pageReady) {
      this.setData({ pageReady: true })
    }
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden: false, selected: 1 });
    }
    this._calcPageHeight()
    this._updateCockpitStatusByState()
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
    this._updateCockpitStatusByState();
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
    this._hideSystemLoadingSafe()
    this.setData({ routeAnimating: 'prepare' });
    this._stopCountdown()
    this._abortCurrentFlight({ resetToLaunch: false })
    this._closeOverlay()
    this.setData({ oldStarMap: null })
    if (this.data.overlayState === 'share') {
      this.setData({ phase: '', posterPath: '', posterError: '' })
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setData({ hidden: false, selected: 1 });
      }
    }
    this._updateCockpitStatusByState()
  },

  onUnload() {
    this._resetLoadingState()
    this._hideSystemLoadingSafe()
    this._stopCountdown()
    this._abortCurrentFlight({ resetToLaunch: false })
    this._closeOverlay()
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden: false, selected: 1 });
    }
    this._updateCockpitStatusByState()
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
          baseState: 'completed',
          coreCompact: true,
          firstEnter: false,
          _ignitionEntered: true,
          ...viewState,
        })
        this._updateCockpitStatusByState()
        return
      }
    } catch (e) {}
    this.setData({ baseState: 'idle' })
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
    })
  },

  _updateCockpitStatusByState() {
    const { baseState } = this.data
    const roomNo = wx.getStorageSync('currentRoomNo') || '--'
    const memberCount = wx.getStorageSync('currentMemberCount') || 0
    const memberCountText = `${memberCount}/16`

    let statusDot = 'idle'
    let statusLabel = '导航舱待机中'
    let statusLineText = '待机'

    if (baseState === 'starting' || baseState === 'calibrating') {
      statusDot = 'starting'
      statusLabel = '星图校准中'
      statusLineText = '校准中'
    } else if (baseState === 'completing' || baseState === 'completed') {
      statusDot = 'online'
      statusLabel = '校准已完成'
      statusLineText = '已完成'
    } else if (baseState === 'regenerating') {
      statusDot = 'starting'
      statusLabel = '星图重构中'
      statusLineText = '校准中'
    } else {
      const roomId = wx.getStorageSync('currentRoomId')
      if (roomId) {
        statusDot = 'online'
        statusLabel = '导航舱已接入'
        statusLineText = '待机'
      } else {
        statusDot = 'idle'
        statusLabel = '导航舱待机中'
        statusLineText = '待机'
      }
    }

    this.setData({
      cockpitView: {
        statusDot,
        statusLabel,
        roomNo,
        memberCountText
      },
      statusLineText,
    })
  },

  /** 基于 seed 生成确定性星图数据 */
  _generateStarMap(seed) {
    const random = createSeededRandom(seed || 'default')
    const rand = (min, max) => min + random() * (max - min)
    const randInt = (min, max) => min + Math.floor(random() * (max - min + 1))

    // 打乱数组算法
    const shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
      }
      return arr
    }

    // 星核偏移（中心附近 ±8%）
    const coreOffset = {
      x: +(rand(-8, 8)).toFixed(1),
      y: +(rand(-6, 6)).toFixed(1),
    }

    // 星点：35~60 个
    const starCount = randInt(35, 60)
    const stars = Array.from({ length: starCount }, (_, i) => ({
      x: +(rand(4, 96)).toFixed(1),
      y: +(rand(4, 96)).toFixed(1),
      size: +(rand(1.5, 5.5)).toFixed(1),
      opacity: +(rand(0.2, 0.8)).toFixed(2),
      flickerDelay: +(rand(-4.0, 0)).toFixed(1), // 用负延时错开初始状态
    }))

    // 航线：2~4 条
    const routeCount = randInt(2, 4)
    const routes = Array.from({ length: routeCount }, () => {
      const x1 = +(rand(8, 40)).toFixed(1)
      const y1 = +(rand(10, 90)).toFixed(1)
      const x2 = +(rand(60, 92)).toFixed(1)
      const y2 = +(rand(10, 90)).toFixed(1)
      const dx = (x2 - x1) / 100 * 640
      const dy = (y2 - y1) / 100 * 420
      return {
        x1, y1,
        length: +Math.sqrt(dx * dx + dy * dy).toFixed(1),
        angle: +(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1),
        opacity: +(rand(0.10, 0.32)).toFixed(2),
      }
    })

    // 光晕：2~4 个
    const highlights = Array.from({ length: hlCount => randInt(2, 4) }, () => ({
      x: +(rand(12, 88)).toFixed(1),
      y: +(rand(12, 88)).toFixed(1),
      size: +(rand(80, 180)).toFixed(0),
      opacity: +(rand(0.05, 0.14)).toFixed(2),
    }))

    // 扫描中心
    const scanCenter = {
      x: +(rand(30, 70)).toFixed(1),
      y: +(rand(30, 70)).toFixed(1),
    }

    // 星尘粒子：20~35 个微小点
    const dustCount = randInt(20, 35)
    const dustParticles = Array.from({ length: dustCount }, () => ({
      x: +(rand(2, 98)).toFixed(1),
      y: +(rand(2, 98)).toFixed(1),
      size: +(rand(0.8, 2)).toFixed(1),
      opacity: +(rand(0.06, 0.22)).toFixed(2),
      driftDuration: randInt(60, 120),
      driftDelay: +(rand(-30, 0)).toFixed(0),
    }))

    // 轨道弧线：2~5 条
    const orbitCount = randInt(2, 5)
    const orbitArcs = Array.from({ length: orbitCount }, (_, i) => ({
      cx: +(rand(20, 80)).toFixed(1),
      cy: +(rand(15, 85)).toFixed(1),
      rx: +(rand(20, 45)).toFixed(1),
      ry: +(rand(8, 22)).toFixed(1),
      rotation: +(rand(-30, 30)).toFixed(1),
      opacity: +(rand(0.04, 0.14)).toFixed(2),
      breatheDuration: +(rand(8.0, 14.0)).toFixed(1),
      breatheDelay: +(rand(-5.0, 0)).toFixed(1),
    }))

    // 连接线：4~8 条（随机配对星点）
    const connCount = Math.min(randInt(4, 8), stars.length - 1)
    const connectionLines = Array.from({ length: connCount }, () => {
      const a = stars[randInt(0, stars.length - 1)]
      const b = stars[randInt(0, stars.length - 1)]
      const dx = (b.x - a.x)
      const dy = (b.y - a.y)
      const length = Math.sqrt(dx * dx + dy * dy)
      return {
        x1: a.x, y1: a.y,
        length: +length.toFixed(1),
        angle: +(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1),
        opacity: +(rand(0.04, 0.12)).toFixed(2),
      }
    })

    // 能量节点：2~4 个
    const nodeCount = randInt(2, 4)
    const energyNodes = Array.from({ length: nodeCount }, () => ({
      x: +(rand(15, 85)).toFixed(1),
      y: +(rand(15, 85)).toFixed(1),
      size: +(rand(4, 8)).toFixed(1),
      pulseDuration: +(rand(3, 6)).toFixed(1),
      pulseDelay: +(rand(-3.0, 0)).toFixed(1),
    }))

    // 雷达扫描中心
    const radarCenter = {
      x: +(rand(35, 65)).toFixed(1),
      y: +(rand(35, 65)).toFixed(1),
    }

    // 星图唯一 ID（从 seed 派生）
    const starMapId = 'SM-' + (seed || '').slice(0, 6).toUpperCase()

    // 色相偏移：青蓝 / 蓝绿（原 teal 改为更明显的 teal） / 暗紫（即 purple）
    const tints = ['cyan', 'teal', 'purple']
    const colorTint = tints[randInt(0, tints.length - 1)]

    // ===== 中央多行星系统（核心主视觉） =====
    // 容器 480rpx × 480rpx，坐标以中心为原点（rpx）；同 seed → 同布局
    const coreSystem = (() => {
      // 主核心：继续放大，更大、更亮、更有层次
      const main = {
        x: +(rand(-15, 15)).toFixed(1),
        y: +(rand(-15, 15)).toFixed(1),
        dotSize: randInt(38, 48),      // 主星核放大到 38~48rpx
        glowSize: randInt(220, 270),   // 内层光晕放大到 220~270rpx
        haloSize: randInt(300, 380),   // 外层光晕放大到 300~380rpx
        haloDur: +(rand(4.5, 7.5)).toFixed(1),
        glowDur: +(rand(3.0, 5.0)).toFixed(1),
        dotDur: +(rand(2.5, 4.5)).toFixed(1),
        scanDur: +(rand(1.8, 3.2)).toFixed(1),
      }

      // 轨道：3~5 条主轨道，整体向外扩，半径增大
      const coreOrbitCount = randInt(3, 5)
      const orbitArcs = ['full', 'full', 'half', 'dash', 'half']
      const orbits = Array.from({ length: coreOrbitCount }, (_, i) => {
        const layerRatio = (i + 1) / coreOrbitCount  // 0.x ~ 1
        const baseRx = 110 + layerRatio * 180 + rand(-15, 15)  // 半径整体调大
        const rx = +baseRx.toFixed(1)
        const ry = +(rx * rand(0.45, 0.82)).toFixed(1)  // 椭圆形
        const opacity = +(0.22 - layerRatio * 0.14).toFixed(2)
        return {
          rx, ry,
          rotation: +(rand(-40, 40)).toFixed(1),
          arc: orbitArcs[(i + randInt(0, 4)) % orbitArcs.length],
          opacity: Math.max(opacity, 0.07),
          breatheDuration: +(rand(8.0, 16.0)).toFixed(1),
          breatheDelay: +(rand(-5.0, 0.0)).toFixed(1),
          predict: false,
        }
      })

      // 额外增加 1 条辅助预测轨道 (断续线，最外层，极淡)
      const predictRx = 290 + rand(10, 40)
      orbits.push({
        rx: +predictRx.toFixed(1),
        ry: +(predictRx * rand(0.48, 0.75)).toFixed(1),
        rotation: +(rand(-45, 45)).toFixed(1),
        arc: 'dash',
        opacity: +(rand(0.04, 0.08)).toFixed(2),
        breatheDuration: +(rand(10.0, 18.0)).toFixed(1),
        breatheDelay: +(rand(-6.0, 0.0)).toFixed(1),
        predict: true,
      })

      // 次级行星：4~6 个，让体积更饱满明显
      const planetCount = randInt(4, 6)
      const colorPool = ['cyan', 'teal', 'blue', 'white']
      const useViolet = random() < 0.6
      const planets = []
      const lightUpOrders = shuffle(Array.from({ length: planetCount }, (_, idx) => idx))

      for (let i = 0; i < planetCount; i++) {
        const orbitIdx = i % coreOrbitCount
        const orbit = orbits[orbitIdx]
        const angleDeg = +((360 / planetCount) * i + rand(-22, 22)).toFixed(1)
        const angleRad = angleDeg * Math.PI / 180
        const ex = Math.cos(angleRad) * orbit.rx
        const ey = Math.sin(angleRad) * orbit.ry
        const rot = orbit.rotation * Math.PI / 180
        const x = +(ex * Math.cos(rot) - ey * Math.sin(rot) + main.x).toFixed(1)
        const y = +(ex * Math.sin(rot) + ey * Math.cos(rot) + main.y).toFixed(1)
        
        const color = (i === planetCount - 1 && useViolet)
          ? 'violet'
          : colorPool[randInt(0, colorPool.length - 1)]
        
        // 大小：近轨行星更明显（大小 32~42rpx），远轨行星大小 18~24rpx，富有层次与质量感
        const isNear = orbitIdx <= 1
        const size = isNear 
          ? +(32 + rand(0, 10)).toFixed(1) 
          : +(18 + rand(0, 6)).toFixed(1)

        // 确定性的自转/公转速度：近轨快，远轨慢
        const orbitSpinDur = isNear
          ? +(rand(12.0, 16.0)).toFixed(1)
          : +(rand(24.0, 34.0)).toFixed(1)

        planets.push({
          orbitIndex: orbitIdx,
          angleDeg, x, y,
          size: Math.max(size, 10),
          color,
          opacity: +(rand(0.65, 0.90)).toFixed(2),
          glow: isNear ? +(rand(16, 26)).toFixed(0) : +(rand(10, 18)).toFixed(0),
          twinkleDuration: +(rand(2.2, 4.5)).toFixed(1),
          twinkleDelay: +(rand(-4.0, 0.0)).toFixed(1),
          lightUpOrder: lightUpOrders[i],
          orbitSpinDur,
          orbitRx: orbit.rx, // 缓存轨道半径用于 CSS 旋转定位
        })
      }

      // 远轨小节点/信标：2~4 个，距离更远、慢速公转
      const farCount = randInt(2, 4)
      const farNodes = Array.from({ length: farCount }, () => {
        const angle = rand(0, Math.PI * 2)
        const r = rand(290, 340) // 向外扩，配合放大的主星系
        return {
          x: +(Math.cos(angle) * r).toFixed(1),
          y: +(Math.sin(angle) * r * 0.78).toFixed(1),
          size: +(rand(10, 14)).toFixed(1), // 尺寸稍微调大，更清晰
          opacity: +(rand(0.25, 0.45)).toFixed(2),
          twinkleDuration: +(rand(3.0, 6.0)).toFixed(1),
          twinkleDelay: +(rand(-5.0, 0.0)).toFixed(1),
          orbitSpinDur: +(rand(48.0, 72.0)).toFixed(1), // 信标公转极慢，符合深空定位标的感
          angleDeg: +(angle * 180 / Math.PI).toFixed(1), // 缓存角度用于 CSS 旋转
          orbitRx: r, // 缓存轨道半径
        }
      })

      // 连接线：1~4 条
      const linkCount = randInt(1, 4)
      const links = []
      for (let i = 0; i < linkCount; i++) {
        const a = (i === 0 && planets.length > 0)
          ? { x: main.x, y: main.y }
          : planets[randInt(0, planets.length - 1)]
        const b = planets[(i + 1) % planets.length]
        if (!a || !b || a === b) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const length = Math.sqrt(dx * dx + dy * dy)
        if (length < 40) continue
        links.push({
          x1: +a.x.toFixed(1),
          y1: +a.y.toFixed(1),
          length: +length.toFixed(1),
          angle: +(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1),
          opacity: +(rand(0.06, 0.14)).toFixed(2),
          pulseDuration: +(rand(1.8, 3.6)).toFixed(1),
          pulseDelay: +(rand(-3.0, 0.0)).toFixed(1),
          predict: i % 2 === 1,
        })
      }

      return { main, orbits, planets, farNodes, links }
    })()

    return {
      seed, stars, routes, highlights, scanCenter,
      dustParticles, orbitArcs, connectionLines, energyNodes, radarCenter,
      coreOffset, starMapId, colorTint,
      coreSystem,
    }
  },

  /* ==================== 状态机核心 ==================== */

  /** 统一状态转换 */
  _transition(nextState, options) {
    options = options || {}
    const prev = this.data.baseState
    this._cleanupState(prev)
    const dataPatch = Object.assign({ baseState: nextState }, options.extraData || {})
    this.setData(dataPatch)
    this._updateCockpitStatusByState()
  },

  /** overlay 管理（不影响 baseState） */
  _openOverlay(type) {
    this.setData({ overlayState: type })
  },
  _closeOverlay() {
    this.setData({ overlayState: 'none' })
  },

  /** 按前一状态清理资源 */
  _cleanupState(prevState) {
    if (prevState === 'starting' || prevState === 'calibrating') {
      this._clearFlightTimers()
    }
    if (prevState === 'calibrating') {
      this._clearGeneratingTextState()
    }
    if (prevState === 'completing') {
      this._clearProjectionTimers()
    }
  },

  /* ==================== 校准航行核心 ==================== */

  onTapLaunchCore() {
    if (this.data.baseState !== 'idle') return
    vibrateShort('light')

    if (!this._isMotionEnabled()) {
      this._runId++
      this._calcSettled = false
      this._calcFinishing = false
      this._hideSystemLoadingSafe()
      this._transition('calibrating')
      this._fireApiRequest()
      this._calcAnimDone = true
      this._tryFinishCalc(this._runId)
      return
    }

    this._runIgnitionSequence()
  },

  _runIgnitionSequence() {
    this._abortCurrentFlight({ resetToLaunch: false })
    this._hideSystemLoadingSafe()
    this._runId++
    this._calcSettled = false
    this._calcFinishing = false

    const runId = this._runId

    // 进入 starting
    this._transition('starting')
    this._fireApiRequest()

    // 启动 HUD 计时器
    this._startTime = Date.now()
    this.setData({ calibrationTime: '0.0' })
    this._timeTimer = setInterval(() => {
      const elapsed = ((Date.now() - this._startTime) / 1000).toFixed(1)
      this.setData({ calibrationTime: elapsed })
    }, 100)

    // T=600ms: starting → calibrating
    const t1 = setTimeout(() => {
      if (runId !== this._runId) return
      this._transition('calibrating')

      // 校准阶段文案循环：同步星图、锁定轨道、推演路径、写入结果
      const phases = ['同步星图', '锁定轨道', '推演路径', '写入结果']
      let phaseIdx = 0
      this.setData({ calibrationText: phases[0] })
      this._calibrationTimer = setInterval(() => {
        phaseIdx = Math.min(phaseIdx + 1, phases.length - 1)
        this.setData({ calibrationText: phases[phaseIdx] })
      }, 2000)
    }, 600)

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
    this.setData({
      forcePending: false,
      error: null,
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

    if (!animReady) {
      const retryTimer = setTimeout(() => {
        this._tryFinishCalc(runId)
      }, Math.max(0, 2400 - elapsed))
      this._calcTimers.push(retryTimer)
      return
    }
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
    // 稳定度：根据 buff/debuff 比例计算视觉百分比
    const buffCount = (strategy.buffs || []).length
    const debuffCount = (strategy.debuffs || []).length
    const stabilityPercent = debuffCount === 0
      ? Math.min(65 + buffCount * 8, 92)
      : Math.max(40, Math.min(85, 65 + (buffCount - debuffCount) * 10))
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
      stabilityPercent,
    }
  },

  /** 错误态回退：回到完整待机态 */
  _failCalc(message) {
    this._resetLoadingState()
    this._hideSystemLoadingSafe()
    this._calcSettled = true
    this._clearCalcTimers()
    this._clearGeneratingTextState()
    this.setData({
      error: null,
      coreCompact: false,
      firstEnter: false,
      _ignitionEntered: true,
    })
    this._transition('idle')
    wx.showToast({ title: sanitizeStrategyText(message) || '导航计算响应超时，请稍后再试', icon: 'none' })
  },

  _enterResultReveal(runId, viewState) {
    if (runId !== this._runId) return

    this._resetLoadingState()
    this._hideSystemLoadingSafe()
    this._clearCalcTimers()
    this._clearLongWaitTimers()
    this._stopHeartbeat()

    if (!this._isMotionEnabled()) {
      this.setData(Object.assign({
        baseState: 'completed',
        coreCompact: true,
      }, viewState))
      this._updateCockpitStatusByState()
      return
    }

    // 进入 completing 转场（700ms）
    this._transition('completing', { extraData: viewState })

    // T=700ms: completing → completed
    const doneTimer = setTimeout(() => {
      if (runId !== this._runId) return
      this._resetLoadingState()
      this._hideSystemLoadingSafe()
      this.setData({
        baseState: 'completed',
        coreCompact: true,
        projectingResult: false,
      })
      this._updateCockpitStatusByState()
    }, 700)

    this._projectionTimers.push(doneTimer)
  },

  /* ==================== 统一清理 ==================== */

  /** 中断当前校准流程 */
  _abortCurrentFlight(options) {
    options = options || {}
    this._resetLoadingState()
    this._hideSystemLoadingSafe()
    this._clearFlightTimers()
    this._clearCalcTimers()
    this._clearProjectionTimers()
    this._resetCalcFlags()
    this._clearGeneratingTextState()

    if (options.resetToLaunch) {
      const seed = createStarMapSeed()
      this.setData({
        baseState: 'idle',
        starMapSeed: seed,
        starMap: this._generateStarMap(seed),
        oldStarMap: null,
        projectingResult: false,
        coreCompact: false,
        firstEnter: false,
        _ignitionEntered: true,
        phase: '',
        posterPath: '',
        posterError: '',
        overlayState: 'none',
      })
      this._updateCockpitStatusByState()
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setData({ hidden: false, selected: 1 });
      }
    }
  },

  _clearFlightTimers() {
    if (this._flightTimers && this._flightTimers.forEach) {
      this._flightTimers.forEach(t => clearTimeout(t))
    }
    this._flightTimers = []
  },

  _clearCalcTimers() {
    if (this._calcTimers && this._calcTimers.forEach) {
      this._calcTimers.forEach(t => clearTimeout(t))
    }
    this._calcTimers = []
    if (this._apiTimeoutTimer) { clearTimeout(this._apiTimeoutTimer); this._apiTimeoutTimer = null }
    this._clearLongWaitTimers()
  },

  _clearProjectionTimers() {
    if (this._projectionTimers && this._projectionTimers.forEach) {
      this._projectionTimers.forEach(t => clearTimeout(t))
    }
    this._projectionTimers = []
  },

  _resetCalcFlags() {
    this._calcAnimDone = false
    this._calcApiDone = false
    this._calcResult = null
    this._calcFinishing = false
    this._calcSettled = false
  },

  /* ===== heartbeat 已废弃，保留方法签名防调用报错 ===== */
  _startHeartbeat() {
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
  },

  /* ===== 长等待守卫（配合后端 25s LLM 上限） ===== */
  _startLongWaitGuard(runId) {
    this._clearLongWaitTimers()

    // 30 秒：前端兜底（晚于后端 25s）
    const t4 = setTimeout(() => {
      if (!this._isRunActive(runId) || this._calcApiDone) return
      this._failCalc('导航计算响应超时，请稍后再试')
    }, 30000)
    this._longWaitTimers.push(t4)
  },

  /** 统一设置等待主文案（已无 UI 消费，保留方法签名防调用报错） */
  _setGenerationStatus() {},

  _clearGeneratingTextState() {
    if (this._calibrationTimer) {
      clearInterval(this._calibrationTimer)
      this._calibrationTimer = null
    }
    if (this._timeTimer) {
      clearInterval(this._timeTimer)
      this._timeTimer = null
    }
    this.setData({
      calibrationText: '',
      calibrationTime: '0.0'
    })
    this._stopHeartbeat()
  },

  /** 清理所有生成中视觉状态 */
  _clearGeneratingVisualState() {
    this._stopHeartbeat()
  },

  _clearLongWaitTimers() {
    if (this._longWaitTimers && this._longWaitTimers.forEach) {
      this._longWaitTimers.forEach(t => clearTimeout(t))
    }
    this._longWaitTimers = []
  },

  _isRunActive(runId) {
    return runId === this._runId && (this.data.baseState === 'starting' || this.data.baseState === 'calibrating')
  },

  /* ==================== result → 重新生成星图弹窗 ==================== */

  onTapRegenerate() {
    vibrateShort('light')
    this._openOverlay('confirmRegenerate')
  },

  onCancelRegenerate() {
    this._closeOverlay()
  },

  onConfirmRegenerate() {
    vibrateShort('light')
    // 1. 关闭弹窗
    this._closeOverlay()
    // 2. 保留旧星图用于 crossfade
    const oldMap = this.data.starMap
    this.setData({ oldStarMap: oldMap })
    // 3. 清除旧结果
    try { wx.removeStorageSync('strategy_result') } catch (e) {}
    this._abortCurrentFlight({ resetToLaunch: false })
    this._clearGeneratingTextState()
    // 4. 生成新 seed + 新星图
    const newSeed = createStarMapSeed()
    this._transition('regenerating', {
      extraData: {
        starMapSeed: newSeed,
        starMap: this._generateStarMap(newSeed),
        strategy: null,
        directiveText: '',
        strategyTheme: '',
        strategySummary: '',
        sourceLabel: '待同步',
        solarTermLabel: '待同步',
        userTagLabel: '待同步',
        userTagColor: '#0A84FF',
        themeColor: '#0A84FF',
        targetDistance: '2.4',
        nextRefreshAtEpochMs: 0,
        coreCompact: false,
        projectingResult: false,
        phase: '',
        posterPath: '',
        posterError: '',
        error: null,
        forcePending: true,
      }
    })
    // 5. T=800ms 清除旧星图，进入 idle
    const t = setTimeout(() => {
      this.setData({ oldStarMap: null })
      this._transition('idle')
    }, 800)
    this._flightTimers.push(t)
  },

  /* ==================== 分享指令 ==================== */

  onTapGeneratePoster() {
    vibrateShort('light')
    this._openOverlay('share')
    this.setData({ phase: 'poster_generating', posterError: '' })
    // TabBar 在 overlay 完全入场后再隐藏
    setTimeout(() => {
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setData({ hidden: true })
      }
      this._renderPosterCanvas()
    }, 400)
  },

  _renderPosterCanvas(retryCount) {
    retryCount = retryCount || 0
    const query = wx.createSelectorQuery().in(this)
    query.select('#posterCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        if (retryCount < 2) {
          console.warn('[poster] canvas node not ready, retry', retryCount + 1)
          setTimeout(() => this._renderPosterCanvas(retryCount + 1), 300)
          return
        }
        this.setData({ phase: 'poster_error', posterError: '画布初始化失败' })
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
          this.getTabBar().setData({ hidden: false, selected: 1 });
        }
        return
      }

      const canvas = res[0].node
      const dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2
      const W = 750
      const H = 1050

      canvas.width = W * dpr
      canvas.height = H * dpr
      const ctx = canvas.getContext('2d')
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
      } catch (bgErr) {
        console.error('[poster] _drawPosterBg failed:', bgErr && bgErr.message, bgErr && bgErr.stack)
        this.setData({ phase: 'poster_error', posterError: '背景绘制失败' })
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
          this.getTabBar().setData({ hidden: false, selected: 1 });
        }
        return
      }

      try {
        this._drawPosterContent(ctx, W, H, s)
      } catch (e) {
        console.error('[poster] _drawPosterContent failed:', e && e.message, e && e.stack)
        this.setData({ phase: 'poster_error', posterError: '内容绘制失败' })
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

  /** 海报背景：深空星图终端 HUD 风格 */
  _drawPosterBg(ctx, W, H) {
    const map = this.data.starMap || {}

    // 1. Deep black base
    ctx.fillStyle = '#040810'
    ctx.fillRect(0, 0, W, H)

    // 2. Multi-layer radial glows
    // Blue glow from top-left
    const g1 = ctx.createRadialGradient(150, 80, 0, 150, 80, 500)
    g1.addColorStop(0, 'rgba(10,132,255,0.18)')
    g1.addColorStop(1, 'rgba(10,132,255,0)')
    ctx.fillStyle = g1
    ctx.fillRect(0, 0, W, H)

    // Green glow from bottom-right
    const g2 = ctx.createRadialGradient(W - 100, H - 180, 0, W - 100, H - 180, 400)
    g2.addColorStop(0, 'rgba(50,215,75,0.10)')
    g2.addColorStop(1, 'rgba(50,215,75,0)')
    ctx.fillStyle = g2
    ctx.fillRect(0, 0, W, H)

    // Subtle center glow
    const g3 = ctx.createRadialGradient(W / 2, H * 0.24, 0, W / 2, H * 0.24, 300)
    g3.addColorStop(0, 'rgba(0,190,255,0.06)')
    g3.addColorStop(1, 'rgba(0,190,255,0)')
    ctx.fillStyle = g3
    ctx.fillRect(0, 0, W, H)

    // 3. Horizontal scan lines (very faint, every 5px)
    ctx.strokeStyle = 'rgba(255,255,255,0.015)'
    ctx.lineWidth = 1
    for (let sy = 0; sy < H; sy += 5) {
      ctx.beginPath()
      ctx.moveTo(0, sy)
      ctx.lineTo(W, sy)
      ctx.stroke()
    }

    // 4. Full-page star map
    try {
      // Dust particles
      (map.dustParticles || []).forEach(function (d) {
        var dx = d.x / 100 * W
        var dy = d.y / 100 * H
        var dr = Math.max(d.size, 0.5)
        ctx.fillStyle = 'rgba(180,210,240,' + d.opacity + ')'
        ctx.beginPath()
        ctx.arc(dx, dy, dr, 0, Math.PI * 2)
        ctx.fill()
      })

      // Orbit arcs (save/translate/scale/arc/restore — no ctx.ellipse)
      (map.orbitArcs || []).forEach(function (arc) {
        var cx = arc.cx / 100 * W
        var cy = arc.cy / 100 * H
        var rx = Math.max(arc.rx / 100 * W, 1)
        var ry = Math.max(arc.ry / 100 * H, 1)
        var rot = (arc.rotation || 0) * Math.PI / 180
        ctx.strokeStyle = 'rgba(0,200,255,' + arc.opacity + ')'
        ctx.lineWidth = 1
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(rot)
        ctx.scale(1, ry / rx)
        ctx.beginPath()
        ctx.arc(0, 0, rx, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      })

      // Connection lines (thin gradient lines between star pairs)
      (map.connectionLines || []).forEach(function (cl) {
        var startX = cl.x1 / 100 * W
        var startY = cl.y1 / 100 * H
        var angle = cl.angle * Math.PI / 180
        var len = cl.length / 100 * Math.max(W, H) * 0.5
        var endX = startX + Math.cos(angle) * len
        var endY = startY + Math.sin(angle) * len
        var grad = ctx.createLinearGradient(startX, startY, endX, endY)
        grad.addColorStop(0, 'rgba(0,200,255,0)')
        grad.addColorStop(0.5, 'rgba(0,200,255,' + cl.opacity + ')')
        grad.addColorStop(1, 'rgba(0,200,255,0)')
        ctx.strokeStyle = grad
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        ctx.stroke()
      })

      // Star points with glow
      (map.stars || []).forEach(function (star) {
        var sx = star.x / 100 * W
        var sy = star.y / 100 * H
        var sr = Math.max(star.size / 5 * 3, 0.5)
        // Outer glow
        var gg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 3)
        gg.addColorStop(0, 'rgba(200,230,255,' + (star.opacity * 0.4) + ')')
        gg.addColorStop(1, 'rgba(200,230,255,0)')
        ctx.fillStyle = gg
        ctx.beginPath()
        ctx.arc(sx, sy, sr * 3, 0, Math.PI * 2)
        ctx.fill()
        // Core dot
        ctx.fillStyle = 'rgba(220,240,255,' + star.opacity + ')'
        ctx.beginPath()
        ctx.arc(sx, sy, sr, 0, Math.PI * 2)
        ctx.fill()
      })

      // Highlights / glow spots
      (map.highlights || []).forEach(function (hl) {
        var hx = hl.x / 100 * W
        var hy = hl.y / 100 * H
        var hr = Math.max(hl.size / 140 * W * 0.3, 1)
        var hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr)
        hg.addColorStop(0, 'rgba(0,200,255,' + hl.opacity + ')')
        hg.addColorStop(1, 'rgba(0,200,255,0)')
        ctx.fillStyle = hg
        ctx.fillRect(hx - hr, hy - hr, hr * 2, hr * 2)
      })

      // Energy nodes
      (map.energyNodes || []).forEach(function (node) {
        var nx = node.x / 100 * W
        var ny = node.y / 100 * H
        var nr = Math.max(node.size, 1)
        // Outer pulse ring
        ctx.strokeStyle = 'rgba(0,200,255,0.12)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(nx, ny, nr * 2.5, 0, Math.PI * 2)
        ctx.stroke()
        // Inner core
        var ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr)
        ng.addColorStop(0, 'rgba(0,230,255,0.5)')
        ng.addColorStop(1, 'rgba(0,200,255,0)')
        ctx.fillStyle = ng
        ctx.beginPath()
        ctx.arc(nx, ny, nr, 0, Math.PI * 2)
        ctx.fill()
      })

      // Scan wave rings at scanCenter / radarCenter
      var sc = map.scanCenter || map.radarCenter || { x: 50, y: 50 }
      var scx = sc.x / 100 * W
      var scy = sc.y / 100 * H
      var ringRadii = [30, 60, 95]
      for (var ri = 0; ri < ringRadii.length; ri++) {
        ctx.strokeStyle = 'rgba(0,200,255,' + (0.08 - ri * 0.02) + ')'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(scx, scy, ringRadii[ri], 0, Math.PI * 2)
        ctx.stroke()
      }

      // ORIGIN planet (bottom-left area)
      var ox = W * 0.15
      var oy = H * 0.78
      var og = ctx.createRadialGradient(ox, oy, 0, ox, oy, 20)
      og.addColorStop(0, 'rgba(10,132,255,0.7)')
      og.addColorStop(1, 'rgba(10,132,255,0)')
      ctx.fillStyle = og
      ctx.beginPath()
      ctx.arc(ox, oy, 20, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(10,132,255,0.85)'
      ctx.beginPath()
      ctx.arc(ox, oy, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(10,132,255,0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(ox, oy, 14, 0, Math.PI * 2)
      ctx.stroke()

      // TARGET planet (top-right area)
      var tx = W * 0.85
      var ty = H * 0.22
      var tc = this.data.themeColor || '#32D74B'
      var tg = ctx.createRadialGradient(tx, ty, 0, tx, ty, 22)
      tg.addColorStop(0, hexWithAlpha(tc, 'AA'))
      tg.addColorStop(1, hexWithAlpha(tc, '00'))
      ctx.fillStyle = tg
      ctx.beginPath()
      ctx.arc(tx, ty, 22, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = hexWithAlpha(tc, 'DD')
      ctx.beginPath()
      ctx.arc(tx, ty, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = hexWithAlpha(tc, '55')
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(tx, ty, 16, 0, Math.PI * 2)
      ctx.stroke()

      // Center dot
      ctx.fillStyle = 'rgba(70,255,145,0.85)'
      ctx.beginPath()
      ctx.arc(W / 2, H * 0.24, 4, 0, Math.PI * 2)
      ctx.fill()
    } catch (mapErr) {
      console.error('[poster] _drawPosterBg star map partial failure:', mapErr && mapErr.message)
    }

    // 5. HUD grid (very faint, only at edges)
    ctx.strokeStyle = 'rgba(0,200,255,0.025)'
    ctx.lineWidth = 0.5
    for (var gx = 0; gx <= 100; gx += 50) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, 80); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(gx, H - 80); ctx.lineTo(gx, H); ctx.stroke()
    }
    for (var gy = 0; gy <= H; gy += 50) {
      if (gy < 80 || gy > H - 80) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(100, gy); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(W - 100, gy); ctx.lineTo(W, gy); ctx.stroke()
      }
    }

    // 6. Corner L-marks
    this._drawCorner(ctx, 36, 36, 1, 1)
    this._drawCorner(ctx, W - 36, 36, -1, 1)
    this._drawCorner(ctx, 36, H - 36, 1, -1)
    this._drawCorner(ctx, W - 36, H - 36, -1, -1)

    // 7. Outer frame line
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
   * 分享卡内容：星图终端 HUD 风格
   *
   * 布局结构（750 x 1050）：
   *   [中央星核装饰]  y: ~180-320
   *   [HUD 数据面板]  y: ~360-880
   *   [底部标识]      y: ~960-1020
   */
  _drawPosterContent(ctx, W, H, s) {
    const padL = 64
    const padR = W - padL
    const contentW = padR - padL

    /* ===== Central star core (decorative, no text) y: ~180-320 ===== */
    var coreX = W / 2
    var coreY = 240
    // Outer glow
    var cg1 = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, 90)
    cg1.addColorStop(0, 'rgba(0,190,255,0.15)')
    cg1.addColorStop(1, 'rgba(0,190,255,0)')
    ctx.fillStyle = cg1
    ctx.beginPath()
    ctx.arc(coreX, coreY, 90, 0, Math.PI * 2)
    ctx.fill()
    // Outer ring
    ctx.strokeStyle = 'rgba(0,200,255,0.18)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(coreX, coreY, 55, 0, Math.PI * 2)
    ctx.stroke()
    // Middle ring
    ctx.strokeStyle = 'rgba(0,200,255,0.10)'
    ctx.beginPath()
    ctx.arc(coreX, coreY, 38, 0, Math.PI * 2)
    ctx.stroke()
    // Inner glow
    var cg2 = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, 20)
    cg2.addColorStop(0, 'rgba(70,255,180,0.85)')
    cg2.addColorStop(0.6, 'rgba(0,200,255,0.3)')
    cg2.addColorStop(1, 'rgba(0,200,255,0)')
    ctx.fillStyle = cg2
    ctx.beginPath()
    ctx.arc(coreX, coreY, 20, 0, Math.PI * 2)
    ctx.fill()
    // Center dot
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.beginPath()
    ctx.arc(coreX, coreY, 3.5, 0, Math.PI * 2)
    ctx.fill()
    // Crosshair lines
    ctx.strokeStyle = 'rgba(0,200,255,0.12)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(coreX - 68, coreY); ctx.lineTo(coreX - 28, coreY); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(coreX + 28, coreY); ctx.lineTo(coreX + 68, coreY); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(coreX, coreY - 68); ctx.lineTo(coreX, coreY - 28); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(coreX, coreY + 28); ctx.lineTo(coreX, coreY + 68); ctx.stroke()

    /* ===== HUD Panel (glassmorphism) y: ~360-880 ===== */
    var panelX = 56
    var panelY = 360
    var panelW = W - 112
    var panelH = 500
    var panelR = 18

    // Panel background
    ctx.fillStyle = 'rgba(3,20,28,0.52)'
    this._roundRect(ctx, panelX, panelY, panelW, panelH, panelR)
    ctx.fill()

    // Panel border
    ctx.strokeStyle = 'rgba(0,190,255,0.12)'
    ctx.lineWidth = 1
    this._roundRect(ctx, panelX, panelY, panelW, panelH, panelR)
    ctx.stroke()

    // Corner decorations (small L-shapes at top-left and bottom-right of panel)
    var cLen = 16
    ctx.strokeStyle = 'rgba(0,200,255,0.38)'
    ctx.lineWidth = 1.5
    // Top-left
    ctx.beginPath()
    ctx.moveTo(panelX + 10, panelY + 10 + cLen)
    ctx.lineTo(panelX + 10, panelY + 10)
    ctx.lineTo(panelX + 10 + cLen, panelY + 10)
    ctx.stroke()
    // Bottom-right
    ctx.beginPath()
    ctx.moveTo(panelX + panelW - 10, panelY + panelH - 10 - cLen)
    ctx.lineTo(panelX + panelW - 10, panelY + panelH - 10)
    ctx.lineTo(panelX + panelW - 10 - cLen, panelY + panelH - 10)
    ctx.stroke()

    // Inner content
    var iy = panelY + 32
    var ix = panelX + 28
    var iw = panelW - 56

    // --- Status capsule: "校准完成" with green dot ---
    ctx.fillStyle = 'rgba(50,215,75,0.72)'
    ctx.beginPath()
    ctx.arc(ix + 6, iy + 2, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(50,215,75,0.55)'
    ctx.font = '15px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('\u6821\u51C6\u5B8C\u6210', ix + 18, iy + 6)

    // Capsule outline
    ctx.strokeStyle = 'rgba(50,215,75,0.22)'
    ctx.lineWidth = 1
    this._roundRect(ctx, ix - 4, iy - 10, 90, 24, 10)
    ctx.stroke()

    iy += 36

    // --- Verdict text (bold 30px, centered) ---
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(230,246,255,0.92)'
    ctx.font = 'bold 30px sans-serif'
    var verdictLines = this._wrapText(ctx, sanitizeStrategyText(s.verdict || ''), iw - 20)
    var maxV = Math.min(verdictLines.length, 2)
    for (var vi = 0; vi < maxV; vi++) {
      ctx.fillText(verdictLines[vi], W / 2, iy + vi * 40)
    }
    iy += maxV * 40 + 10

    // --- Tag pills (small rounded pills) ---
    var allTags = (s.tags || []).map(sanitizeStrategyText)
    if (s.tag && allTags.indexOf(sanitizeStrategyText(s.tag)) === -1) {
      allTags.unshift(sanitizeStrategyText(s.tag))
    }
    if (allTags.length > 0) {
      var tagX = W / 2 - (allTags.length * 70) / 2
      for (var ti = 0; ti < Math.min(allTags.length, 4); ti++) {
        var tw = Math.max(ctx.measureText(allTags[ti]).width + 20, 48)
        ctx.fillStyle = 'rgba(0,190,255,0.08)'
        this._roundRect(ctx, tagX, iy - 12, tw, 24, 12)
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,190,255,0.22)'
        ctx.lineWidth = 1
        this._roundRect(ctx, tagX, iy - 12, tw, 24, 12)
        ctx.stroke()
        ctx.fillStyle = 'rgba(0,200,255,0.65)'
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(allTags[ti], tagX + tw / 2, iy + 4)
        tagX += tw + 10
      }
      iy += 28
    }

    // --- Divider line ---
    iy += 6
    this._drawDivider(ctx, ix + 10, iy, iw - 20)
    iy += 22

    // --- Param section (2-column grid of param cards) ---
    var buffs = (s.buffs || []).map(sanitizeStrategyText).slice(0, 3)
    var debuffs = (s.debuffs || []).map(sanitizeStrategyText).slice(0, 3)
    var cardW = (iw - 16) / 2
    var cardH = 38
    var cardY = iy

    // Left column: buffs
    for (var bi = 0; bi < buffs.length; bi++) {
      // Card background
      ctx.fillStyle = 'rgba(0,190,255,0.04)'
      this._roundRect(ctx, ix, cardY + bi * (cardH + 8), cardW, cardH, 8)
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,190,255,0.08)'
      ctx.lineWidth = 0.5
      this._roundRect(ctx, ix, cardY + bi * (cardH + 8), cardW, cardH, 8)
      ctx.stroke()
      // Green dot
      ctx.fillStyle = 'rgba(80,255,170,0.72)'
      ctx.beginPath()
      ctx.arc(ix + 14, cardY + bi * (cardH + 8) + cardH / 2, 3.5, 0, Math.PI * 2)
      ctx.fill()
      // Text
      ctx.fillStyle = 'rgba(220,240,255,0.80)'
      ctx.font = '16px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(buffs[bi], ix + 26, cardY + bi * (cardH + 8) + cardH / 2 + 5)
    }

    // Right column: debuffs
    for (var di = 0; di < debuffs.length; di++) {
      var dxCol = ix + cardW + 16
      // Card background
      ctx.fillStyle = 'rgba(255,160,60,0.04)'
      this._roundRect(ctx, dxCol, cardY + di * (cardH + 8), cardW, cardH, 8)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,160,60,0.08)'
      ctx.lineWidth = 0.5
      this._roundRect(ctx, dxCol, cardY + di * (cardH + 8), cardW, cardH, 8)
      ctx.stroke()
      // Orange dot
      ctx.fillStyle = 'rgba(255,160,60,0.72)'
      ctx.beginPath()
      ctx.arc(dxCol + 14, cardY + di * (cardH + 8) + cardH / 2, 3.5, 0, Math.PI * 2)
      ctx.fill()
      // Text
      ctx.fillStyle = 'rgba(220,240,255,0.80)'
      ctx.font = '16px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(debuffs[di], dxCol + 26, cardY + di * (cardH + 8) + cardH / 2 + 5)
    }

    var maxRows = Math.max(buffs.length, debuffs.length)
    cardY += maxRows * (cardH + 8) + 16

    // --- Stability bar (thin gradient line) ---
    var stabPct = (this.data.stabilityPercent || 72) / 100
    ctx.fillStyle = 'rgba(160,210,235,0.32)'
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('\u7A33\u5B9A\u5EA6', ix, cardY)
    cardY += 14
    // Track background
    ctx.fillStyle = 'rgba(0,190,255,0.08)'
    this._roundRect(ctx, ix, cardY, iw, 5, 2.5)
    ctx.fill()
    // Filled portion (gradient)
    var stabGrad = ctx.createLinearGradient(ix, cardY, ix + iw * stabPct, cardY)
    stabGrad.addColorStop(0, 'rgba(0,200,255,0.55)')
    stabGrad.addColorStop(1, 'rgba(50,215,75,0.55)')
    ctx.fillStyle = stabGrad
    this._roundRect(ctx, ix, cardY, Math.max(iw * stabPct, 4), 5, 2.5)
    ctx.fill()

    /* ===== Footer y: ~960-1020 ===== */
    // starMapId 标识行
    var mapId = (this.data.starMap && this.data.starMap.starMapId) || ''
    if (mapId) {
      ctx.fillStyle = 'rgba(0,200,255,0.12)'
      ctx.font = '11px Courier New'
      ctx.textAlign = 'center'
      ctx.fillText(mapId, W / 2, H - 60)
    }

    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.font = '12px Courier New'
    ctx.textAlign = 'left'
    ctx.fillText('STAR COMMAND / \u6307\u4EE4\u6863\u6848', padL, H - 36)

    ctx.fillStyle = 'rgba(0,175,255,0.18)'
    this._fillLetterSpacedRight(ctx, 'NAVIGATION CABIN', padR, H - 36)
  },

  /** 分享卡星图缩略图（复用 starMap 数据，增强版） */
  _drawShareStarMap(ctx, x, y, w, h) {
    var map = this.data.starMap
    if (!map) return

    // 星图区域背景
    ctx.fillStyle = 'rgba(2,8,14,0.85)'
    this._roundRect(ctx, x, y, w, h, 16)
    ctx.fill()

    // 边框
    ctx.strokeStyle = 'rgba(0,200,255,0.12)'
    ctx.lineWidth = 1
    this._roundRect(ctx, x, y, w, h, 16)
    ctx.stroke()

    // clip 到圆角区域
    ctx.save()
    this._roundRect(ctx, x, y, w, h, 16)
    ctx.clip()

    try {
      // 网格线（轻量）
      ctx.strokeStyle = 'rgba(0,200,255,0.04)'
      ctx.lineWidth = 0.5
      for (var gx = x; gx < x + w; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke()
      }
      for (var gy = y; gy < y + h; gy += 40) {
        ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke()
      }

      // 星尘粒子 (dustParticles)
      (map.dustParticles || []).forEach(function (d) {
        var dx = x + d.x / 100 * w
        var dy = y + d.y / 100 * h
        var dr = Math.max(d.size, 0.5)
        ctx.fillStyle = 'rgba(180,210,240,' + d.opacity + ')'
        ctx.beginPath()
        ctx.arc(dx, dy, dr, 0, Math.PI * 2)
        ctx.fill()
      })

      // 光晕 (highlights)
      (map.highlights || []).forEach(function (hl) {
        var hx = x + hl.x / 100 * w
        var hy = y + hl.y / 100 * h
        var hr = Math.max(hl.size / 140 * w * 0.3, 1)
        var hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr)
        hg.addColorStop(0, 'rgba(0,200,255,' + hl.opacity + ')')
        hg.addColorStop(1, 'rgba(0,200,255,0)')
        ctx.fillStyle = hg
        ctx.fillRect(hx - hr, hy - hr, hr * 2, hr * 2)
      })

      // 轨道弧线 (orbitArcs) — save/translate/scale/arc/restore, no ctx.ellipse
      (map.orbitArcs || []).forEach(function (arc) {
        var cx = x + arc.cx / 100 * w
        var cy = y + arc.cy / 100 * h
        var rx = Math.max(arc.rx / 100 * w, 1)
        var ry = Math.max(arc.ry / 100 * h, 1)
        var rot = (arc.rotation || 0) * Math.PI / 180
        ctx.strokeStyle = 'rgba(0,200,255,' + arc.opacity + ')'
        ctx.lineWidth = 1
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(rot)
        ctx.scale(1, ry / rx)
        ctx.beginPath()
        ctx.arc(0, 0, rx, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      })

      // 连接线 (connectionLines) — thin gradient lines
      (map.connectionLines || []).forEach(function (cl) {
        var startX = x + cl.x1 / 100 * w
        var startY = y + cl.y1 / 100 * h
        var angle = cl.angle * Math.PI / 180
        var len = cl.length / 100 * w * 0.5
        var endX = startX + Math.cos(angle) * len
        var endY = startY + Math.sin(angle) * len
        var grad = ctx.createLinearGradient(startX, startY, endX, endY)
        grad.addColorStop(0, 'rgba(0,200,255,0)')
        grad.addColorStop(0.5, 'rgba(0,200,255,' + cl.opacity + ')')
        grad.addColorStop(1, 'rgba(0,200,255,0)')
        ctx.strokeStyle = grad
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        ctx.stroke()
      })

      // 随机航线 (routes)
      (map.routes || []).forEach(function (rt) {
        var startX = x + rt.x1 / 100 * w
        var startY = y + rt.y1 / 100 * h
        var angle = rt.angle * Math.PI / 180
        var len = rt.length / 640 * w
        var endX = startX + Math.cos(angle) * len
        var endY = startY + Math.sin(angle) * len
        var rtGrad = ctx.createLinearGradient(startX, startY, endX, endY)
        rtGrad.addColorStop(0, 'rgba(0,210,255,0.08)')
        rtGrad.addColorStop(0.5, 'rgba(0,210,255,0.22)')
        rtGrad.addColorStop(1, 'rgba(88,255,160,0.28)')
        ctx.strokeStyle = rtGrad
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        ctx.stroke()
      })

      // 主航线（静态版）
      ctx.strokeStyle = 'rgba(0,200,255,0.16)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x + w * 0.2, y + h * 0.7)
      ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.3, x + w * 0.8, y + h * 0.35)
      ctx.stroke()

      // 星点 (stars) with glow
      (map.stars || []).forEach(function (star) {
        var sx = x + star.x / 100 * w
        var sy = y + star.y / 100 * h
        var sr = Math.max(star.size / 5 * 2.5, 0.5)
        // Glow
        var sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.5)
        sg.addColorStop(0, 'rgba(200,230,255,' + (star.opacity * 0.35) + ')')
        sg.addColorStop(1, 'rgba(200,230,255,0)')
        ctx.fillStyle = sg
        ctx.beginPath()
        ctx.arc(sx, sy, sr * 2.5, 0, Math.PI * 2)
        ctx.fill()
        // Core
        ctx.fillStyle = 'rgba(200,230,255,' + star.opacity + ')'
        ctx.beginPath()
        ctx.arc(sx, sy, sr, 0, Math.PI * 2)
        ctx.fill()
      })

      // 能量节点 (energyNodes)
      (map.energyNodes || []).forEach(function (node) {
        var nx = x + node.x / 100 * w
        var ny = y + node.y / 100 * h
        var nr = Math.max(node.size, 1)
        // Outer ring
        ctx.strokeStyle = 'rgba(0,200,255,0.12)'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.arc(nx, ny, nr * 2, 0, Math.PI * 2)
        ctx.stroke()
        // Core gradient
        var ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr)
        ng.addColorStop(0, 'rgba(0,230,255,0.45)')
        ng.addColorStop(1, 'rgba(0,200,255,0)')
        ctx.fillStyle = ng
        ctx.beginPath()
        ctx.arc(nx, ny, nr, 0, Math.PI * 2)
        ctx.fill()
      })

      // 扫描波纹（静态圆环）
      var sc = map.scanCenter || map.radarCenter
      if (sc) {
        var scx = x + sc.x / 100 * w
        var scy = y + sc.y / 100 * h
        var ringRadii = [28, 18, 10]
        for (var ri = 0; ri < ringRadii.length; ri++) {
          ctx.strokeStyle = 'rgba(0,200,255,' + (0.10 - ri * 0.025) + ')'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(scx, scy, ringRadii[ri], 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      // ORIGIN 星体
      var ox = x + w * 0.2
      var oy = y + h * 0.7
      var og = ctx.createRadialGradient(ox, oy, 0, ox, oy, 14)
      og.addColorStop(0, 'rgba(10,132,255,0.7)')
      og.addColorStop(1, 'rgba(10,132,255,0)')
      ctx.fillStyle = og
      ctx.beginPath()
      ctx.arc(ox, oy, 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(10,132,255,0.8)'
      ctx.beginPath()
      ctx.arc(ox, oy, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(10,132,255,0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(ox, oy, 10, 0, Math.PI * 2)
      ctx.stroke()

      // TARGET 星体
      var tx = x + w * 0.8
      var ty = y + h * 0.35
      var tc = this.data.themeColor || '#32D74B'
      var tg = ctx.createRadialGradient(tx, ty, 0, tx, ty, 16)
      tg.addColorStop(0, hexWithAlpha(tc, 'AA'))
      tg.addColorStop(1, hexWithAlpha(tc, '00'))
      ctx.fillStyle = tg
      ctx.beginPath()
      ctx.arc(tx, ty, 16, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = hexWithAlpha(tc, 'BB')
      ctx.beginPath()
      ctx.arc(tx, ty, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = hexWithAlpha(tc, '44')
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(tx, ty, 12, 0, Math.PI * 2)
      ctx.stroke()

      // 中央多行星系统（与页面主视觉同 seed 同布局，缩放至星图区 0.7×）
      this._drawCoreSystem(ctx, x + w * 0.5, y + h * 0.46, Math.min(w, h) / 480 * 0.7)

      // 指示灯
      ctx.fillStyle = 'rgba(0,200,255,0.7)'
      ctx.beginPath()
      ctx.arc(x + 16, y + 16, 3, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = 'rgba(80,255,150,0.7)'
      ctx.beginPath()
      ctx.arc(x + w - 16, y + h - 16, 3, 0, Math.PI * 2)
      ctx.fill()
    } catch (drawErr) {
      console.error('[poster] _drawShareStarMap partial failure:', drawErr && drawErr.message)
    }

    ctx.restore()
  },

  /** 分享卡：绘制中央多行星系统（与页面 coreSystem 同 seed） */
  _drawCoreSystem(ctx, cx, cy, scale) {
    const cs = this.data.starMap && this.data.starMap.coreSystem
    if (!cs) return
    // rpx→海报像素：海报 ctx 已按 750 设计，1rpx ≈ 1 海报 px
    const s = scale
    const planetColors = {
      cyan:   { halo: '92,220,255',  body: ['rgba(170,240,255,0.95)', 'rgba(92,220,255,0.85)']  },
      blue:   { halo: '106,166,255', body: ['rgba(184,214,255,0.95)', 'rgba(106,166,255,0.85)'] },
      teal:   { halo: '95,232,192',  body: ['rgba(179,244,221,0.95)', 'rgba(95,232,192,0.85)']  },
      violet: { halo: '138,130,200', body: ['rgba(197,190,232,0.85)', 'rgba(138,130,200,0.65)'] },
    }

    // 1) 远轨节点
    ;(cs.farNodes || []).forEach((n) => {
      const px = cx + n.x * s
      const py = cy + n.y * s
      const r = Math.max(n.size * s, 0.6)
      ctx.fillStyle = `rgba(180,220,255,${n.opacity})`
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fill()
    })

    // 2) 轨道椭圆（根据 arc 类型选择全弧/半弧/虚线）
    const orbitOriginY = cs.main.y * 0.3 * s
    ;(cs.orbits || []).forEach((o) => {
      const rx = Math.max(o.rx * s, 1)
      const ry = Math.max(o.ry * s, 1)
      const rot = (o.rotation || 0) * Math.PI / 180
      ctx.save()
      ctx.translate(cx, cy + orbitOriginY)
      ctx.rotate(rot)
      ctx.scale(1, ry / rx)
      ctx.strokeStyle = `rgba(140,215,255,${o.opacity})`
      ctx.lineWidth = 1
      if (o.arc === 'dash') {
        if (typeof ctx.setLineDash === 'function') ctx.setLineDash([3, 3])
      }
      ctx.beginPath()
      if (o.arc === 'half') {
        // 半弧：上半（rotate 后的局部坐标系下，0~π）
        ctx.arc(0, 0, rx, Math.PI, Math.PI * 2)
      } else {
        ctx.arc(0, 0, rx, 0, Math.PI * 2)
      }
      ctx.stroke()
      if (o.arc === 'dash' && typeof ctx.setLineDash === 'function') ctx.setLineDash([])
      ctx.restore()
    })

    // 3) 连接线（行星↔主核 / 行星间）
    ;(cs.links || []).forEach((l) => {
      const x1 = cx + l.x1 * s
      const y1 = cy + l.y1 * s
      const len = l.length * s
      const ang = l.angle * Math.PI / 180
      const x2 = x1 + Math.cos(ang) * len
      const y2 = y1 + Math.sin(ang) * len
      const grad = ctx.createLinearGradient(x1, y1, x2, y2)
      grad.addColorStop(0,   'rgba(0,220,255,0)')
      grad.addColorStop(0.5, `rgba(0,220,255,${l.opacity})`)
      grad.addColorStop(1,   'rgba(0,220,255,0)')
      ctx.strokeStyle = grad
      ctx.lineWidth = 0.6
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    })

    // 4) 次级行星
    ;(cs.planets || []).forEach((p) => {
      const px = cx + p.x * s
      const py = cy + p.y * s
      const r = Math.max(p.size * 0.5 * s, 1)
      const cols = planetColors[p.color] || planetColors.cyan
      // 外光晕
      const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 3.5)
      glow.addColorStop(0, `rgba(${cols.halo},${(p.opacity * 0.55).toFixed(2)})`)
      glow.addColorStop(1, `rgba(${cols.halo},0)`)
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(px, py, r * 3.5, 0, Math.PI * 2)
      ctx.fill()
      // 主体
      const body = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, 0, px, py, r)
      body.addColorStop(0, cols.body[0])
      body.addColorStop(1, cols.body[1])
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fill()
    })

    // 5) 主核心：halo + glow + dot
    const mx = cx + cs.main.x * s
    const my = cy + cs.main.y * s
    const haloR = Math.max(cs.main.haloSize * 0.5 * s, 1)
    const glowR = Math.max(cs.main.glowSize * 0.5 * s, 1)
    const dotR  = Math.max(cs.main.dotSize  * 0.5 * s, 1)
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, haloR)
    halo.addColorStop(0, 'rgba(0,200,255,0.06)')
    halo.addColorStop(1, 'rgba(0,200,255,0)')
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(mx, my, haloR, 0, Math.PI * 2)
    ctx.fill()
    const glow = ctx.createRadialGradient(mx, my, 0, mx, my, glowR)
    glow.addColorStop(0, 'rgba(0,215,255,0.30)')
    glow.addColorStop(1, 'rgba(0,180,255,0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(mx, my, glowR, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(0,225,255,0.95)'
    ctx.beginPath()
    ctx.arc(mx, my, dotR, 0, Math.PI * 2)
    ctx.fill()
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
    // 预计算总宽度（含 letter-spacing）
    let totalW = 0
    for (let i = 0; i < chars.length; i++) {
      totalW += ctx.measureText(chars[i]).width + 4
    }
    // 兼容 textAlign='center'：从 x - totalW/2 开始绘制
    let cx = ctx.textAlign === 'center' ? x - totalW / 2 : x
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
    this._closeOverlay()
    this.setData({ phase: '', posterPath: '', posterError: '' })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden: false, selected: 1 });
    }
  },

  onPosterRetry() {
    vibrateShort('light')
    this.setData({ posterError: '', phase: 'poster_generating' })
    setTimeout(() => {
      this._renderPosterCanvas()
    }, 500)
  },

  onPosterCancel() {
    vibrateShort('light')
    this._closeOverlay()
    this.setData({ phase: '', posterPath: '', posterError: '' })
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
    const title = sanitizeStrategyText(`今日指令：${s.tag || '节奏校准'}`)
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
