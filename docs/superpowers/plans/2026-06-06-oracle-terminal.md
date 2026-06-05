# Oracle Terminal — 策略灵感终端完整重写 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将策略灵感页从"塔罗抽卡"体验重写为"策略推演终端"体验，后端返回卡牌原型 + 刷新时间，前端完整重写为 6 状态机。

**Architecture:** 后端 FortuneResp 新增 title/subtitle/tags/nextRefreshAt 字段，FortuneServiceImpl 新增卡牌原型池 + Redis TTL 推算。前端 fortune.js/wxml/wxss 完整重写，状态机 idle→generating→success→poster_generating→poster_preview→error。

**Tech Stack:** Java 21, Spring Boot 3.2.5, Redis, 微信小程序原生 (WXML/WXSS/JS), Canvas 2D

---

## Task 1: FortuneResp 新增字段

**Files:**
- Modify: `backend/src/main/java/com/smartrecord/dto/fortune/FortuneResp.java`

- [ ] **Step 1: 添加新字段到 FortuneResp**

在 `FortuneResp.java` 的 `solarTerm` 字段后添加：

```java
@Schema(description = "卡牌中文名", example = "压制者")
private String title;

@Schema(description = "卡牌英文名", example = "THE DOMINATOR")
private String subtitle;

@Schema(description = "策略标签列表", example = "[\"强势\", \"连续\", \"压制\"]")
private List<String> tags;

@Schema(description = "下次可刷新时间 (HH:mm:ss)，null 表示今日已生成", example = "20:30:43")
private String nextRefreshAt;
```

- [ ] **Step 2: 验证后端编译**

Run: `cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/smartrecord/dto/fortune/FortuneResp.java
git commit -m "feat(fortune): FortuneResp 新增 title/subtitle/tags/nextRefreshAt 字段"
```

---

## Task 2: FortuneServiceImpl 卡牌原型池 + nextRefreshAt

**Files:**
- Modify: `backend/src/main/java/com/smartrecord/service/impl/FortuneServiceImpl.java`

- [ ] **Step 1: 添加卡牌原型内部类和池**

在 `FortuneServiceImpl.java` 的 `FALLBACK_POOL` 定义之前，添加：

```java
/** 卡牌原型 */
private static class Archetype {
    final String title;
    final String subtitle;
    final List<String> keywords;
    Archetype(String title, String subtitle, List<String> keywords) {
        this.title = title;
        this.subtitle = subtitle;
        this.keywords = keywords;
    }
}

/** 卡牌原型池：UserTag → 可选原型列表 */
private static final Map<UserTag, List<Archetype>> ARCHETYPE_POOL = new EnumMap<>(UserTag.class);

static {
    ARCHETYPE_POOL.put(UserTag.WINNING_STREAK, List.of(
            new Archetype("压制者", "THE DOMINATOR", List.of("强势", "连续", "压制")),
            new Archetype("开拓者", "THE PIONEER", List.of("主动", "突破", "先手")),
            new Archetype("决策者", "THE DECIDER", List.of("果断", "清晰", "执行"))
    ));
    ARCHETYPE_POOL.put(UserTag.LOSING_STREAK, List.of(
            new Archetype("蛰伏者", "THE WATCHER", List.of("隐忍", "积累", "时机")),
            new Archetype("观察者", "THE OBSERVER", List.of("耐心", "分析", "等待")),
            new Archetype("引路者", "THE GUIDE", List.of("引导", "顺势", "直觉"))
    ));
    ARCHETYPE_POOL.put(UserTag.HIGH_RISK, List.of(
            new Archetype("破局者", "THE BREAKER", List.of("冒险", "反转", "大胆")),
            new Archetype("博弈者", "THE GAMBLER", List.of("变通", "灵活", "博弈")),
            new Archetype("操盘手", "THE OPERATOR", List.of("控制", "节奏", "布局"))
    ));
    ARCHETYPE_POOL.put(UserTag.STABLE, List.of(
            new Archetype("决策者", "THE DECIDER", List.of("果断", "清晰", "执行")),
            new Archetype("观察者", "THE OBSERVER", List.of("耐心", "分析", "等待")),
            new Archetype("终审者", "THE JUDGE", List.of("冷静", "复盘", "总结"))
    ));
}
```

- [ ] **Step 2: 添加卡牌选择方法**

在 `fallbackFortune` 方法之后添加：

```java
/**
 * 根据 UserTag 从原型池中选取卡牌（基于当日日期作为种子保证当日一致）
 */
private Archetype pickArchetype(UserTag userTag) {
    List<Archetype> pool = ARCHETYPE_POOL.getOrDefault(userTag, ARCHETYPE_POOL.get(UserTag.STABLE));
    int index = Math.floorMod(LocalDate.now().hashCode(), pool.size());
    return pool.get(index);
}
```

- [ ] **Step 3: 在 getTodayFortune 中填充卡牌原型字段**

在 `getTodayFortune` 方法中，找到 `// 3. 填充农历/节气字段` 这行注释，在其**上方**添加：

```java
// 2.5 填充卡牌原型
Archetype archetype = pickArchetype(userTag);
result.setTitle(archetype.title);
result.setSubtitle(archetype.subtitle);
result.setTags(archetype.keywords);
```

- [ ] **Step 4: 在 getTodayFortune 中计算 nextRefreshAt**

在 `// 4. 写入缓存` 的 `redisTemplate.opsForValue().set(...)` 之后，添加：

```java
// 4.5 计算下次可刷新时间
try {
    Long ttl = redisTemplate.getExpire(cacheKey, TimeUnit.SECONDS);
    if (ttl != null && ttl > 0) {
        java.time.LocalTime refreshTime = java.time.LocalTime.now().plusSeconds(ttl);
        result.setNextRefreshAt(refreshTime.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss")));
    }
} catch (Exception e) {
    log.warn("计算 nextRefreshAt 失败", e);
}
```

- [ ] **Step 5: 缓存命中时也填充卡牌原型和 nextRefreshAt**

