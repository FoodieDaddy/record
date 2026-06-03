/**
 * 语音播报工具 — 通过后端 TTS 接口合成语音
 */

const config = require('../config');

/** 队列播放，避免重叠 */
let _speaking = false;
const _queue = [];

function _dequeue() {
  if (_queue.length === 0) {
    _speaking = false;
    return;
  }
  _speaking = true;
  const text = _queue.shift();
  _speakOnce(text, _dequeue);
}

function _speakOnce(text, onDone) {
  const settings = getSettings();
  const url = config.baseUrl + '/tts/audio?text=' + encodeURIComponent(text) + '&voice=' + encodeURIComponent(settings.voice);

  wx.downloadFile({
    url,
    success: (res) => {
      if (res.statusCode !== 200) {
        onDone();
        return;
      }
      // 校验返回的是音频文件而非错误 JSON
      const ct = (res.header && (res.header['content-type'] || res.header['Content-Type'])) || '';
      if (!ct.includes('audio')) {
        console.warn('[TTS] 非音频响应:', ct);
        onDone();
        return;
      }
      // 保存到持久化路径（http://tmp/ 路径不兼容 InnerAudioContext）
      const fs = wx.getFileSystemManager();
      const savedPath = `${wx.env.USER_DATA_PATH}/tts_${Date.now()}.mp3`;
      fs.saveFile({
        tempFilePath: res.tempFilePath,
        filePath: savedPath,
        success: () => _playAudio(savedPath, onDone),
        fail: () => _playAudio(res.tempFilePath, onDone)
      });
    },
    fail: () => onDone()
  });
}

function _playAudio(src, onDone) {
  const audio = wx.createInnerAudioContext();
  audio.src = src;
  audio.obeyMuteSwitch = false;

  const cleanup = () => {
    try { audio.destroy(); } catch (e) {}
    try { wx.getFileSystemManager().unlinkSync(src); } catch (e) {}
  };

  let played = false;
  audio.onCanplay(() => {
    if (played) return;
    played = true;
    audio.play();
  });
  audio.onEnded(() => {
    cleanup();
    onDone();
  });
  audio.onError(() => {
    cleanup();
    onDone();
  });
  setTimeout(() => {
    if (played) return;
    played = true;
    audio.play();
  }, 300);
}

/**
 * 计分语音播报
 */
function speakTransfer(fromName, toName, amount) {
  const settings = getSettings();
  console.log('[TTS] speakTransfer:', fromName, toName, amount, 'enabled:', settings.enabled);
  if (!settings.enabled) return;
  const text = `${toName} 收到 ${fromName} 的 ${amount} 分`;
  _queue.push(text);
  if (!_speaking) _dequeue();
}

function speak(text) {
  if (!text) return;
  _queue.push(text);
  if (!_speaking) _dequeue();
}

function stop() {
  _queue.length = 0;
  _speaking = false;
}

function getSettings() {
  const saved = wx.getStorageSync('voiceSettings');
  return {
    enabled: saved.enabled !== undefined ? saved.enabled : true,
    voiceId: saved.voiceId || 'std_01',
    voiceName: saved.voiceName || '晓晓',
    voice: saved.voice || 'zh-CN-XiaoxiaoNeural'
  };
}

function saveSettings(partial) {
  const current = getSettings();
  wx.setStorageSync('voiceSettings', { ...current, ...partial });
}

module.exports = { speakTransfer, speak, stop, getSettings, saveSettings };
