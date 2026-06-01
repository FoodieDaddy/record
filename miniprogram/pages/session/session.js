const { get, post } = require('../../utils/request');
const { getScoreWS } = require('../../utils/score-ws');
const { chooseAndCompress, batchUpload } = require('../../utils/image');
const { generatePoster, saveToAlbum } = require('../../utils/poster');
const app = getApp();

Page({
  data: {
    sessionId: null,
    roomId: null,
    sessionInfo: {},
    ranking: [],
    scoreInputs: [],
    selectedImages: [],
    recentBatches: [],
    submitting: false,
    isOwner: false,
    posterPath: null
  },

Page({
  data: {
    sessionId: null,
    roomId: null,
    sessionInfo: {},
    ranking: [],
    scoreInputs: [],
    selectedImages: [],
    recentBatches: [],
    submitting: false,
    isOwner: false
  },

  async onLoad(options) {
    const { sessionId, roomId } = options;
    this.setData({ sessionId, roomId });

    // 获取房间成员列表（用于记分输入）
    const room = await get(`/room/${roomId}`);
    const members = room.members || [];
    this.setData({
      isOwner: room.ownerId === app.globalData.userId,
      scoreInputs: members.map(m => ({
        userId: m.userId,
        nickname: m.nickname,
        avatarUrl: m.avatarUrl,
        score: ''
      }))
    });

    await this.refresh();

    // WebSocket 实时推送
    this.ws = getScoreWS();
    this.ws.connect(roomId);
    this.ws.onScoreUpdate(this.onWsScoreUpdate.bind(this));
  },

  onUnload() {
    if (this.ws) {
      this.ws.offScoreUpdate(this.onWsScoreUpdate);
    }
  },

  onWsScoreUpdate(data) {
    if (data.type === 'SCORE_UPDATE' && String(data.sessionId) === String(this.data.sessionId)) {
      this.refresh();
    }
  },

  async refresh() {
    await Promise.all([
      this.loadSessionInfo(),
      this.loadRanking(),
      this.loadRecentBatches()
    ]);
  },

  async loadSessionInfo() {
    try {
      const info = await get(`/session/${this.data.sessionId}`);
      this.setData({ sessionInfo: info });
    } catch (e) {}
  },

  async loadRanking() {
    try {
      const ranking = await get(`/score/session/${this.data.sessionId}/ranking`);
      this.setData({ ranking: ranking || [] });
    } catch (e) {}
  },

  async loadRecentBatches() {
    try {
      const batches = await get(`/score/session/${this.data.sessionId}/recent?count=10`);
      const formatted = (batches || []).map(b => ({
        ...b,
        batchTimeFormatted: this.formatTime(b.batchTime)
      }));
      this.setData({ recentBatches: formatted });
    } catch (e) {}
  },

  formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  onScoreInput(e) {
    const userId = e.currentTarget.dataset.userId;
    const value = e.detail.value;
    const inputs = this.data.scoreInputs.map(item =>
      item.userId === userId ? { ...item, score: value } : item
    );
    this.setData({ scoreInputs: inputs });
  },

  async chooseImage() {
    try {
      const remaining = 9 - this.data.selectedImages.length;
      const paths = await chooseAndCompress(remaining);
      this.setData({
        selectedImages: [...this.data.selectedImages, ...paths].slice(0, 9)
      });
    } catch (e) {}
  },

  removeImage(e) {
    const idx = e.currentTarget.dataset.index;
    const images = [...this.data.selectedImages];
    images.splice(idx, 1);
    this.setData({ selectedImages: images });
  },

  previewImage(e) {
    wx.previewImage({
      current: e.currentTarget.dataset.src,
      urls: this.data.selectedImages
    });
  },

  previewBatchImage(e) {
    const { urls, src } = e.currentTarget.dataset;
    wx.previewImage({ current: src, urls });
  },

  async submitScore() {
    if (this.data.submitting) return;

    // 收集有输入的玩家得分
    const scores = this.data.scoreInputs
      .filter(item => item.score !== '' && item.score !== '0')
      .map(item => ({
        userId: item.userId,
        score: parseInt(item.score) || 0
      }));

    if (scores.length === 0) {
      wx.showToast({ title: '请输入得分', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      // 1. 上传图片（如果有）
      let imageUrls = [];
      if (this.data.selectedImages.length > 0) {
        wx.showLoading({ title: '上传图片...' });
        imageUrls = await batchUpload(this.data.selectedImages);
        wx.hideLoading();
      }

      // 2. 提交记分
      await post('/score', {
        sessionId: parseInt(this.data.sessionId),
        scores,
        imageUrls
      });

      wx.showToast({ title: '记分成功', icon: 'success' });

      // 3. 清空表单
      this.setData({
        scoreInputs: this.data.scoreInputs.map(item => ({ ...item, score: '' })),
        selectedImages: []
      });

      // 4. 刷新数据
      await this.refresh();
    } catch (e) {
      console.error('提交记分失败', e);
    } finally {
      this.setData({ submitting: false });
    }
  },

  async settleSession() {
    const { confirm } = await wx.showModal({
      title: '确认结算？',
      content: '结算后将不可再记分'
    });
    if (!confirm) return;

    try {
      await post(`/session/${this.data.sessionId}/settle`);
      wx.showToast({ title: '已结算', icon: 'success' });
      await this.refresh();
      // 结算后自动生成海报
      this.generateSharePoster();
    } catch (e) {}
  },

  async generateSharePoster() {
    if (this.data.ranking.length === 0) {
      wx.showToast({ title: '暂无数据', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '生成海报...' });
    try {
      const path = await generatePoster(this.data.sessionInfo, this.data.ranking);
      this.setData({ posterPath: path });
    } catch (e) {
      console.error('生成海报失败', e);
      wx.showToast({ title: '生成失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async savePoster() {
    if (!this.data.posterPath) return;
    try {
      await saveToAlbum(this.data.posterPath);
      wx.showToast({ title: '已保存到相册', icon: 'success' });
    } catch (e) {
      console.error('保存失败', e);
    }
  },

  closePoster() {
    this.setData({ posterPath: null });
  }
});
