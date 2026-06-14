const { getFirstChar, getAvatarView } = require('../../utils/avatar')

Component({
  properties: {
    nodes: { type: Array, value: [] },
    links: { type: Array, value: [] },
    myUserId: { type: String, value: '' }
  },

  data: {
    graphWidth: 300,
    graphHeight: 220,
    positionedNodes: [],
    selectedNode: null,
    nodeDetails: null,
    canvasReady: false
  },

  observers: {
    'nodes, links'() {
      if (this._componentReady) {
        this._updateGraphMetrics(true)
      }
    }
  },

  lifetimes: {
    ready() {
      this._componentReady = true
      this._updateGraphMetrics(true)
    },
    detached() {
      this._componentReady = false
    }
  },

  methods: {
    _updateGraphMetrics(buildLayout) {
      const sysInfo = wx.getWindowInfo()
      const graphWidth = Math.min(sysInfo.windowWidth - 80, 340)
      const count = this.data.nodes.length
      const graphHeight = count <= 1
        ? 150
        : count === 2
          ? 180
          : count <= 4
            ? Math.min(graphWidth, 240)
            : graphWidth

      const afterUpdate = () => {
        if (buildLayout && this.data.nodes.length > 0) {
          wx.nextTick(() => this._buildLayout())
        }
      }
      if (graphWidth !== this.data.graphWidth || graphHeight !== this.data.graphHeight) {
        this.setData({ graphWidth, graphHeight }, afterUpdate)
      } else {
        afterUpdate()
      }
    },

    _buildLayout() {
      const { nodes, graphWidth, graphHeight, myUserId } = this.data
      const n = nodes.length
      if (n === 0) return

      const cx = graphWidth / 2
      const cy = graphHeight * (n <= 2 ? 0.42 : 0.48)
      const radiusX = graphWidth * 0.34
      const radiusY = Math.min(graphHeight * 0.30, graphWidth * 0.28)

      const positionedNodes = nodes.map((node, i) => {
        let x = cx
        let y = cy
        if (n === 2) {
          x = graphWidth * (i === 0 ? 0.26 : 0.74)
        } else if (n > 2) {
          const angle = (2 * Math.PI * i) / n - Math.PI / 2
          x = cx + radiusX * Math.cos(angle)
          y = cy + radiusY * Math.sin(angle)
        }
        const av = getAvatarView(node.nickname, node.avatarUrl)
        return {
          ...node,
          ...av,
          initial: getFirstChar(node.nickname),
          posX: x - 24,
          posY: y - 24,
          labelY: y + 28,
          isMe: String(node.userId) === String(myUserId),
          scoreColor: (node.score || 0) > 0 ? '#32D74B' : (node.score || 0) < 0 ? '#FF453A' : 'rgba(255,255,255,0.35)'
        }
      })

      this.setData({ positionedNodes, canvasReady: false }, () => this._drawLines())
    },

    _drawLines() {
      const query = this.createSelectorQuery()
      query.select('#networkCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) return

          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = wx.getWindowInfo().pixelRatio
          const width = this.data.graphWidth
          const height = this.data.graphHeight

          canvas.width = width * dpr
          canvas.height = height * dpr
          ctx.scale(dpr, dpr)
          ctx.clearRect(0, 0, width, height)

          const { links, positionedNodes } = this.data
          const nodeMap = {}
          positionedNodes.forEach((pn, i) => {
            nodeMap[String(pn.userId)] = i
          })

          for (const link of links) {
            const fi = nodeMap[String(link.from)]
            const fj = nodeMap[String(link.to)]
            if (fi === undefined || fj === undefined) continue

            const p1 = positionedNodes[fi]
            const p2 = positionedNodes[fj]
            const x1 = p1.posX + 24
            const y1 = p1.posY + 24
            const x2 = p2.posX + 24
            const y2 = p2.posY + 24

            const isPositive = link.netAmount > 0
            const lineWidth = Math.max(1, Math.min(3, Math.abs(link.netAmount) * 0.01 + 1))

            ctx.beginPath()
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
            ctx.strokeStyle = isPositive ? 'rgba(10,132,255,0.35)' : 'rgba(255,69,58,0.30)'
            ctx.lineWidth = lineWidth
            ctx.stroke()

            // 箭头方向：从净流出指向净流入
            const arrowX = isPositive ? x2 : x1
            const arrowY = isPositive ? y2 : y1
            const fromX = isPositive ? x1 : x2
            const fromY = isPositive ? y1 : y2
            const angle = Math.atan2(arrowY - fromY, arrowX - fromX)
            const arrowLen = 8

            ctx.beginPath()
            ctx.moveTo(arrowX, arrowY)
            ctx.lineTo(
              arrowX - arrowLen * Math.cos(angle - 0.4),
              arrowY - arrowLen * Math.sin(angle - 0.4)
            )
            ctx.moveTo(arrowX, arrowY)
            ctx.lineTo(
              arrowX - arrowLen * Math.cos(angle + 0.4),
              arrowY - arrowLen * Math.sin(angle + 0.4)
            )
            ctx.strokeStyle = isPositive ? 'rgba(10,132,255,0.50)' : 'rgba(255,69,58,0.45)'
            ctx.lineWidth = lineWidth * 0.8
            ctx.stroke()
          }

          this.setData({ canvasReady: true })
        })
    },

    onNodeTap(e) {
      const { nodes, links, myUserId, positionedNodes } = this.data
      const dataset = e.currentTarget.dataset
      const idx = dataset.index

      if (idx === undefined || idx === null) return

      const node = nodes[idx]
      if (!node) return

      const outgoing = links.filter(l => String(l.from) === String(node.userId))
      const incoming = links.filter(l => String(l.to) === String(node.userId))

      const totalSent = outgoing.reduce((s, l) => s + (l.netAmount || 0), 0)
      const totalReceived = incoming.reduce((s, l) => s + (l.netAmount || 0), 0)

      const topRecipient = outgoing.sort((a, b) => (b.netAmount || 0) - (a.netAmount || 0))[0]
      const topSender = incoming.sort((a, b) => (b.netAmount || 0) - (a.netAmount || 0))[0]

      const topRecipientName = topRecipient
        ? (positionedNodes.find(n => String(n.userId) === String(topRecipient.to)) || {}).nickname || '暂无'
        : null
      const topSenderName = topSender
        ? (positionedNodes.find(n => String(n.userId) === String(topSender.from)) || {}).nickname || '暂无'
        : null

      const details = {
        nickname: node.nickname,
        score: node.score || 0,
        isMe: String(node.userId) === String(myUserId),
        totalSent,
        totalReceived,
        netGain: totalReceived - totalSent,
        interactionCount: outgoing.length + incoming.length,
        topRecipientName: topRecipientName || '暂无明显送出对象',
        topRecipientAmount: topRecipient ? topRecipient.netAmount : null,
        topSenderName: topSenderName || '暂无明显获得来源',
        topSenderAmount: topSender ? topSender.netAmount : null
      }

      this.setData({ selectedNode: idx, nodeDetails: details })
    },

    onAvatarError(e) {
      const idx = e.currentTarget.dataset.index
      if (idx === undefined) return
      const key = `positionedNodes[${idx}].avatarUrl`
      this.setData({ [key]: '' })
    },

    closeDetail() {
      this.setData({ selectedNode: null, nodeDetails: null })
    }
  }
})
