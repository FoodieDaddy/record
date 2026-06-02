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
  const url = config.baseUrl + '/tts/audio?text=' + encodeURIComponent(text);

  wx.downloadFile({
    url,
    success: (res) => {
      if (res.statusCode !== 200) {
        console.warn('TTS 下载失败', res.statusCode);
        onDone();
        return;
      }
      const audio = wx.createInnerAudioContext();
      audio.src = res.tempFilePath;
      audio.obeyMuteSwitch = false;
      audio.onEnded(() => {
        try { audio.destroy(); } catch (e) {}
        onDone();
      });
      audio.onError((err) => {
        console.warn('TTS 播放失败', err);
        try { audio.destroy(); } catch (e) {}
        onDone();
      });
      audio.play();
    },
    fail: (err) => {
      console.warn('TTS 请求失败', err);
      onDone();
    }
  });
}

/**
 * 计分语音播报
 * @param {string} fromName 发起人昵称
 * @param {string} toName 得分方昵称
 * @param {string} amount 分数
 */
function speakTransfer(fromName, toName, amount) {
  const text = `${toName} 收到 ${fromName} 的 ${amount} 分`;
  _queue.push(text);
  if (!_speaking) _dequeue();
}

/**
 * 通用语音播报
 */
function speak(text) {
  if (!text) return;
  _queue.push(text);
  if (!_speaking) _dequeue();
}

/**
 * 停止当前播报
 */
function stop() {
  _queue.length = 0;
  _speaking = false;
}

function getSettings() {
  return { enabled: true };
}

function saveSettings() {}

module.exports = { speakTransfer, speak, stop, getSettings, saveSettings };
