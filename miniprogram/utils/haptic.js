function vibrateShort(type) {
  const app = getApp();
  if (app.globalData.vibrateEnabled === false) return;
  try {
    wx.vibrateShort({ type: type || 'light' });
  } catch (err) {}
}

module.exports = { vibrateShort };
