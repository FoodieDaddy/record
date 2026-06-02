/**
 * 自动生成头像工具
 * 提供颜色和首字，由 WXML/WXSS 渲染为圆形头像
 * Canvas 生成作为备选方案
 */

// 麻将主题色池（12种）
const COLORS = [
  '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C',
  '#E67E22', '#E91E63', '#00BCD4', '#FF5722', '#607D8B', '#795548'
];

/**
 * 根据昵称哈希选取颜色（同一昵称始终同色）
 * @param {string} nickname
 * @returns {string} hex颜色值
 */
function getColor(nickname) {
  let hash = 0;
  const str = nickname || '';
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

/**
 * 获取昵称首字
 * @param {string} nickname
 * @returns {string}
 */
function getFirstChar(nickname) {
  if (!nickname) return '?';
  for (let i = 0; i < nickname.length; i++) {
    const ch = nickname[i];
    if (/[一-龥a-zA-Z0-9]/.test(ch)) return ch;
  }
  return nickname[0];
}

/**
 * 生成头像数据对象（供 WXML 渲染）
 * @param {string} nickname
 * @returns {{ color: string, char: string }}
 */
function getAvatarData(nickname) {
  return {
    color: getColor(nickname),
    char: getFirstChar(nickname)
  };
}

/**
 * Canvas 方式生成头像文件（用于需要图片的场景）
 * @param {CanvasContext} ctx
 * @param {string} nickname
 * @param {number} size
 */
function drawToCanvas(ctx, nickname, size) {
  const color = getColor(nickname);
  const radius = size / 2;
  const char = getFirstChar(nickname);

  ctx.beginPath();
  ctx.arc(radius, radius, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.round(size * 0.4)}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, radius, radius);
}

module.exports = { getColor, getFirstChar, getAvatarData, drawToCanvas };