找到缓存命中的 `if (cached != null)` 分支，在 `return resp;` 之前添加：

```java
// 缓存命中时补充卡牌原型（缓存中可能没有）
if (resp.getTitle() == null) {
    UserTag cachedTag = resp.getUserTag() != null ? UserTag.valueOf(resp.getUserTag()) : UserTag.STABLE;
    Archetype cachedArchetype = pickArchetype(cachedTag);
    resp.setTitle(cachedArchetype.title);
    resp.setSubtitle(cachedArchetype.subtitle);
    resp.setTags(cachedArchetype.keywords);
}
// 补充 nextRefreshAt
try {
    Long ttl = redisTemplate.getExpire(cacheKey, TimeUnit.SECONDS);
    if (ttl != null && ttl > 0) {
        java.time.LocalTime refreshTime = java.time.LocalTime.now().plusSeconds(ttl);
        resp.setNextRefreshAt(refreshTime.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss")));
    }
} catch (Exception e) {
    log.warn("缓存命中时计算 nextRefreshAt 失败", e);
}
```

- [ ] **Step 6: 验证后端编译**

Run: `cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/smartrecord/service/impl/FortuneServiceImpl.java
git commit -m "feat(fortune): 后端卡牌原型池 + nextRefreshAt 计算"
```

---

## Task 3: 前端 fortune.js 完整重写

**Files:**
- Rewrite: `miniprogram/pages/fortune/fortune.js`

- [ ] **Step 1: 备份当前文件**

Run: `cp miniprogram/pages/fortune/fortune.js miniprogram/pages/fortune/fortune.js.bak`

- [ ] **Step 2: 写入新的 fortune.js**

完整替换 `miniprogram/pages/fortune/fortune.js`：

