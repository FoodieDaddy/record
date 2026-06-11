/**
 * Canvas 绘制共享工具
 * 从 fortune.js 和 mirror/index.js 中提取的公共绘制方法
 */

/**
 * 等间距绘制文本（字间距可控）
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x 起始 X
 * @param {number} y 基线 Y
 * @param {number} spacing 额外字间距 (px)
 */
function fillLetterSpaced(ctx, text, x, y, spacing) {
  if (!text) return;
  var chars = String(text).split('');
  var cx = x;
  for (var i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, y);
    cx += ctx.measureText(chars[i]).width + spacing;
  }
}

/**
 * 圆角矩形路径（不 fill/stroke，只构建 path）
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r 圆角半径
 */
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * 文本自动换行（返回行数组）
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth 最大宽度
 * @returns {string[]}
 */
function wrapTextLines(ctx, text, maxWidth) {
  if (!text) return [];
  var words = String(text).split('');
  var lines = [];
  var currentLine = '';
  for (var i = 0; i < words.length; i++) {
    var testLine = currentLine + words[i];
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * HUD 切角装饰（四角 L 形）
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} len 切角长度
 * @param {string} color 描边颜色
 */
function drawCornerDecor(ctx, x, y, w, h, len, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  // 左上
  ctx.beginPath();
  ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
  ctx.stroke();
  // 右上
  ctx.beginPath();
  ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
  ctx.stroke();
  // 左下
  ctx.beginPath();
  ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h);
  ctx.stroke();
  // 右下
  ctx.beginPath();
  ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len);
  ctx.stroke();
  ctx.restore();
}

/**
 * Canvas 文本宽度截断，超出追加省略号
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string}
 */
function truncateCanvasText(ctx, text, maxWidth) {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  var result = '';
  for (var i = 0; i < text.length; i++) {
    var next = result + text[i];
    if (ctx.measureText(next + '…').width > maxWidth) {
      return result + '…';
    }
    result = next;
  }
  return result;
}

module.exports = {
  fillLetterSpaced: fillLetterSpaced,
  roundRectPath: roundRectPath,
  wrapTextLines: wrapTextLines,
  drawCornerDecor: drawCornerDecor,
  truncateCanvasText: truncateCanvasText
};
