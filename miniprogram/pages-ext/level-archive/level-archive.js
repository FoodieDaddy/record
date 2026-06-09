const { get } = require('../../utils/request');
const { getMirrorProfile } = require('../../utils/mirror-api');
const app = getApp();

const LEVEL_TITLES = {
  1: '观察员',
  2: '参与者',
  3: '执行者',
  4: '掌控者',
  5: '候选者'
};

const BADGE_CONFIG = [
  { id: 'first_match',   name: '首次封存',   code: '首任',     icon: 'circle',  desc: '完成第一次任务封存',    field: 'matchCount',  target: 1 },
  { id: 'match_10',      name: '累计十任',   code: 'x10',      icon: 'layers',  desc: '累计完成10次封存',    field: 'matchCount',  target: 10 },
  { id: 'match_50',      name: '半百任务',   code: 'x50',      icon: 'layers',  desc: '累计完成50次封存',    field: 'matchCount',  target: 50 },
  { id: 'score_100',     name: '百分成员',   code: '100+',     icon: 'star',    desc: '累计净数值达到100',   field: 'totalScore',  target: 100 },
  { id: 'score_1000',    name: '数值破千',   code: '1000+',    icon: 'diamond', desc: '累计净数值达到1000',  field: 'totalScore',  target: 1000 },
  { id: 'win_3_streak',  name: '三次正馈',   code: '3 连续',   icon: 'bolt',    desc: '连续3场获得正向反馈',   field: 'winStreak',   target: 3 },
  { id: 'win_10',        name: '十次正馈',   code: '10 连续',  icon: 'bolt',    desc: '连续10场获得正向反馈',  field: 'winStreak',   target: 10 },
  { id: 'win_rate_50',   name: '正馈过半',   code: '50%+',     icon: 'target',  desc: '正反馈率达到50%',      field: 'winRate',     target: 50 },
  { id: 'mirror_sync',   name: '镜像同步',   code: '已同步',   icon: 'scan',    desc: '完成MBTI校准',        field: 'mbtiSync',    target: 1 },
  { id: 'level_2',       name: '等级提升',   code: 'Lv.2',     icon: 'arrow-up',desc: '身份等级达到2级',     field: 'level',       target: 2 },
  { id: 'level_3',       name: '指令执行者', code: 'Lv.3',     icon: 'arrow-up',desc: '身份等级达到3级',     field: 'level',       target: 3 },
  { id: 'stability_80',  name: '稳定执行者', code: '稳定',     icon: 'shield',  desc: '稳定度达到80',        field: 'stability',   target: 80 }
];

Page({
  data: {
    animationEnabled: true,
    level: 1,
    levelTitle: '观察员',
    levelExp: 0,
    levelExpDisplay: 0,
    levelExpRange: 0,
    levelProgress: 0,
    levelRemainingExp: 0,
    nextLevelTitle: '',
    stability: null,
    matchCount: 0,
    totalScore: 0,
    bestAchievement: null,
    achievements: []
  },

  onLoad() {
    this.setData({
      animationEnabled: app.globalData.animationEnabled !== false
    });
    this.loadAll();
  },

  async loadAll() {
    await Promise.all([
      this.loadIdentityLevel(),
      this.loadScoreStats(),
      this.loadMbtiStatus()
    ]);
  },

  async loadIdentityLevel() {
    try {
      const res = await get('/user/identity-level');
      if (!res) return;
      const levelExp = Math.max(0, res.currentLevelExp || 0);
      const levelExpRange = Math.max(0, res.requiredExpInLevel || 0);
      const levelExpDisplay = levelExpRange > 0 ? Math.min(levelExp, levelExpRange) : levelExp;
      const levelRemainingExp = Math.max(0, levelExpRange - levelExp);
      const levelProgress = Math.max(0, Math.min(100, res.progress || 0));
      const nextLevel = (res.level || 1) + 1;
      this.setData({
        level: res.level || 1,
        levelTitle: res.title || '观察员',
        nextLevelTitle: LEVEL_TITLES[nextLevel] || '',
        levelExp,
        levelExpDisplay,
        levelExpRange,
        levelRemainingExp,
        levelProgress,
        stability: res.stability
      });
    } catch (e) {
      console.error('加载身份等级失败', e);
    }
  },

  async loadScoreStats() {
    try {
      const resp = await get('/score/trend?limit=50');
      const points = (resp && resp.points) || [];
      const totalScore = points.reduce((sum, p) => sum + (p.netScore || 0), 0);
      const wins = points.filter(p => p.netScore > 0).length;
      const matchCount = points.length;
      const winRate = matchCount > 0 ? Math.round((wins / matchCount) * 100) : 0;

      let winStreak = 0;
      let maxWinStreak = 0;
      for (const p of points) {
        if (p.netScore > 0) {
          winStreak++;
          maxWinStreak = Math.max(maxWinStreak, winStreak);
        } else {
          winStreak = 0;
        }
      }

      this.setData({ totalScore, matchCount, winRate, maxWinStreak });
      this.computeAchievements();
    } catch (e) {
      console.error('加载积分数据失败', e);
    }
  },

  async loadMbtiStatus() {
    try {
      const res = await getMirrorProfile();
      if (res && res.mbti) {
        app.globalData.mbtiCalibrated = !!res.mbti.calibrated;
        this.computeAchievements();
      }
    } catch (e) {
      // 镜像数据加载失败不影响主流程
    }
  },

  computeAchievements() {
    const { matchCount, totalScore, winRate, maxWinStreak, level, stability } = this.data;
    const mbtiSync = app.globalData.mbtiCalibrated ? 1 : 0;

    const statsMap = {
      matchCount, totalScore, winRate,
      winStreak: maxWinStreak || 0,
      mbtiSync,
      level,
      stability: stability || 0
    };

    const achievements = BADGE_CONFIG.map(badge => {
      const current = Math.max(0, statsMap[badge.field] || 0);
      const progress = Math.max(0, Math.min(current, badge.target));
      const progressPct = badge.target > 0 ? Math.round(progress * 100 / badge.target) : 0;
      return {
        id: badge.id,
        name: badge.name,
        code: badge.code,
        icon: badge.icon,
        desc: badge.desc,
        progress,
        progressPct,
        progressText: progress + '/' + badge.target,
        target: badge.target,
        unlocked: current >= badge.target
      };
    });

    const unlocked = achievements.filter(a => a.unlocked);
    const bestAchievement = unlocked.length > 0 ? unlocked[0] : achievements[0];

    this.setData({ achievements, bestAchievement });
  }
});
