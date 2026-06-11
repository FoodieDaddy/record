/**
 * 编队（房间）服务 — 封装房间相关 API
 */
const { get, post, put, del } = require('../utils/request');

/** 获取我的房间列表 */
function getMyRooms() {
  return get('/room/my');
}

/** 获取房间详情 */
function getRoomDetail(roomId) {
  return get(`/room/${roomId}`);
}

/** 创建房间 */
function createRoom(payload) {
  return post('/room', payload).then(res => {
    try {
      const behaviorLogger = require('../utils/behavior-logger');
      behaviorLogger.track('FLEET_CREATE', {
        scoreMode: payload.scoreMode,
        roundInputMethod: payload.roundInputMethod,
        roomId: res ? res.id : ''
      });
    } catch(e) {}
    return res;
  });
}

/** 加入房间 */
function joinRoom(roomNo) {
  return post('/room/join', { roomNo }).then(res => {
    try {
      const behaviorLogger = require('../utils/behavior-logger');
      behaviorLogger.track('FLEET_JOIN', {
        roomNo: roomNo,
        roomId: res ? res.id : ''
      });
    } catch(e) {}
    return res;
  });
}

/** 退出房间 */
function quitRoom(roomId) {
  return del(`/room/${roomId}/quit`);
}

/** 历史房间 */
function getHistory() {
  return get('/room/history');
}

/** 更新记分设置 */
function updateSettings(roomId, settings) {
  return put(`/room/${roomId}/settings`, settings);
}

module.exports = {
  getMyRooms,
  getRoomDetail,
  createRoom,
  joinRoom,
  quitRoom,
  getHistory,
  updateSettings,
};