```javascript
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
    phase: 'idle',        // idle | generating | success | poster_generating | poster_preview | error
    animationEnabled: true,
    currentDate: '',
    lunarInfo: '',
    countdownText: '',

    // idle 状态
    nextRefreshAt: '',

    // generating 状态
    logs: [],
    step: 0,
    stages: [
      { label: '人格协议同步', done: false },
      { label: '战绩镜像分析', done: false },
      { label: '策略向量构建', done: false },
      { label: '生成最终建议', done: false },
    ],
    stagesDoneCount: 0,
    timeoutLevel: 'normal', // normal | slow | long

    // success 状态
    strategy: null,

    // error 状态
    error: null,

    // poster 状态
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
  _shareImagePath: '',
  _timeoutSlowTimer: null,
  _timeoutLongTimer: null,

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
    this._clearTimeoutTimers()
  },

  onUnload() {
    this._stopCountdown()
    this._clearCalcTimers()
    this._clearTimeoutTimers()
  },

  /* ===== 缓存检查 ===== */
  _checkCache() {
    try {
      const today = this.data.currentDate.replace(/\./g, '-')
      const cached = wx.getStorageSync('strategy_result')
      if (cached && cached.date === today && cached.data && cached.data.verdict) {
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

  /* ===== idle: 点击抽取 ===== */
  onTapDraw() {
    if (this.data.phase !== 'idle') return
    try { wx.vibrateShort({ type: 'light' }) } catch (err) {}
    this._startGenerating()
  },

  /* ===== generating: 开始推演 ===== */
  _startGenerating() {
    this._clearCalcTimers()
    this._clearTimeoutTimers()
    this._calcAnimDone = false
    this._calcApiDone = false
    this._calcResult = null

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

    // 并行：日志动画 + API 调用
    this._runLogAnimation()

    const params = this._forceRefresh ? { force: true } : undefined
    this._forceRefresh = false

    get('/fortune/today', params).then(data => {
      this._calcApiDone = true
      this._calcResult = { strategy: data }
      this._tryFinishGenerating()
    }).catch(err => {
      this._calcApiDone = true
      this._calcResult = { error: err.message || '连接中断，请重试' }
      this._tryFinishGenerating()
    })

    // 超时提示
    this._timeoutSlowTimer = setTimeout(() => {
      if (this.data.phase === 'generating') {
        this.setData({ timeoutLevel: 'slow' })
      }
    }, 5000)
    this._timeoutLongTimer = setTimeout(() => {
      if (this.data.phase === 'generating') {
        this.setData({ timeoutLevel: 'long' })
      }
    }, 10000)
  },

  /** 日志动画 */
  _runLogAnimation() {
    const lines = CALC_LOG_LINES
    let currentStage = -1

    lines.forEach((line, i) => {
      const showTimer = setTimeout(() => {
        if (line.stage !== currentStage) {
          if (currentStage >= 0) {
            this.setData({
              [`stages[${currentStage}].done`]: true,
              stagesDoneCount: this.data.stages.filter(s => s.done).length + 1,
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
        const logs = [...this.data.logs]
        if (logs[i]) {
          logs[i] = { ...logs[i], typing: false }
          this.setData({ logs })
        }
      }, 500 + i * 1200 + 800)
      this._calcTimers.push(typeTimer)
    })

    const doneTimer = setTimeout(() => {
      const lastStage = lines[lines.length - 1].stage
      this.setData({
        [`stages[${lastStage}].done`]: true,
        stagesDoneCount: 4,
      })
      this._calcAnimDone = true
      this._tryFinishGenerating()
    }, 500 + lines.length * 1200 + 200)
    this._calcTimers.push(doneTimer)
  },

  /** 双标记就绪检查 */
  _tryFinishGenerating() {
    if (!this._calcAnimDone || !this._calcApiDone) return

    this.setData({
      [`stages[3].done`]: true,
      stagesDoneCount: 4,
    })

    const finishTimer = setTimeout(() => {
      this._applyResult(this._calcResult)
    }, 600)
    this._calcTimers.push(finishTimer)
  },

  /** 应用结果 */
  _applyResult(result) {
    this._clearTimeoutTimers()

    if (result.error) {
      this.setData({ phase: 'error', error: result.error })
      return
    }

    const s = result.strategy

    // 缓存到本地
    try {
      const today = this.data.currentDate.replace(/\./g, '-')
      wx.setStorageSync('strategy_result', { date: today, data: s })
    } catch (e) {}

    let lunarInfo = ''
    if (s.lunarDate) {
      lunarInfo = s.lunarDate
      if (s.solarTerm) lunarInfo += ' · ' + s.solarTerm
    }

    this.setData({
      phase: 'success',
      strategy: s,
      lunarInfo,
      nextRefreshAt: s.nextRefreshAt || '',
    })
  },

  /* ===== generating: 超时操作 ===== */
  onTapContinueWait() {
    // 继续等待，不做任何操作
  },

  onTapRegenerate() {
    this._forceRefresh = true
    this._clearCalcTimers()
    this._clearTimeoutTimers()
    this._startGenerating()
  },

  /* ===== success: 重新抽取 ===== */
  onTapRefresh() {
    wx.showModal({
      title: '',
      content: '今日策略已生成，重新抽取将覆盖当前结果。',
      confirmText: '重新抽取',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          try { wx.removeStorageSync('strategy_result') } catch (e) {}
          this._forceRefresh = true
          this._startGenerating()
        }
      },
    })
  },

  /* ===== success: 分享策略卡 ===== */
  onTapShare() {
    try { wx.vibrateShort({ type: 'light' }) } catch (err) {}
    this.setData({ phase: 'poster_generating', posterPath: '', posterError: '' })
    setTimeout(() => {
      this._renderPosterCanvas()
    }, 300)
  },

  /* ===== poster: Canvas 渲染 ===== */
  _renderPosterCanvas() {
    const query = wx.createSelectorQuery().in(this)
    query.select('#posterCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        this.setData({ phase: 'success', posterError: '生成失败' })
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
        this.setData({ phase: 'success', posterError: '数据异常' })
        return
      }

      // === 背景 ===
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

      // === 霓虹边框 ===
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.25)'
      ctx.lineWidth = 3
      ctx.shadowColor = 'rgba(0, 175, 255, 0.3)'
      ctx.shadowBlur = 16
      ctx.strokeRect(30, 30, W - 60, H - 60)
      ctx.shadowBlur = 0

      // 内框
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.12)'
      ctx.lineWidth = 1
      ctx.strokeRect(42, 42, W - 84, H - 84)

      // === 顶部标头 ===
      ctx.textAlign = 'center'
      ctx.font = '28px Courier New'
      ctx.fillStyle = 'rgba(0, 175, 255, 0.6)'
      ctx.fillText('SMART RECORD', W / 2, 100)
      ctx.font = '18px Courier New'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.fillText('STRATEGY DOSSIER', W / 2, 132)

      // 分隔线
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.12)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(80, 158)
      ctx.lineTo(W - 80, 158)
      ctx.stroke()

      // === 日期 ===
      ctx.font = '20px Courier New'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.fillText(`[ ${this.data.currentDate} ]`, W / 2, 200)
      if (this.data.lunarInfo) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
        ctx.fillText(this.data.lunarInfo, W / 2, 232)
      }

      // === 中央卡牌区 ===
      const accent = s.glowColor || '#00AFFF'

      // 背景光晕
      ctx.fillStyle = accent
      ctx.globalAlpha = 0.04
      ctx.beginPath()
      ctx.arc(W / 2, 480, 180, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1

      // 原型中文名
      ctx.font = 'bold 56px sans-serif'
      ctx.fillStyle = '#FFFFFF'
      ctx.textBaseline = 'middle'
      ctx.fillText(s.title || '策略', W / 2, 460)
      ctx.textBaseline = 'alphabetic'

      // 英文名
      ctx.font = '22px Courier New'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
      ctx.letterSpacing = '4px'
      ctx.fillText(s.subtitle || '', W / 2, 510)

      // 分隔线
      ctx.strokeStyle = accent
      ctx.globalAlpha = 0.3
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(W / 2 - 120, 550)
      ctx.lineTo(W / 2 + 120, 550)
      ctx.stroke()
      ctx.globalAlpha = 1

      // === 策略判词 ===
      ctx.font = '32px sans-serif'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.textAlign = 'center'
      const verdictLines = this._wrapText(ctx, s.verdict, W - 200)
      let vy = 610
      verdictLines.forEach(line => {
        ctx.fillText(line, W / 2, vy)
        vy += 48
      })

      // === 关键词标签 ===
      const tagY = vy + 30
      const tags = (s.tags || []).map(k => `#${k}`)
      const tagStr = tags.join('  ')
      ctx.font = '22px Courier New'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.fillText(tagStr, W / 2, tagY)

      // === 底部分隔线 ===
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.08)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(80, H - 160)
      ctx.lineTo(W - 80, H - 160)
      ctx.stroke()

      // === 底部扫码区域 ===
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.15)'
      ctx.lineWidth = 1
      const qrX = W / 2 - 80
      const qrY = H - 140
      ctx.strokeRect(qrX, qrY, 160, 90)

      // 装饰十字
      ctx.strokeStyle = 'rgba(0, 175, 255, 0.1)'
      ctx.beginPath()
      ctx.moveTo(W / 2 - 20, qrY + 45)
      ctx.lineTo(W / 2 + 20, qrY + 45)
      ctx.moveTo(W / 2, qrY + 25)
      ctx.lineTo(W / 2, qrY + 65)
      ctx.stroke()

      ctx.font = '16px Courier New'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.fillText('扫码进入 Smart Record', W / 2, H - 52)

      // === 导出 ===
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
          this.setData({ phase: 'success', posterError: '海报生成失败' })
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

  /* ===== poster: 操作 ===== */
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
          wx.showToast({ title: '保存失败，请检查相册权限', icon: 'none' })
        }
      },
    })
  },

  onSharePoster() {
    this._shareImagePath = this._posterImagePath
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] })
  },

  onClosePoster() {
    this.setData({ phase: 'success', posterPath: '', posterError: '' })
  },

  onPosterRetry() {
    this.setData({ phase: 'poster_generating', posterError: '' })
    setTimeout(() => {
      this._renderPosterCanvas()
    }, 300)
  },

  onPosterCancel() {
    this.setData({ phase: 'success', posterPath: '', posterError: '' })
  },

  noop() {},

  onShareAppMessage() {
    const s = this.data.strategy
    if (!s) return {}
    const result = {
      title: `今日策略：${s.title || ''} · ${s.tag || ''}`,
      path: '/pages/fortune/fortune',
    }
    if (this._shareImagePath) {
      result.imageUrl = this._shareImagePath
      this._shareImagePath = null
    }
    return result
  },

  /* ===== 倒计时 ===== */
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
    const nextRefresh = this.data.nextRefreshAt
    if (!nextRefresh) {
      this.setData({ countdownText: '' })
      return
    }

    const now = new Date()
    const parts = nextRefresh.split(':')
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
      parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]))

    let diff = Math.max(0, Math.floor((target - now) / 1000))
    if (diff <= 0) {
      this.setData({ countdownText: '可刷新' })
      return
    }
    const h = String(Math.floor(diff / 3600)).padStart(2, '0')
    diff %= 3600
    const m = String(Math.floor(diff / 60)).padStart(2, '0')
    const s = String(diff % 60).padStart(2, '0')
    this.setData({ countdownText: `${h}:${m}:${s}` })
  },

  /* ===== 工具方法 ===== */
  _clearCalcTimers() {
    this._calcTimers.forEach(t => clearTimeout(t))
    this._calcTimers = []
  },

  _clearTimeoutTimers() {
    if (this._timeoutSlowTimer) { clearTimeout(this._timeoutSlowTimer); this._timeoutSlowTimer = null }
    if (this._timeoutLongTimer) { clearTimeout(this._timeoutLongTimer); this._timeoutLongTimer = null }
  },

  preventTouchMove() {},
})
```

- [ ] **Step 3: 删除备份文件**

Run: `rm miniprogram/pages/fortune/fortune.js.bak`

- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/fortune/fortune.js
git commit -m "feat(fortune): 前端 fortune.js 完整重写为 6 状态机"
```

