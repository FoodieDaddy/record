/**
 * 图片工具 — 压缩 + 预签名直传 OSS
 */
const { get, post } = require('./request');

/**
 * 压缩图片（微信 API）
 */
function compressImage(filePath) {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: filePath,
      quality: 60,
      success: res => resolve(res.tempFilePath),
      fail: () => resolve(filePath) // 压缩失败用原图
    });
  });
}

/**
 * 从相册/拍照选择图片并压缩
 */
function chooseAndCompress(maxCount = 9) {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: maxCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const files = res.tempFiles;
        const compressed = [];
        for (const f of files) {
          const path = await compressImage(f.tempFilePath);
          compressed.push(path);
        }
        resolve(compressed);
      },
      fail: reject
    });
  });
}

/**
 * 获取文件 Content-Type
 */
function getContentType(filePath) {
  if (filePath.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
}

/**
 * 上传图片到 OSS（预签名直传）
 * @param {string} filePath - 本地文件路径
 * @returns {Promise<string>} - 上传后的访问 URL
 */
async function uploadToOSS(filePath) {
  // 1. 获取预签名 URL
  const contentType = getContentType(filePath);
  const presign = await get(`/storage/presign?contentType=${encodeURIComponent(contentType)}`);

  // 2. 直传到 OSS
  await new Promise((resolve, reject) => {
    wx.uploadFile({
      url: presign.uploadUrl,
      filePath: filePath,
      name: 'file',
      header: { 'Content-Type': contentType },
      success: res => {
        if (res.statusCode === 200) resolve();
        else reject(new Error('上传失败: ' + res.statusCode));
      },
      fail: reject
    });
  });

  return presign.accessUrl;
}

/**
 * 批量上传图片
 * @param {string[]} filePaths
 * @returns {Promise<string[]>} 访问 URL 列表
 */
async function batchUpload(filePaths) {
  const { post } = require('./request');

  // 批量获取预签名
  const contentTypes = filePaths.map(getContentType);
  const presigns = await post('/storage/presign/batch', {
    count: filePaths.length,
    contentTypes
  });

  // 并行直传
  const uploadTasks = filePaths.map((filePath, i) =>
    new Promise((resolve, reject) => {
      wx.uploadFile({
        url: presigns[i].uploadUrl,
        filePath,
        name: 'file',
        header: { 'Content-Type': contentTypes[i] },
        success: res => {
          if (res.statusCode === 200) {
            resolve(presigns[i].accessUrl);
          } else {
            reject(new Error('上传失败'));
          }
        },
        fail: reject
      });
    })
  );
  return Promise.all(uploadTasks);
}

module.exports = { compressImage, chooseAndCompress, uploadToOSS, batchUpload };
