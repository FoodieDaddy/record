const { getColor, getFirstChar } = require('../../utils/avatar')
const app = getApp()

/**
 * 2.5D 座位模式组件 — 纯 CSS3 透视架构
 *
 * 核心算法：第一人称主视角锚定
 *   relIndex = (absoluteIndex - myIndex + N) % N
 *   当前用户永远渲染在 relIndex == 0（屏幕正下方）
 *
 * 布局：百分比坐标定位在 perspective 容器上
 *   桌面 rotateX(60deg) + 座位 counter-rotateX(-60deg) = 广告牌效应
 */

const SCORE_ROLL_DURATION = 600

Component({
  properties: {
    members: { type: Array, value: [] },
    scoreMap: { type: Object, value: {} },
    myUserId: { type: String, value: '' },
    maxSeats: { type: Number, value: 16 },
    tableLabel: { type: String, value: '' },
    layoutType: { type: String, value: 'circle' },
    showDebug: { type: Boolean, value: false },
    showActions: { type: Boolean, value: false },
    isOwner: { type: Boolean, value: false },
    waitingList: { type: Array, value: [] }
  },

  data: {
    seats: [],
    animationEnabled: true,
    editMode: false,
    showPicker: false,
    pickerSeatIndex: -1,
    showActionMenu: false,
    actionTarget: { userId: '', nickname: '', score: 0 }
  },

  observers: {
    'members, scoreMap, myUserId, maxSeats': function (members, scoreMap, myUserId, maxSeats) {
      if (!members || members.length === 0) return
      try {
        this._buildSeats(members, scoreMap, myUserId, maxSeats)
      } catch (err) {
        console.error('[seat-mode] observer 异常', err)
      }
    }
  },

  lifetimes: {
    attached() {
      this._animTimers = {}
      this._myIndex = -1
      this.setData({
        animationEnabled: app.globalData.animationEnabled !== false
      })
    },
    ready() {
      try {
        const { members, scoreMap, myUserId, maxSeats } = this.data
        if (members && members.length > 0 && (!this.data.seats || this.data.seats.length === 0)) {
          this._buildSeats(members, scoreMap, myUserId, maxSeats)
        }
      } catch (err) {
        console.error('[seat-mode] ready 异常', err)
      }
    },
    detached() {
      Object.values(this._animTimers).forEach(t => clearTimeout(t))
      this._animTimers = {}
      if (this._scoreRaf) { clearTimeout(this._scoreRaf); this._scoreRaf = null }
    }
  },

  methods: {
    // ========== 座位构建 ==========

    _buildSeats(members, scoreMap, myUserId, maxSeats) {
      const N = members.length
      const M = Math.max(N, maxSeats || N)
      const myIndex = members.findIndex(m => String(m.userId) === String(myUserId))
      this._myIndex = myIndex

      // 计算 2D 百分比坐标
      const positions = this._layoutSeats(this.data.layoutType || 'circle', M)

      // 第一人称映射：relIndex = (i - myIndex + M) % M
      const memberMap = {}
      members.forEach((member, i) => {
        const relIndex = (i - myIndex + M) % M
        memberMap[relIndex] = member
      })

      const seats = []
      for (let rel = 0; rel < M; rel++) {
        const pos = positions[rel] || { x: 50, y: 50 }
        const member = memberMap[rel]

        if (member) {
          const score = scoreMap[member.userId] || 0
          const prevSeat = this._prevSeats && this._prevSeats.find(s => s.userId === member.userId)
          const animVal = prevSeat ? prevSeat.animValue : score

          seats.push({
            userId: member.userId,
            nickname: member.nickname,
            avatarUrl: member.avatarUrl || '',
            avatarColor: member.avatarUrl ? '' : getColor(member.nickname),
            avatarChar: member.avatarUrl ? '' : getFirstChar(member.nickname),
            score,
            animValue: animVal,
            displayScore: score,
            isMe: String(member.userId) === String(myUserId),
            isEmpty: false,
            isHighlight: false,
            absIndex: members.indexOf(member),
            index: members.indexOf(member),
            posX: pos.x,
            posY: pos.y
          })
        } else {
          seats.push({
            userId: `_empty_${rel}`,
            nickname: '',
            avatarUrl: '',
            avatarColor: '',
            avatarChar: '',
            score: 0,
            animValue: 0,
            displayScore: 0,
            isMe: false,
            isEmpty: true,
            isHighlight: false,
            absIndex: -1,
            index: -1,
            posX: pos.x,
            posY: pos.y
          })
        }
      }

      this._prevSeats = seats
      this.setData({ seats })
      this._animateScores(members, scoreMap)
    },

    // ========== 布局算法（百分比坐标） ==========

    _layoutSeats(type, N) {
      if (type === 'rectangle') return this._rectangleLayout(N)
      if (type === 'arc') return this._arcLayout(N)
      return this._circleLayout(N)
    },

    _circleLayout(N) {
      const R = 38 // 半径百分比
      const cx = 50, cy = 50
      const coords = []
      for (let i = 0; i < N; i++) {
        // 从底部（6 点钟）开始顺时针
        const angle = (Math.PI / 2) + i * (2 * Math.PI / N)
        coords.push({
          x: cx + R * Math.cos(angle),
          y: cy + R * Math.sin(angle)
        })
      }
      return coords
    },

    _rectangleLayout(N) {
      const coords = []
      const hw = 36, hd = 30 // 半宽、半深百分比
      const cx = 50, cy = 50

      let bottomN, topN, leftN, rightN
      if (N <= 2) { bottomN = 1; topN = N - 1; leftN = 0; rightN = 0 }
      else if (N <= 4) { bottomN = Math.ceil(N / 2); topN = N - bottomN; leftN = 0; rightN = 0 }
      else { bottomN = 2; topN = 2; leftN = Math.floor((N - 4) / 2); rightN = N - 4 - leftN }

      // 底边（近摄像机）
      for (let i = 0; i < bottomN; i++) {
        const x = bottomN === 1 ? cx : cx - hw + 2 * hw * i / (bottomN - 1)
        coords.push({ x, y: cy + hd })
      }
      // 右边
      for (let i = 0; i < rightN; i++) {
        const y = rightN === 1 ? cy : cy + hd - 2 * hd * i / (rightN - 1)
        coords.push({ x: cx + hw, y })
      }
      // 顶边
      for (let i = 0; i < topN; i++) {
        const x = topN === 1 ? cx : cx + hw - 2 * hw * i / (topN - 1)
        coords.push({ x, y: cy - hd })
      }
      // 左边
      for (let i = 0; i < leftN; i++) {
        const y = leftN === 1 ? cy : cy - hd + 2 * hd * i / (leftN - 1)
        coords.push({ x: cx - hw, y })
      }
      return coords
    },

    _arcLayout(N) {
      const R = 40
      const cx = 50, cy = 55
      const coords = []
      if (N === 1) {
        coords.push({ x: cx, y: cy - R * 0.3 })
        return coords
      }
      const halfSpan = Math.min(20 + (N - 2) * 10, 80) * Math.PI / 180
      for (let i = 0; i < N; i++) {
        const angle = (Math.PI / 2 - halfSpan) + 2 * halfSpan * i / (N - 1)
        coords.push({
          x: cx + R * Math.cos(angle),
          y: cy - R * Math.sin(angle)
        })
      }
      return coords
    },

    // ========== 分数动画 ==========

    _animateScores(members, scoreMap) {
      if (!this.data.animationEnabled) {
        const seats = this.data.seats.map(s => {
          if (s.isEmpty) return s
          const score = scoreMap[s.userId] || 0
          return { ...s, score, animValue: score, displayScore: score }
        })
        this.setData({ seats })
        return
      }

      const changed = []
      const prevSeats = this._prevSeats || []
      members.forEach(m => {
        const newScore = scoreMap[m.userId] || 0
        const prev = prevSeats.find(s => s.userId === m.userId)
        const oldScore = prev ? prev.displayScore : 0
        if (oldScore !== newScore) {
          changed.push({ userId: m.userId, from: oldScore, to: newScore })
        }
      })

      if (changed.length === 0) return

      const startTime = Date.now()
      const roll = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / SCORE_ROLL_DURATION, 1)
        const seats = this.data.seats.map(s => {
          const ch = changed.find(c => c.userId === s.userId)
          if (!ch) return s
          const ease = progress >= 1 ? 1 : 1 - Math.pow(2, -10 * progress)
          const current = Math.round(ch.from + (ch.to - ch.from) * ease)
          return { ...s, animValue: current }
        })
        this.setData({ seats })

        if (progress < 1) {
          this._scoreRaf = setTimeout(roll, 16)
        } else {
          const finalSeats = this.data.seats.map(s => {
            const ch = changed.find(c => c.userId === s.userId)
            if (!ch) return s
            return { ...s, score: ch.to, animValue: ch.to, displayScore: ch.to }
          })
          this.setData({ seats: finalSeats })
          this._prevSeats = finalSeats
        }
      }

      this._scoreRaf = setTimeout(roll, 16)
    },

    // ========== 外部方法 ==========

    updateScores(scoreMap) {
      const members = this.data.members
      if (!members || members.length === 0) return
      this._animateScores(members, scoreMap)
    },

    rollScore(userId, fromScore, toScore) {
      if (!this.data.animationEnabled) {
        const seats = this.data.seats.map(s => {
          if (s.userId === userId) {
            return { ...s, score: toScore, animValue: toScore, displayScore: toScore }
          }
          return s
        })
        this.setData({ seats })
        return
      }

      const startTime = Date.now()
      const roll = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / SCORE_ROLL_DURATION, 1)
        const ease = progress >= 1 ? 1 : 1 - Math.pow(2, -10 * progress)
        const current = Math.round(fromScore + (toScore - fromScore) * ease)

        const seats = this.data.seats.map(s => {
          if (s.userId === userId) {
            return { ...s, animValue: current }
          }
          return s
        })
        this.setData({ seats })

        if (progress < 1) {
          this._animTimers[`roll_${userId}`] = setTimeout(roll, 16)
        } else {
          const seats = this.data.seats.map(s => {
            if (s.userId === userId) {
              return { ...s, score: toScore, animValue: toScore, displayScore: toScore }
            }
            return s
          })
          this.setData({ seats })
        }
      }

      this._animTimers[`roll_${userId}`] = setTimeout(roll, 16)
    },

    // ========== UI 交互 ==========

    onSeatTap(e) {
      const { userId, isEmpty } = e.currentTarget.dataset
      if (isEmpty) {
        // 空位点击 → 打开成员选择器（仅房主）
        if (!this.data.isOwner) return
        const index = Number(e.currentTarget.dataset.index)
        this.setData({ showPicker: true, pickerSeatIndex: index })
        return
      }
      // 已入座点击 → 触发 tapseat 事件（非自己）
      if (String(userId) === String(this.data.myUserId)) return
      try { wx.vibrateShort({ type: 'light' }) } catch (err) {}
      this.triggerEvent('tapseat', { userId, index: Number(e.currentTarget.dataset.index) })
    },

    onSeatLongPress(e) {
      const { userId, isEmpty } = e.currentTarget.dataset
      if (isEmpty) return
      if (String(userId) === String(this.data.myUserId)) return
      try { wx.vibrateShort({ type: 'medium' }) } catch (err) {}
      const seat = (this.data.seats || []).find(s => String(s.userId) === String(userId))
      if (!seat) return
      this.setData({
        showActionMenu: true,
        actionTarget: { userId: seat.userId, nickname: seat.nickname, score: seat.score }
      })
    },

    toggleEditMode() {
      if (!this.data.isOwner) return
      const editMode = !this.data.editMode
      this.setData({ editMode })
      this.triggerEvent('editmodechange', { editMode })
    },

    onPickMember(e) {
      const userId = e.currentTarget.dataset.userId
      const seatIndex = this.data.pickerSeatIndex
      this.setData({ showPicker: false, pickerSeatIndex: -1 })
      this.triggerEvent('assignseat', { userId, seatIndex })
    },

    closePicker() {
      this.setData({ showPicker: false, pickerSeatIndex: -1 })
    },

    onTransfer() {
      const targetUserId = this.data.actionTarget.userId
      this.setData({ showActionMenu: false })
      this.triggerEvent('transfer', { targetUserId })
    },

    onRemoveSeat() {
      const targetUserId = this.data.actionTarget.userId
      this.setData({ showActionMenu: false })
      this.triggerEvent('removeseat', { targetUserId })
    },

    closeActionMenu() {
      this.setData({ showActionMenu: false })
    },

    onToggleAnimation() {
      const enabled = !this.data.animationEnabled
      app.globalData.animationEnabled = enabled
      wx.setStorageSync('animationEnabled', enabled)
      this.setData({ animationEnabled: enabled })
      this.triggerEvent('animationchange', { enabled })
    }
  }
})
