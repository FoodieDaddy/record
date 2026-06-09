const profileService = require('../../services/profile-service');
const { getSettings, saveSettings, syncFromServer } = require('../../utils/voice');
const { vibrateShort } = require('../../utils/haptic');
const config = require('../../config');
const app = getApp();

const SAVE_DELAY = 2000;
const audioCtx = wx.createInnerAudioContext();
audioCtx.obeyMuteSwitch = false;

let _settingsTimer = null;
let _pendingSettings = {};

Page({
  data: {
    voiceEnabled: true,
    voiceName: '晓晓',
    selectedVoiceId: 'std_01',
    animationEnabled: true,
    vibrateEnabled: true,
    // 音色抽屉
    voiceSheetVisible: false,
    voiceCategories: [],
    activeVoiceCatId: 'female',
    scrollToCat: '',
    playingVoiceId: '',
    pendingVoice: null
  },

  onShow() {
    this.loadVoiceSettings();
    this.setData({
      animationEnabled: app.globalData.animationEnabled,
      vibrateEnabled: app.globalData.vibrateEnabled !== false
    });
    this.loadVoiceCatalog().then(() => {
      this.resolveVoiceName(this.data.selectedVoiceId);
    });
  },

  loadVoiceSettings() {
    const settings = getSettings();
    this.setData({
      voiceEnabled: settings.enabled,
      selectedVoiceId: settings.voiceId
    });
    this.resolveVoiceName(settings.voiceId);
  },

  resolveVoiceName(voiceId) {
    const cats = this.data.voiceCategories;
    if (!cats.length) {
      this.setData({ voiceName: voiceId });
      return;
    }
    for (const cat of cats) {
      const found = (cat.voices || []).find(v => v.id === voiceId);
      if (found) {
        this.setData({ voiceName: found.name });
        return;
      }
    }
    this.setData({ voiceName: voiceId });
  },

  onVoiceToggle() {
    const enabled = !this.data.voiceEnabled;
    this.setData({ voiceEnabled: enabled });
    saveSettings({ enabled });
    app.globalData.audioEnabled = enabled;
    wx.setStorageSync('audioEnabled', enabled);
    this.debouncedSaveSettings({ voiceEnabled: enabled });
    vibrateShort('light');
  },

  async loadVoiceCatalog() {
    if (this.data.voiceCategories.length > 0) return;
    try {
      const { get } = require('../../utils/request');
      const catalog = await get('/voice/catalog');
      const categories = catalog.categories || [];
      this.setData({ voiceCategories: categories });
      if (categories.length > 0 && !categories.find(c => c.id === this.data.activeVoiceCatId)) {
        this.setData({ activeVoiceCatId: categories[0].id });
      }
    } catch (e) {
      console.error('加载音色目录失败', e);
    }
  },

  openVoiceSheet() {
    this.loadVoiceCatalog();
    this.setData({ voiceSheetVisible: true });
  },

  closeVoiceSheet() {
    if (this.data.pendingVoice) {
      const pv = this.data.pendingVoice;
      saveSettings({ voiceId: pv.voiceId });
      this.debouncedSaveSettings({ voiceId: pv.voiceId });
      this.setData({ pendingVoice: null });
    }
    this.setData({ voiceSheetVisible: false });
    audioCtx.stop();
    this.setData({ playingVoiceId: '' });
  },

  onCatTap(e) {
    const catId = e.currentTarget.dataset.catId;
    this.setData({
      activeVoiceCatId: catId,
      scrollToCat: 'cat-' + catId
    });
  },

  onVoiceTap(e) {
    const voice = e.currentTarget.dataset.voice;
    const catId = e.currentTarget.dataset.catId;

    this.setData({
      selectedVoiceId: voice.id,
      voiceName: voice.name,
      activeVoiceCatId: catId,
      pendingVoice: { voiceId: voice.id }
    });

    audioCtx.stop();
    this.setData({ playingVoiceId: voice.id });
    audioCtx.src = config.baseUrl + '/voice/preview?file=' + encodeURIComponent(voice.file);
    audioCtx.play();

    audioCtx.offEnded();
    audioCtx.onEnded(() => {
      this.setData({ playingVoiceId: '' });
    });
  },

  onAnimationToggle() {
    const enabled = !this.data.animationEnabled;
    this.setData({ animationEnabled: enabled });
    app.globalData.animationEnabled = enabled;
    wx.setStorageSync('animationEnabled', enabled);
    this.debouncedSaveSettings({ animEnabled: enabled });
    vibrateShort('light');
  },

  onVibrateToggle() {
    const enabled = !this.data.vibrateEnabled;
    this.setData({ vibrateEnabled: enabled });
    app.globalData.vibrateEnabled = enabled;
    wx.setStorageSync('vibrateEnabled', enabled);
    this.debouncedSaveSettings({ vibrateEnabled: enabled });
    vibrateShort('light');
  },

  // ========== 防抖保存 ==========

  debouncedSaveSettings(partial) {
    Object.assign(_pendingSettings, partial);
    if (_settingsTimer) clearTimeout(_settingsTimer);
    _settingsTimer = setTimeout(() => {
      _settingsTimer = null;
      this.flushSaveSettings();
    }, SAVE_DELAY);
  },

  flushSaveSettings() {
    if (_settingsTimer) {
      clearTimeout(_settingsTimer);
      _settingsTimer = null;
    }
    if (Object.keys(_pendingSettings).length === 0) return;
    const payload = { ..._pendingSettings };
    _pendingSettings = {};
    profileService.saveUserSettings(payload).catch(() => {});
  },

  onHide() {
    this.flushSaveSettings();
  },

  onUnload() {
    this.flushSaveSettings();
    if (this.data.pendingVoice) {
      saveSettings(this.data.pendingVoice);
    }
    audioCtx.stop();
    audioCtx.destroy();
  }
});
