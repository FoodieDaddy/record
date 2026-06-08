Component({
  data: {
    selected: 0,
    tabs: [
      {
        text: '编队',
        bay: '驾驶舱',
        kicker: 'COCKPIT',
        pagePath: '/pages/room/room',
        iconClass: 'icon-cockpit'
      },
      {
        text: '指令',
        bay: '导航舱',
        kicker: 'NAV',
        pagePath: '/pages/fortune/fortune',
        iconClass: 'icon-nav'
      },
      {
        text: '镜像',
        bay: '全息舱',
        kicker: 'HOLO',
        pagePath: '/pages/mirror/index',
        iconClass: 'icon-holo'
      },
      {
        text: '身份',
        bay: '识别舱',
        kicker: 'IDENTITY',
        pagePath: '/pages/profile/profile',
        iconClass: 'icon-identity'
      }
    ]
  },

  methods: {
    switchTab(e) {
      var index = e.currentTarget.dataset.index
      var path = e.currentTarget.dataset.path
      if (index === this.data.selected) return
      this.setData({ selected: index })
      wx.switchTab({ url: path })
    }
  }
})
