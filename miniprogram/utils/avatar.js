/**
 * 自动生成头像工具
 * 提供颜色和首字，由 WXML/WXSS 渲染为圆形头像
 * Canvas 生成作为备选方案
 */

// 用户头像色池（12种，蓝绿红体系）
const COLORS = [
  '#E74C3C', '#3498DB', '#2ECC71', '#5E5CE6', '#9B59B6', '#1ABC9C',
  '#0A84FF', '#E91E63', '#00BCD4', '#00C8FF', '#607D8B', '#30D158'
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
 * 标准化头像地址：只保留小程序可直接渲染的图片地址。
 * 后端偶尔会返回 OSS objectKey，相对路径在页面内会被解析为本地文件。
 */
function normalizeAvatarUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^(https?:\/\/|wxfile:\/\/|cloud:\/\/|data:image\/)/.test(value)) return value;
  return '';
}

/**
 * 生成头像视图数据。图片不可用时，统一回退到首字头像。
 */
function getAvatarView(nickname, url) {
  const avatarUrl = normalizeAvatarUrl(url);
  return {
    avatarUrl,
    avatarColor: avatarUrl ? '' : getColor(nickname),
    avatarChar: avatarUrl ? '' : getFirstChar(nickname)
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

  ctx.fillStyle = '#E2F2FF';
  ctx.font = `bold ${Math.round(size * 0.4)}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, radius, radius);
}

module.exports = { getColor, getFirstChar, getAvatarData, normalizeAvatarUrl, getAvatarView, drawToCanvas };
