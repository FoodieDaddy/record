/**
 * 战绩分享海报 — Canvas 生成
 */
const { get } = require('./request');

/**
 * 生成战绩海报图片
 * @param {Object} sessionInfo - 场次信息
 * @param {Array} ranking - 排行榜数据 [{userId, nickname, score}]
 * @returns {Promise<string>} - 临时文件路径
 */
async function generatePoster(sessionInfo, ranking) {
  const query = wx.createSelectorQuery();
  const canvas = await new Promise(resolve => {
    query.select('#posterCanvas')
      .fields({ node: true, size: true })
      .exec(res => resolve(res[0]));
  });

  if (!canvas || !canvas.node) {
    // Fallback: 使用离屏 Canvas
    return generateOfflinePoster(sessionInfo, ranking);
  }

  const ctx = canvas.node.getContext('2d');
  const dpr = wx.getSystemInfoSync().pixelRatio;
  const width = 750;
  const height = 1000;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  drawPoster(ctx, sessionInfo, ranking, width, height);

  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas: canvas,
      success: res => resolve(res.tempFilePath),
      fail: reject
    });
  });
}

/**
 * 使用离屏 Canvas 生成海报（页面无 canvas 元素时）
 */
function generateOfflinePoster(sessionInfo, ranking) {
  const canvas = wx.createOffscreenCanvas({ type: '2d', width: 750, height: 1000 });
  const ctx = canvas.getContext('2d');
  drawPoster(ctx, sessionInfo, ranking, 750, 1000);

  return new Promise((resolve, reject) => {
    try {
      const tempPath = `${wx.env.USER_DATA_PATH}/poster_${Date.now()}.png`;
      // 离屏 canvas 需要用 wx.canvasToTempFilePath
      wx.canvasToTempFilePath({
        canvas: canvas,
        success: res => resolve(res.tempFilePath),
        fail: err => {
          console.error('离屏海报生成失败', err);
          reject(err);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

function drawPoster(ctx, sessionInfo, ranking, width, height) {
  // 背景
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#0a0a0a');
  gradient.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 装饰光晕
  ctx.beginPath();
  ctx.arc(width / 2, 200, 250, 0, Math.PI * 2);
  const glow = ctx.createRadialGradient(width / 2, 200, 0, width / 2, 200, 250);
  glow.addColorStop(0, 'rgba(79, 140, 255, 0.15)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fill();

  // 标题
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🀄 麻将记分器', width / 2, 100);

  // 场次信息
  ctx.font = '28px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(sessionInfo.title || '战绩报告', width / 2, 160);

  // 排行榜卡片背景
  const cardY = 210;
  const cardH = 120 + ranking.length * 90;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(ctx, 40, cardY, width - 80, cardH, 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  roundRect(ctx, 40, cardY, width - 80, cardH, 24);
  ctx.stroke();

  // 排行榜标题
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('排行榜', 80, cardY + 50);

  // 分割线
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(80, cardY + 70);
  ctx.lineTo(width - 80, cardY + 70);
  ctx.stroke();

  // 排行榜列表
  ranking.forEach((player, index) => {
    const y = cardY + 110 + index * 90;

    // 名次
    const rankColors = ['#fbbf24', '#94a3b8', '#cd7f32', 'rgba(255,255,255,0.4)'];
    ctx.fillStyle = rankColors[Math.min(index, 3)];
    ctx.font = 'bold 36px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${index + 1}`, 90, y);

    // 昵称
    ctx.fillStyle = '#ffffff';
    ctx.font = '28px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(player.nickname || '玩家', 130, y);

    // 分数
    const scoreText = player.score > 0 ? `+${player.score}` : `${player.score}`;
    ctx.fillStyle = player.score >= 0 ? '#34d399' : '#f87171';
    ctx.font = 'bold 36px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(scoreText, width - 80, y);
  });

  // 底部
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '22px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('长按识别小程序码加入房间', width / 2, height - 80);
  ctx.fillText(new Date().toLocaleDateString(), width / 2, height - 45);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * 保存海报到相册
 */
function saveToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: resolve,
      fail: (err) => {
        if (err.errMsg.includes('deny') || err.errMsg.includes('auth')) {
          wx.showModal({
            title: '需要授权',
            content: '请在设置中允许保存到相册',
            success: (res) => {
              if (res.confirm) wx.openSetting();
            }
          });
        }
        reject(err);
      }
    });
  });
}

module.exports = { generatePoster, saveToAlbum };
