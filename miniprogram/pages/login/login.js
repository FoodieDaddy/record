const { post, put } = require('../../utils/request');
const { getColor, getFirstChar } = require('../../utils/avatar');
const app = getApp();

Page({
  data: {
    loading: false
  },

  onShow() {
    if (app.globalData.token) {
      wx.switchTab({ url: '/pages/room/room' });
    }
  },

  async onLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const { code } = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject });
      });

      // 后端自动生成昵称（NickNameGenerator），无需前端传入
      const data = await post('/user/login', { code });
      app.setLoginInfo(data);

      // 首次登录且无头像时，自动生成头像并上传
      if (!data.avatarUrl && data.nickname) {
        this.generateAndUploadAvatar(data.nickname).catch(err => {
          console.warn('自动生成头像失败', err);
        });
      }

      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/room/room' });
      }, 800);
    } catch (err) {
      console.error('登录失败', err);
      wx.showToast({ title: '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 用 canvas 根据昵称生成头像，上传到后端，更新用户信息
   */
  async generateAndUploadAvatar(nickname) {
    const query = wx.createSelectorQuery();
    const canvas = await new Promise(resolve => {
      query.select('#avatarCanvas')
        .fields({ node: true, size: true })
        .exec(res => resolve(res[0].node));
    });

    const size = 200;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // 绘制彩色圆形 + 首字
    const color = getColor(nickname);
    const char = getFirstChar(nickname);
    const radius = size / 2;

    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(size * 0.4)}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, radius, radius);

    // 导出为临时文件
    const tempPath = await new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas,
        fileType: 'png',
        success: res => resolve(res.tempFilePath),
        fail: reject
      });
    });

    // 上传到后端
    const avatarUrl = await this.uploadToBackend(tempPath);

    // 更新用户信息
    await put('/user/me', { avatarUrl });

    // 更新全局缓存
    app.globalData.userInfo = app.globalData.userInfo || {};
    app.globalData.userInfo.avatarUrl = avatarUrl;
  },

  uploadToBackend(filePath) {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${app.globalData.baseUrl}/storage/upload`,
        filePath,
        name: 'file',
        header: {
          Authorization: `Bearer ${app.globalData.token}`
        },
        success(res) {
          try {
            const data = JSON.parse(res.data);
            if (data.code === 200) resolve(data.data);
            else reject(new Error(data.message || '上传失败'));
          } catch (e) {
            reject(e);
          }
        },
        fail: reject
      });
    });
  }
});
