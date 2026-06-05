Component({
  properties: {
    nodes: { type: Array, value: [] },
    links: { type: Array, value: [] },
    myUserId: { type: String, value: '' }
  },

  data: {
    graphWidth: 320,
    graphHeight: 320,
    selectedNode: null,
    nodeDetails: null
  },

  lifetimes: {
    ready() {
      const sysInfo = wx.getWindowInfo();
      const graphWidth = Math.min(sysInfo.windowWidth - 80, 360);
      this.setData({ graphWidth, graphHeight: graphWidth });
    }
  },

  methods: {
    onNodeTap(e) {
      const { nodes, links, myUserId } = this.data;
      const touch = e.touches[0];
      if (!touch) return;

      const x = touch.x;
      const y = touch.y;
      let closest = null;
      let minDist = Infinity;

      const fg = this.selectComponent('#scoreNetworkGraph');
      if (!fg || !fg.data.positions) return;

      fg.data.positions.forEach((pos, i) => {
        const dist = Math.sqrt((pos.x - x) ** 2 + (pos.y - y) ** 2);
        if (dist < minDist && dist < 40) {
          minDist = dist;
          closest = i;
        }
      });

      if (closest === null) {
        this.setData({ selectedNode: null, nodeDetails: null });
        return;
      }

      const node = nodes[closest];
      const outgoing = links.filter(l => l.from === node.userId);
      const incoming = links.filter(l => l.to === node.userId);
      const totalSent = outgoing.reduce((s, l) => s + l.netAmount, 0);
      const totalReceived = incoming.reduce((s, l) => s + l.netAmount, 0);
      const topRecipient = outgoing.sort((a, b) => b.netAmount - a.netAmount)[0];
      const topSender = incoming.sort((a, b) => b.netAmount - a.netAmount)[0];

      const details = {
        nickname: node.nickname,
        score: node.score,
        isMe: String(node.userId) === String(myUserId),
        totalSent,
        totalReceived,
        netGain: totalReceived - totalSent,
        interactionCount: outgoing.length + incoming.length,
        topRecipientName: topRecipient ? (nodes.find(n => n.userId === topRecipient.to) || {}).nickname || '--' : '--',
        topSenderName: topSender ? (nodes.find(n => n.userId === topSender.from) || {}).nickname || '--' : '--'
      };

      this.setData({ selectedNode: closest, nodeDetails: details });
    },

    closeDetail() {
      this.setData({ selectedNode: null, nodeDetails: null });
    }
  }
})
