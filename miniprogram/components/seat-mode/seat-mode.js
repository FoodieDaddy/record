const { getColor, getFirstChar } = require('../../utils/avatar')
const app = getApp()

/**
 * 座位模式自定义组件
 *
 * 核心算法：第一人称主视角锚定
 *   相对偏移 = (absoluteIndex - myIndex + N) % N
 *   当前用户永远在 6 点钟方向（relIndex == 0）
 *
 * 性能约束：
 *   - 坐标仅初始化计算一次，后续只改 transform
 *   - 所有位移用 translate3d + will-change 触发 GPU 加速
 *   - 数字滚动走 WXS 视图层，避免 setData
 *   - wx:key="userId" 确保节点高效复用
 */

// 圆桌半径比例（相对容器短边）
const TABLE_RADIUS_RATIO = 0.32
// 最大座位数
const MAX_SEATS = 8
// 分数滚动动画时长
const SCORE_ROLL_DURATION = 600

Component({
  properties: {
    /** 成员列表 [{ userId, nickname, avatarUrl }] */
    members: { type: Array, value: [] },
    /** 分数映射 { [userId]: score } */
    scoreMap: { type: Object, value: {} },
    /** 当前用户 ID */
    myUserId: { type: String, value: '' },
    /** 房间最大座位数（默认 4） */
    maxSeats: { type: Number, value: 4 },
    /** 表面标签文字 */
    tableLabel: { type: String, value: '' },
    /** 显示调试信息 */
    showDebug: { type: Boolean, value: false },
    /** 显示底部操作栏 */
    showActions: { type: Boolean, value: false },
    /** 布局类型: 'circle' | 'rectangle' | 'arc' */
    layoutType: { type: String, value: 'circle' },
    /** 是否处于编辑模式（房主调整座位） */
    editMode: { type: Boolean, value: false },
    /** 编辑模式中被选中的用户 ID */
    editSelectedUserId: { type: String, value: '' }
  },

  data: {
    seats: [],
    animationEnabled: true
  },

  observers: {
    'members, scoreMap, myUserId, maxSeats': function (members, scoreMap, myUserId, maxSeats) {
      if (!members || members.length === 0) return
      this._buildSeats(members, scoreMap, myUserId, maxSeats)
    },
    'layoutType': function () {
      this._seatCoords = []
      this._coordContainerW = 0
      this._coordLayout = ''
      const N = (this.data.members || []).length
      if (N > 0) this._calcCoords(N)
    }
  },

  lifetimes: {
    attached() {
      this._seatCoords = []
      this._animTimers = {}
      this._myIndex = -1
      this.setData({
        animationEnabled: app.globalData.animationEnabled !== false
      })
    },

    detached() {
      // 清理所有动画定时器
      Object.values(this._animTimers).forEach(t => clearTimeout(t))
      this._animTimers = {}
      if (this._scoreRaf) {
        clearTimeout(this._scoreRaf)
        this._scoreRaf = null
      }
    }
  },

  methods: {
    /**
     * 构建座位数据
     * 核心：第一人称视角转换算法
     */
    _buildSeats(members, scoreMap, myUserId, maxSeats) {
      const N = members.length
      const myIndex = members.findIndex(m => String(m.userId) === String(myUserId))
      this._myIndex = myIndex

      // 布局坐标基于实际人数，随人数变化动态调整
      this._calcCoords(N)

      const seats = []
      for (let i = 0; i < N; i++) {
        const member = members[i]
        const relIndex = (i - myIndex + N) % N
        const coord = this._seatCoords[relIndex] || { x: 0, y: 0 }

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
          absIndex: i,
          index: i,
          x: coord.x,
          y: coord.y,
          transform: `translate3d(${coord.x}px,${coord.y}px,0)`
        })
      }

      this._prevSeats = seats
      this.setData({ seats })

      // 触发分数滚动动画
      this._animateScores(members, scoreMap)
    },

    /**
     * 计算座位坐标（容器中心为原点）
     * 仅在座位数变化、布局变化或首次渲染时计算
     */
    _calcCoords(N) {
      if (!this._seatCoords) this._seatCoords = []
      // 缓存命中：同 N、同布局、容器尺寸未变
      if (this._seatCoords.length === N && this._coordContainerW && this._coordLayout === this.data.layoutType) return

      const query = this.createSelectorQuery()
      query.select('#seatArena').boundingClientRect()
      query.exec((res) => {
        if (!res || !res[0] || !res[0].width) {
          if (!this._coordRetryCount) this._coordRetryCount = 0
          if (this._coordRetryCount < 10) {
            this._coordRetryCount++
            setTimeout(() => this._calcCoords(N), 100)
          }
          return
        }
        this._coordRetryCount = 0
        const rect = res[0]
        this._coordContainerW = rect.width
        this._coordLayout = this.data.layoutType
        this._seatCoords = this._layoutCoords(this.data.layoutType, N, rect)

        // 坐标就绪后重新渲染
        const members = this.data.members
        const scoreMap = this.data.scoreMap
        const myUserId = this.data.myUserId
        if (members && members.length > 0) {
          this._buildSeats(members, scoreMap, myUserId, N)
        }
      })
    },

    /**
     * 布局算法分派
     */
    _layoutCoords(type, N, rect) {
      const cx = rect.width / 2
      const cy = rect.height / 2
      const halfSeat = 60

      if (type === 'rectangle') {
        return this._rectangleLayout(N, rect, cx, cy, halfSeat)
      }
      if (type === 'arc') {
        return this._arcLayout(N, rect, cx, cy, halfSeat)
      }
      // 默认圆形
      return this._circleLayout(N, rect, cx, cy, halfSeat)
    },

    /** 圆桌布局：均匀环形分布 */
    _circleLayout(N, rect, cx, cy, halfSeat) {
      const radius = Math.min(rect.width, rect.height) * TABLE_RADIUS_RATIO
      const coords = []
      for (let i = 0; i < N; i++) {
        const angle = (90 + i * (360 / N)) * Math.PI / 180
        coords.push({
          x: Math.round(cx + radius * Math.cos(angle) - halfSeat),
          y: Math.round(cy + radius * Math.sin(angle) - halfSeat)
        })
      }
      return coords
    },

    /**
     * 长桌布局：矩形围坐
     * 座位沿矩形四边分布，底边（靠近自己）座多人少，对面座少人多
     * N=2: 上下各1  N=4: 上下各2  N=6: 上下各2+左右各1  N=8: 上下各2+左右各2
     */
    _rectangleLayout(N, rect, cx, cy, halfSeat) {
      const coords = []
      const padX = rect.width * 0.12
      const padY = rect.height * 0.1
      const left = padX
      const right = rect.width - padX
      const top = padY
      const bottom = rect.height - padY

      // 计算每边分配的座位数
      // 优先底边和顶边，多余放左右
      let bottomN, topN, leftN, rightN
      if (N <= 2) {
        bottomN = 1; topN = N - 1; leftN = 0; rightN = 0
      } else if (N <= 4) {
        bottomN = Math.ceil(N / 2); topN = N - bottomN; leftN = 0; rightN = 0
      } else if (N <= 6) {
        bottomN = 2; topN = 2; leftN = Math.floor((N - 4) / 2); rightN = N - 4 - leftN
      } else {
        bottomN = 2; topN = 2; leftN = Math.floor((N - 4) / 2); rightN = N - 4 - leftN
      }

      // 底边：从左到右（靠近用户）
      for (let i = 0; i < bottomN; i++) {
        const x = bottomN === 1 ? cx : left + (right - left) * i / (bottomN - 1)
        coords.push({ x: Math.round(x - halfSeat), y: Math.round(bottom - halfSeat) })
      }
      // 右边：从下到上
      for (let i = 0; i < rightN; i++) {
        const y = rightN === 1 ? cy : bottom - (bottom - top) * i / (rightN - 1)
        coords.push({ x: Math.round(right - halfSeat), y: Math.round(y - halfSeat) })
      }
      // 顶边：从右到左（对面）
      for (let i = 0; i < topN; i++) {
        const x = topN === 1 ? cx : right - (right - left) * i / (topN - 1)
        coords.push({ x: Math.round(x - halfSeat), y: Math.round(top - halfSeat) })
      }
      // 左边：从上到下
      for (let i = 0; i < leftN; i++) {
        const y = leftN === 1 ? cy : top + (bottom - top) * i / (leftN - 1)
        coords.push({ x: Math.round(left - halfSeat), y: Math.round(y - halfSeat) })
      }
      return coords
    },

    /**
     * 半弧布局：底部宽弧展开
     * 自己在弧底中央，其他人向两侧展开
     * 弧度随人数增多而变宽
     */
    _arcLayout(N, rect, cx, cy, halfSeat) {
      const coords = []
      const radius = Math.min(rect.width, rect.height) * 0.42
      if (N === 1) {
        coords.push({ x: Math.round(cx - halfSeat), y: Math.round(cy + radius * 0.3 - halfSeat) })
        return coords
      }
      // 根据人数调整弧的跨度：人少窄弧，人多宽弧
      // N=2: ±20°  N=4: ±50°  N=6: ±70°  N=8: ±80°
      const halfSpan = Math.min(20 + (N - 2) * 10, 80)
      const startAngle = 270 - halfSpan
      const endAngle = 270 + halfSpan
      for (let i = 0; i < N; i++) {
        const angle = (startAngle + (endAngle - startAngle) * (i / (N - 1))) * Math.PI / 180
        coords.push({
          x: Math.round(cx + radius * Math.cos(angle) - halfSeat),
          y: Math.round(cy + radius * Math.sin(angle) - halfSeat)
        })
      }
      return coords
    },

    /**
     * 分数滚动动画
     * 分两阶段：
     * 1. 粒子动画阶段 — 保持旧分（由外部 transfer 动画控制）
     * 2. 滚动阶段 — 从旧值缓动到新值
     */
    _animateScores(members, scoreMap) {
      if (!this.data.animationEnabled) {
        // 非动画模式，直接设置最终值
        const seats = this.data.seats.map(s => {
          if (s.isEmpty) return s
          const score = scoreMap[s.userId] || 0
          return { ...s, score, animValue: score, displayScore: score }
        })
        this.setData({ seats })
        return
      }

      // 找出分数变化的座位
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

      // 启动滚动动画
      const startTime = Date.now()
      const roll = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / SCORE_ROLL_DURATION, 1)
        const seats = this.data.seats.map(s => {
          const ch = changed.find(c => c.userId === s.userId)
          if (!ch) return s
          // easeOutExpo
          const ease = progress >= 1 ? 1 : 1 - Math.pow(2, -10 * progress)
          const current = Math.round(ch.from + (ch.to - ch.from) * ease)
          return { ...s, animValue: current }
        })
        this.setData({ seats })

        if (progress < 1) {
          this._scoreRaf = setTimeout(roll, 16)
        } else {
          // 确保最终值精确
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

    /**
     * 点击座位
     * - 编辑模式：触发 editseat（房主调整座位）
     * - 普通模式：触发 tapseat（计分等）
     */
    onTapSeat(e) {
      const { userId, index } = e.currentTarget.dataset
      try { wx.vibrateShort({ type: 'light' }) } catch (err) {}

      if (this.data.editMode) {
        this.triggerEvent('editseat', { userId, index })
        return
      }

      this.triggerEvent('tapseat', { userId, index })
    },


    /**
     * 头像加载失败兜底
     */
    onAvatarError(e) {
      const userId = e.currentTarget.dataset.userId
      const seats = this.data.seats.map(s => {
        if (s.userId === userId) {
          return {
            ...s,
            avatarUrl: '',
            avatarColor: getColor(s.nickname),
            avatarChar: getFirstChar(s.nickname)
          }
        }
        return s
      })
      this.setData({ seats })
    },

    /**
     * 切换动画开关
     */
    onToggleAnimation() {
      const enabled = !this.data.animationEnabled
      app.globalData.animationEnabled = enabled
      wx.setStorageSync('animationEnabled', enabled)
      this.setData({ animationEnabled: enabled })
      this.triggerEvent('animationchange', { enabled })
    },

    /**
     * 外部调用：更新分数（带滚动动画）
     */
    updateScores(scoreMap) {
      const members = this.data.members
      if (!members || members.length === 0) return
      this._animateScores(members, scoreMap)
    },

    /**
     * 外部调用：触发分数滚动（粒子动画结束后调用）
     */
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
    }
  }
})
