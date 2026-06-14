/**
 * 清理 room.js 中已提取到 handler 文件的方法
 * 用法：node clean-room.js
 */
const fs = require('fs');
const path = require('path');

const roomJsPath = path.join(__dirname, 'room.js');
let lines = fs.readFileSync(roomJsPath, 'utf-8').split('\n');

const methodsToRemove = [
  'handleStartSpace',
  'cancelLaunchWait',
  'retryLaunchWait',
  'openJoinPanel',
  'closeJoinPanel',
  'onJoinCodeInput',
  'handleJoinSpace',
  'handleSettle',
  'confirmLeaveOrDisband',
  'closeLeaveConfirm',
  'executeLeaveOrDisband',
  'openSealConfirm',
  'closeSealConfirm',
  'async handleSealRoom',
  'startSealHeartbeat',
  'stopSealHeartbeat',
  '_clearTransitionTimers',
  'canRecordPulse',
  'normalizeRoomActionError',
  'focusFormationForPulse',
  'openPulseRecorder',
  'openTransferPad',
  'onPulseValueInput',
  'tapPulsePreset',
  'clearPulseValue',
  'async handleSubmitPulse'
];

let removedCount = 0;
const resultLines = [];

let i = 0;
while (i < lines.length) {
  const line = lines[i];
  let isMethodStart = false;
  let methodName = '';

  for (const pattern of methodsToRemove) {
    const nameOnly = pattern.replace('async ', '');
    // 构建匹配：行首任意缩进 + 可选 async + 方法名 + 任意字符直到 (
    // 支持多行参数列表
    const escaped = nameOnly.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 简单检测：行中包含方法名且后面有 (
    if (line.match(new RegExp(`^\\s*` + (pattern.startsWith('async ') ? 'async\\s+' : '') + escaped + '\\s*\\('))) {
      isMethodStart = true;
      methodName = nameOnly;
      break;
    }
    // 也检测方法名在行中，且后面某行有 (
    if (line.match(new RegExp(`^\\s*` + (pattern.startsWith('async ') ? 'async\\s+' : '') + escaped + '\\s*$'))) {
      // 多行参数列表，继续读取直到找到 (
      let j = i + 1;
      let foundParen = false;
      while (j < lines.length) {
        if (lines[j].indexOf('(') !== -1) { foundParen = true; break; }
        if (lines[j].indexOf(')') !== -1 && lines[j].indexOf('(') === -1) { break; } // 遇到 ) 还没遇到 (，不是这个方法
        j++;
      }
      if (foundParen) {
        isMethodStart = true;
        methodName = nameOnly;
        // 调整 i 到包含 ( 的行
        i = j;
        break;
      }
    }
  }

  if (isMethodStart) {
    removedCount++;
    // 找到方法体结束的 }
    let braceCount = 0;
    let foundOpenBrace = false;
    let j = i;
    // 先找到 { 开始方法体
    while (j < lines.length) {
      const l = lines[j];
      for (let k = 0; k < l.length; k++) {
        if (l[k] === '(' && !foundOpenBrace) { /* skip */ }
        if (l[k] === ')' && !foundOpenBrace) { /* skip */ }
        if (l[k] === '{') { foundOpenBrace = true; braceCount++; break; }
      }
      if (foundOpenBrace) { j++; break; }
      j++;
    }
    // 现在找到匹配的 }
    while (j < lines.length) {
      const l = lines[j];
      for (let k = 0; k < l.length; k++) {
        if (l[k] === '{') braceCount++;
        if (l[k] === '}') { braceCount--; }
      }
      if (braceCount === 0) {
        // 找到方法结束，j 是 } 所在行
        // 跳过后面的逗号（如果有）
        if (j + 1 < lines.length && lines[j + 1].trim() === ',') {
          j++;
        }
        // 跳过方法后的空白行（最多一行）
        if (j + 1 < lines.length && lines[j + 1].trim() === '') {
          j++;
        }
        i = j + 1;
        break;
      }
      j++;
    }
  } else {
    resultLines.push(line);
    i++;
  }
}

const result = resultLines.join('\n');
fs.writeFileSync(roomJsPath, result, 'utf-8');
console.log(`尝试删除方法数: ${methodsToRemove.length}`);
console.log(`实际删除方法数: ${removedCount}`);
console.log(`清理后文件大小: ${result.length} bytes`);
console.log(`清理后文件行数: ${resultLines.length}`);
