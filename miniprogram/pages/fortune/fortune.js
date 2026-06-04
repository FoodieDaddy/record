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

// 赛博终端加载文案队列
const LOADING_STEPS = [
  '[ 初始化对战矩阵 ]',
  '[ 解析历史磁场波动 ]',
  '[ 载入太阴历环境参数 ]',
  '[ 正在坍缩量子态 ]'
]

Page({
  data: {
    loading: true,
    loadingFadeOut: false,
    currentLoadingText: LOADING_STEPS[0],
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

  _loadingTimer: null,
  _loadingIndex: 0,
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
    this.clearLoadingTimer()
    this.stopAccelerometer()
    this.stopCountdown()
  },

  /** 获取运势，force=true 时跳过缓存强制重新生成 */
  fetchFortune(force) {
    this.setData({ loading: true, loadingFadeOut: false, error: null })
    this.startLoadingText()

    const params = force ? { force: true } : undefined
    const finishLoading = (updates) => {
      this.clearLoadingTimer()
      if (this.data.animationEnabled) {
        this.setData({ loadingFadeOut: true })
        setTimeout(() => {
          this.setData({ loading: false, loadingFadeOut: false, ...updates })
        }, 300)
      } else {
        this.setData({ loading: false, ...updates })
      }
    }

    get('/fortune/today', params).then(data => {
      finishLoading({ fortune: data })
    }).catch(err => {
      finishLoading({ error: err.message || '连接中断，请重试' })
    })
  },

  /** 刷新运势：强制跳过缓存，重新调用 LLM 生成 */
  refreshFortune() {
    if (this.data.loading) return
    this.fetchFortune(true)
  },

  // ===== 加载文案轮播 =====

  startLoadingText() {
    this._loadingIndex = 0
    this.setData({ currentLoadingText: LOADING_STEPS[0] })
    this.clearLoadingTimer()
    this._loadingTimer = setInterval(() => {
      this._loadingIndex = (this._loadingIndex + 1) % LOADING_STEPS.length
      this.setData({
        currentLoadingText: LOADING_STEPS[this._loadingIndex]
      })
    }, 800)
  },

  clearLoadingTimer() {
    if (this._loadingTimer) {
      clearInterval(this._loadingTimer)
      this._loadingTimer = null
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
