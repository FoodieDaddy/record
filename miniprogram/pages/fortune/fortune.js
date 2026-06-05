const { get } = require('../../utils/request')
const app = getApp()

/* ===== 战术原型阵列（心理 / 策略主题，非玄学） ===== */
const TACTICAL_CARDS = [
  { id: 0,  name: '开拓者',   archetype: 'THE PIONEER',    meaning: '无畏开局', icon: '○' },
  { id: 1,  name: '操盘手',   archetype: 'THE OPERATOR',   meaning: '掌控全场', icon: '△' },
  { id: 2,  name: '观察者',   archetype: 'THE OBSERVER',   meaning: '洞察先机', icon: '◇' },
  { id: 3,  name: '破局者',   archetype: 'THE BREAKER',    meaning: '逆转乾坤', icon: '☆' },
  { id: 4,  name: '蛰伏者',   archetype: 'THE WATCHER',    meaning: '静待时机', icon: '◎' },
  { id: 5,  name: '压制者',   archetype: 'THE DOMINATOR',  meaning: '势不可挡', icon: '✦' },
  { id: 6,  name: '引路者',   archetype: 'THE GUIDE',      meaning: '命运垂青', icon: '✧' },
  { id: 7,  name: '博弈者',   archetype: 'THE GAMBLER',    meaning: '暗藏变数', icon: '◈' },
  { id: 8,  name: '决策者',   archetype: 'THE DECIDER',    meaning: '光明坦途', icon: '⊕' },
  { id: 9,  name: '终审者',   archetype: 'THE JUDGE',      meaning: '终见分晓', icon: '⋈' },
]

/** 随机抽取 5 张不重复的战术盲盒 */
function drawTacticalCards() {
  const pool = TACTICAL_CARDS.slice()
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 5)
}

// ===== 终端日志：过程日志（按序输出） =====
const PROCESS_LOGS = [
  { msg: 'BOOT SEQUENCE INITIATED...', type: 'info' },
  { msg: '[SYS] 加载策略内核模块 (KERNEL v4.1.0)...', type: 'info' },
  { msg: 'MEMORY ALLOCATION: 0x9A2C7D00 // 推演缓存区已锁定', type: 'info' },
  { msg: '[INIT] 挂载决策引擎 /dev/strategy [OK]', type: 'success' },
  { msg: '[ENV] 正在同步对局数据坐标系 (MATCH_DB)...', type: 'info' },
  { msg: '[ENV] 校准行为分析模块 BEHAVIOR v3.2...', type: 'info' },
  { msg: '[WARN] 检测到缓存层数据陈旧，执行 BYPASS...', type: 'warn' },
  { msg: '[ENV] 解密近期对局数据流 MATCH_STREAM... [OK]', type: 'success' },
  { msg: '[SCAN] 扫描玩家积分波动偏移量...', type: 'info' },
  { msg: '[SCAN] 近期分值波动幅度: +/-327.68 // DEVIATION', type: 'info' },
  { msg: '[FIELD] 分析策略向量场 STRATEGY_VECTOR...', type: 'info' },
  { msg: '[MODEL] 计算概率分布与贝叶斯推断...', type: 'info' },
  { msg: '[FIELD] 场域分析完成 VECTOR_NORM=0.97 [OK]', type: 'success' },
  { msg: '[AIGC] 启动 Agent 推理任务 TASK_ID=0xB3E1...', type: 'info' },
  { msg: '[AIGC] 神经网络推理引擎 INFERENCE_ENGINE 就绪', type: 'info' },
  { msg: '[AIGC] 算力倾注：深度推演多重策略分支...', type: 'info' },
  { msg: '[AIGC] 正在评估风险/收益矩阵 RISK_MATRIX...', type: 'info' },
  { msg: '[AIGC] 解析玩家近期对局行为模式 PATTERN...', type: 'info' },
  { msg: '[AIGC] 交叉验证心理画像 x 战术偏好 x 状态因子...', type: 'info' },
]

// ===== 终端日志：拖延日志（动态生成） =====
function hex8() { return Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, '0') }
function randAlphaNum(len) { return Math.random().toString(36).substring(2, 2 + len).toUpperCase() }

