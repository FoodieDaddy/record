const { getFirstChar, normalizeAvatarUrl } = require('../../utils/avatar');

const FORMATION_SAFE_ZONE = { minY: 22, maxY: 52, minX: 18, maxX: 82 };
const SPARKLINE_EMPTY_POINTS = [
  { x: 0, y: 35 },
  { x: 25, y: 45 },
  { x: 50, y: 38 },
  { x: 75, y: 55 },
  { x: 100, y: 42 }
];
const FORMATION_LAYOUTS = {
  1: [{ x: 50, y: 40, sizeClass: 'ship-craft--solo' }],
  2: [
    { x: 34, y: 42, sizeClass: 'ship-craft--duo' },
    { x: 68, y: 34, sizeClass: 'ship-craft--duo' }
  ],
  3: [
    { x: 26, y: 44, sizeClass: 'ship-craft--normal' },
    { x: 50, y: 32, sizeClass: 'ship-craft--normal' },
    { x: 74, y: 42, sizeClass: 'ship-craft--normal' }
  ],
  4: [
    { x: 24, y: 44, sizeClass: 'ship-craft--compact' },
    { x: 44, y: 30, sizeClass: 'ship-craft--compact' },
    { x: 64, y: 32, sizeClass: 'ship-craft--compact' },
    { x: 82, y: 44, sizeClass: 'ship-craft--compact' }
  ]
};
const FORMATION_POSITIONS = [
  { x: 24, y: 44 },
  { x: 44, y: 30 },
  { x: 64, y: 32 },
  { x: 82, y: 44 },
  { x: 31, y: 42 },
  { x: 54, y: 40 },
  { x: 72, y: 46 },
  { x: 20, y: 48 },
  { x: 82, y: 30 },
  { x: 38, y: 34 },
  { x: 58, y: 32 },
  { x: 69, y: 24 },
  { x: 28, y: 26 },
  { x: 48, y: 47 },
  { x: 80, y: 47 }
];

function clampFormationPosition(pos) {
  const z = FORMATION_SAFE_ZONE;
  return {
    x: Math.max(z.minX, Math.min(z.maxX, pos.x)),
    y: Math.max(z.minY, Math.min(z.maxY, pos.y))
  };
}

function getTraceSortValue(trace) {
  if (!trace) return 0;
  const time = new Date(trace.createdAt || '').getTime();
  if (!Number.isNaN(time)) return time;
  return Number(trace.id || 0);
}

function pickLatestTrace(traces = []) {
  return traces.reduce((latest, trace) => (
    getTraceSortValue(trace) >= getTraceSortValue(latest) ? trace : latest
  ), null);
}

function formatCrewName(name = '') {
  const text = String(name || '成员').trim();
  return text.length > 6 ? text.slice(0, 6) : text;
}

function formatCallSign(name = '') {
  const text = String(name || '未命名').trim();
  return text.length > 5 ? text.slice(0, 5) : text;
}

function formatPulseValue(value = 0) {
  const num = Number(value || 0);
  if (Math.abs(num) >= 100000) return `${(num / 10000).toFixed(1)}w`;
  return `${num}`;
}

function getPresenceClass(userId, onlineMap = {}, hasPresenceSnapshot = false, myUserId = '') {
  const uid = String(userId || '');
  if (!hasPresenceSnapshot) {
    return uid === String(myUserId) ? 'online' : 'syncing';
  }
  return onlineMap[uid] ? 'online' : 'offline';
}

function getPresenceLabel(userId, onlineMap = {}, hasPresenceSnapshot = false, myUserId = '') {
  const uid = String(userId || '');
  if (!hasPresenceSnapshot) {
    return uid === String(myUserId) ? '链路在线' : '链路同步中';
  }
  return onlineMap[uid] ? '链路在线' : '链路离线';
}

function getSeatLayoutMode(count) {
  if (count <= 1) return 'solo';
  if (count === 2) return 'duo';
  if (count <= 4) return 'compact';
  if (count <= 8) return 'wide';
  return 'matrix';
}

function deriveModeLabel(room, scoreMode = 1) {
  if (!room) return Number(scoreMode) === 2 ? '本局录入' : '自由流转';
  return Number(room.scoreMode) === 2 ? '本局录入' : '自由流转';
}

