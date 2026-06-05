const app = getApp()

Component({
  properties: {
    nodes: { type: Array, value: [] },
    links: { type: Array, value: [] },
    width: { type: Number, value: 300 },
    height: { type: Number, value: 300 }
  },

  data: {
    ctx: null,
    canvasNode: null,
    positions: [],
    animFrame: 0
  },

  observers: {
    'nodes, links': function (nodes, links) {
      if (nodes && nodes.length > 0) {
        this.initSimulation()
      }
    }
  },

  lifetimes: {
    detached() {
      if (this._rafId) {
        cancelAnimationFrame(this._rafId)
      }
    }
  },

  methods: {
    initSimulation() {
      const { nodes, links, width, height } = this.data
      const reduceMotion = !app.globalData.animationEnabled
      const cx = width / 2
      const cy = height / 2

      let positions
      if (reduceMotion || nodes.length <= 1) {
        positions = nodes.map((n, i) => {
          const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2
          const r = Math.min(width, height) * 0.32
          return {
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle),
            vx: 0,
            vy: 0
          }
        })
        this.setData({ positions })
        this.initCanvas()
        return
      }

      positions = nodes.map(() => ({
        x: cx + (Math.random() - 0.5) * width * 0.5,
        y: cy + (Math.random() - 0.5) * height * 0.5,
        vx: 0,
        vy: 0
      }))
      this.setData({ positions })
      this.initCanvas()
      this.simulate()
    },

    initCanvas() {
      const query = this.createSelectorQuery()
      query.select('#forceGraphCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0]) return
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = wx.getWindowInfo().pixelRatio
          canvas.width = this.data.width * dpr
          canvas.height = this.data.height * dpr
          ctx.scale(dpr, dpr)
          this.setData({ ctx, canvasNode: canvas })
          this.draw()
        })
    },

    simulate() {
      const { nodes, links, positions, width, height } = this.data
      const n = nodes.length
      const damping = 0.9
      const repulsionK = 2000
      const springK = 0.005
      const restLength = 100
      const iterations = 80

      for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            let dx = positions[i].x - positions[j].x
            let dy = positions[i].y - positions[j].y
            let dist = Math.sqrt(dx * dx + dy * dy) || 1
            let force = repulsionK / (dist * dist)
            let fx = (dx / dist) * force
            let fy = (dy / dist) * force
            positions[i].vx += fx
            positions[i].vy += fy
            positions[j].vx -= fx
            positions[j].vy -= fy
          }
        }

        for (const link of links) {
          const fi = nodes.findIndex(nd => nd.userId === link.from)
          const fj = nodes.findIndex(nd => nd.userId === link.to)
          if (fi < 0 || fj < 0) continue
          let dx = positions[fj].x - positions[fi].x
          let dy = positions[fj].y - positions[fi].y
          let dist = Math.sqrt(dx * dx + dy * dy) || 1
          let force = springK * (dist - restLength)
          let fx = (dx / dist) * force
          let fy = (dy / dist) * force
          positions[fi].vx += fx
          positions[fi].vy += fy
          positions[fj].vx -= fx
          positions[fj].vy -= fy
        }

        const padding = 30
        for (let i = 0; i < n; i++) {
          positions[i].vx *= damping
          positions[i].vy *= damping
          positions[i].x += positions[i].vx
          positions[i].y += positions[i].vy
          positions[i].x = Math.max(padding, Math.min(width - padding, positions[i].x))
          positions[i].y = Math.max(padding, Math.min(height - padding, positions[i].y))
        }
      }

      this.setData({ positions })
      this.draw()
    },

    draw() {
      const { ctx, nodes, links, positions, width, height } = this.data
      if (!ctx) return

      ctx.clearRect(0, 0, width, height)

      for (const link of links) {
        const fi = nodes.findIndex(n => n.userId === link.from)
        const fj = nodes.findIndex(n => n.userId === link.to)
        if (fi < 0 || fj < 0) continue

        const p1 = positions[fi]
        const p2 = positions[fj]
        const lineWidth = Math.max(1, Math.min(4, Math.abs(link.count)))

        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.setStrokeStyle(link.netAmount > 0 ? 'rgba(10,132,255,0.5)' : 'rgba(255,90,90,0.5)')
        ctx.setLineWidth(lineWidth)
        ctx.stroke()
      }

      for (let i = 0; i < nodes.length; i++) {
        const p = positions[i]
        const node = nodes[i]
        const radius = Math.max(12, Math.min(28, 12 + Math.abs(node.score || 0) * 0.05))

        ctx.beginPath()
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
        ctx.setFillStyle('rgba(10,132,255,0.3)')
        ctx.fill()
        ctx.setStrokeStyle('rgba(10,132,255,0.6)')
        ctx.setLineWidth(1)
        ctx.stroke()

        ctx.setFillStyle('rgba(255,255,255,0.7)')
        ctx.setFontSize(10)
        ctx.setTextAlign('center')
        const name = node.nickname || '?'
        ctx.fillText(name.length > 4 ? name.slice(0, 4) + '..' : name, p.x, p.y + radius + 14)
      }
    },

    onTouchStart() {
      // 预留：节点拖拽交互
    }
  }
})