---

## Task 4: 前端 fortune.wxml 完整重写

**Files:**
- Rewrite: `miniprogram/pages/fortune/fortune.wxml`

- [ ] **Step 1: 写入新的 fortune.wxml**

完整替换 `miniprogram/pages/fortune/fortune.wxml`：

```xml
<scroll-view class="page-container {{!animationEnabled ? 'reduce-motion' : ''}}" scroll-y="{{phase !== 'generating'}}" enhanced show-scrollbar="{{false}}">

  <!-- idle: 未抽取状态 -->
  <view class="idle-screen" wx:if="{{phase === 'idle'}}">
    <view class="idle-header">
      <view class="page-kicker">SMART RECORD · STRATEGY</view>
      <view class="page-date">[ {{currentDate}} ]</view>
      <view class="page-lunar" wx:if="{{lunarInfo}}">{{lunarInfo}}</view>
    </view>

    <view class="section-title-row">
      <view class="section-divider"></view>
      <view class="section-title">今日策略</view>
      <view class="section-divider"></view>
    </view>

    <view class="card-stage" bindtap="onTapDraw">
      <view class="oracle-card">
        <view class="card-inner">
          <view class="card-ring card-ring--1"></view>
          <view class="card-ring card-ring--2"></view>
          <view class="card-ring card-ring--3"></view>
          <view class="card-dot"></view>
        </view>
      </view>
      <view class="scan-ring scan-ring--idle"></view>
      <view class="tap-hint">点击抽取</view>
    </view>

    <view class="idle-info">
      <view class="idle-info-label">系统将结合：</view>
      <view class="idle-info-tags">人格协议 · 战绩镜像 · 历史行为</view>
    </view>

    <view class="countdown-bar" wx:if="{{countdownText}}">
      <text class="countdown-label">下一次策略更新：</text>
      <text class="countdown-value">{{countdownText}}</text>
    </view>
  </view>

  <!-- generating: 推演中 -->
  <view class="gen-screen {{genFadeOut ? 'gen-fade-out' : ''}}" wx:if="{{phase === 'generating'}}">
    <view class="gen-card-area">
      <view class="gen-card gen-card--breathing">
        <view class="card-inner">
          <view class="card-ring card-ring--1"></view>
          <view class="card-ring card-ring--2"></view>
          <view class="card-ring card-ring--3"></view>
          <view class="card-dot"></view>
        </view>
      </view>
      <view class="scan-ring scan-ring--gen"></view>
    </view>

    <view class="gen-title-block">
      <text class="gen-main-title">正在推演今日策略</text>
      <text class="gen-sub-title">系统正在结合人格协议与历史行为模型，生成最优行动建议</text>
    </view>

    <!-- 阶段清单 -->
    <view class="gen-checklist">
      <view class="gen-check-item {{item.done ? 'gen-check-item--done' : ''}}"
            wx:for="{{stages}}" wx:key="index">
        <text class="gen-check-mark">{{item.done ? '✓' : (index === step ? '...' : '·')}}</text>
        <text class="gen-check-label">{{item.label}}</text>
      </view>
      <view class="gen-check-count">{{stagesDoneCount}} / 4</view>
    </view>

    <!-- 终端日志 -->
    <view class="gen-terminal">
      <view class="gen-log-line {{item.visible ? 'gen-log-line--visible' : ''}}"
            wx:for="{{logs}}" wx:key="index">
        <text class="gen-log-prefix">{{item.prefix}}</text>
        <text class="gen-log-text {{item.typing ? 'gen-log-typing' : ''}}">{{item.text}}</text>
      </view>
    </view>

    <!-- 超时提示 -->
    <view class="gen-timeout" wx:if="{{timeoutLevel === 'slow'}}">
      <text class="gen-timeout-text">推演仍在进行，请稍候</text>
    </view>
    <view class="gen-timeout gen-timeout--long" wx:if="{{timeoutLevel === 'long'}}">
      <text class="gen-timeout-text">推演耗时较长，可继续等待或重新发起</text>
      <view class="gen-timeout-actions">
        <view class="gen-timeout-btn" bindtap="onTapContinueWait">继续等待</view>
        <view class="gen-timeout-btn gen-timeout-btn--primary" bindtap="onTapRegenerate">重新推演</view>
      </view>
    </view>
  </view>

  <!-- success: 结果展示 -->
  <view class="success-screen" wx:if="{{phase === 'success'}}">
    <view class="success-header">
      <view class="page-kicker">SMART RECORD · STRATEGY</view>
      <view class="page-date">[ {{currentDate}} ]</view>
      <view class="page-lunar" wx:if="{{lunarInfo}}">{{lunarInfo}}</view>
    </view>

    <view class="section-title-row">
      <view class="section-divider"></view>
      <view class="section-title">今日策略</view>
      <view class="section-divider"></view>
    </view>

    <!-- 策略卡 -->
    <view class="result-card" style="--accent: {{strategy.glowColor || '#00AFFF'}};">
      <view class="result-card-title">{{strategy.title}}</view>
      <view class="result-card-subtitle">{{strategy.subtitle}}</view>
      <view class="result-card-verdict-label">核心建议：</view>
      <view class="result-card-verdict">{{strategy.verdict}}</view>
      <view class="result-card-divider"></view>
    </view>

    <!-- 标签 -->
    <view class="result-tags">
      <view class="result-tag" wx:for="{{strategy.tags}}" wx:key="index">{{item}}</view>
    </view>

    <!-- 优势 -->
    <view class="result-section" wx:if="{{strategy.buffs && strategy.buffs.length}}">
      <view class="result-section-title">行动优势</view>
      <view class="result-list-item result-list-item--buff" wx:for="{{strategy.buffs}}" wx:key="index">
        <text class="result-list-prefix">+</text>
        <text class="result-list-text">{{item}}</text>
      </view>
    </view>

    <!-- 风险 -->
    <view class="result-section" wx:if="{{strategy.debuffs && strategy.debuffs.length}}">
      <view class="result-section-title">风险提示</view>
      <view class="result-list-item result-list-item--risk" wx:for="{{strategy.debuffs}}" wx:key="index">
        <text class="result-list-prefix">-</text>
        <text class="result-list-text">{{item}}</text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="result-actions">
      <view class="result-btn result-btn--secondary" bindtap="onTapRefresh">重新抽取</view>
      <view class="result-btn result-btn--primary" bindtap="onTapShare">分享策略卡</view>
    </view>

    <!-- 刷新时间 -->
    <view class="countdown-bar" wx:if="{{countdownText}}">
      <text class="countdown-label">下一次策略更新：</text>
      <text class="countdown-value">{{countdownText}}</text>
    </view>
  </view>

  <!-- error: 错误态 -->
  <view class="error-screen" wx:if="{{phase === 'error'}}">
    <view class="error-icon">!</view>
    <view class="error-title">策略推演失败</view>
    <view class="error-text">系统暂时无法生成今日策略</view>
    <view class="error-actions">
      <view class="error-btn" bindtap="onTapRegenerate">重试</view>
    </view>
  </view>

  <!-- poster_generating: 海报生成中 -->
  <view class="poster-mask" wx:if="{{phase === 'poster_generating' || phase === 'poster_preview'}}" catchtap="noop">
    <view class="poster-container">
      <!-- 生成中 -->
      <view class="poster-gen" wx:if="{{phase === 'poster_generating'}}">
        <text class="poster-gen-text">GENERATING DOSSIER...</text>
        <view class="poster-gen-bar"><view class="poster-gen-bar-fill"></view></view>
      </view>

      <!-- 预览 -->
      <view class="poster-preview" wx:if="{{phase === 'poster_preview' && posterPath}}">
        <image class="poster-image" src="{{posterPath}}" mode="widthFix" show-menu-by-longpress />
      </view>

      <!-- 错误 -->
      <view class="poster-error" wx:if="{{posterError}}">
        <text class="poster-error-text">{{posterError}}</text>
        <view class="poster-error-actions">
          <view class="poster-error-btn" bindtap="onPosterRetry">重试</view>
          <view class="poster-error-btn" bindtap="onPosterCancel">取消</view>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="poster-actions" wx:if="{{phase === 'poster_preview' && posterPath}}">
        <view class="poster-btn poster-btn--save" bindtap="onSavePoster">保存图片</view>
        <view class="poster-btn poster-btn--share" bindtap="onSharePoster">分享微信</view>
        <view class="poster-btn poster-btn--close" bindtap="onClosePoster">关闭</view>
      </view>
    </view>
  </view>
  <canvas type="2d" id="posterCanvas" class="poster-canvas"></canvas>

</scroll-view>
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/pages/fortune/fortune.wxml
git commit -m "feat(fortune): 前端 fortune.wxml 完整重写为 6 屏结构"
```

