/**
 * 昵称宽度校验工具
 * 规则：中文/日文/韩文 = 1 宽度单位，英文/数字/常见符号 = 0.5 宽度单位
 * 最大 6 个中文宽度单位（即最多 12 个半角字符）
 */

const MAX_WIDTH = 6;

/**
 * 判断字符是否为 CJK（中日韩）全角字符
 */
function isCJK(ch) {
  const code = ch.charCodeAt(0);
  return (
    (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK 统一汉字
    (code >= 0x3400 && code <= 0x4DBF) ||   // CJK 扩展 A
    (code >= 0x3000 && code <= 0x303F) ||   // CJK 符号和标点
    (code >= 0xFF00 && code <= 0xFFEF) ||   // 全角字符
    (code >= 0x3040 && code <= 0x309F) ||   // 平假名
    (code >= 0x30A0 && code <= 0x30FF)      // 片假名
  );
}

/**
 * 计算昵称的显示宽度
 */
function getWidth(str) {
  if (!str) return 0;
  let w = 0;
  for (let i = 0; i < str.length; i++) {
    w += isCJK(str.charAt(i)) ? 1 : 0.5;
  }
  return w;
}

/**
 * 截断昵称到最大宽度
 */
function truncate(str, max) {
  const limit = max || MAX_WIDTH;
  if (!str) return '';
  let w = 0;
  let end = 0;
  for (let i = 0; i < str.length; i++) {
    const cw = isCJK(str.charAt(i)) ? 1 : 0.5;
    if (w + cw > limit) break;
    w += cw;
    end = i + 1;
  }
  return str.substring(0, end);
}

/**
 * 校验昵称是否在宽度限制内
 */
function isValid(str) {
  return getWidth(str) <= MAX_WIDTH;
}

/**
 * 返回用于展示的昵称（确保不超宽）
 */
function displayName(str) {
  return truncate(str, MAX_WIDTH);
}

module.exports = { getWidth, truncate, isValid, displayName, MAX_WIDTH, isCJK };
