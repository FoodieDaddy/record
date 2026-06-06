const app = getApp()
const config = require('../../config')
const voiceUtil = require('../../utils/voice')
const { get } = require('../../utils/request')

// 模块级音频实例，页面销毁后置 null，重入时重建
let audioCtx = wx.createInnerAudioContext()
audioCtx.obeyMuteSwitch = false

Page({
  data: {
    categories: [],
    activeTab: 0,
    selectedId: '',
    selectedName: '',
    selectedVoice: '',
    selectedFile: '',
    playingId: '',
    scrollTo: '',
    showSheet: false,
    animationEnabled: true
  },

  onLoad() {
    this.setData({ animationEnabled: app.globalData.animationEnabled !== false })
    // 重建音频实例（onUnload 销毁后重入）
    if (!audioCtx) {
      audioCtx = wx.createInnerAudioContext()
      audioCtx.obeyMuteSwitch = false
    }
    this.loadCatalog()
    // reduce-motion 下直接展示抽屉，否则延迟滑入
    if (this.data.animationEnabled) {
      this._sheetTimer = setTimeout(() => this.setData({ showSheet: true }), 50)
    } else {
      this.setData({ showSheet: true })
    }
  },

  onUnload() {
    // 清理音频
    if (audioCtx) {
      audioCtx.stop()
      audioCtx.destroy()
      audioCtx = null
    }
    // 清理所有延迟定时器
    if (this._sheetTimer) { clearTimeout(this._sheetTimer); this._sheetTimer = null }
    if (this._backTimer) { clearTimeout(this._backTimer); this._backTimer = null }
    if (this._confirmTimer) { clearTimeout(this._confirmTimer); this._confirmTimer = null }
  },

  /** 从后端加载音色目录 */
  async loadCatalog() {
    try {
      const catalog = await get('/voice/catalog')
      this.setData({ categories: catalog.categories || [] })
    } catch (e) {
      wx.showToast({ title: '加载音色失败', icon: 'none' })
    }
  },

  /** 关闭抽屉 */
  closeSheet() {
    this.setData({ showSheet: false })
    // reduce-motion 下直接返回，否则等待滑出动画
    if (this.data.animationEnabled) {
      this._backTimer = setTimeout(() => wx.navigateBack(), 350)
    } else {
      wx.navigateBack()
    }
  },

  /** 切换分类 */
  switchTab(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ activeTab: index, scrollTo: '' })
  },

  /** 播放/切换音色 — 复用同一个 audioCtx */
  playVoice(e) {
    const { id, file } = e.currentTarget.dataset
    const baseUrl = config.baseUrl.replace('/api', '')

    // 如果点击的是当前正在播放的，停止
    if (this.data.playingId === id) {
      audioCtx.stop()
      this.setData({ playingId: '' })
      return
    }

    // 停止当前播放，切换到新音色
    audioCtx.stop()
    this.setData({ playingId: id })

    const url = baseUrl + '/voices/' + file
    audioCtx.src = url
    audioCtx.play()

    // 记为已选
    const cat = this.data.categories[this.data.activeTab]
    const voice = cat.voices.find(v => v.id === id)
    if (voice) {
      this.setData({
        selectedId: id,
        selectedName: voice.name + ' - ' + voice.desc,
        selectedVoice: voice.voice || '',
        selectedFile: file
      })
    }
  },

  /** 确认选择，保存到本地并返回 */
  confirmSelect() {
    const { selectedId, selectedName, selectedVoice, selectedFile } = this.data
    if (!selectedId) return

    voiceUtil.saveSettings({
      voiceId: selectedId,
      voiceName: selectedName,
      voice: selectedVoice,
      voiceFile: selectedFile
    })

    wx.showToast({ title: '已选择 ' + selectedName, icon: 'success' })
    // reduce-motion 下直接返回，否则等待 toast 消失
    if (this.data.animationEnabled) {
      this._confirmTimer = setTimeout(() => wx.navigateBack(), 800)
    } else {
      wx.navigateBack()
    }
  }
})
