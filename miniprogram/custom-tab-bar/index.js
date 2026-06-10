Component({
  data: {
    selected: 0,
    hidden: false,
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

  lifetimes: {
    attached() {
      this.syncFromPage();
    }
  },

  pageLifetimes: {
    show() {
      this.syncFromPage();
    }
  },

  methods: {
    syncFromPage() {
      var pages = getCurrentPages();
      if (pages.length === 0) return;
      var route = '/' + pages[pages.length - 1].route;
      var tabs = this.data.tabs;
      var matched = -1;
      for (var i = 0; i < tabs.length; i++) {
        if (route === tabs[i].pagePath || route.indexOf(tabs[i].pagePath) === 0) {
          matched = i;
          break;
        }
      }
      if (matched >= 0 && matched !== this.data.selected) {
        this.setData({ selected: matched });
      }
    },

    switchTab(e) {
      var index = e.currentTarget.dataset.index;
      var path = e.currentTarget.dataset.path;
      if (index === this.data.selected) return;
      this.setData({ selected: index });
      wx.switchTab({ url: path });
    },

    /** 隐藏 tabbar（全屏覆盖场景，如校准流） */
    hide() {
      this.setData({ hidden: true });
    },

    /** 显示 tabbar */
    show() {
      this.setData({ hidden: false });
    }
  }
})