function generateStallLog() {
  const templates = [
    () => ({ msg: `[WARN] 推理引擎高负荷运转 CPU_LOAD: ${(85 + Math.random() * 14).toFixed(1)}%`, type: 'warn' }),
    () => ({ msg: `[BRANCH] 解析多重策略分支 0x${hex8()}... 尚未收敛`, type: 'info' }),
    () => ({ msg: `[GATEWAY] 动态路由寻址中... 命中可用推理节点 NACOS_ID: ${randAlphaNum(6)}`, type: 'info' }),
    () => ({ msg: `[STREAM] 持续消费对局事件流 TOPIC_STRATEGY | OFFSET: ${Math.floor(Math.random() * 900000 + 100000)}`, type: 'info' }),
    () => ({ msg: `[CACHE] 离线演算穿透，触发内存淘汰机制 LRU_KEY: 0x${hex8()}`, type: 'warn' }),
    () => ({ msg: `[AIGC] 持续推演策略时间线... 累计词元吞吐 TOKENS: ${Math.floor(Math.random() * 4096 + 1024)}`, type: 'info' }),
    () => ({ msg: `[VISION] 提取多模态行为特征矩阵 | CONFIDENCE: ${(0.85 + Math.random() * 0.14).toFixed(3)}`, type: 'info' }),
    () => ({ msg: `[RPC] 维持跨节点推理通信链路 | LATENCY: ${Math.floor(Math.random() * 45 + 5)}ms`, type: 'info' }),
    () => ({ msg: `>>> DATA_STREAM: ${randAlphaNum(10)}...`, type: 'info' }),
    () => ({ msg: `[TRACE] 分布式链路追踪 SPAN_ID: ${randAlphaNum(8)}-${randAlphaNum(4)}`, type: 'info' }),
    () => ({ msg: `[WARN] 算力调度器触发熔断降级 FALLBACK_CHAIN: ${randAlphaNum(6)}`, type: 'warn' }),
    () => ({ msg: `[REBALANCE] 推理节点重平衡 IN_PROGRESS | PARTITION: ${Math.floor(Math.random() * 8)}`, type: 'warn' }),
    () => ({ msg: `[METRICS] 采集推理节点指标 INFERENCE_P99: ${Math.floor(Math.random() * 300 + 200)}ms`, type: 'info' }),
    () => ({ msg: `[HEALTH] 健康检查通过 NODE_PASS: ${Math.floor(Math.random() * 12 + 3)}/15`, type: 'success' }),
  ]
  return templates[Math.floor(Math.random() * templates.length)]()
}

// ===== 终端日志：成功收尾（API 返回后快速输出） =====
const SUCCESS_LOGS = [
  { msg: '[SYNTH] 合成策略输出 STRATEGY_OUTPUT... [OK]', type: 'success' },
  { msg: '[RENDER] 渲染全息战术卡片 HOLO_CARD...', type: 'info' },
  { msg: '[BUFF] 生成增益/减益效果列表...', type: 'info' },
  { msg: 'ALL SYSTEMS NOMINAL // 策略模块就绪', type: 'success' },
  { msg: '[AGENT] 策略推演收敛演算完成 [200 OK]', type: 'success' },
]

