/**
 * 单例音频管理器 — 防重叠播放
 * 策略：打断并播放最新音频（最新记分的情绪反应最重要）
 */

let instance = null;

class AudioManager {
  constructor() {
    this._audio = null;
    this._playing = false;
  }

  /**
   * 播放音频（打断当前正在播放的）
   * @param {string} url 音频文件 URL
   */
  play(url) {
    if (!url) return;

    // 打断当前播放
    this._stop();

    const audio = wx.createInnerAudioContext();
    audio.src = url;
    audio.obeyMuteSwitch = false; // 静音模式下也播放

    audio.onEnded(() => {
      this._destroy(audio);
    });

    audio.onError((err) => {
      console.warn('情绪音频播放失败', err);
      this._destroy(audio);
    });

    audio.play();
    this._audio = audio;
    this._playing = true;
  }

  /**
   * 停止当前播放
   */
  stop() {
    this._stop();
  }

  _stop() {
    if (this._audio) {
      try {
        this._audio.stop();
      } catch (e) {}
      this._destroy(this._audio);
    }
  }

  _destroy(audio) {
    if (audio) {
      try {
        audio.destroy();
      } catch (e) {}
    }
    if (this._audio === audio) {
      this._audio = null;
      this._playing = false;
    }
  }

  get isPlaying() {
    return this._playing;
  }
}

/**
 * 获取单例
 * @returns {AudioManager}
 */
function getAudioManager() {
  if (!instance) {
    instance = new AudioManager();
  }
  return instance;
}

module.exports = { getAudioManager };
