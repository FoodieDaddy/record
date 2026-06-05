Component({
  properties: {
    mostActiveUser: { type: Object, value: null },  // { nickname, count }
    mostFocusedUser: { type: Object, value: null },  // { nickname, count }
    networkDensity: { type: String, value: 'LOW' },  // HIGH/MEDIUM/LOW
    transferCount: { type: Number, value: 0 },
    memberCount: { type: Number, value: 0 }
  }
})
