const { get } = require('../../utils/request');

Page({
  data: {
    images: [],
    page: 1,
    hasMore: true,
    loading: false
  },

  onShow() {
    this.setData({ images: [], page: 1, hasMore: true });
    this.loadImages();
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
          const sessions = await get(`/session/room/${room.roomId}?page=1&size=50`);
          if (!sessions) continue;
          for (const session of sessions) {
            try {
              const detail = await get(`/score/session/${session.sessionId}`);
              if (detail && detail.batches) {
                for (const batch of detail.batches) {
                  if (batch.imageUrls) {
                    for (const url of batch.imageUrls) {
                      allImages.push({
                        id: `${session.sessionId}-${url}`,
                        imageUrl: url,
                        dateFormatted: this.formatDate(batch.batchTime),
                        rawDate: batch.batchTime
                      });
                    }
                  }
                }
              }
            } catch (e) {
              // 单个场次加载失败不影响其他
              console.warn('加载场次失败', session.sessionId);
            }
          }
        } catch (e) {
          console.warn('加载房间场次失败', room.roomId);
        }
      }

      allImages.sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));
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

  formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  },

  preview(e) {
    const idx = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.images[idx].imageUrl,
      urls: this.data.images.map(i => i.imageUrl)
    });
  },

  loadMore() {
    this.setData({ page: this.data.page + 1 });
    this.loadImages();
  }
});
