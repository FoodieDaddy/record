const config = require('../../config')
const voiceUtil = require('../../utils/voice')
const { get } = require('../../utils/request')

// 全局唯一音频实例，防止内存泄漏和多音频重叠
const audioCtx = wx.createInnerAudioContext()
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
    showSheet: false
  },

  onLoad() {
    this.loadCatalog()
    // 延迟触发抽屉滑入动画
    setTimeout(() => this.setData({ showSheet: true }), 50)
  },

  onUnload() {
    audioCtx.stop()
    audioCtx.destroy()
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
    setTimeout(() => wx.navigateBack(), 350)
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
    setTimeout(() => wx.navigateBack(), 800)
  }
})