Page({
  data: {
    phase: 'draw',        // draw | calc | reveal | error
    animationEnabled: true,
    currentDate: '',
    countdownStr: '00:00:00',

    // Phase 1: 盲抽
    cards: [],
    selectedCardIdx: -1,
    cardFadeOut: false,

    // Phase 2: 推演（赛博终端消散日志）
    logs: [],
    logSliding: false,
    calcFadeOut: false,

    // Phase 3: 揭晓
    strategy: null,
    strategyCard: null,
    typewriterDone: false,

    // 错误态
    error: null,
  },

  _typewriterTimer: null,

  _countdownTimer: null,
  _logTimer: null,
  _logIndex: 0,
  _apiReturned: false,

  onLoad() {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    this.setData({
      animationEnabled: app.globalData.animationEnabled !== false,
      currentDate: `${y}.${m}.${d}`,
    })
    this.checkStrategyCache()
  },

  onShow() {
    this.startCountdown()
  },

  onHide() {
    this.stopCountdown()
  },

  onUnload() {
    this.stopCountdown()
    this.clearLogTimer()
    this._clearTypewriterTimer()
  },

  /* ===== 缓存检查（仅检测已生成的策略数据，不触发新生成） ===== */
  checkStrategyCache() {
    try {
      const today = this.data.currentDate.replace(/\./g, '-')
      const cached = wx.getStorageSync('strategy_result')
      if (cached && cached.date === today && cached.data && cached.data.verdict) {
        this.setData({
          phase: 'reveal',
          strategy: cached.data,
          strategyCard: this._pickRandomCard(),
          typewriterDone: false,
        })
        this._startRevealTypewriter()
        return
      }
    } catch (e) {}
    this.startDraw()
  },

  /* ===== Phase 1: 盲抽仪式 ===== */
  startDraw() {
    this.setData({
      phase: 'draw',
      cards: drawTacticalCards(),
      selectedCardIdx: -1,
      cardFadeOut: false,
      error: null,
    })
  },

  onCardTap(e) {
    const idx = e.currentTarget.dataset.idx
    if (this.data.selectedCardIdx !== -1) return
    if (this.data.phase !== 'draw') return

    try { wx.vibrateShort({ type: 'light' }) } catch (err) {}

    this.setData({
      selectedCardIdx: idx,
      cardFadeOut: true,
    })

    setTimeout(() => {
      this.startCalculation()
    }, 500)
  },

  /* ===== Phase 2: 数据推演（终端日志瀑布流） ===== */
  startCalculation() {
    this._apiReturned = false
    this.setData({
      phase: 'calc',
      calcFadeOut: false,
      logs: [],
      logSliding: false,
    })
    this.startLogStream()

    // 发起策略请求（后端 FortuneController.getTodayFortune）
    // 重新校准时传 force=true，强制跳过 Redis 缓存重新调用大模型
    const params = this._forceRefresh ? { force: true } : undefined
    this._forceRefresh = false
    get('/fortune/today', params).then(data => {
      this._apiReturned = true
      this._strategyResult = data
      this.clearLogTimer()
      this._pushSuccessLogs(() => {
        this._finishCalc({ strategy: data })
      })
    }).catch(err => {
      this._apiReturned = true
      this._strategyError = err.message || '连接中断，请重试'
      this.clearLogTimer()
      this._pushSuccessLogs(() => {
        this._finishCalc({ error: this._strategyError })
      })
    })
  },

  /** 退场：淡出日志遮罩，进入揭晓或错误态 */
  _finishCalc(updates) {
    if (this.data.animationEnabled) {
      this.setData({ calcFadeOut: true })
      setTimeout(() => {
        const idx = this.data.selectedCardIdx
        const card = this.data.cards[idx] || this._pickRandomCard()
        if (updates.error) {
          this.setData({ phase: 'error', error: updates.error, calcFadeOut: false, logs: [] })
        } else {
          // 缓存到本地
          try {
            const today = this.data.currentDate.replace(/\./g, '-')
            wx.setStorageSync('strategy_result', { date: today, data: updates.strategy })
          } catch (e) {}
          this.setData({
            phase: 'reveal',
            strategy: updates.strategy,
            strategyCard: card,
            typewriterDone: false,
            calcFadeOut: false,
            logs: [],
          })
          this._startRevealTypewriter()
        }
      }, 300)
    } else {
      const idx = this.data.selectedCardIdx
      const card = this.data.cards[idx] || this._pickRandomCard()
      if (updates.error) {
        this.setData({ phase: 'error', error: updates.error, logs: [] })
      } else {
        try {
          const today = this.data.currentDate.replace(/\./g, '-')
          wx.setStorageSync('strategy_result', { date: today, data: updates.strategy })
        } catch (e) {}
        this.setData({
          phase: 'reveal',
          strategy: updates.strategy,
          strategyCard: card,
          typewriterDone: false,
          logs: [],
        })
        this._startRevealTypewriter()
      }
    }
  },

  /** 打字机特效：策略面板逐行出现，结束后淡入 CTA */
  _startRevealTypewriter() {
    this._clearTypewriterTimer()
    const s = this.data.strategy || {}
    const buffCount = (s.buffs || []).length
    const debuffCount = (s.debuffs || []).length
    const totalItems = buffCount + debuffCount
    // 最后一行延迟 = 0.5 + totalItems * 0.15 + 0.4，再加动画 0.3s + 缓冲 0.5s
    const lastDelay = 0.5 + totalItems * 0.15 + 0.4
    const totalMs = (lastDelay + 0.8) * 1000
    this._typewriterTimer = setTimeout(() => {
      this.setData({ typewriterDone: true })
    }, totalMs)
  },

  _clearTypewriterTimer() {
    if (this._typewriterTimer) {
      clearTimeout(this._typewriterTimer)
      this._typewriterTimer = null
    }
  },

  // ===== 终端日志瀑布流 =====

  startLogStream() {
    this._logIndex = 0
    this.clearLogTimer()
    this._pushNextProcessLog()
  },

  /** 输出下一条过程日志；打完后进入动态拖延模式 */
  _pushNextProcessLog() {
    if (this._apiReturned) return

    let entry
    if (this._logIndex < PROCESS_LOGS.length) {
      entry = PROCESS_LOGS[this._logIndex++]
    } else {
      entry = generateStallLog()
    }

    this._appendLog(entry)

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
        setTimeout(onDone, 500)
        return
      }
      this._appendLog(SUCCESS_LOGS[i++])
      this._logTimer = setTimeout(push, 80 + Math.floor(Math.random() * 70))
    }
    push()
  },

  /** 追加一条日志，保留最近 6 条，附加消散透明度与模糊 */
  _appendLog(entry) {
    const now = new Date()
    const ts = [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0')
    ].join(':') + '.' + String(now.getMilliseconds()).padStart(3, '0')

    const LOG_MAX = 6
    const raw = this.data.logs.concat({ time: ts, msg: entry.msg, type: entry.type })
    const trimmed = raw.length > LOG_MAX ? raw.slice(raw.length - LOG_MAX) : raw

    // 为每条日志计算消散层级：越新越清晰，越旧越模糊透明
    const len = trimmed.length
    const withFade = trimmed.map((item, i) => {
      const level = len - 1 - i  // 0=最旧, len-1=最新
      const opacity = Math.max(0.12, 0.15 + level * 0.17)
      const blur = Math.max(0, (len - 1 - level) * 0.6)
      return { ...item, opacity: +opacity.toFixed(2), blur: +blur.toFixed(1) }
    })

    this.setData({ logs: withFade })

    // 平滑上推动画：先位移，再归位
    if (!this.data.animationEnabled) return
    if (this.data.logs.length > 1) {
      this.setData({ logSliding: true })
      setTimeout(() => {
        this.setData({ logSliding: false })
      }, 260)
    }
  },

  clearLogTimer() {
    if (this._logTimer) {
      clearTimeout(this._logTimer)
      this._logTimer = null
    }
  },

  /** 缓存命中时随机选一张战术原型 */
  _pickRandomCard() {
    return TACTICAL_CARDS[Math.floor(Math.random() * TACTICAL_CARDS.length)]
  },

  /* ===== Phase 3: 结果操作 ===== */
  closeReveal() {
    this.setData({ phase: 'draw' })
    this.startDraw()
  },

  refreshStrategy() {
    try { wx.removeStorageSync('strategy_result') } catch (e) {}
    this._forceRefresh = true
    this.setData({ phase: 'draw', strategy: null, strategyCard: null })
    this.startDraw()
  },

  onShareStrategy() {
    try { wx.vibrateShort({ type: 'light' }) } catch (err) {}
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] })
  },

  onShareAppMessage() {
    const s = this.data.strategy
    const c = this.data.strategyCard
    if (!s || !c) return {}
    return {
      title: `今日战术灵感：${c.name} · ${s.tag || ''}`,
      path: '/pages/fortune/fortune',
    }
  },

  /* ===== 状态刷新倒计时 ===== */
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

  preventTouchMove() {},
})
