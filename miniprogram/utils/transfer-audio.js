/**
 * 计分音效播放
 * 策略：发起者播放确认音，得分方播放提示音，其他人静音
 */

const SEND_SRC = '/audio/transfer-send.mp3';
const RECEIVE_SRC = '/audio/transfer-receive.mp3';

function _play(src) {
  try {
    const audio = wx.createInnerAudioContext();
    audio.src = src;
    audio.obeyMuteSwitch = false;
    audio.onEnded(() => { try { audio.destroy(); } catch (e) {} });
    audio.onError(() => { try { audio.destroy(); } catch (e) {} });
    audio.play();
  } catch (e) {}
}

/** 发起者听到的确认音效 */
function playTransferSend() {
  _play(SEND_SRC);
}

/** 收款方听到的提示音效（仅在无情绪音频时调用） */
function playTransferReceive() {
  _play(RECEIVE_SRC);
}

module.exports = { playTransferSend, playTransferReceive };