function derivePhaseLabel(hasFormation, state, roundRecord) {
  if (!hasFormation) return '待机';
  if (state === 'sealing') return '封存中';
  if (state === 'sealed') return '已封存';
  return roundRecord ? '录入中' : '记录中';
}

function deriveStageText(hasFormation, state) {
  if (!hasFormation) return '编队记录中';
  if (state === 'sealing' || state === 'sealed') return '航程已封存';
  return '编队记录中';
}

function deriveLinkLabel(hasFormation, state, options = {}) {
  if (!hasFormation) return '链路待接入';
  if (options.wsReconnecting) return '通讯链路波动';
  if (state === 'sealing') return '封存链路保持';
  return options.wsConnected ? '通讯链路在线' : '通讯链路待接入';
}

function deriveFormationShips(members = [], selfId = '', options = {}) {
  const onlineMap = options.onlineUserMap || {};
  const hasPresenceSnapshot = !!options.hasPresenceSnapshot;
  const myUserId = options.myUserId || selfId;
  const externalMembers = (members || [])
    .filter(member => String(member.userId || member.id || '') !== String(selfId))
    .slice(0, FORMATION_POSITIONS.length);
  const count = externalMembers.length;
  const layout = FORMATION_LAYOUTS[count] || FORMATION_POSITIONS.map(pos => ({
    ...pos,
    sizeClass: count <= 6 ? 'ship-craft--normal' : 'ship-craft--compact'
  }));
  const newMap = options.shipNewMap || {};

  return externalMembers.map((member, index) => {
    const rawPos = layout[index] || { x: 50, y: 30, sizeClass: 'ship-craft--compact' };
    const pos = clampFormationPosition(rawPos);
    const rawPulse = member.displayScore !== undefined ? member.displayScore : member.score;
    const pulse = Number(rawPulse || 0);
    const uid = member.userId || member.id;
    const presenceClass = member.presenceClass ||
      getPresenceClass(uid, onlineMap, hasPresenceSnapshot, myUserId);
    const callsign = formatCallSign(member.nickname);
    const pulseClass = pulse > 0 ? 'is-positive' : pulse < 0 ? 'is-negative' : 'is-zero';
    const pulseDisplay = formatPulseValue(pulse);

    return {
      userId: uid,
      callSign: callsign,
      callsign,
      nickname: formatCrewName(member.nickname),
      avatarUrl: normalizeAvatarUrl(member.avatarUrl),
      avatarChar: getFirstChar(member.nickname || '?'),
      pulse: pulseDisplay,
      pulseDisplay,
      pulseTone: pulse > 0 ? 'positive' : pulse < 0 ? 'negative' : 'zero',
      pulseClass,
      online: presenceClass !== 'offline',
      presenceClass,
      isNew: !!newMap[uid],
      linkLabel: member.presenceLabel ||
        getPresenceLabel(uid, onlineMap, hasPresenceSnapshot, myUserId),
      roleLabel: member.isHost ? '主控' : '编队',
      scaleClass: rawPos.sizeClass,
      orbSizeClass: rawPos.sizeClass,
      sizeClass: rawPos.sizeClass,
      x: pos.x,
      y: pos.y,
      slotIndex: index + 1
    };
  });
}

function buildSeatList(members = [], options = {}) {
  const onlineMap = options.onlineUserMap || {};
  const hasPresenceSnapshot = !!options.hasPresenceSnapshot;
  const myUserId = options.myUserId || '';
  return (members || []).slice(0, 16).map(m => ({
    userId: m.userId || m.id,
    nickname: m.nickname,
    avatarUrl: normalizeAvatarUrl(m.avatarUrl),
    score: m.score || 0,
    displayName: formatCrewName(m.nickname),
    scoreText: formatPulseValue(m.displayScore !== undefined ? m.displayScore : m.score),
    active: true,
    seatKey: `crew-${m.userId || m.id}`,
    isSelf: String(m.userId || m.id) === String(myUserId),
    isHost: m.isHost || false,
    presenceClass: getPresenceClass(m.userId || m.id, onlineMap, hasPresenceSnapshot, myUserId),
    presenceLabel: getPresenceLabel(m.userId || m.id, onlineMap, hasPresenceSnapshot, myUserId)
  }));
}

