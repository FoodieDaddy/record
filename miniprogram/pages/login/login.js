const { get, post } = require('../../utils/request');
const { getColor, getFirstChar } = require('../../utils/avatar');
const nicknameGen = require('../../utils/nickname-generator');
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

      // 前端预生成昵称 + 头像，一并传给登录接口，省掉登录后的单独 UPDATE
      const nickname = nicknameGen.generate();
      let avatarUrl = '';
      try {
        avatarUrl = await this.generateAndUploadAvatar(nickname);
      } catch (err) {
        console.warn('自动生成头像失败，使用默认', err);
      }

      const data = await post('/user/login', { code, nickname, avatarUrl });
      app.setLoginInfo(data);

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
   * 用 canvas 根据昵称生成头像，上传到 OSS，返回 avatarUrl
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

    const tempPath = await new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas,
        fileType: 'png',
        success: res => resolve(res.tempFilePath),
        fail: reject
      });
    });

    return this.uploadToBackend(tempPath);
  },

  async uploadToBackend(filePath) {
    // 1. 获取预签名 URL
    const presignData = await get('/storage/presign?contentType=' + encodeURIComponent('image/png'));

    // 2. 读取文件为 ArrayBuffer
    const fileData = await new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        success: res => resolve(res.data),
        fail: reject
      });
    });

    // 3. PUT 上传到 OSS
    await new Promise((resolve, reject) => {
      wx.request({
        url: presignData.uploadUrl,
        method: 'PUT',
        data: fileData,
        header: {
          'Content-Type': 'image/png'
        },
        success(res) {
          if (res.statusCode === 200) resolve();
          else reject(new Error('上传到 OSS 失败'));
        },
        fail: reject
      });
    });

    // 3. 返回完整公开 URL（objectKey 由后端存储，前端需完整 URL 用于图片加载）
    return presignData.accessUrl || presignData.objectKey;
  }
});
