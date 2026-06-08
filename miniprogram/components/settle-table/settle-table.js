/**
 * 对角线脉冲矩阵表组件
 * 行列 = 玩家，对角线 = 总脉冲，非对角线 = 净脉冲差
 */
Component({
  properties: {
    memberScores: { type: Array, value: [] },
    myUserId: { type: String, value: '' }
  },

  data: {
    players: [],
    matrix: []
  },

  observers: {
    'memberScores, myUserId'() {
      this._buildMatrix();
    }
  },

  methods: {
    _buildMatrix() {
      const list = this.data.memberScores;
      if (!list || list.length === 0) {
        this.setData({ players: [], matrix: [] });
        return;
      }

      const myId = String(this.data.myUserId);
      const players = list.map(m => ({
        userId: String(m.userId),
        nickname: m.nickname || '?',
        firstChar: (m.nickname || '?')[0],
        finalScore: m.finalScore || 0,
        isMe: String(m.userId) === myId
      }));

      const n = players.length;
      const matrix = [];
      for (let i = 0; i < n; i++) {
        const row = [];
        for (let j = 0; j < n; j++) {
          if (i === j) {
            // 对角线：该玩家总脉冲
            const score = players[i].finalScore;
            row.push({
              isDiagonal: true,
              value: score,
              display: (score > 0 ? '+' : '') + score,
              colorClass: score > 0 ? 'cell-positive' : score < 0 ? 'cell-negative' : 'cell-zero'
            });
          } else {
            // 非对角线：空（简化显示）
            row.push({ isDiagonal: false, display: '', colorClass: '' });
          }
        }
        matrix.push(row);
      }

      this.setData({ players, matrix });
    }
  }
});