function buildTerminalLogEntries(pulseTraces = [], maxEntries = 3) {
  const traces = pulseTraces.slice(-maxEntries);
  return traces.map(trace => {
    const ts = trace.createdAt ? new Date(trace.createdAt) : null;
    const time = ts && !isNaN(ts.getTime())
      ? `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}:${String(ts.getSeconds()).padStart(2, '0')}`
      : (trace.timeFormatted || '--:--:--');
    const direction = trace.direction || '';
    const text = direction ? `${direction} · ${trace.title || '脉冲记录'}` : (trace.title || '脉冲记录');
    return {
      id: trace.id,
      time,
      text,
      value: trace.valueText || '',
      valueClass: trace.valueClass || '',
      isNew: !!trace.isNew
    };
  });
}

function buildCockpitView(ctx = {}) {
  const room = ctx.currentRoom;
  const state = ctx.cockpitState;
  const grid = ctx.memberGrid || [];
  const hasFormation = !!(room && ctx.viewingRoom);
  const isConnecting = state === 'connecting';
  const selfId = String(ctx.myUserId || '');
  const selfMember = grid.find(m => String(m.userId) === selfId) ||
    (room && room.members || []).find(m => String(m.userId) === selfId) ||
    {};
  const rawPulse = selfMember.displayScore !== undefined ? selfMember.displayScore : selfMember.score;
  const myPulse = Number(rawPulse || 0);
  const formationCount = hasFormation
    ? (grid.length || (room && room.members ? room.members.length : 0))
    : 0;
  const externalShips = deriveFormationShips(grid, selfId, ctx);
  const terminalLogEntries = buildTerminalLogEntries(ctx.pulseTraces || []);

  let statusLabel, statusDot, statusSubtitle;
  if (isConnecting || state === 'connecting') {
    statusLabel = '驾驶舱启动中';
    statusDot = 'connecting';
    statusSubtitle = '';
  } else if (hasFormation) {
    statusLabel = '驾驶舱已接入';
    statusSubtitle = externalShips.length > 0 ? '' : '暂无外部航船';
    statusDot = 'online';
  } else {
    statusLabel = '驾驶舱待机中';
    statusDot = 'idle';
    statusSubtitle = '';
  }

  const lastTrace = pickLatestTrace(ctx.pulseTraces || []);
  const sparklineSrc = ctx.traceChartSparkline || [];
  const sparklinePoints = sparklineSrc.length > 0
    ? sparklineSrc.slice(-8)
    : SPARKLINE_EMPTY_POINTS;
  const userInfo = ctx.userInfo || {};

  return {
    hasFormation: hasFormation || isConnecting,
    isConnecting,
    statusLabel,
    statusDot,
    statusSubtitle,
    formationCode: hasFormation && room ? room.roomNo : '--',
    roomNo: hasFormation && room ? room.roomNo : '--',
    formationCount,
    memberCountText: `${formationCount}/16`,
    maxMembers: 16,
    myPulse,
    myPulseText: formatPulseValue(myPulse),
    myPulseDisplay: formatPulseValue(myPulse),
    selfPulseDisplay: formatPulseValue(myPulse),
    myPulseTone: myPulse > 0 ? 'positive' : myPulse < 0 ? 'negative' : 'zero',
    selfPulseClass: myPulse > 0 ? 'is-positive' : myPulse < 0 ? 'is-negative' : 'is-zero',
    myCallSign: formatCallSign(selfMember.nickname || userInfo.nickname || ''),
    isOwner: !!ctx.isOwner,
    roleLabel: ctx.isOwner ? '编队主控' : '编队成员',
    externalShips,
    transferCount: (ctx.scoreRecords || []).length,
    totalPulse: ctx.pulseStats ? ctx.pulseStats.totalAmount : '0',
    lastPulseText: lastTrace ? lastTrace.title : '等待更多脉冲写入',
    lastPulseAmount: lastTrace ? lastTrace.valueText : '',
    sparklinePoints,
    hasTrajectory: sparklineSrc.length > 0,
    terminalLogEntries
  };
}

module.exports = {
  SPARKLINE_EMPTY_POINTS,
  pickLatestTrace,
  buildCockpitView,
  deriveFormationShips,
  deriveModeLabel,
  derivePhaseLabel,
  deriveStageText,
  deriveLinkLabel,
  buildSeatList,
  getPresenceClass,
  getPresenceLabel,
  getSeatLayoutMode,
  formatCrewName,
  formatCallSign,
  formatPulseValue
};
