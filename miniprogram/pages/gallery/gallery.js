const { get } = require('../../utils/request');

Page({
  data: {
    images: [],
    page: 1,
    hasMore: true,
    loading: false
  },

  onShow() {
    // 图库功能开发中，暂不加载数据
    this.setData({ images: [], page: 1, hasMore: false, loading: false });
  },

  async loadImages() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const rooms = await get('/room/my');
      if (!rooms || rooms.length === 0) {
        this.setData({ hasMore: false });
        return;
      }

      const allImages = [];
      for (const room of rooms) {
        try {
          const images = await get(`/score/room/${room.roomId}/images`);
          if (!images) continue;
          for (const url of images) {
            allImages.push({
              id: `${room.roomId}-${url}`,
              imageUrl: url,
              roomNo: room.roomNo
            });
          }
        } catch (e) {
          console.warn('加载房间图片失败', room.roomId);
        }
      }

      this.setData({
        images: [...this.data.images, ...allImages],
        hasMore: false
      });
    } catch (e) {
      console.error('加载图库失败', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onImageError(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ [`images[${idx}].failed`]: true });
  },

  preview(e) {
    const idx = e.currentTarget.dataset.index;
    const valid = this.data.images.filter(i => !i.failed);
    wx.previewImage({
      current: this.data.images[idx].imageUrl,
      urls: valid.map(i => i.imageUrl)
    });
  },

  loadMore() {
    this.setData({ page: this.data.page + 1 });
    this.loadImages();
  }
});