---

## Task 5: 前端 fortune.wxss 完整重写

**Files:**
- Rewrite: `miniprogram/pages/fortune/fortune.wxss`

- [ ] **Step 1: 写入新的 fortune.wxss**

完整替换 `miniprogram/pages/fortune/fortune.wxss`：

```css
/* ===== 全局容器 ===== */
.page-container {
  min-height: 100vh;
  background:
    radial-gradient(circle at 20% 0%, rgba(0, 175, 255, 0.08), transparent 32%),
    radial-gradient(circle at 90% 18%, rgba(94, 92, 230, 0.05), transparent 30%),
    #05070A;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}

/* reduce-motion 静默模式 */
.reduce-motion .oracle-card,
.reduce-motion .scan-ring,
.reduce-motion .gen-card--breathing,
.reduce-motion .gen-log-line,
.reduce-motion .gen-log-typing,
.reduce-motion .gen-check-item,
.reduce-motion .result-card,
.reduce-motion .result-tags,
.reduce-motion .result-section,
.reduce-motion .result-actions,
.reduce-motion .poster-gen-bar-fill,
.reduce-motion .poster-gen-text,
.reduce-motion .tap-hint {
  animation: none !important;
  transition-duration: 0ms !important;
}

/* ===== 通用元素 ===== */
.page-kicker {
  font-family: 'Courier New', Courier, monospace;
  font-size: 20rpx;
  color: rgba(0, 175, 255, 0.6);
  letter-spacing: 6rpx;
  text-transform: uppercase;
  margin-bottom: 12rpx;
}

.page-date {
  font-family: 'Courier New', Courier, monospace;
  font-size: 18rpx;
  color: rgba(255, 255, 255, 0.12);
  letter-spacing: 4rpx;
}

.page-lunar {
  font-family: 'Courier New', Courier, monospace;
  font-size: 18rpx;
  color: rgba(255, 255, 255, 0.15);
  letter-spacing: 3rpx;
  margin-top: 8rpx;
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-bottom: 48rpx;
  width: 100%;
  opacity: 0;
  animation: fadeIn 0.6s ease 0.3s forwards;
}

.section-title {
  font-size: 36rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: 8rpx;
  white-space: nowrap;
}

.section-divider {
  flex: 1;
  height: 1rpx;
  background: linear-gradient(90deg, transparent, rgba(0, 175, 255, 0.15), transparent);
}

/* 卡牌通用 */
.card-inner {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-ring {
  position: absolute;
  border-radius: 50%;
  border: 1rpx solid rgba(255, 255, 255, 0.04);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.card-ring--1 { width: 200rpx; height: 200rpx; border-color: rgba(255, 255, 255, 0.06); }
.card-ring--2 { width: 130rpx; height: 130rpx; border-color: rgba(255, 255, 255, 0.05); }
.card-ring--3 { width: 60rpx; height: 60rpx; border-color: rgba(255, 255, 255, 0.04); }

.card-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  position: relative;
  z-index: 1;
}

/* 扫描环 */
.scan-ring {
  position: absolute;
  width: 340rpx;
  height: 340rpx;
  border-radius: 50%;
  border: 1px solid rgba(0, 175, 255, 0.2);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 12rpx rgba(0, 175, 255, 0.08);
}

.scan-ring--idle {
  animation: scanRotate 12s linear infinite;
}

.scan-ring--gen {
  animation: scanRotate 8s linear infinite;
}

@keyframes scanRotate {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to   { transform: translate(-50%, -50%) rotate(360deg); }
}

/* ===========================
   idle: 未抽取状态
   =========================== */
.idle-screen {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 40rpx 40rpx;
  box-sizing: border-box;
}

.idle-header {
  text-align: center;
  margin-bottom: 48rpx;
  opacity: 0;
  animation: fadeInDown 0.8s ease forwards;
}

@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-20rpx); }
  to { opacity: 1; transform: translateY(0); }
}

.card-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 56rpx;
  position: relative;
  opacity: 0;
  animation: cardEntrance 0.7s cubic-bezier(0.23, 1, 0.32, 1) 0.5s forwards;
}

@keyframes cardEntrance {
  from { opacity: 0; transform: translateY(60rpx) scale(0.85); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.oracle-card {
  width: 280rpx;
  height: 440rpx;
  position: relative;
  border-radius: 20rpx;
  background: linear-gradient(165deg, #12141A 0%, #0A0C12 100%);
  border: 1rpx solid rgba(0, 175, 255, 0.12);
  box-shadow:
    0 12rpx 48rpx rgba(0, 0, 0, 0.6),
    0 1rpx 0 rgba(0, 175, 255, 0.06) inset;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.4s cubic-bezier(0.23, 1, 0.32, 1);
  z-index: 2;
}

.oracle-card:active {
  transform: scale(0.97);
}

.tap-hint {
  font-family: 'Courier New', Courier, monospace;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 6rpx;
  margin-top: 40rpx;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

.idle-info {
  text-align: center;
  margin-bottom: 48rpx;
  opacity: 0;
  animation: fadeIn 0.6s ease 0.9s forwards;
}

.idle-info-label {
  font-family: 'Courier New', Courier, monospace;
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.25);
  letter-spacing: 4rpx;
  margin-bottom: 12rpx;
}

.idle-info-tags {
  font-family: 'Courier New', Courier, monospace;
  font-size: 20rpx;
  color: rgba(0, 175, 255, 0.5);
  letter-spacing: 3rpx;
}

@keyframes fadeIn {
  to { opacity: 1; }
}

/* ===========================
   generating: 推演中
   =========================== */
.gen-screen {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 40rpx;
  box-sizing: border-box;
}

.gen-fade-out {
  animation: fadeOut 0.4s ease forwards;
}

@keyframes fadeOut {
  to { opacity: 0; }
}

.gen-card-area {
  position: relative;
  width: 280rpx;
  height: 440rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 48rpx;
}

.gen-card {
  width: 280rpx;
  height: 440rpx;
  border-radius: 20rpx;
  background: linear-gradient(165deg, #12141A 0%, #0A0C12 100%);
  border: 1rpx solid rgba(0, 175, 255, 0.12);
  overflow: hidden;
  position: relative;
  z-index: 2;
}

.gen-card--breathing {
  animation: cardBreathe 2.4s ease-in-out infinite;
}

@keyframes cardBreathe {
  0%, 100% { transform: scale(0.96); opacity: 0.7; }
  50%      { transform: scale(1.02); opacity: 1; }
}

.gen-title-block {
  text-align: center;
  margin-bottom: 40rpx;
}

.gen-main-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: 4rpx;
  margin-bottom: 12rpx;
}

.gen-sub-title {
  display: block;
  font-family: 'Courier New', Courier, monospace;
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 2rpx;
  line-height: 1.6;
  max-width: 520rpx;
  margin: 0 auto;
}

/* 阶段清单 */
.gen-checklist {
  width: 400rpx;
  margin-bottom: 40rpx;
}

.gen-check-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 12rpx;
  opacity: 0.3;
  transition: opacity 0.3s ease;
}

.gen-check-item--done {
  opacity: 0.8;
}

.gen-check-mark {
  font-family: 'Courier New', Courier, monospace;
  font-size: 22rpx;
  color: rgba(0, 175, 255, 0.7);
  width: 32rpx;
  text-align: center;
}

.gen-check-label {
  font-family: 'Courier New', Courier, monospace;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 2rpx;
}

.gen-check-count {
  text-align: center;
  font-family: 'Courier New', Courier, monospace;
  font-size: 20rpx;
  color: rgba(0, 175, 255, 0.4);
  margin-top: 16rpx;
  letter-spacing: 4rpx;
}

/* 终端日志 */
.gen-terminal {
  width: 520rpx;
  min-height: 200rpx;
  margin-bottom: 32rpx;
}

.gen-log-line {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
  opacity: 0;
  transform: translateY(8rpx);
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.gen-log-line--visible {
  opacity: 1;
  transform: translateY(0);
}

.gen-log-prefix {
  font-family: 'Courier New', Courier, monospace;
  font-size: 20rpx;
  color: rgba(0, 175, 255, 0.6);
  flex-shrink: 0;
  width: 140rpx;
}

.gen-log-text {
  font-family: 'Courier New', Courier, monospace;
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.45);
  letter-spacing: 1rpx;
}

.gen-log-typing {
  border-right: 2rpx solid rgba(0, 175, 255, 0.6);
  animation: blink 0.6s step-end infinite;
}

@keyframes blink {
  0%, 100% { border-color: rgba(0, 175, 255, 0.6); }
  50%      { border-color: transparent; }
}

/* 超时提示 */
.gen-timeout {
  text-align: center;
  margin-top: 16rpx;
}

.gen-timeout-text {
  font-family: 'Courier New', Courier, monospace;
  font-size: 20rpx;
  color: rgba(255, 170, 51, 0.7);
  letter-spacing: 2rpx;
}

.gen-timeout--long {
  margin-top: 24rpx;
}

.gen-timeout-actions {
  display: flex;
  gap: 24rpx;
  margin-top: 24rpx;
  justify-content: center;
}

.gen-timeout-btn {
  font-family: 'Courier New', Courier, monospace;
  font-size: 22rpx;
  letter-spacing: 3rpx;
  padding: 16rpx 40rpx;
  border-radius: 4rpx;
  color: rgba(255, 255, 255, 0.5);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
}

.gen-timeout-btn--primary {
  color: #00AFFF;
  border-color: rgba(0, 175, 255, 0.3);
}

/* ===========================
   success: 结果展示
   =========================== */
.success-screen {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx 160rpx;
  box-sizing: border-box;
}

.success-header {
  text-align: center;
  margin-bottom: 32rpx;
  opacity: 0;
  animation: fadeInDown 0.6s ease forwards;
}

/* 策略卡 */
.result-card {
  width: 480rpx;
  background: rgba(10, 15, 24, 0.95);
  border: 1rpx solid var(--accent, #00AFFF);
  border-radius: 16rpx;
  padding: 48rpx 40rpx;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
  margin-bottom: 32rpx;
  opacity: 0;
  transform: scale(0.9);
  animation: revealScale 0.5s cubic-bezier(0.23, 1, 0.32, 1) 0.2s forwards;
}

.result-card::before {
  content: '';
  position: absolute;
  top: -30%;
  left: 50%;
  transform: translateX(-50%);
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  background: var(--accent, #00AFFF);
  opacity: 0.04;
  filter: blur(40px);
  pointer-events: none;
}

@keyframes revealScale {
  to { opacity: 1; transform: scale(1); }
}

.result-card-title {
  font-size: 44rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: 6rpx;
  text-align: center;
  margin-bottom: 8rpx;
}

.result-card-subtitle {
  font-family: 'Courier New', Courier, monospace;
  font-size: 18rpx;
  color: rgba(255, 255, 255, 0.25);
  letter-spacing: 4rpx;
  text-transform: uppercase;
  text-align: center;
  margin-bottom: 32rpx;
}

.result-card-verdict-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.38);
  letter-spacing: 2rpx;
  margin-bottom: 12rpx;
}

.result-card-verdict {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.8;
  letter-spacing: 2rpx;
}

.result-card-divider {
  width: 60%;
  height: 1rpx;
  margin: 24rpx auto 0;
  background: linear-gradient(90deg, transparent, var(--accent, #00AFFF), transparent);
  opacity: 0.3;
}

/* 标签 */
.result-tags {
  display: flex;
  gap: 16rpx;
  margin-bottom: 36rpx;
  opacity: 0;
  animation: fadeIn 0.4s ease 0.5s forwards;
}

.result-tag {
  font-family: 'Courier New', Courier, monospace;
  font-size: 22rpx;
  color: rgba(0, 175, 255, 0.7);
  letter-spacing: 3rpx;
  padding: 10rpx 28rpx;
  border: 1rpx solid rgba(0, 175, 255, 0.2);
  border-radius: 4rpx;
}

/* 优势/风险 */
.result-section {
  width: 100%;
  max-width: 480rpx;
  margin-bottom: 28rpx;
  opacity: 0;
  animation: fadeIn 0.4s ease 0.7s forwards;
}

.result-section-title {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.38);
  letter-spacing: 4rpx;
  margin-bottom: 16rpx;
}

.result-list-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 10rpx 0;
}

.result-list-prefix {
  font-family: 'Courier New', Courier, monospace;
  font-size: 24rpx;
  flex-shrink: 0;
  width: 32rpx;
  text-align: center;
}

.result-list-item--buff .result-list-prefix {
  color: #30D158;
}

.result-list-item--risk .result-list-prefix {
  color: #FF453A;
}

.result-list-text {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 1rpx;
}

/* 操作按钮 */
.result-actions {
  display: flex;
  gap: 32rpx;
  margin-top: 16rpx;
  opacity: 0;
  animation: fadeIn 0.4s ease 0.9s forwards;
}

.result-btn {
  font-family: 'Courier New', Courier, monospace;
  font-size: 24rpx;
  letter-spacing: 3rpx;
  padding: 20rpx 48rpx;
  border-radius: 4rpx;
  transition: opacity 0.15s ease;
}

.result-btn:active {
  opacity: 0.5;
}

.result-btn--secondary {
  color: rgba(255, 255, 255, 0.35);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);
}

.result-btn--primary {
  color: #00AFFF;
  border: 1rpx solid rgba(0, 175, 255, 0.3);
  background: rgba(0, 175, 255, 0.06);
}

/* ===========================
   error: 错误态
   =========================== */
.error-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 40rpx;
}

.error-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(255, 69, 58, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Courier New', Courier, monospace;
  font-size: 36rpx;
  color: #FF453A;
  margin-bottom: 32rpx;
}

.error-title {
  font-size: 32rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: 4rpx;
  margin-bottom: 16rpx;
}

.error-text {
  font-family: 'Courier New', Courier, monospace;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 2rpx;
  margin-bottom: 48rpx;
  text-align: center;
}

.error-actions {
  display: flex;
  gap: 24rpx;
}

.error-btn {
  font-family: 'Courier New', Courier, monospace;
  font-size: 22rpx;
  color: #00AFFF;
  letter-spacing: 4rpx;
  padding: 16rpx 48rpx;
  border: 1rpx solid rgba(0, 175, 255, 0.3);
  border-radius: 4rpx;
}

.error-btn:active {
  opacity: 0.6;
}

/* ===========================
   倒计时
   =========================== */
.countdown-bar {
  margin-top: 48rpx;
  text-align: center;
}

.countdown-label {
  font-family: 'Courier New', Courier, monospace;
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.25);
  letter-spacing: 3rpx;
}

.countdown-value {
  font-family: 'Courier New', Courier, monospace;
  font-size: 20rpx;
  color: rgba(0, 175, 255, 0.6);
  letter-spacing: 3rpx;
}

/* ===========================
   海报弹层
   =========================== */
.poster-mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.92);
  backdrop-filter: blur(16px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
}

.poster-container {
  width: 100%;
  max-width: 600rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.poster-gen {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32rpx;
  padding: 80rpx 0;
}

.poster-gen-text {
  font-family: 'Courier New', Courier, monospace;
  font-size: 24rpx;
  color: rgba(0, 175, 255, 0.7);
  letter-spacing: 4rpx;
  animation: posterBreathe 1.5s ease-in-out infinite;
}

@keyframes posterBreathe {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.9; }
}

.poster-gen-bar {
  width: 300rpx;
  height: 4rpx;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2rpx;
  overflow: hidden;
}

.poster-gen-bar-fill {
  width: 40%;
  height: 100%;
  background: rgba(0, 175, 255, 0.6);
  border-radius: 2rpx;
  animation: genBarSlide 1.2s ease-in-out infinite;
}

@keyframes genBarSlide {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}

.poster-preview {
  width: 100%;
  margin-bottom: 32rpx;
}

.poster-image {
  width: 100%;
  border-radius: 8rpx;
  border: 1rpx solid rgba(0, 175, 255, 0.2);
}

.poster-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  padding: 60rpx 0;
}

.poster-error-text {
  font-family: 'Courier New', Courier, monospace;
  font-size: 24rpx;
  color: rgba(255, 69, 58, 0.8);
  letter-spacing: 2rpx;
}

.poster-error-actions {
  display: flex;
  gap: 24rpx;
}

.poster-error-btn {
  font-family: 'Courier New', Courier, monospace;
  font-size: 22rpx;
  letter-spacing: 3rpx;
  padding: 16rpx 40rpx;
  border-radius: 4rpx;
  color: rgba(255, 255, 255, 0.5);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
}

.poster-error-btn:active {
  opacity: 0.5;
}

.poster-actions {
  display: flex;
  gap: 20rpx;
  width: 100%;
}

.poster-btn {
  flex: 1;
  text-align: center;
  font-family: 'Courier New', Courier, monospace;
  font-size: 22rpx;
  letter-spacing: 2rpx;
  padding: 20rpx 0;
  border-radius: 4rpx;
  transition: opacity 0.15s ease;
}

.poster-btn:active {
  opacity: 0.5;
}

.poster-btn--save {
  color: #F5F5F7;
  border: 1rpx solid rgba(0, 175, 255, 0.3);
  background: rgba(0, 175, 255, 0.1);
}

.poster-btn--share {
  color: #00AFFF;
  border: 1rpx solid rgba(0, 175, 255, 0.4);
  background: rgba(0, 175, 255, 0.08);
  box-shadow: 0 0 12rpx rgba(0, 175, 255, 0.15);
}

.poster-btn--close {
  color: rgba(255, 255, 255, 0.35);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
}

.poster-canvas {
  position: fixed;
  left: -9999px;
  top: -9999px;
}
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/pages/fortune/fortune.wxss
git commit -m "feat(fortune): 前端 fortune.wxss 完整重写为新配色系统"
```

---

## Task 6: 清理备份 + 整体验证

**Files:**
- None (cleanup only)

- [ ] **Step 1: 检查是否有残留备份文件**

Run: `ls miniprogram/pages/fortune/fortune.js.bak 2>/dev/null && echo "需要删除" || echo "无备份文件"`

- [ ] **Step 2: 验证后端编译**

Run: `cd backend && JAVA_HOME=$(/usr/libexec/java_home -v 21) mvn compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 3: 验证前端文件结构完整**

Run: `ls -la miniprogram/pages/fortune/`
Expected: 4 个文件 (fortune.js, fortune.json, fortune.wxml, fortune.wxss)

- [ ] **Step 4: Commit（如果需要清理）**

```bash
# 仅在有备份文件时执行
git add -A
git commit -m "chore(fortune): 清理临时文件"
```
